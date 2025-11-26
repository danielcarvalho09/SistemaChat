import { getPrismaClient } from '../config/database.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getSocketServer } from '../websocket/socket.server.js';
import { MessageResponse, SendMessageRequest, PaginatedResponse, PaginationParams, MessageType, MessageStatus } from '../models/types.js';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';

export class MessageService {
  private prisma = getPrismaClient();

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
          quotedMessage: {
            include: {
              sender: {
                include: {
                  roles: {
                    include: { role: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
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
  }

  /**
   * Envia mensagem
   */
  async sendMessage(data: SendMessageRequest, userId: string, userRoles: string[] = []): Promise<MessageResponse> {
    const { conversationId, content, messageType = 'text', mediaUrl, quotedMessageId } = data;

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

    let quotedMessage: any = null;
    if (quotedMessageId) {
      quotedMessage = await this.prisma.message.findUnique({
        where: { id: quotedMessageId },
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

      if (!quotedMessage) {
        throw new NotFoundError('Quoted message not found');
      }

      if (quotedMessage.conversationId !== conversationId) {
        throw new ForbiddenError('Cannot quote a message from another conversation');
      }
    }

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

    // ✅ OTIMIZAÇÃO: Salvar mensagem IMEDIATAMENTE com status "sending" para aparecer no frontend
    // Depois enviar via WhatsApp em background e atualizar status
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        connectionId: conversation.connectionId,
        senderId: userId,
        content,
        messageType,
        mediaUrl,
        status: 'sending', // ✅ Status inicial: "sending" (aparece imediatamente no frontend)
        isFromContact: false,
        timestamp: new Date(),
        externalId: null, // Será atualizado após envio
        quotedMessageId: quotedMessage?.id || null,
      },
      include: {
        sender: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
        quotedMessage: {
          include: {
            sender: {
              include: {
                roles: {
                  include: { role: true },
                },
              },
            },
          },
        },
      },
    });

    // Atualizar conversa IMEDIATAMENTE
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        firstResponseAt: conversation.firstResponseAt || new Date(),
      },
    });

    // ✅ Emitir evento WebSocket IMEDIATAMENTE (mensagem aparece no frontend antes de enviar)
    try {
      const socketServer = getSocketServer();
      if (socketServer) {
        const formattedMessage = this.formatMessageResponse(message);
        // Sobrescrever status para 'sending'
        formattedMessage.status = MessageStatus.SENDING;
        
        socketServer.emitNewMessage(conversationId, formattedMessage);
        logger.info(`[MessageService] 📡 Message event emitted IMMEDIATELY for conversation ${conversationId} (status: sending)`);
      }
    } catch (socketError) {
      logger.error('[MessageService] ❌ Error emitting socket event:', socketError);
    }

    // ✅ ENVIAR VIA WHATSAPP EM BACKGROUND (não bloqueia resposta)
    // Isso permite que a mensagem apareça imediatamente no frontend
    // ✅ IMPORTANTE: Usar .catch() para garantir que erros não sejam silenciados
    (async () => {
      try {
        logger.info(`📤 [BACKGROUND] Starting WhatsApp send for message ${message.id}`);
        logger.info(`📤 [BACKGROUND] Connection: ${conversation.connectionId}, Phone: ${conversation.contact.phoneNumber}`);
        logger.info(`📤 [BACKGROUND] Message type: ${messageType}, mediaUrl: ${mediaUrl || 'none'}`);
        
        // ✅ VERIFICAÇÃO: Verificar se conexão está disponível antes de enviar
        const connectionStatus = await this.prisma.whatsAppConnection.findUnique({
          where: { id: conversation.connectionId },
          select: { status: true },
        });
        
        if (!connectionStatus || connectionStatus.status !== 'connected') {
          throw new Error(`Connection ${conversation.connectionId} is not connected (status: ${connectionStatus?.status || 'not found'})`);
        }
        
        logger.info(`📤 [BACKGROUND] Connection verified: ${connectionStatus.status}`);
        
        let externalId: string | undefined;
        
        const quotedForSend = quotedMessage && quotedMessage.externalId
          ? {
              stanzaId: quotedMessage.externalId as string,
              messageId: quotedMessage.id,
              messageType: quotedMessage.messageType,
              content: quotedMessage.content,
              mediaUrl: quotedMessage.mediaUrl,
              isFromContact: quotedMessage.isFromContact,
              metadata: quotedMessage.metadata ?? null,
            }
          : undefined;

        if (quotedMessage && !quotedMessage.externalId) {
          logger.warn(`⚠️ [BACKGROUND] Quoted message ${quotedMessage.id} has no externalId - WhatsApp reply will be sent without reference`);
        }

        if (messageType === 'text') {
          logger.info(`📤 [BACKGROUND] Sending text message...`);
          externalId = await baileysManager.sendMessage(
            conversation.connectionId,
            conversation.contact.phoneNumber,
            formattedContent,
            'text',
            quotedForSend ? { quotedMessage: quotedForSend } : undefined
          );
          logger.info(`📤 [BACKGROUND] Text message sent, externalId: ${externalId || 'none'}`);
        } else if (mediaUrl) {
          logger.info(`📤 [BACKGROUND] Sending media message: type=${messageType}, url=${mediaUrl}`);
          
          // ✅ CORREÇÃO: Áudio não suporta caption no WhatsApp
          // Se houver texto E for áudio, enviar duas mensagens separadas
          // Verificar se content não é apenas o nome do arquivo (geralmente começa com "audio-" e tem extensão)
          const isLikelyFileName = /^audio-\d+\.(ogg|webm|mp3|wav|m4a)$/i.test(content);
          const hasRealText = content && content.trim() && !isLikelyFileName;
          
          if (messageType === 'audio' && hasRealText) {
            logger.info(`📤 [BACKGROUND] Audio with text detected - sending text first, then audio`);
            logger.info(`📤 [BACKGROUND] Content: "${content}" (isFileName: ${isLikelyFileName})`);
            
            // 1. Enviar mensagem de texto primeiro (com nome do usuário)
            const textExternalId = await baileysManager.sendMessage(
              conversation.connectionId,
              conversation.contact.phoneNumber,
              formattedContent,
              'text',
              quotedForSend ? { quotedMessage: quotedForSend } : undefined
            );
            logger.info(`📤 [BACKGROUND] Text message sent first, externalId: ${textExternalId || 'none'}`);
            
            // 2. Criar e salvar mensagem de texto no banco
            const textMessage = await this.prisma.message.create({
              data: {
                conversationId,
                connectionId: conversation.connectionId,
                senderId: userId,
                content,
                messageType: 'text',
                status: textExternalId ? 'sent' : 'failed',
                isFromContact: false,
                timestamp: new Date(),
                externalId: textExternalId || null,
                quotedMessageId: quotedMessage?.id || null,
              },
            });
            
            // 3. Atualizar externalId da mensagem de texto
            if (textExternalId) {
              await this.prisma.message.update({
                where: { id: textMessage.id },
                data: { externalId: textExternalId },
              });
            }
            
            // 4. Emitir evento WebSocket para a mensagem de texto
            try {
              const socketServer = getSocketServer();
              if (socketServer) {
                const formattedTextMessage = this.formatMessageResponse(textMessage);
                formattedTextMessage.status = textExternalId ? MessageStatus.SENT : MessageStatus.FAILED;
                socketServer.emitNewMessage(conversationId, formattedTextMessage);
              }
            } catch (socketError) {
              logger.error('[MessageService] ❌ Error emitting text message socket event:', socketError);
            }
            
            // 5. Aguardar um pouco antes de enviar o áudio
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 6. Enviar áudio sem caption
            externalId = await baileysManager.sendMessage(
              conversation.connectionId,
              conversation.contact.phoneNumber,
              { url: mediaUrl },
              'audio',
              undefined // Sem quoted message no áudio
            );
            logger.info(`📤 [BACKGROUND] Audio message sent, externalId: ${externalId || 'none'}`);
          } else {
            // Para outros tipos de mídia (image, video, document), usar caption normalmente
            const caption = (messageType === 'audio') ? undefined : formattedContent;
            externalId = await baileysManager.sendMessage(
              conversation.connectionId,
              conversation.contact.phoneNumber,
              { url: mediaUrl, caption },
              messageType as 'image' | 'audio' | 'video' | 'document',
              quotedForSend ? { quotedMessage: quotedForSend } : undefined
            );
            logger.info(`📤 [BACKGROUND] Media message sent, externalId: ${externalId || 'none'}`);
          }
        } else {
          throw new Error(`Invalid message type or missing mediaUrl for media message`);
        }
        
        if (!externalId) {
          logger.warn(`📤 [BACKGROUND] ⚠️ Message sent but no externalId returned - may not have been sent`);
        }
        
        // ✅ Atualizar mensagem com externalId e status "sent"
        await this.prisma.message.update({
          where: { id: message.id },
          data: {
            externalId,
            status: 'sent',
          },
        });
        
        logger.info(`✅ [BACKGROUND] Message ${message.id} updated to 'sent' status (externalId: ${externalId || 'none'})`);
        
        // ✅ Emitir evento WebSocket com status atualizado
        try {
          const socketServer = getSocketServer();
          if (socketServer) {
            // Buscar mensagem atualizada com sender
            const updatedMessageData = await this.prisma.message.findUnique({
              where: { id: message.id },
              include: {
                sender: {
                  include: {
                    roles: {
                      include: { role: true },
                    },
                  },
                },
                quotedMessage: {
                  include: {
                    sender: {
                      include: {
                        roles: {
                          include: { role: true },
                        },
                      },
                    },
                  },
                },
              },
            });
            
            if (updatedMessageData) {
              const updatedMessage = this.formatMessageResponse(updatedMessageData);
              socketServer.emitNewMessage(conversationId, updatedMessage);
              logger.info(`[MessageService] 📡 Message status updated to 'sent' for conversation ${conversationId}`);
            }
          }
        } catch (socketError) {
          logger.error('[MessageService] ❌ Error emitting socket event (update):', socketError);
        }
        
        logger.info(`✅ [BACKGROUND] Message ${message.id} sent successfully via WhatsApp (id: ${externalId || 'n/a'})`);
      } catch (error: any) {
        // ✅ LOG DETALHADO DO ERRO
        logger.error('❌ [BACKGROUND] Error sending WhatsApp message:', error);
        logger.error('❌ [BACKGROUND] Error details:', {
          messageId: message.id,
          conversationId,
          connectionId: conversation.connectionId,
          phoneNumber: conversation.contact.phoneNumber,
          messageType,
          errorMessage: error?.message || 'Unknown error',
          errorStack: error?.stack || 'No stack trace',
          errorName: error?.name || 'Unknown',
        });
        
        // ✅ Atualizar mensagem com status "failed"
        try {
          await this.prisma.message.update({
            where: { id: message.id },
            data: {
              status: 'failed',
            },
          });
          logger.info(`❌ [BACKGROUND] Message ${message.id} updated to 'failed' status`);
        } catch (updateError) {
          logger.error('❌ [BACKGROUND] Error updating message status to failed:', updateError);
        }
        
        // ✅ Emitir evento WebSocket com status "failed"
        try {
          const socketServer = getSocketServer();
          if (socketServer) {
            // Buscar mensagem atualizada com sender
            const failedMessageData = await this.prisma.message.findUnique({
              where: { id: message.id },
              include: {
                sender: {
                  include: {
                    roles: {
                      include: { role: true },
                    },
                  },
                },
                quotedMessage: {
                  include: {
                    sender: {
                      include: {
                        roles: {
                          include: { role: true },
                        },
                      },
                    },
                  },
                },
              },
            });
            
            if (failedMessageData) {
              const failedMessage = this.formatMessageResponse(failedMessageData);
              socketServer.emitNewMessage(conversationId, failedMessage);
              logger.info(`[MessageService] 📡 Message status updated to 'failed' for conversation ${conversationId}`);
            }
          }
        } catch (socketError) {
          logger.error('[MessageService] ❌ Error emitting socket event (failed):', socketError);
        }
      }
    })().catch((error) => {
      // ✅ CATCH FINAL: Garantir que nenhum erro seja silenciado
      logger.error('❌ [BACKGROUND] Unhandled error in background send:', error);
      logger.error('❌ [BACKGROUND] This should never happen - all errors should be caught above');
    });

    logger.info(`[MessageService] ✅ Message saved and queued for sending (id: ${message.id})`);

    // ✅ Retornar mensagem IMEDIATAMENTE (não esperar envio via WhatsApp)
    // Evento WebSocket já foi emitido acima com status "sending"
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
    pushName?: string | null,
    senderName?: string | null, // ✅ Nome do remetente (para grupos)
    quotedContext?: {
      stanzaId?: string;
      participant?: string;
      quotedMessage?: any;
    }
  ): Promise<void> {
    try {
      // 🔒 DEDUPLICAÇÃO: Verificar se mensagem já foi processada
      // ✅ IMPORTANTE: Isso garante que mensagens já sincronizadas sejam puladas durante reconexão
      // Permite sincronizar desde firstConnectedAt sem duplicar mensagens existentes
      if (externalId) {
        const existingMessage = await this.prisma.message.findFirst({
          where: {
            externalId,
            connectionId,
          },
        });

        if (existingMessage) {
          logger.debug(`[MessageService] ⏭️ Message ${externalId} already exists (deduplication), skipping`);
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

      // 🔒 DEDUPLICAÇÃO FINAL: Verificar novamente por conversa específica
      // (pode ter mudado de conversa ou ter sido criada nova conversa)
      if (externalId) {
        const exists = await this.prisma.message.findFirst({
          where: { conversationId: conversation.id, externalId },
          select: { id: true },
        });
        if (exists) {
          logger.debug(`[MessageService] ⏭️ Message ${externalId} already exists in conversation ${conversation.id} (deduplication), skipping`);
          return;
        }
      }

      let referencedMessageId: string | null = null;
      if (quotedContext?.stanzaId) {
        const referencedMessage = await this.prisma.message.findFirst({
          where: {
            connectionId,
            externalId: quotedContext.stanzaId,
          },
          select: { id: true },
        });

        if (referencedMessage) {
          referencedMessageId = referencedMessage.id;
          logger.info(
            `[MessageService] 🧷 Linking incoming message ${externalId || 'without-external-id'} to quoted message ${referencedMessageId}`
          );
        } else {
          logger.warn(
            `[MessageService] ⚠️ Quoted stanza ${quotedContext.stanzaId} not found for connection ${connectionId}`
          );
        }
      }

      const additionalMetadata: Record<string, any> = {};
      if (quotedContext?.participant) {
        additionalMetadata.quotedParticipant = quotedContext.participant;
      }
      const hasMetadata = Object.keys(additionalMetadata).length > 0;

      // Salvar mensagem
      // 💾 Salvar mensagem com proteção contra duplicatas
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          connectionId,
          content: messageText,
          messageType,
          isFromContact: !isFromMe, // true se veio do contato, false se foi enviado pelo sistema
          senderName: senderName || null, // ✅ Nome do remetente (importante para grupos)
          status: 'delivered',
          mediaUrl,
          externalId: externalId || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          quotedMessageId: referencedMessageId,
          ...(hasMetadata ? { metadata: additionalMetadata } : {}),
        },
        include: {
          sender: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
          quotedMessage: {
            include: {
              sender: {
                include: {
                  roles: {
                    include: { role: true },
                  },
                },
              },
            },
          },
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
    const senderRoles = message.sender?.roles || [];

    const quotedMessageData = message.quotedMessage || null;

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
            roles: senderRoles.map((ur: any) => ({
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
      quotedMessageId: message.quotedMessageId || null,
      quotedMessage: quotedMessageData
        ? {
            id: quotedMessageData.id,
            content: quotedMessageData.content,
            messageType: quotedMessageData.messageType,
            mediaUrl: quotedMessageData.mediaUrl,
            isFromContact: quotedMessageData.isFromContact,
            senderName: quotedMessageData.sender
              ? quotedMessageData.sender.name
              : null,
            senderAvatar: quotedMessageData.sender
              ? quotedMessageData.sender.avatar
              : null,
            senderId: quotedMessageData.senderId || null,
            timestamp: quotedMessageData.timestamp
              ? quotedMessageData.timestamp.toISOString()
              : null,
            status: quotedMessageData.status
              ? (quotedMessageData.status as MessageStatus)
              : null,
          }
        : null,
    };
  }
}
