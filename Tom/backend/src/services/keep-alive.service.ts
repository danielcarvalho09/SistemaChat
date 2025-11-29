import { logger } from '../config/logger.js';
import { getPrismaClient } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { config } from '../config/env.js';
import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Serviço de Keep-Alive
 * 
 * Previne que o Railway/Heroku coloque a aplicação em sleep fazendo:
 * 1. Health checks internos periódicos
 * 2. Queries ao banco de dados
 * 3. Ping ao Redis
 * 4. Auto-ping no próprio endpoint /health
 * 
 * Railway entra em sleep após ~15 minutos de inatividade.
 * Este serviço mantém a aplicação "viva" fazendo atividade a cada 5 minutos.
 */

export class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly INTERVAL_MS = 5 * 60 * 1000; // 5 minutos (menor que 15min do Railway)

  /**
   * Inicia o serviço de keep-alive
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Keep-alive service already running');
      return;
    }

    logger.info(`🔄 Starting keep-alive service (interval: ${this.INTERVAL_MS / 1000 / 60} minutes)`);
    
    this.isRunning = true;
    
    // Executar imediatamente na primeira vez
    this.performKeepAlive();
    
    // Depois executar a cada intervalo
    this.intervalId = setInterval(() => {
      this.performKeepAlive();
    }, this.INTERVAL_MS);
  }

  /**
   * Para o serviço de keep-alive
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('⏹️ Keep-alive service stopped');
  }

  /**
   * Executa atividades de keep-alive
   */
  private async performKeepAlive(): Promise<void> {
    try {
      logger.debug('💓 Keep-alive heartbeat...');
      
      // 1. Query simples ao banco (mantém conexão ativa)
      await this.keepDatabaseAlive();
      
      // 2. Ping ao Redis (mantém conexão ativa)
      await this.keepRedisAlive();
      
      // 3. Manter conexões Baileys ativas (CRÍTICO - independente do WebSocket)
      await this.keepBaileysConnectionsAlive();
      
      // 4. Self-ping ao próprio endpoint /health (se configurado)
      if (config.server.isProduction) {
        await this.selfPing();
      }
      
      logger.debug('✅ Keep-alive completed');
    } catch (error) {
      logger.error('❌ Keep-alive error (non-fatal):', error);
      // Não parar o serviço por erros de keep-alive
    }
  }

  /**
   * Mantém conexões Baileys ativas independentemente do WebSocket
   * Garante que as conexões continuem funcionando mesmo sem clientes WebSocket conectados
   */
  private async keepBaileysConnectionsAlive(): Promise<void> {
    try {
      // Importar dinamicamente para evitar dependência circular
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      
      // Obter todas as conexões ativas do banco que deveriam estar conectadas
      const prisma = getPrismaClient();
      const activeConnections = await prisma.whatsAppConnection.findMany({
        where: {
          status: 'connected',
        },
        select: {
          id: true,
          phoneNumber: true,
          status: true,
        },
      });

      if (activeConnections.length === 0) {
        logger.debug('💓 No active Baileys connections to keep alive');
        return;
      }

      logger.debug(`💓 Keeping ${activeConnections.length} Baileys connection(s) alive...`);
      
      // Para cada conexão que deveria estar conectada, verificar se ainda está
      for (const connection of activeConnections) {
        try {
          const client = baileysManager.getClient(connection.id);
          
          if (!client) {
            logger.warn(`💔 Baileys connection ${connection.id} (${connection.phoneNumber}) should be connected but client not found - attempting reconnect...`);
            // Tentar reconectar se deveria estar conectado mas não está
            try {
              // ✅ Usar manualReconnect que é público e trata o caso de não ter cliente
              await baileysManager.manualReconnect(connection.id);
              logger.info(`✅ Reconnected Baileys connection ${connection.id}`);
            } catch (reconnectError) {
              logger.error(`❌ Failed to reconnect Baileys connection ${connection.id}:`, reconnectError);
            }
          } else if (client.status !== 'connected') {
            logger.warn(`💔 Baileys connection ${connection.id} (${connection.phoneNumber}) status is ${client.status} but should be connected`);
            // Se tem credenciais mas não está conectado, tentar reconectar
            if (client.hasCredentials) {
              try {
                // ✅ Usar manualReconnect que é público (attemptReconnection é privado)
                await baileysManager.manualReconnect(connection.id);
                logger.info(`🔄 Attempted reconnection for ${connection.id}`);
              } catch (reconnectError) {
                logger.error(`❌ Failed to attempt reconnection for ${connection.id}:`, reconnectError);
              }
            }
          } else {
            // Conexão está ativa e conectada - verificar se heartbeat está funcionando
            const secondsSinceHeartbeat = client.lastHeartbeat
              ? Math.floor((Date.now() - client.lastHeartbeat.getTime()) / 1000)
              : null;
            
            if (secondsSinceHeartbeat !== null && secondsSinceHeartbeat > 120) {
              logger.warn(`⚠️ Baileys connection ${connection.id} heartbeat is stale (${secondsSinceHeartbeat}s ago) - connection may be dead`);
            } else {
              logger.debug(`✅ Baileys connection ${connection.id} is alive and healthy`);
            }
          }
        } catch (connectionError) {
          logger.error(`❌ Error checking Baileys connection ${connection.id}:`, connectionError);
        }
      }
    } catch (error) {
      logger.error('❌ Error in keepBaileysConnectionsAlive (non-fatal):', error);
      // Não propagar erro - keep-alive não deve falhar por causa de Baileys
    }
  }

  /**
   * Mantém banco de dados ativo com query simples
   */
  private async keepDatabaseAlive(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      // Query mínima que não faz nada, apenas mantém conexão ativa
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      logger.warn('Database keep-alive failed:', error);
      throw error;
    }
  }

  /**
   * Mantém Redis ativo com ping
   */
  private async keepRedisAlive(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.ping();
    } catch (error) {
      logger.warn('Redis keep-alive failed:', error);
      throw error;
    }
  }

  /**
   * Faz self-ping no próprio endpoint de health
   * Só funciona em produção (precisa da URL completa)
   */
  private async selfPing(): Promise<void> {
    const healthUrl = process.env.HEALTH_CHECK_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
    
    if (!healthUrl) {
      // Em desenvolvimento, não fazer self-ping (não tem URL pública)
      return;
    }

    try {
      const urlString = healthUrl.startsWith('http') 
        ? `${healthUrl}/health` 
        : `https://${healthUrl}/health`;
      
      const url = new URL(urlString);
      const client = url.protocol === 'https:' ? https : http;
      
      // Criar promise para requisição HTTP
      await new Promise<void>((resolve, reject) => {
        let timeout: NodeJS.Timeout;
        
        const req = client.get(urlString, {
          headers: {
            'User-Agent': 'KeepAliveService/1.0',
          },
        }, (res) => {
          if (timeout) clearTimeout(timeout);
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve();
          } else {
            logger.warn(`Self-ping returned ${res.statusCode}`);
            resolve(); // Resolve mesmo assim (não crítico)
          }
        });
        
        timeout = setTimeout(() => {
          req.destroy();
          reject(new Error('Self-ping timeout (5s)'));
        }, 5000);
        
        req.on('error', (error) => {
          if (timeout) clearTimeout(timeout);
          reject(error);
        });
        
        req.end();
      });
    } catch (error) {
      // Self-ping pode falhar (ex: DNS, rede)
      // Não é crítico, apenas logamos
      logger.debug('Self-ping failed (non-critical):', error);
    }
  }

  /**
   * Verifica se o serviço está rodando
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const keepAliveService = new KeepAliveService();

