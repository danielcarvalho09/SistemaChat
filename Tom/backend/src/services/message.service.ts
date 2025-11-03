import { getPrismaClient } from '../config/database.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getSocketServer } from '../websocket/socket.server.js';
import { MessageResponse, SendMessageRequest, PaginatedResponse, PaginationParams } from '../models/types.js';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';
import { MessageRepository, IMessageRepository } from '../repositories/message.repository.js';
import { CacheService } from './cache.service.js';
import { getRedisClient } from '../config/redis.js';

export class MessageService {
  private prisma = getPrismaClient();
  private repository: IMessageRepository;
  private cache: CacheService;

  constructor() {
    this.repository = new MessageRepository(this.prisma);
    this.cache = new CacheService(getRedisClient());
  }

  /**
   * Lista mensagens de uma conversa
   */
  async listMessages(
    conversationId: string,
    userId: string,
    userRoles: string[],
    params: PaginationParams
  ): Promise<PaginatedResponse<MessageResponse>> {
    const { page = 1, limit = 50, sortOrder = 'asc' } = params;
    const skip = (page - 1) * limit;

    // Verificar acesso à conversa
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && conversation.assignedUserId !== userId && conversation.status !== 'waiting') {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    // Cache key baseado em conversationId + params
    const cacheKey = `messages:${conversationId}:page${page}:limit${limit}:${sortOrder}`;
    
    // Tentar buscar do cache primeiro
    const cached = await this.cache.get<PaginatedResponse<MessageResponse>>(cacheKey, { ttl: 60 }); // 1 min cache
    if (cached) {
      logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { timestamp: sortOrder },
        include: {
          sender: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    const result = {
      data: messages.map(this.formatMessageResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };

    // Cachear resultado
    await this.cache.set(cacheKey, result, { ttl: 60 }); // 1 minuto
    
    return result;
  }

  /**
   * Envia mensagem
   */
  async sendMessage(data: SendMessageRequest, userId: string, userRoles: string[] = []): Promise<MessageResponse> {
    const { conversationId, content, messageType = 'text', mediaUrl } = data;

    // Buscar conversa
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        connection: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Buscar informações do usuário que está enviando
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Verificar permissão
    const isAdmin = userRoles.includes('admin');
    const isAssigned = conversation.assignedUserId === userId;
    const isWaiting = conversation.status === 'waiting';
    const isTransferredToUser = conversation.status === 'transferred' && conversation.assignedUserId === userId;

    // Admin pode enviar em QUALQUER conversa (não precisa estar atribuída a ele)
    // Usuário comum só pode enviar se:
    // 1. Conversa está atribuída a ele, OU
    // 2. Conversa está em waiting (e será atribuída a ele), OU
    // 3. Conversa foi transferida para ele (status transferred + assignedUserId)
    if (!isAdmin) {
      if (!isAssigned && !isWaiting && !isTransferredToUser) {
        throw new ForbiddenError('You can only send messages in conversations assigned to you, in waiting status, or transferred to you');
      }
    }

    // Atribuir conversa ao usuário que está respondendo APENAS se:
    // 1. Conversa está em waiting (sem atribuição), OU
    // 2. Conversa está em transferred (foi transferida e precisa ser aceita), OU
    // 3. Conversa não tem ninguém atribuído
    // Se admin envia em conversa já atribuída a outro usuário, NÃO reatribui
    const isTransferred = conversation.status === 'transferred';
    
    // Aceitar automaticamente somente se estiver em 'waiting' ou sem atendente
    if (conversation.status === 'waiting' || !conversation.assignedUserId) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          assignedUserId: userId,
          status: 'in_progress',
        },
      });
    }

    // Se estiver 'transferred', NÃO alterar conexão aqui. O fluxo correto é aceitar a conversa pela rota específica.

    // Formatar mensagem com nome do usuário em negrito (WhatsApp usa *texto* para negrito)
    const userName = user?.name || 'Atendente';
    const formattedContent = `*${userName}:*\n${content}`;

    // Verificar se a conexão está ativa
    const isConnectionActive = baileysManager.isConnectionActive(conversation.connectionId);
    
