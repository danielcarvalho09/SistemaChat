import { FastifyRequest, FastifyReply } from 'fastify';
import { FunnelService } from '../services/funnel.service.js';
import { logger } from '../config/logger.js';

export class FunnelController {
  private funnelService = new FunnelService();

  /**
   * POST /api/v1/funnels/generate
   * Gera funil automaticamente usando IA
   */
  generateFunnel = async (
    request: FastifyRequest<{ Body: { niche: string; name?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { niche, name } = request.body;
      const userId = request.user!.userId;

      if (!niche || niche.trim() === '') {
        return reply.status(400).send({
          success: false,
          message: 'Niche is required',
        });
      }

      const funnel = await this.funnelService.generateFunnel({ niche, name }, userId);

      return reply.status(201).send({
        success: true,
        message: 'Funnel generated successfully',
        data: funnel,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error generating funnel:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error generating funnel',
      });
    }
  };

  /**
   * GET /api/v1/funnels
   * Lista funis do usuário
   */
  listFunnels = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const userRoles = request.user!.roles;

      const funnels = await this.funnelService.listFunnels(userId, userRoles);

      return reply.status(200).send({
        success: true,
        data: funnels,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error listing funnels:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error listing funnels',
      });
    }
  };

  /**
   * GET /api/v1/funnels/:funnelId
   * Busca funil por ID
   */
  getFunnelById = async (
    request: FastifyRequest<{ Params: { funnelId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { funnelId } = request.params;
      const userId = request.user!.userId;

      const funnel = await this.funnelService.getFunnelById(funnelId, userId);

      return reply.status(200).send({
        success: true,
        data: funnel,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error getting funnel:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error getting funnel',
      });
    }
  };

  /**
   * PATCH /api/v1/funnels/:funnelId
   * Atualiza funil
   */
  updateFunnel = async (
    request: FastifyRequest<{
      Params: { funnelId: string };
      Body: { name?: string; description?: string; isActive?: boolean };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { funnelId } = request.params;
      const userId = request.user!.userId;
      const data = request.body;

      const funnel = await this.funnelService.updateFunnel(funnelId, userId, data);

      return reply.status(200).send({
        success: true,
        message: 'Funnel updated successfully',
        data: funnel,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error updating funnel:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error updating funnel',
      });
    }
  };

  /**
   * DELETE /api/v1/funnels/:funnelId
   * Deleta funil
   */
  deleteFunnel = async (
    request: FastifyRequest<{ Params: { funnelId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { funnelId } = request.params;
      const userId = request.user!.userId;

      await this.funnelService.deleteFunnel(funnelId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Funnel deleted successfully',
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error deleting funnel:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error deleting funnel',
      });
    }
  };

  /**
   * POST /api/v1/funnels/:funnelId/stages
   * Cria nova etapa no funil
   */
  createStage = async (
    request: FastifyRequest<{
      Params: { funnelId: string };
      Body: {
        title: string;
        description?: string;
        icon?: string;
        color?: string;
        positionX: number;
        positionY: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { funnelId } = request.params;
      const userId = request.user!.userId;
      const data = request.body;

      const stage = await this.funnelService.createStage(funnelId, userId, {
        title: data.title,
        description: data.description || '',
        icon: data.icon || 'circle',
        color: data.color || '#3B82F6',
        positionX: data.positionX,
        positionY: data.positionY,
      });

      return reply.status(201).send({
        success: true,
        message: 'Stage created successfully',
        data: stage,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error creating stage:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error creating stage',
      });
    }
  };

  /**
   * PATCH /api/v1/funnels/stages/:stageId
   * Atualiza etapa do funil
   */
  updateStage = async (
    request: FastifyRequest<{
      Params: { stageId: string };
      Body: {
        title?: string;
        description?: string;
        icon?: string;
        color?: string;
        positionX?: number;
        positionY?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { stageId } = request.params;
      const userId = request.user!.userId;
      const data = request.body;

      const stage = await this.funnelService.updateStage(stageId, userId, data);

      return reply.status(200).send({
        success: true,
        message: 'Stage updated successfully',
        data: stage,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error updating stage:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error updating stage',
      });
    }
  };

  /**
   * DELETE /api/v1/funnels/stages/:stageId
   * Deleta etapa do funil
   */
  deleteStage = async (
    request: FastifyRequest<{ Params: { stageId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { stageId } = request.params;
      const userId = request.user!.userId;

      await this.funnelService.deleteStage(stageId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Stage deleted successfully',
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error deleting stage:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error deleting stage',
      });
    }
  };

  /**
   * POST /api/v1/funnels/connections
   * Cria conexão entre etapas
   */
  createConnection = async (
    request: FastifyRequest<{
      Body: {
        fromStageId: string;
        toStageId: string;
        label?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user!.userId;
      const data = request.body;

      const connection = await this.funnelService.createConnection(userId, data);

      return reply.status(201).send({
        success: true,
        message: 'Connection created successfully',
        data: connection,
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error creating connection:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error creating connection',
      });
    }
  };

  /**
   * DELETE /api/v1/funnels/connections/:connectionId
   * Deleta conexão entre etapas
   */
  deleteConnection = async (
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { connectionId } = request.params;
      const userId = request.user!.userId;

      await this.funnelService.deleteConnection(connectionId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Connection deleted successfully',
      });
    } catch (error: any) {
      logger.error('[FunnelController] Error deleting connection:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        message: error.message || 'Error deleting connection',
      });
    }
  };
}

