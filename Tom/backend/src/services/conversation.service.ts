import { getPrismaClient } from '../config/database.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import {
  ConversationResponse,
  ConversationStatus,
  PaginatedResponse,
  PaginationParams,
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

      where.OR = [
        // Conversas atribuídas ao usuário (qualquer status)
        { assignedUserId: userId },
        // Conversas AGUARDANDO (não atribuídas) dos setores do usuário
        {
          AND: [
            { status: 'waiting' },
            { assignedUserId: null }, // Ainda não atribuída
            { departmentId: { in: departmentIds } },
          ],
        },
        // Conversas TRANSFERIDAS para o usuário ou seus setores
        {
          AND: [
            { status: 'transferred' },
            {
              OR: [
                { assignedUserId: userId }, // Transferida diretamente para o usuário
                { departmentId: { in: departmentIds } }, // Transferida para um dos setores do usuário
              ],
            },
          ],
        },
      ];
    }

    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    
    // Apenas usuários comuns são filtrados por conexão
    // Admins veem TODAS as conversas de TODAS as conexões
    if (connectionId && !isAdmin) {
      where.connectionId = connectionId;
    }
    // Se admin passar connectionId, ainda pode filtrar se quiser
    // Mas por padrão vê todas

    if (search) {
      where.OR = [
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { phoneNumber: { contains: search } } },
      ];
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
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations.map(this.formatConversationResponse),
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

    // NOVA LÓGICA: Se o usuário tem uma conexão, trocar a conexão da conversa
    if (userWithConnection?.whatsappConnections && userWithConnection.whatsappConnections.length > 0) {
      const userConnection = userWithConnection.whatsappConnections[0];
      updateData.connectionId = userConnection.id;
      logger.info(`🔄 Conversation ${conversationId} connection changed from ${conversation.connectionId} to ${userConnection.id} (user ${userId})`);
    } else {
      logger.warn(`⚠️ User ${userId} has no active connection. Keeping current connection ${conversation.connectionId}`);
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
   * Transfere conversa para outro usuário, departamento ou conexão
   * IMPORTANTE: Mantém histórico de mensagens
   * NOVA LÓGICA: Ao transferir para setor, a conversa fica visível para todos os usuários do setor
   * e a conexão só muda quando alguém aceitar a conversa
   */
  async transferConversation(
    conversationId: string,
    fromUserId: string,
    toUserId?: string,
    toDepartmentId?: string,
    toConnectionId?: string,
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

    // Criar registro de transferência
    await this.prisma.conversationTransfer.create({
      data: {
        conversationId,
        fromUserId,
        toUserId,
        toDepartmentId,
        reason,
      },
    });

    // NOVA LÓGICA: Ao transferir para setor, não atribui a ninguém específico
    // A conexão só muda quando alguém aceitar a conversa
    const updateData: any = {
      status: 'transferred',
      departmentId: toDepartmentId || conversation.departmentId,
      assignedUserId: null, // Remove atribuição para que todos do setor vejam
    };

    // Se transferir para usuário específico, atribui diretamente
    if (toUserId) {
      updateData.assignedUserId = toUserId;
    }

    // NÃO mudar a conexão na transferência
    // A conexão só será alterada quando alguém aceitar a conversa
    logger.info(`🔄 Conversation ${conversationId} will keep connection ${conversation.connectionId} until accepted`);

    // Atualizar conversa
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    logger.info(`✅ Conversation ${conversationId} transferred from ${fromUserId} to ${toDepartmentId ? `department ${toDepartmentId}` : `user ${toUserId}`}`);
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

    if (conversation.assignedUserId !== userId) {
      throw new ForbiddenError('You can only update conversations assigned to you');
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
    return {
      id: conversation.id,
      contact: {
        id: conversation.contact.id,
        phoneNumber: conversation.contact.phoneNumber,
        name: conversation.contact.name,
        avatar: conversation.contact.avatar,
        email: conversation.contact.email,
        tags: conversation.contact.tags,
      },
      connection: {
        id: conversation.connection.id,
        name: conversation.connection.name,
        phoneNumber: conversation.connection.phoneNumber,
        status: conversation.connection.status,
        avatar: conversation.connection.avatar,
        lastConnected: conversation.connection.lastConnected?.toISOString() || null,
        isActive: conversation.connection.isActive,
        createdAt: conversation.connection.createdAt.toISOString(),
        updatedAt: conversation.connection.updatedAt.toISOString(),
      },
      department: conversation.department
        ? {
            id: conversation.department.id,
            name: conversation.department.name,
            description: conversation.department.description,
            color: conversation.department.color,
            icon: conversation.department.icon,
            isActive: conversation.department.isActive,
            createdAt: conversation.department.createdAt.toISOString(),
            updatedAt: conversation.department.updatedAt.toISOString(),
          }
        : null,
      assignedUser: conversation.assignedUser
        ? {
            id: conversation.assignedUser.id,
            email: conversation.assignedUser.email,
            name: conversation.assignedUser.name,
            avatar: conversation.assignedUser.avatar,
            status: conversation.assignedUser.status,
            isActive: conversation.assignedUser.isActive,
            roles: conversation.assignedUser.roles.map((ur: any) => ({
              id: ur.role.id,
              name: ur.role.name,
              description: ur.role.description,
            })),
            createdAt: conversation.assignedUser.createdAt.toISOString(),
            updatedAt: conversation.assignedUser.updatedAt.toISOString(),
          }
        : null,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      firstResponseAt: conversation.firstResponseAt?.toISOString() || null,
      resolvedAt: conversation.resolvedAt?.toISOString() || null,
      unreadCount: conversation.unreadCount,
      lastMessage: conversation.messages[0]
        ? {
            id: conversation.messages[0].id,
            conversationId: conversation.messages[0].conversationId,
            sender: null,
            content: conversation.messages[0].content,
            messageType: conversation.messages[0].messageType,
            mediaUrl: conversation.messages[0].mediaUrl,
            status: conversation.messages[0].status,
            isFromContact: conversation.messages[0].isFromContact,
            timestamp: conversation.messages[0].timestamp.toISOString(),
            createdAt: conversation.messages[0].createdAt.toISOString(),
          }
        : null,
      internalNotes: conversation.internalNotes,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }
}
