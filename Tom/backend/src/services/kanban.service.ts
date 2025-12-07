import { getPrismaClient } from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';

interface CreateStageData {
  name: string;
  description?: string;
  color?: string;
  order: number;
  isDefault?: boolean;
}

interface UpdateStageData {
  name?: string;
  description?: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
}

interface MoveConversationData {
  conversationId: string;
  toStageId: string;
  userId: string;
  notes?: string;
}

export class KanbanService {
  private prisma = getPrismaClient();

  // ==================== ETAPAS ====================

  /**
   * Criar nova etapa do Kanban
   */
  async createStage(data: CreateStageData) {
    // Se for etapa padrão, remover flag de outras etapas
    if (data.isDefault) {
      await this.prisma.kanbanStage.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return await this.prisma.kanbanStage.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#3B82F6',
        order: data.order,
        isDefault: data.isDefault || false,
      },
    });
  }

  /**
   * Listar todas as etapas
   */
  async listStages() {
    return await this.prisma.kanbanStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });
  }

  /**
   * Obter etapa por ID
   */
  async getStageById(stageId: string) {
    const stage = await this.prisma.kanbanStage.findUnique({
      where: { id: stageId },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (!stage) {
      throw new AppError('Etapa não encontrada', 404);
    }

    return stage;
  }

  /**
   * Atualizar etapa
   */
  async updateStage(stageId: string, data: UpdateStageData) {
    const stage = await this.prisma.kanbanStage.findUnique({
      where: { id: stageId },
    });

    if (!stage) {
      throw new AppError('Etapa não encontrada', 404);
    }

    // Se for marcar como padrão, remover flag de outras
    if (data.isDefault) {
      await this.prisma.kanbanStage.updateMany({
        where: { isDefault: true, id: { not: stageId } },
        data: { isDefault: false },
      });
    }

    return await this.prisma.kanbanStage.update({
      where: { id: stageId },
      data,
    });
  }

  /**
   * Deletar etapa
   */
  async deleteStage(stageId: string) {
    const stage = await this.prisma.kanbanStage.findUnique({
      where: { id: stageId },
      include: {
        _count: {
          select: { conversations: true },
        },
        conversations: true,
      },
    });

    if (!stage) {
      throw new AppError('Etapa não encontrada', 404);
    }

    // Se houver conversas, mover para a etapa anterior
    if (stage._count.conversations > 0) {
      // Buscar etapa anterior (menor order)
      const previousStage = await this.prisma.kanbanStage.findFirst({
        where: {
          order: { lt: stage.order },
        },
        orderBy: { order: 'desc' },
      });

      if (!previousStage) {
        throw new AppError(
          'Não é possível excluir a primeira etapa com conversas. Mova as conversas manualmente primeiro.',
          400
        );
      }

      // Mover todas as conversas para a etapa anterior
      await this.prisma.conversation.updateMany({
        where: { kanbanStageId: stageId },
        data: { kanbanStageId: previousStage.id },
      });

      console.log(`✅ Moved ${stage._count.conversations} conversations from "${stage.name}" to "${previousStage.name}"`);
    }

    await this.prisma.kanbanStage.delete({
      where: { id: stageId },
    });
  }

  /**
   * Reordenar etapas
   */
  async reorderStages(stageIds: string[]) {
    const updates = stageIds.map((id, index) =>
      this.prisma.kanbanStage.update({
        where: { id },
        data: { order: index },
      })
    );

    await this.prisma.$transaction(updates);

    return await this.listStages();
  }

  // ==================== CONVERSAS NO KANBAN ====================

  /**
   * Obter conversas por etapa (para visualização do Kanban)
   * Filtra por connectionId do usuário e apenas conversas aceitas (status 'in_progress' ou 'transferred')
   * Para admin: pode ver todas as conversas ou filtrar por usuário específico
   * ✅ Se usuário não tem conexões atreladas, retorna array vazio (nenhuma conversa)
   */
  async getConversationsByStage(
    stageId: string, 
    userId?: string, 
    isAdmin: boolean = false,
    targetUserId?: string // Para admin ver kanban de outro usuário
  ) {
    // Se admin está vendo kanban de outro usuário, usar targetUserId
    const effectiveUserId = isAdmin && targetUserId ? targetUserId : userId;
    
    // Buscar conexões do usuário
    let connectionIds: string[] = [];
    let shouldFilterByConnections = false;
    
    if (effectiveUserId && !isAdmin) {
      // ✅ Para usuários normais: buscar conexões onde userId = effectiveUserId
      const connections = await this.prisma.whatsAppConnection.findMany({
        where: {
          userId: effectiveUserId, // ✅ Buscar conexões atreladas ao usuário
          isActive: true,
        },
        select: {
          id: true,
        },
      });
      connectionIds = connections.map(c => c.id);
      shouldFilterByConnections = true; // ✅ SEMPRE filtrar (mesmo se vazio, não mostra nada)
      
      // ✅ Se usuário não tem conexões, retornar array vazio imediatamente
      if (connectionIds.length === 0) {
        return [];
      }
    } else if (isAdmin && targetUserId) {
      // ✅ Admin vendo kanban de outro usuário: buscar conexões do targetUserId
      const connections = await this.prisma.whatsAppConnection.findMany({
        where: {
          userId: targetUserId, // ✅ Buscar conexões atreladas ao usuário específico
          isActive: true,
        },
        select: {
          id: true,
        },
      });
      connectionIds = connections.map(c => c.id);
      shouldFilterByConnections = true; // ✅ Filtrar por conexões do usuário específico
      
      // ✅ Se usuário não tem conexões, retornar array vazio imediatamente
      if (connectionIds.length === 0) {
        return [];
      }
    }
    // ✅ Se admin sem targetUserId: não filtrar por connectionId (mostra todas)

    return await this.prisma.conversation.findMany({
      where: { 
        kanbanStageId: stageId,
        // ✅ CRÍTICO: Filtrar por connectionId apenas se shouldFilterByConnections for true
        // Se usuário tem conexões, mostrar apenas dessas conexões
        // Se usuário não tem conexões, já retornamos vazio acima
        ...(shouldFilterByConnections && connectionIds.length > 0 && { 
          connectionId: { in: connectionIds } 
        }),
        // ✅ IMPORTANTE: Filtrar apenas conversas aceitas (não 'waiting')
        // Status aceitos: 'in_progress' (conversas que foram aceitas e estão em atendimento)
        // Também incluir 'transferred' se a conversa foi transferida mas ainda está em atendimento
        status: {
          in: ['in_progress', 'transferred'], // Conversas aceitas/em atendimento
        },
      },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        connection: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1, // Apenas última mensagem
          select: {
            id: true,
            content: true,
            isFromContact: true,
            timestamp: true,
          },
        },
        conversationTags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  /**
   * Obter todas as conversas organizadas por etapa
   * Para usuários normais: mostra apenas conversas aceitas das suas conexões
   * Para admin: mostra todas as conversas aceitas ou pode filtrar por usuário específico
   */
  async getKanbanBoard(
    userId?: string, 
    isAdmin: boolean = false,
    targetUserId?: string // Para admin ver kanban de outro usuário
  ) {
    const stages = await this.listStages();

    const board = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        conversations: await this.getConversationsByStage(stage.id, userId, isAdmin, targetUserId),
      }))
    );

    return board;
  }

  /**
   * Mover conversa para outra etapa
   */
  async moveConversation(data: MoveConversationData) {
    const { conversationId, toStageId, userId, notes } = data;

    // Verificar se a conversa existe
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError('Conversa não encontrada', 404);
    }

    // Verificar se a etapa de destino existe
    const toStage = await this.prisma.kanbanStage.findUnique({
      where: { id: toStageId },
    });

    if (!toStage) {
      throw new AppError('Etapa de destino não encontrada', 404);
    }

    // Registrar movimentação no histórico
    await this.prisma.conversationHistory.create({
      data: {
        conversationId,
        fromStageId: conversation.kanbanStageId,
        toStageId,
        userId,
        notes,
      },
    });

    // Atualizar conversa
    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { kanbanStageId: toStageId },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        kanbanStage: true,
      },
    });
  }

  /**
   * Obter histórico de movimentações de uma conversa
   */
  async getConversationHistory(conversationId: string) {
    return await this.prisma.conversationHistory.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Inicializar etapas padrão (se não existir nenhuma)
   * Cria apenas a coluna "Novo" - outras colunas são criadas manualmente
   */
  async initializeDefaultStages() {
    const count = await this.prisma.kanbanStage.count();

    if (count === 0) {
      await this.createStage({
        name: 'Novo',
        description: 'Conversas novas',
        color: '#10B981',
        order: 0,
        isDefault: true,
      });

      return await this.listStages();
    }

    return null;
  }
}
