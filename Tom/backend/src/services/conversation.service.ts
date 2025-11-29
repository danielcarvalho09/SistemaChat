import { getPrismaClient } from '../config/database.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import {
  ConversationResponse,
  ConversationStatus,
  PaginatedResponse,
  PaginationParams,
  MessageStatus,
} from '../models/types.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';

export class ConversationService {
  private prisma = getPrismaClient();

  /**
   * Lista conversas com filtros
   */
  async listConversations(
    userId: string,
    userRoles: string[],
    params: PaginationParams & {
      status?: ConversationStatus;
      departmentId?: string;
      connectionId?: string;
      search?: string;
    }
  ): Promise<PaginatedResponse<ConversationResponse>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc',
      status,
      departmentId,
      connectionId,
      search,
    } = params;

    const skip = (page - 1) * limit;
    const isAdmin = userRoles.includes('admin');

    // Construir filtros
    const where: any = {};
    const andConditions: any[] = [];

    // Admins veem todas as conversas de todas as conexões
    // Users veem apenas:
    // 1. Conversas AGUARDANDO dos seus setores (ainda não atribuídas)
    // 2. Conversas TRANSFERIDAS para eles ou seus setores
    // 3. Conversas ATRIBUÍDAS a eles (independente do status)
    // IMPORTANTE: Conexão Matriz NÃO duplica mensagens, apenas permite que admin veja tudo
    if (!isAdmin) {
      // Buscar setores do usuário
      const userDepartments = await this.prisma.userDepartmentAccess.findMany({
        where: { userId },
        select: { departmentId: true },
      });

      const departmentIds = userDepartments.map((ud) => ud.departmentId);

      // ✅ Construir condições de permissão
      const permissionConditions: any[] = [
        // Conversas atribuídas ao usuário (qualquer status)
        { assignedUserId: userId },
      ];

      // ✅ Adicionar condições de setores apenas se o usuário tiver setores
      if (departmentIds.length > 0) {
        // Conversas AGUARDANDO (não atribuídas) dos setores do usuário
        permissionConditions.push({
          AND: [
            { status: 'waiting' },
            { assignedUserId: null }, // Ainda não atribuída
            { departmentId: { in: departmentIds } },
          ],
        });

        // Conversas TRANSFERIDAS para o usuário ou seus setores
        permissionConditions.push({
          AND: [
            { status: 'transferred' },
            {
              OR: [
                { assignedUserId: userId }, // Transferida diretamente para o usuário
                { departmentId: { in: departmentIds } }, // Transferida para um dos setores do usuário
              ],
            },
          ],
        });
      } else {
        // Se usuário não tem setores, só pode ver conversas atribuídas a ele
        logger.warn(`[ConversationService] User ${userId} has no departments - will only see assigned conversations`);
      }

      // Adicionar restrições de permissão como condição AND
      andConditions.push({
        OR: permissionConditions,
      });
    }

    // ✅ BUG FIX: Adicionar filtros diretos como condições AND também
    // Isso evita conflitos quando há múltiplas condições
    if (status) {
      andConditions.push({ status });
    }
    if (departmentId) {
      andConditions.push({ departmentId });
    }
    
    // Apenas usuários comuns são filtrados por conexão
    // Admins veem TODAS as conversas de TODAS as conexões
    if (connectionId && !isAdmin) {
      andConditions.push({ connectionId });
    }
    // Se admin passar connectionId, ainda pode filtrar se quiser
    // Mas por padrão vê todas

    // ✅ BUG FIX: Combinar busca com restrições de permissão usando AND
    // Se search for fornecido, precisa combinar com as restrições existentes
    if (search) {
      andConditions.push({
        OR: [
          { contact: { name: { contains: search, mode: 'insensitive' } } },
          { contact: { phoneNumber: { contains: search } } },
        ],
      });
    }

    // ✅ Construir where clause final
    // Se há condições AND, adicionar ao where
    if (andConditions.length === 1) {
      // Se há apenas uma condição, mesclar diretamente no where
      Object.assign(where, andConditions[0]);
    } else if (andConditions.length > 1) {
      // Se há múltiplas condições, usar AND
      where.AND = andConditions;
    }
    // Se andConditions.length === 0 (admin sem filtros), where fica vazio {} = retorna todas as conversas

    try {
      // ✅ Log do where clause para debug (apenas em desenvolvimento)
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`[ConversationService] Where clause:`, JSON.stringify(where, null, 2));
      }

      const [conversations, total] = await Promise.all([
        this.prisma.conversation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            contact: true,
            connection: true,
            department: true,
            assignedUser: {
              include: {
                roles: {
                  include: { role: true },
                },
              },
            },
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 1,
              include: {
                quotedMessage: {
                  include: {
                    sender: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.conversation.count({ where }),
      ]);

      return {
        data: conversations.map((conv) => {
          try {
            return this.formatConversationResponse(conv);
          } catch (error) {
            logger.error(`[ConversationService] Error formatting conversation ${conv.id}:`, error);
            // Retornar conversa básica em caso de erro
            return {
              id: conv.id,
              contact: {
                id: conv.contact.id,
                phoneNumber: conv.contact.phoneNumber,
                name: conv.contact.name || null,
                pushName: conv.contact.pushName || null,
                avatar: conv.contact.avatar || null,
                email: conv.contact.email || null,
                tags: conv.contact.tags || [],
              },
              connection: {
                id: conv.connection.id,
                name: conv.connection.name,
                phoneNumber: conv.connection.phoneNumber,
                status: conv.connection.status,
                avatar: conv.connection.avatar || null,
                lastConnected: conv.connection.lastConnected?.toISOString() || null,
                isActive: conv.connection.isActive,
                createdAt: conv.connection.createdAt.toISOString(),
                updatedAt: conv.connection.updatedAt.toISOString(),
              },
              department: null,
              assignedUser: null,
              status: conv.status,
              lastMessageAt: conv.lastMessageAt.toISOString(),
              firstResponseAt: conv.firstResponseAt?.toISOString() || null,
              resolvedAt: conv.resolvedAt?.toISOString() || null,
              unreadCount: conv.unreadCount,
              lastMessage: null,
              internalNotes: conv.internalNotes,
              createdAt: conv.createdAt.toISOString(),
              updatedAt: conv.updatedAt.toISOString(),
            } as any;
          }
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      logger.error(`[ConversationService] ❌ Error in listConversations:`, error);
      logger.error(`[ConversationService] 📋 Where clause:`, JSON.stringify(where, null, 2));
      logger.error(`[ConversationService] 📋 User ID: ${userId}`);
      logger.error(`[ConversationService] 📋 Is Admin: ${isAdmin}`);
      logger.error(`[ConversationService] 📋 Params:`, JSON.stringify(params, null, 2));
      logger.error(`[ConversationService] 📋 Error stack:`, error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  /**
   * Busca conversa por ID
   */
  async getConversationById(conversationId: string, userId: string, userRoles: string[]): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        connection: true,
        department: true,
        assignedUser: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          include: {
            quotedMessage: {
              include: {
                sender: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verificar permissão
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && conversation.assignedUserId !== userId && conversation.status !== 'waiting' && conversation.status !== 'transferred') {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    return this.formatConversationResponse(conversation);
  }

  /**
   * Aceita conversa da fila (waiting ou transferred)
   * NOVA LÓGICA: Ao aceitar conversa transferida, muda a conexão para a conexão do usuário
   */
  async acceptConversation(
    conversationId: string,
    userId: string,
    departmentId?: string
  ): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Aceita conversas em 'waiting' (novas) ou 'transferred' (transferidas)
    if (conversation.status !== 'waiting' && conversation.status !== 'transferred') {
      throw new ConflictError('Conversation is not available for acceptance');
    }

    // Buscar a conexão do usuário que está aceitando
    const userWithConnection = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        whatsappConnections: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    // Atualizar conversa
    const updateData: any = {
      status: 'in_progress',
      assignedUserId: userId,
      departmentId: departmentId || conversation.departmentId,
    };

    // LÓGICA CORRETA: Trocar conexão APENAS se a conversa foi TRANSFERIDA
    // - Se status = 'transferred': Trocar para a conexão do usuário que aceitou
    // - Se status = 'waiting': Manter a conexão original (WhatsApp que recebeu)
    if (conversation.status === 'transferred') {
      // Conversa foi transferida - trocar para a conexão do usuário que está aceitando
      if (userWithConnection?.whatsappConnections && userWithConnection.whatsappConnections.length > 0) {
        const userConnection = userWithConnection.whatsappConnections[0];
        updateData.connectionId = userConnection.id;
        logger.info(`🔄 Transferred conversation ${conversationId}: connection changed from ${conversation.connectionId} to ${userConnection.id} (user ${userId})`);
      } else {
        logger.warn(`⚠️ User ${userId} has no active connection. Keeping current connection ${conversation.connectionId}`);
      }
    } else {
      // Conversa nova (waiting) - manter conexão original
      logger.info(`✅ Accepting new conversation ${conversationId} - keeping original connection ${conversation.connectionId}`);
    }

    // Só atualiza firstResponseAt se for a primeira vez (waiting)
    if (conversation.status === 'waiting' && !conversation.firstResponseAt) {
      updateData.firstResponseAt = new Date();
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        contact: true,
        connection: true,
        department: true,
        assignedUser: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    logger.info(`Conversation ${conversationId} accepted by user ${userId}`);

    return this.formatConversationResponse(updated);
  }

  /**
   * Transfere conversa para usuário específico
   * IMPORTANTE: Mantém histórico de mensagens e observações (internalNotes)
   * NOVA LÓGICA: Transferência agora é apenas para usuário específico
   * A conversa ficará visível apenas para o usuário selecionado e administradores
   */
  async transferConversation(
    conversationId: string,
    fromUserId: string,
    toUserId: string,
    reason?: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verificar se usuário é admin
    const user = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        departmentAccess: {
          include: {
            department: true,
          },
        },
      },
    });

    const isAdmin = user?.roles.some((ur: any) => ur.role.name === 'admin');

    // Admin pode transferir qualquer conversa
    // Usuário comum só pode transferir se:
    // 1. A conversa está atribuída a ele, OU
    // 2. A conversa está no departamento dele e não está atribuída a ninguém (status waiting ou transferred)
    if (!isAdmin) {
      const userDepartmentIds = user?.departmentAccess.map((d: any) => d.departmentId) || [];
      const canTransfer = 
        conversation.assignedUserId === fromUserId ||
        ((conversation.status === 'waiting' || conversation.status === 'transferred') && 
         conversation.departmentId && 
         userDepartmentIds.includes(conversation.departmentId));

      if (!canTransfer) {
        throw new ForbiddenError('You can only transfer conversations assigned to you or in your department queue');
      }
    }

    // NOVA LÓGICA: Transferência agora é APENAS para usuário específico
    // Primeiro seleciona o setor, depois o usuário do setor
    if (!toUserId) {
      throw new Error('toUserId is required. Transfer must be to a specific user.');
    }

    // Buscar departamento do usuário de destino para definir departmentId
    const toUserDepartment = await this.prisma.userDepartmentAccess.findFirst({
      where: { userId: toUserId },
      include: { department: true },
    });

    const targetDepartmentId = toUserDepartment?.departmentId || conversation.departmentId;

    // Criar registro de transferência
    await this.prisma.conversationTransfer.create({
      data: {
        conversationId,
        fromUserId,
        toUserId,
        toDepartmentId: targetDepartmentId,
        reason,
      },
    });

    // Atualizar conversa: atribuir ao usuário específico e definir status como transferred
    // A conversa ficará visível APENAS para o usuário selecionado e administradores
    const updateData: any = {
      status: 'transferred',
      departmentId: targetDepartmentId,
      assignedUserId: toUserId, // Atribuir diretamente ao usuário selecionado
    };

    // NÃO mudar a conexão na transferência
    // A conexão só será alterada quando o usuário aceitar a conversa
    logger.info(`🔄 Conversation ${conversationId} will keep connection ${conversation.connectionId} until accepted by user ${toUserId}`);

    // Atualizar conversa
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    logger.info(`✅ Conversation ${conversationId} transferred from ${fromUserId} to user ${toUserId} (department: ${targetDepartmentId})`);
  }

  /**
   * Atualiza status da conversa
   */
  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    userId: string
  ): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Permitir fechar/recusar conversas em waiting (sem atribuição)
    // Ou conversas atribuídas ao usuário
    if (conversation.assignedUserId !== userId && conversation.status !== 'waiting') {
      throw new ForbiddenError('You can only update conversations assigned to you or in waiting status');
    }

    const updateData: any = { status };

    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        contact: true,
        connection: true,
        department: true,
        assignedUser: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return this.formatConversationResponse(updated);
  }

  /**
   * Atualiza notas internas da conversa
   */
  async updateInternalNotes(
    conversationId: string,
    notes: string,
    userId: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verificar se o usuário tem permissão para atualizar as notas
    if (conversation.assignedUserId !== userId) {
      throw new ForbiddenError('You can only update notes for conversations assigned to you');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { internalNotes: notes },
    });
  }

  /**
   * Marca mensagens como lidas
   */
  async markAsRead(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  /**
   * Formata resposta da conversa
   */
  private formatConversationResponse(conversation: any): ConversationResponse {
    try {
      const lastMessage = conversation.messages?.[0] || null;
      const quoted = lastMessage?.quotedMessage || null;

      // ✅ Validações de segurança para evitar erros
      if (!conversation.contact) {
        throw new Error('Contact is missing');
      }
      if (!conversation.connection) {
        throw new Error('Connection is missing');
      }

      return {
        id: conversation.id,
        contact: {
          id: conversation.contact.id,
          phoneNumber: conversation.contact.phoneNumber,
          name: conversation.contact.name || null,
          pushName: conversation.contact.pushName || null,
          avatar: conversation.contact.avatar || null,
          email: conversation.contact.email || null,
          tags: conversation.contact.tags || [],
        },
        connection: {
          id: conversation.connection.id,
          name: conversation.connection.name,
          phoneNumber: conversation.connection.phoneNumber,
          status: conversation.connection.status,
          avatar: conversation.connection.avatar || null,
          lastConnected: conversation.connection.lastConnected?.toISOString() || null,
          isActive: conversation.connection.isActive ?? true,
          createdAt: conversation.connection.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: conversation.connection.updatedAt?.toISOString() || new Date().toISOString(),
        },
        department: conversation.department
          ? {
              id: conversation.department.id,
              name: conversation.department.name,
              description: conversation.department.description || null,
              color: conversation.department.color || '#3B82F6',
              icon: conversation.department.icon || 'folder',
              isActive: conversation.department.isActive ?? true,
              createdAt: conversation.department.createdAt?.toISOString() || new Date().toISOString(),
              updatedAt: conversation.department.updatedAt?.toISOString() || new Date().toISOString(),
            }
          : null,
        assignedUser: conversation.assignedUser
          ? {
              id: conversation.assignedUser.id,
              email: conversation.assignedUser.email,
              name: conversation.assignedUser.name,
              avatar: conversation.assignedUser.avatar || null,
              status: conversation.assignedUser.status || 'offline',
              isActive: conversation.assignedUser.isActive ?? true,
              roles: (conversation.assignedUser.roles || []).map((ur: any) => ({
                id: ur.role?.id || ur.roleId,
                name: ur.role?.name || 'user',
                description: ur.role?.description || null,
              })),
              createdAt: conversation.assignedUser.createdAt?.toISOString() || new Date().toISOString(),
              updatedAt: conversation.assignedUser.updatedAt?.toISOString() || new Date().toISOString(),
            }
          : null,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt?.toISOString() || new Date().toISOString(),
        firstResponseAt: conversation.firstResponseAt?.toISOString() || null,
        resolvedAt: conversation.resolvedAt?.toISOString() || null,
        unreadCount: conversation.unreadCount || 0,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              conversationId: lastMessage.conversationId,
              sender: null,
              content: lastMessage.content || '',
              messageType: lastMessage.messageType || 'text',
              mediaUrl: lastMessage.mediaUrl || null,
              status: lastMessage.status || 'sent',
              isFromContact: lastMessage.isFromContact ?? false,
              timestamp: lastMessage.timestamp?.toISOString() || new Date().toISOString(),
              createdAt: lastMessage.createdAt?.toISOString() || new Date().toISOString(),
              quotedMessageId: lastMessage.quotedMessageId || null,
              quotedMessage: quoted
                ? {
                    id: quoted.id,
                    content: quoted.content || '',
                    messageType: quoted.messageType || 'text',
                    mediaUrl: quoted.mediaUrl || null,
                    isFromContact: quoted.isFromContact ?? false,
                    senderName: quoted.sender?.name || null,
                    senderAvatar: quoted.sender?.avatar || null,
                    senderId: quoted.senderId || null,
                    timestamp: quoted.timestamp ? quoted.timestamp.toISOString() : null,
                    status: quoted.status ? (quoted.status as MessageStatus) : null,
                  }
                : null,
            }
          : null,
        internalNotes: conversation.internalNotes || null,
        createdAt: conversation.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: conversation.updatedAt?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[ConversationService] Error in formatConversationResponse for conversation ${conversation?.id}:`, error);
      throw error;
    }
  }
}
