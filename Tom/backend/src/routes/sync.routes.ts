import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// import { SyncService } from '../services/sync.service'; // DESABILITADO - serviço removido
import { authenticate } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

export async function syncRoutes(fastify: FastifyInstance) {
  /**
   * Sincronizar mensagens de uma conversa específica
   * POST /api/v1/sync/conversation/:conversationId
   * DESABILITADO - SyncService foi removido
   */
  fastify.post('/conversation/:conversationId', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    return reply.status(501).send({
      success: false,
      message: 'Sync service is currently disabled',
    });
  });

  /**
   * Sincronizar todas as conversas ativas
   * POST /api/v1/sync/all
   * DESABILITADO - SyncService foi removido
   */
  fastify.post('/all', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send({
      success: false,
      message: 'Sync service is currently disabled',
    });
  });

  /**
   * Obter status da sincronização
   * GET /api/v1/sync/status
   */
  fastify.get('/status', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Contar mensagens com e sem externalId
    const totalMessages = await prisma.message.count();
    const messagesWithExternalId = await prisma.message.count({
      where: { externalId: { not: null } },
    });
    const messagesWithoutExternalId = totalMessages - messagesWithExternalId;

    // Contar conversas ativas
    const activeConversations = await prisma.conversation.count({
      where: { status: { in: ['waiting', 'in_progress'] } },
    });

    await prisma.$disconnect();

    return reply.send({
      success: true,
      data: {
        totalMessages,
        messagesWithExternalId,
        messagesWithoutExternalId,
        activeConversations,
        syncPercentage: totalMessages > 0 
          ? Math.round((messagesWithExternalId / totalMessages) * 100) 
          : 0,
      },
    });
  } catch (error: any) {
    logger.error('Error getting sync status:', error);
    return reply.status(500).send({
      success: false,
      message: error.message || 'Erro ao obter status',
    });
  }
  });
}