    if (!isConnectionActive) {
      logger.error(`❌ Connection ${conversation.connectionId} is not active. Cannot send message.`);
      
      // Buscar info da conexão
      const connectionInfo = await this.prisma.whatsAppConnection.findUnique({
        where: { id: conversation.connectionId },
        select: { name: true, phoneNumber: true, status: true },
      });
      
      throw new Error(
        `WhatsApp connection "${connectionInfo?.name}" (${connectionInfo?.phoneNumber}) is not connected. ` +
        `Status: ${connectionInfo?.status}. Please connect it first.`
      );
    }

    // Enviar via WhatsApp usando Baileys
    let externalId: string | undefined;
    try {
      logger.info(`📤 Sending message from user ${userName} (${userId}) to ${conversation.contact.phoneNumber} via connection ${conversation.connectionId}`);
      
      if (messageType === 'text') {
        externalId = await baileysManager.sendMessage(
          conversation.connectionId,
          conversation.contact.phoneNumber,
          formattedContent,
          'text'
        );
      } else if (mediaUrl) {
        externalId = await baileysManager.sendMessage(
          conversation.connectionId,
          conversation.contact.phoneNumber,
          { url: mediaUrl, caption: formattedContent },
          messageType as 'image' | 'audio' | 'video' | 'document'
        );
      }
      
      logger.info(`✅ Message sent successfully via WhatsApp (id: ${externalId || 'n/a'})`);
    } catch (error) {
      logger.error('❌ Error sending WhatsApp message:', error);
      throw new Error(`Failed to send WhatsApp message: ${(error as Error).message}`);
    }

