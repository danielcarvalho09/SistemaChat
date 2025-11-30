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
   * ✅ IMPORTANTE: Funciona completamente independente do frontend
   */
  private async keepBaileysConnectionsAlive(): Promise<void> {
    try {
      // Importar dinamicamente para evitar dependência circular
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      const { BufferJSON } = await import('@whiskeysockets/baileys');
      
      const prisma = getPrismaClient();
      
      // ✅ Buscar TODAS as conexões que têm credenciais válidas (podem estar desconectadas)
      const allConnections = await prisma.whatsAppConnection.findMany({
        where: {
          isActive: true,
          authData: { not: null },
        },
        select: {
          id: true,
          phoneNumber: true,
          status: true,
          authData: true,
        },
      });

      if (allConnections.length === 0) {
        logger.debug('💓 No Baileys connections with credentials found');
        return;
      }

      logger.debug(`💓 Checking ${allConnections.length} Baileys connection(s) with credentials...`);
      
      // Para cada conexão com credenciais, verificar se precisa reconectar
      for (const connection of allConnections) {
        try {
          // ✅ Verificar se tem credenciais válidas (creds.me.id existe)
          let hasValidCredentials = false;
          if (connection.authData && typeof connection.authData === 'string' && connection.authData.trim() !== '') {
            try {
              const authData = JSON.parse(connection.authData, BufferJSON.reviver);
              hasValidCredentials = !!(authData.creds && authData.creds.me && authData.creds.me.id);
            } catch (parseError) {
              logger.warn(`⚠️ Invalid authData format for connection ${connection.id}`);
              continue; // Pular se não conseguir parsear
            }
          }

          if (!hasValidCredentials) {
            logger.debug(`⏭️ Connection ${connection.id} has no valid credentials, skipping`);
            continue;
          }

          const client = baileysManager.getClient(connection.id);
          
          // ✅ CRÍTICO: Verificar se já está conectado ANTES de tentar qualquer coisa
          if (client && client.status === 'connected') {
            logger.debug(`✅ Baileys connection ${connection.id} (${connection.phoneNumber}) is already connected - skipping keep-alive reconnection`);
            
            // Apenas verificar heartbeat se estiver conectado
            const secondsSinceHeartbeat = client.lastHeartbeat
              ? Math.floor((Date.now() - client.lastHeartbeat.getTime()) / 1000)
              : null;
            
            if (secondsSinceHeartbeat !== null && secondsSinceHeartbeat > 120) {
              logger.warn(`⚠️ Baileys connection ${connection.id} heartbeat is stale (${secondsSinceHeartbeat}s ago) but status is connected - monitoring`);
            } else {
              logger.debug(`✅ Baileys connection ${connection.id} (${connection.phoneNumber}) is alive and healthy`);
            }
            continue; // Pular para próxima conexão - não tentar reconectar
          }

          // ✅ CRÍTICO: Verificar se já está conectando/reconectando ANTES de tentar reconectar
          if (client && (client.status === 'connecting' || client.isReconnecting)) {
            logger.debug(`⏳ Baileys connection ${connection.id} (${connection.phoneNumber}) is already ${client.status} - skipping keep-alive reconnection`);
            continue; // Pular para próxima conexão - não tentar reconectar enquanto já está conectando
          }

          // ✅ CRÍTICO: Verificar status no banco ANTES de tentar reconectar
          // Se status no banco é 'connected' ou 'connecting', não tentar reconectar
          if (connection.status === 'connected') {
            logger.debug(`✅ Connection ${connection.id} status in DB is 'connected' - skipping keep-alive reconnection`);
            continue;
          }
          
          if (connection.status === 'connecting') {
            logger.debug(`⏳ Connection ${connection.id} status in DB is 'connecting' - skipping keep-alive reconnection (already in progress)`);
            continue;
          }
          
          // ✅ Caso 1: Cliente não existe mas deveria estar conectado (tem credenciais)
          if (!client) {
            // ✅ Só tentar reconectar se status for 'disconnected' e não estiver em 'connecting' no banco
            if (connection.status === 'disconnected') {
              logger.info(`🔄 Connection ${connection.id} (${connection.phoneNumber}) is disconnected but has valid credentials - attempting auto-reconnect...`);
              try {
                const result = await baileysManager.manualReconnect(connection.id);
                
                // ✅ Verificar resultado - se já está conectado/conectando, não tentar novamente
                if (result.status === 'already_connected' || result.status === 'already_reconnecting') {
                  logger.debug(`✅ Connection ${connection.id} is already ${result.status} - keep-alive skipping`);
                } else {
                  logger.info(`✅ Auto-reconnection initiated for ${connection.id}: ${result.status}`);
                }
              } catch (reconnectError: any) {
                logger.error(`❌ Failed to auto-reconnect ${connection.id}:`, reconnectError?.message || reconnectError);
              }
            }
            // ✅ Removido: Caso de status 'connected'/'connecting' no banco mas sem cliente
            // Se status no banco é 'connected' ou 'connecting', não tentar reconectar (já verificado acima)
          } 
          // ✅ Caso 2: Cliente existe mas não está conectado (e não está conectando)
          else if (client.status !== 'connected' && client.status !== 'connecting' && !client.isReconnecting) {
            logger.warn(`💔 Baileys connection ${connection.id} (${connection.phoneNumber}) has client but status is ${client.status} - attempting reconnect...`);
            if (client.hasCredentials || hasValidCredentials) {
              try {
                const result = await baileysManager.manualReconnect(connection.id);
                
                if (result.status === 'already_connected' || result.status === 'already_reconnecting') {
                  logger.debug(`✅ Connection ${connection.id} is already ${result.status} - keep-alive skipping`);
                } else {
                  logger.info(`🔄 Reconnection attempted for ${connection.id}: ${result.status}`);
                }
              } catch (reconnectError: any) {
                logger.error(`❌ Failed to reconnect ${connection.id}:`, reconnectError?.message || reconnectError);
              }
            }
          } 
          // ✅ Caso 3: Status desconhecido ou inválido
          else {
            logger.debug(`ℹ️ Baileys connection ${connection.id} (${connection.phoneNumber}) status: ${client.status}, isReconnecting: ${client.isReconnecting} - monitoring`);
          }
        } catch (connectionError: any) {
          logger.error(`❌ Error checking Baileys connection ${connection.id}:`, connectionError?.message || connectionError);
        }
      }
    } catch (error: any) {
      logger.error('❌ Error in keepBaileysConnectionsAlive (non-fatal):', error?.message || error);
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

