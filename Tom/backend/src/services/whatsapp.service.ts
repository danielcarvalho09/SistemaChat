import { getPrismaClient } from '../config/database.js';
import { baileysManager, ClientCreationInProgressError } from '../whatsapp/baileys.manager.js';
import { logger } from '../config/logger.js';
import { NotFoundError, ConflictError } from '../middlewares/error.middleware.js';
import { BufferJSON } from '@whiskeysockets/baileys';

/**
 * Serviço de gerenciamento de conexões WhatsApp
 */
export class WhatsAppService {
  private prisma = getPrismaClient();

  /**
   * Cria nova conexão WhatsApp
   * NOVA LÓGICA: Conexões agora são associadas a usuários, não a departamentos
   */
  async createConnection(data: {
    name: string;
    phoneNumber: string;
    userId?: string; // Opcionalmente já associar a um usuário
    isMatriz?: boolean;
  }) {
    try {
      // Verificar se número já existe
      const existing = await this.prisma.whatsAppConnection.findUnique({
        where: { phoneNumber: data.phoneNumber },
      });

      if (existing) {
        throw new ConflictError('Phone number already registered');
      }

      // Criar conexão
      const connection = await this.prisma.whatsAppConnection.create({
        data: {
          name: data.name,
          phoneNumber: data.phoneNumber,
          status: 'disconnected',
          isActive: true,
          isMatriz: data.isMatriz || false,
          userId: data.userId || null,
        },
      });

      logger.info(`[WhatsApp] Connection created: ${connection.id}`);
      return connection;
    } catch (error) {
      logger.error('[WhatsApp] Error creating connection:', error);
      throw error;
    }
  }

  /**
   * Lista todas as conexões
   */
  async listConnections() {
    try {
      const connections = await this.prisma.whatsAppConnection.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return connections;
    } catch (error) {
      logger.error('[WhatsApp] Error listing connections:', error);
      throw error;
    }
  }

  /**
   * Busca conexão por ID
   */
  async getConnectionById(connectionId: string) {
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      return connection;
    } catch (error) {
      logger.error(`[WhatsApp] Error getting connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza conexão
   */
  async updateConnection(
    connectionId: string,
    data: {
      name?: string;
      userId?: string | null; // Associar/desassociar usuário
      isMatriz?: boolean;
    }
  ) {
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      // Atualizar conexão
      const updated = await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data: {
          name: data.name,
          userId: data.userId,
          isMatriz: data.isMatriz,
        },
      });

      logger.info(`[WhatsApp] Connection updated: ${connectionId}`);
      return updated;
    } catch (error) {
      logger.error(`[WhatsApp] Error updating connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Conecta uma conexão (inicia Baileys e gera QR Code)
   */
  async connectConnection(connectionId: string) {
    try {
      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { id: true, authData: true, status: true },
      });

      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      // Verificar se já está conectado ANTES de tentar criar
      const existingClient = baileysManager.getClient(connectionId);
      if (existingClient && existingClient.status === 'connected') {
        logger.info(`[WhatsApp] Connection ${connectionId} already connected`);
        return {
          connectionId,
          status: 'connected',
          message: 'Already connected',
        };
      }

      // ✅ Verificar se há credenciais válidas ANTES de tentar conectar
      // Se tiver credenciais válidas e estiver desconectada, usar reconexão automática
      let hasValidCredentials = false;
      if (connection.authData && connection.authData !== null && connection.authData !== '') {
        try {
          const authDataString = connection.authData as string;
          if (authDataString.trim() !== '') {
            const authData = JSON.parse(authDataString, BufferJSON.reviver);
            // ✅ Credenciais válidas = têm creds.me.id (já conectou antes)
            hasValidCredentials = !!(authData.creds && authData.creds.me && authData.creds.me.id);
            
            if (hasValidCredentials) {
              const meId = authData.creds.me.id;
              logger.info(`[WhatsApp] ✅ Credenciais VÁLIDAS encontradas para ${connectionId} (me.id: ${meId})`);
              logger.info(`[WhatsApp] 💡 Conexão já foi conectada antes - usando reconexão automática sem QR code`);
            } else {
              logger.info(`[WhatsApp] ⚠️ AuthData existe mas credenciais são INVÁLIDAS para ${connectionId} (sem creds.me.id)`);
              logger.info(`[WhatsApp] 💡 QR code será gerado`);
            }
          }
        } catch (parseError) {
          logger.warn(`[WhatsApp] ⚠️ Erro ao verificar credenciais para ${connectionId}:`, parseError);
        }
      }

      // ✅ Se tem credenciais válidas e está desconectada, usar reconexão automática
      if (hasValidCredentials && (connection.status === 'disconnected' || !connection.status)) {
        logger.info(`[WhatsApp] 🔄 Conexão ${connectionId} tem credenciais válidas - usando reconexão automática...`);
        
        try {
          const reconnectResult = await baileysManager.manualReconnect(connectionId);
          logger.info(`[WhatsApp] ✅ Reconexão automática iniciada para ${connectionId}: ${reconnectResult.status}`);
          
          return {
            connectionId,
            status: reconnectResult.status,
            qrCode: undefined, // Não precisa de QR code se tem credenciais
            message: reconnectResult.message || 'Reconectando usando credenciais guardadas...',
          };
        } catch (reconnectError) {
          logger.error(`[WhatsApp] ❌ Erro na reconexão automática para ${connectionId}:`, reconnectError);
          // Se falhar a reconexão, tentar criar cliente normalmente (vai gerar QR code)
          logger.info(`[WhatsApp] 🔄 Tentando criar cliente normalmente (vai gerar QR code)...`);
        }
      }

      // Se não tem credenciais válidas ou reconexão falhou, criar cliente normalmente
      // Criar cliente Baileys (QR Code será emitido via Socket.IO)
      logger.info(`[WhatsApp] Connecting ${connectionId}...`);
      
      try {
        await baileysManager.createClient(connectionId);
        
        return {
          connectionId,
          status: 'connecting',
          message: 'Connection initiated. QR Code will be sent via WebSocket.',
        };
      } catch (error) {
        // Se for erro de criação em progresso, retornar status apropriado (não é um erro crítico)
        if (error instanceof ClientCreationInProgressError) {
          logger.info(`[WhatsApp] Connection ${connectionId} creation already in progress - returning status`);
          return {
            connectionId,
            status: 'connecting',
            message: 'Conexão já está em andamento. Aguarde alguns segundos...',
          };
        }
        
        // Outros erros devem ser propagados
        logger.error(`[WhatsApp] Error connecting ${connectionId}:`, error);
        throw error;
      }
    } catch (error) {
      // Tratar erros gerais (ex: NotFoundError)
      logger.error(`[WhatsApp] Error in connectConnection for ${connectionId}:`, error);
      throw error;
    }
  }