    // Salvar mensagem no banco
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        connectionId: conversation.connectionId,
        senderId: userId,
        content,
        messageType,
        mediaUrl,
        status: 'sent',
        isFromContact: false,
        timestamp: new Date(),
        externalId: externalId,
      },
      include: {
        sender: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
      },
    });

    // Atualizar conversa
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        firstResponseAt: conversation.firstResponseAt || new Date(),
      },
    });

    // Invalidar cache de mensagens desta conversa
    await this.cache.invalidatePattern(`messages:${conversationId}:*`);
    logger.debug(`Cache invalidated for conversation ${conversationId}`);

    logger.info(`[MessageService] ✅ Message processed for conversation ${conversation.id}`);

    // Emitir evento via Socket.IO para notificar frontend em tempo real
    try {
      const socketServer = getSocketServer();
      const formattedMessage = this.formatMessageResponse(message);
      
      socketServer.emitNewMessage(conversationId, formattedMessage);
      logger.info(`[MessageService] 📡 New message event emitted for conversation ${conversationId}`);
    } catch (socketError) {
      logger.error('[MessageService] ❌ Error emitting socket event:', socketError);
    }

    return this.formatMessageResponse(message);
  }

  /**
   * Atualiza status da mensagem
   */
  async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed'
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
  }

  /**
   * Processa mensagem recebida do WhatsApp
   */
  async processIncomingMessage(
    connectionId: string,
    from: string,
    messageText: string,
    messageType: string = 'text',
    mediaUrl: string | null = null,
    isFromMe: boolean = false,
    externalId?: string,
    pushName?: string | null
  ): Promise<void> {
    try {
      // 🔒 DEDUPLICAÇÃO: Verificar se mensagem já foi processada
      if (externalId) {
        const existingMessage = await this.prisma.message.findFirst({
          where: {
            externalId,
            connectionId,
          },
        });

        if (existingMessage) {
          logger.info(`[MessageService] ⏭️ Message ${externalId} already exists, skipping duplicate`);
          return; // Não processar duplicata
        }
      } else {
        logger.warn(`[MessageService] ⚠️ Message without externalId received from ${from} - cannot deduplicate`);
      }
      // Verificar se é um grupo
      const isGroup = from.endsWith('@g.us');
      
      // Normalizar número de telefone/ID do grupo
      const phoneNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');

      // Buscar ou criar contato
      let contact = await this.prisma.contact.findUnique({
        where: { phoneNumber },
      });

      if (!contact) {
        // Se for grupo, tentar buscar o nome do grupo
        let contactName = phoneNumber;
        
        if (isGroup) {
          try {
            const client = baileysManager['clients'].get(connectionId);
            
            if (client?.socket) {
              const groupMetadata = await client.socket.groupMetadata(from);
              contactName = groupMetadata.subject || phoneNumber;
              logger.info(`[MessageService] 📱 Group name: ${contactName}`);
            }
          } catch (error) {
            logger.warn(`[MessageService] Could not fetch group name:`, error);
          }
        }
        
        contact = await this.prisma.contact.create({
          data: {
            phoneNumber,
            name: contactName,
            pushName: pushName || null, // Salvar pushName do WhatsApp
          },
        });
        logger.info(`New contact created: ${phoneNumber} (${contactName}) - pushName: ${pushName || 'N/A'}`);
      } else if (pushName && contact.pushName !== pushName) {
        // Atualizar pushName se mudou
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { pushName },
        });
        logger.info(`[MessageService] 📝 Updated pushName for ${phoneNumber}: ${pushName}`);
        contact.pushName = pushName; // Atualizar objeto em memória
      }

      // 🔍 Buscar conversa existente para este contato e conexão
      // PRIORIDADE 1: Buscar por (contato + conexão + status ativo)
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          connectionId,
          status: { in: ['waiting', 'in_progress', 'transferred'] },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      // PRIORIDADE 2: Se não encontrar, buscar conversa fechada recente (últimas 24h)
      // Isso permite reabrir conversas fechadas recentemente
      if (!conversation) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        conversation = await this.prisma.conversation.findFirst({
          where: {
            contactId: contact.id,
            connectionId,
            status: 'closed',
            lastMessageAt: { gte: yesterday },
          },
          orderBy: { lastMessageAt: 'desc' },
        });

        // Se encontrou conversa fechada, reabrir
        if (conversation) {
          logger.info(`[MessageService] 🔄 Reopening closed conversation ${conversation.id}`);
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: 'waiting' },
          });
        }
      }

      // Flag para saber se é conversa nova
      const isNewConversation = !conversation;

      if (!conversation) {
        // Verificar se a conexão existe no banco
        const connectionExists = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
        });

        if (!connectionExists) {
          logger.error(`Connection ${connectionId} not found in database. Cannot create conversation.`);
          throw new Error(`Connection ${connectionId} not found`);
        }

        // Buscar o usuário dono da conexão e pegar seu primeiro setor (NOVA LÓGICA)
        const connection = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
          include: {
            user: {
              include: {
                departmentAccess: {
                  include: { department: true },
                  take: 1,
                },
              },
            },
          },
        });

        const departmentId = connection?.user?.departmentAccess?.[0]?.departmentId || null;

        // Buscar etapa padrão do Kanban
        const defaultStage = await this.prisma.kanbanStage.findFirst({
          where: { isDefault: true },
        });

        // SEMPRE criar conversa como "Aguardando" (waiting)
        // Usuário deve aceitar manualmente
        conversation = await this.prisma.conversation.create({
          data: {
            contactId: contact.id,
            connectionId,
            departmentId,
            assignedUserId: null, // Não atribuir automaticamente
            kanbanStageId: defaultStage?.id || null, // Atribuir etapa padrão
            status: 'waiting', // Sempre aguardando
            lastMessageAt: new Date(),
          },
        });
        logger.info(`New conversation created: ${conversation.id} in department: ${departmentId || 'None'} (status: waiting)`);
      }

      // Se já recebemos esta mensagem (externalId), evitar duplicidade
      if (externalId) {
        const exists = await this.prisma.message.findFirst({
          where: { conversationId: conversation.id, externalId },
          select: { id: true },
        });
        if (exists) {
          logger.info(`Skipping duplicate message ${externalId} for conversation ${conversation.id}`);
          return;
        }
      }

      // Salvar mensagem
      // 💾 Salvar mensagem com proteção contra duplicatas
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          connectionId,
          content: messageText,
          messageType,
          isFromContact: !isFromMe, // true se veio do contato, false se foi enviado pelo sistema
          status: 'delivered',
          mediaUrl,
          externalId: externalId || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        },
      });
      
      logger.info(`[MessageService] 💾 Message saved: ${message.id} (external: ${message.externalId})`);

      // Atualizar conversa
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          // Incrementar unreadCount apenas para mensagens do contato
          ...(isFromMe ? {} : { unreadCount: { increment: 1 } }),
        },
      });

      logger.info(`[MessageService] ✅ Message processed for conversation ${conversation.id}`);

      // 🤖 Verificar se deve responder com IA automaticamente
      // IMPORTANTE: IA só responde conversas em atendimento (in_progress) DA SUA PRÓPRIA CONEXÃO
      if (!isFromMe && conversation.status === 'in_progress') {
        const connectionWithAI = await this.prisma.whatsAppConnection.findUnique({
          where: { id: connectionId },
          select: { aiEnabled: true, aiAssistantId: true },
        });

        // Verificar se a conversa pertence à mesma conexão que tem IA habilitada
        const conversationBelongsToConnection = conversation.connectionId === connectionId;

        if (connectionWithAI?.aiEnabled && connectionWithAI?.aiAssistantId && conversationBelongsToConnection) {
          try {
            logger.info(`[MessageService] 🤖 AI is enabled for connection ${connectionId}, conversation is in_progress and belongs to this connection, generating response...`);
            
            const { AIService } = await import('./ai.service.js');
            const aiService = new AIService();
            
            const aiResponse = await aiService.generateResponse(
              conversation.id,
              messageText,
              connectionWithAI.aiAssistantId
            );
            
            // Enviar resposta da IA automaticamente
            const { MessageType } = await import('../models/types.js');
            await this.sendMessage(
              {
                conversationId: conversation.id,
                content: aiResponse,
                messageType: MessageType.TEXT,
              },
              'system', // Usuário "system" para identificar mensagens da IA
              [] // Sem roles específicas
            );
            
            logger.info(`[MessageService] 🤖 AI response sent successfully`);
          } catch (aiError) {
            logger.error(`[MessageService] ❌ Error generating AI response:`, aiError);
            // Não falhar o processamento da mensagem se a IA falhar
          }
        }
      } else if (!isFromMe && conversation.status !== 'in_progress') {
        logger.debug(`[MessageService] ⏭️ Skipping AI response - conversation status is '${conversation.status}' (only responds to 'in_progress')`);
      }

      // Emitir evento via Socket.IO para notificar frontend
      try {
        const socketServer = getSocketServer();
        const formattedMessage = this.formatMessageResponse(message);
        
        // Emitir nova mensagem formatada
        socketServer.emitNewMessage(conversation.id, formattedMessage);
        logger.info(`[MessageService] 📡 New message event emitted for conversation ${conversation.id}`);
        
        // Só emitir new_conversation se for realmente uma conversa nova
        if (isNewConversation) {
          // Buscar conversa completa com todos os dados
          const fullConversation = await this.prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: {
              contact: true,
              connection: true,
              department: true,
              assignedUser: true,
            },
          });

          if (fullConversation) {
            // Emitir nova conversa para todos os usuários
            socketServer.getIO().emit('new_conversation', fullConversation);
            logger.info(`[MessageService] 🆕 New conversation event emitted: ${conversation.id}`);
          }
        } else {
          logger.info(`Existing conversation, skipping new_conversation event`);
        }
      } catch (socketError) {
        logger.error('Error emitting socket event:', socketError);
        // Não falhar se socket não estiver disponível
      }
    } catch (error) {
      logger.error(`[MessageService] ❌ Error processing incoming message from ${from}:`, error);
      logger.error(`[MessageService] 📊 Error details:`, {
        connectionId,
        from,
        messageType,
        externalId,
        isFromMe,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Formata resposta da mensagem
   */
  private formatMessageResponse(message: any): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender
        ? {
            id: message.sender.id,
            email: message.sender.email,
            name: message.sender.name,
            avatar: message.sender.avatar,
            status: message.sender.status,
            isActive: message.sender.isActive,
            roles: message.sender.roles.map((ur: any) => ({
              id: ur.role.id,
              name: ur.role.name,
              description: ur.role.description,
            })),
            createdAt: message.sender.createdAt.toISOString(),
            updatedAt: message.sender.updatedAt.toISOString(),
          }
        : null,
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      status: message.status,
      isFromContact: message.isFromContact,
      timestamp: message.timestamp.toISOString(),
      createdAt: message.createdAt.toISOString(),
    };
  }
}
