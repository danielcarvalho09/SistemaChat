import { FastifyRequest, FastifyReply } from 'fastify';
import { BroadcastService } from '../services/broadcast.service.js';
import { logger } from '../config/logger.js';

interface SendBroadcastBody {
  connectionId: string;
  listId: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  privacyPolicyUrl?: string;
}

export class BroadcastController {
  private broadcastService = new BroadcastService();

  // Enviar mensagem em massa
  sendBroadcast = async (request: FastifyRequest<{ Body: SendBroadcastBody }>, reply: FastifyReply) => {
    const { connectionId, listId, message, mediaUrl, mediaType, privacyPolicyUrl } = request.body;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    if (!connectionId || !listId || !message) {
      return reply.status(400).send({
        success: false,
        message: 'ConnectionId, listId e message são obrigatórios',
      });
    }

    const result = await this.broadcastService.sendBroadcast({
      userId,
      connectionId,
      listId,
      message,
      mediaUrl,
      mediaType,
      privacyPolicyUrl,
    });

    logger.info(`Broadcast iniciado: ${result.id}`);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  };

  // Obter histórico de broadcasts
  getBroadcastHistory = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const history = await this.broadcastService.getBroadcastHistory(userId);

    return reply.status(200).send({
      success: true,
      data: history,
    });
  };

  // Obter detalhes de um broadcast específico
  getBroadcastDetails = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const details = await this.broadcastService.getBroadcastDetails(id, userId);

    return reply.status(200).send({
      success: true,
      data: details,
    });
  };

  // Cancelar broadcast em andamento
  cancelBroadcast = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    await this.broadcastService.cancelBroadcast(id, userId);

    return reply.status(200).send({
      success: true,
      message: 'Broadcast cancelado com sucesso',
    });
  };

  // Obter configurações de intervalo
  getIntervalConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const config = await this.broadcastService.getIntervalConfig(userId);

    return reply.status(200).send({
      success: true,
      data: config,
    });
  };

  // Atualizar configurações de intervalo
  updateIntervalConfig = async (
    request: FastifyRequest<{ Body: { minInterval: number; maxInterval: number } }>,
    reply: FastifyReply
  ) => {
    const userId = request.user?.userId;
    const { minInterval, maxInterval } = request.body;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    if (!minInterval || !maxInterval) {
      return reply.status(400).send({
        success: false,
        message: 'minInterval e maxInterval são obrigatórios',
      });
    }

    if (minInterval < 1 || maxInterval < minInterval) {
      return reply.status(400).send({
        success: false,
        message: 'Intervalos inválidos',
      });
    }

    const config = await this.broadcastService.updateIntervalConfig(userId, {
      minInterval,
      maxInterval,
    });

    logger.info(`Configuração de intervalo atualizada: ${userId}`);

    return reply.status(200).send({
      success: true,
      data: config,
    });
  };
}