  async manualReconnectConnection(connectionId: string) {
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    const result = await baileysManager.manualReconnect(connectionId);

    if (['connecting', 'awaiting_qr', 'reconnecting'].includes(result.status)) {
      await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data: { status: 'connecting' },
      });
    }

    logger.info(`[WhatsApp] Manual reconnect response for ${connectionId}: ${result.status}`);

    return result;
  }

  /**
   * Reseta conexão e gera novo QR code (limpa credenciais corrompidas)
   */
  async resetConnection(connectionId: string) {
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    logger.info(`[WhatsApp] Resetting connection ${connectionId} - clearing credentials...`);

    // 1. Remover cliente atual (sem fazer logout, pois sessão está inválida)
    await baileysManager.removeClient(connectionId, false);

    // 2. Limpar credenciais do banco
    await this.prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: {
        authData: null,
        status: 'disconnected',
      },
    });

    // 3. Criar novo cliente (vai gerar QR code)
    logger.info(`[WhatsApp] Creating new client for ${connectionId}...`);
    await baileysManager.createClient(connectionId);

    return {
      connectionId,
      status: 'awaiting_qr',
      message: 'Credenciais limpas. Novo QR code será gerado.',
    };
  }

  /**
   * Desconecta uma conexão
   */
  async disconnectConnection(connectionId: string) {
    try {
      await baileysManager.removeClient(connectionId, true); // true = fazer logout

      await this.prisma.whatsAppConnection.update({
        where: { id: connectionId },
        data: { status: 'disconnected' },
      });

      logger.info(`[WhatsApp] Connection disconnected: ${connectionId}`);
    } catch (error) {
      logger.error(`[WhatsApp] Error disconnecting ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Deleta uma conexão e TODOS os dados relacionados
   */
  async deleteConnection(connectionId: string) {
    try {
      logger.info(`[WhatsApp] Deleting connection ${connectionId} and all related data...`);

      // 1. Desconectar se estiver conectado
      await baileysManager.removeClient(connectionId, true); // true = fazer logout

      // 2. Deletar todas as mensagens desta conexão
      const deletedMessages = await this.prisma.message.deleteMany({
        where: { connectionId },
      });
      logger.info(`[WhatsApp] Deleted ${deletedMessages.count} messages`);

      // 3. Deletar todas as conversas desta conexão
      const deletedConversations = await this.prisma.conversation.deleteMany({
        where: { connectionId },
      });
      logger.info(`[WhatsApp] Deleted ${deletedConversations.count} conversations`);

      // 4. Deletar todos os contatos desta conexão (se não tiverem outras conversas)
      // Nota: Contatos podem ser compartilhados entre conexões, então não deletamos automaticamente

      // 5. Deletar a conexão (isso também limpa authData, sessionData, etc)
      // A relação com user é onDelete: SetNull, então não precisa fazer nada
      await this.prisma.whatsAppConnection.delete({
        where: { id: connectionId },
      });

      logger.info(`[WhatsApp] ✅ Connection ${connectionId} and all related data deleted successfully`);
    } catch (error) {
      logger.error(`[WhatsApp] ❌ Error deleting connection ${connectionId}:`, error);
      throw error;
    }
  }
}
