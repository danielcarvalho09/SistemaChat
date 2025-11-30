import { FastifyRequest, FastifyReply } from 'fastify';
import { KanbanService } from '../services/kanban.service.js';
import { validate } from '../utils/validation.js';
import { z } from 'zod';

// Schemas de validação
const createStageSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  order: z.number().int().min(0),
  isDefault: z.boolean().optional(),
});

const updateStageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  order: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});

const reorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()),
});

const moveConversationSchema = z.object({
  toStageId: z.string().uuid(),
  notes: z.string().optional(),
});

export class KanbanController {
  private kanbanService = new KanbanService();

  // ==================== ETAPAS ====================

  /**
   * POST /api/v1/kanban/stages
   * Criar nova etapa
   */
  createStage = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const data = validate(createStageSchema, request.body);
      const stage = await this.kanbanService.createStage(data);

      return reply.status(201).send({
        success: true,
        message: 'Etapa criada com sucesso',
        data: stage,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * GET /api/v1/kanban/stages
   * Listar todas as etapas
   */
  listStages = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const stages = await this.kanbanService.listStages();

      return reply.send({
        success: true,
        data: stages,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * GET /api/v1/kanban/stages/:id
   * Obter etapa por ID
   */
  getStage = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const stage = await this.kanbanService.getStageById(id);

      return reply.send({
        success: true,
        data: stage,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * PUT /api/v1/kanban/stages/:id
   * Atualizar etapa
   */
  updateStage = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const data = validate(updateStageSchema, request.body);
      const stage = await this.kanbanService.updateStage(id, data);

      return reply.send({
        success: true,
        message: 'Etapa atualizada com sucesso',
        data: stage,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * DELETE /api/v1/kanban/stages/:id
   * Deletar etapa
   */
  deleteStage = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      await this.kanbanService.deleteStage(id);

      return reply.send({
        success: true,
        message: 'Etapa deletada com sucesso',
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * PUT /api/v1/kanban/stages/reorder
   * Reordenar etapas
   */
  reorderStages = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { stageIds } = validate(reorderStagesSchema, request.body);
      const stages = await this.kanbanService.reorderStages(stageIds);

      return reply.send({
        success: true,
        message: 'Etapas reordenadas com sucesso',
        data: stages,
      });
    } catch (error) {
      throw error;
    }
  };

  // ==================== KANBAN BOARD ====================

  /**
   * GET /api/v1/kanban/board
   * Obter board completo (todas etapas com suas conversas)
   * Para usuários normais: filtra por conexões do usuário e apenas conversas aceitas
   * Para admin: mostra todas as conversas aceitas ou pode filtrar por usuário específico via query param
   */
  getBoard = async (
    request: FastifyRequest<{ Querystring: { userId?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user!.userId;
      const userRoles = request.user!.roles || [];
      const isAdmin = userRoles.includes('admin');
      const targetUserId = request.query?.userId; // Para admin ver kanban de outro usuário

      const board = await this.kanbanService.getKanbanBoard(userId, isAdmin, targetUserId);

      return reply.send({
        success: true,
        data: board,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * GET /api/v1/kanban/stages/:id/conversations
   * Obter conversas de uma etapa específica
   * Para usuários normais: filtra por conexões do usuário e apenas conversas aceitas
   * Para admin: mostra todas as conversas aceitas ou pode filtrar por usuário específico via query param
   */
  getStageConversations = async (
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { userId?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const userId = request.user!.userId;
      const userRoles = request.user!.roles || [];
      const isAdmin = userRoles.includes('admin');
      const targetUserId = request.query?.userId; // Para admin ver kanban de outro usuário

      const conversations = await this.kanbanService.getConversationsByStage(
        id, 
        userId, 
        isAdmin, 
        targetUserId
      );

      return reply.send({
        success: true,
        data: conversations,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * PUT /api/v1/kanban/conversations/:id/move
   * Mover conversa para outra etapa
   */
  moveConversation = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id: conversationId } = request.params;
      const { toStageId, notes } = validate(moveConversationSchema, request.body);
      const userId = request.user!.userId;

      const conversation = await this.kanbanService.moveConversation({
        conversationId,
        toStageId,
        userId,
        notes,
      });

      return reply.send({
        success: true,
        message: 'Conversa movida com sucesso',
        data: conversation,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * GET /api/v1/kanban/conversations/:id/history
   * Obter histórico de movimentações de uma conversa
   */
  getConversationHistory = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const history = await this.kanbanService.getConversationHistory(id);

      return reply.send({
        success: true,
        data: history,
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * POST /api/v1/kanban/initialize
   * Inicializar etapas padrão
   */
  initializeStages = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const stages = await this.kanbanService.initializeDefaultStages();

      if (stages) {
        return reply.send({
          success: true,
          message: 'Etapas padrão criadas com sucesso',
          data: stages,
        });
      } else {
        return reply.send({
          success: true,
          message: 'Etapas já existem',
        });
      }
    } catch (error) {
      throw error;
    }
  };
}
