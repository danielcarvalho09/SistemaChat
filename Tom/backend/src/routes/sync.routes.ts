import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// import { SyncService } from '../services/sync.service.js'; // DESABILITADO - serviço removido
import { authenticate } from '../middlewares/auth.middleware.js';
import { logger } from '../config/logger.js';

export async function syncRoutes(fastify: FastifyInstance) {
  /**
   * Sincronizar mensagens de uma conversa específica
   * POST /api/v1/sync/conversation/:conversationId
   */
  fastify.post('/conversation/:conversationId', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      // Buscar conversa
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });

      if (!conversation) {
        await prisma.$disconnect();
        return reply.status(404).send({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Sincronizar via Baileys
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      const success = await baileysManager.syncConversationMessages(
        conversation.connectionId,
        conversation.contact.phoneNumber
      );

      await prisma.$disconnect();

      if (success) {
        return reply.send({
          success: true,
          message: 'Conversation sync triggered successfully',
        });
      } else {
        return reply.status(500).send({
          success: false,
          message: 'Failed to trigger sync - connection may be offline',
        });
      }
    } catch (error: any) {
      logger.error('Error syncing conversation:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error syncing conversation',
      });
    }
  });

  /**
   * Sincronizar todas as conversas ativas de uma conexão
   * POST /api/v1/sync/connection/:connectionId
   */
  fastify.post('/connection/:connectionId', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { connectionId } = request.params;

      // Sincronizar via Baileys
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      const syncedCount = await baileysManager.syncAllActiveConversations(connectionId);

      return reply.send({
        success: true,
        message: `Synced ${syncedCount} conversations successfully`,
        syncedCount,
      });
    } catch (error: any) {
      logger.error('Error syncing connection:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error syncing connection',
      });
    }
  });

  /**
   * Sincronizar todas as conversas ativas (SIMPLES)
   * POST /api/v1/sync/all
   */
  fastify.post('/all', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Buscar todas as conexões ativas
      const connections = await prisma.whatsAppConnection.findMany({
        where: { status: 'connected' },
      });

      await prisma.$disconnect();

      if (connections.length === 0) {
        return reply.send({
          success: true,
          message: 'No active connections to sync',
          totalSynced: 0,
        });
      }

      // Sincronizar cada conexão
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      let totalSynced = 0;

      for (const connection of connections) {
        const synced = await baileysManager.syncAllActiveConversations(connection.id);
        totalSynced += synced;
      }

      return reply.send({
        success: true,
        message: `Synced ${totalSynced} conversations from ${connections.length} connections`,
        totalSynced,
        connectionsProcessed: connections.length,
      });
    } catch (error: any) {
      logger.error('Error syncing all:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error syncing all conversations',
      });
    }
  });

  /**
   * SINCRONIZAÇÃO COMPLETA E ROBUSTA - Para Cronjobs
   * POST /api/v1/sync/full-system
   * Endpoint otimizado para ser chamado por cronjobs externos
   * Não requer autenticação (pode ser chamado por cron-job.org)
   */
  fastify.post('/full-system', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('🚀 FULL SYSTEM SYNC requested (via cronjob)');
      
      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      const result = await baileysManager.syncAllConnections();

      return reply.send({
        success: true,
        message: `Full system sync completed successfully`,
        data: {
          totalConnections: result.totalConnections,
          syncedConversations: result.syncedConversations,
          gapsRecovered: result.gapsRecovered,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Error in full system sync:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error in full system sync',
      });
    }
  });

  /**
   * Detectar e Recuperar GAPS (Mensagens Perdidas)
   * POST /api/v1/sync/detect-gaps/:connectionId
   */
  fastify.post('/detect-gaps/:connectionId', { preHandler: [authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { connectionId } = request.params;

      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      const result = await baileysManager.detectAndRecoverGaps(connectionId);

      return reply.send({
        success: true,
        message: `Gap detection completed`,
        data: {
          gapsFound: result.gapsFound,
          gapsRecovered: result.recovered,
        },
      });
    } catch (error: any) {
      logger.error('Error detecting gaps:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error detecting gaps',
      });
    }
  });

  /**
   * Detectar e Recuperar GAPS de TODAS as conexões
   * POST /api/v1/sync/detect-all-gaps
   */
  fastify.post('/detect-all-gaps', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const connections = await prisma.whatsAppConnection.findMany({
        where: { status: 'connected' },
      });

      await prisma.$disconnect();

      if (connections.length === 0) {
        return reply.send({
          success: true,
          message: 'No active connections',
          totalGaps: 0,
          totalRecovered: 0,
        });
      }

      const { baileysManager } = await import('../whatsapp/baileys.manager.js');
      let totalGaps = 0;
      let totalRecovered = 0;

      for (const connection of connections) {
        const result = await baileysManager.detectAndRecoverGaps(connection.id);
        totalGaps += result.gapsFound;
        totalRecovered += result.recovered;
      }

      return reply.send({
        success: true,
        message: `Gap detection completed for ${connections.length} connections`,
        data: {
          connectionsProcessed: connections.length,
          totalGapsFound: totalGaps,
          totalGapsRecovered: totalRecovered,
        },
      });
    } catch (error: any) {
      logger.error('Error detecting all gaps:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error detecting all gaps',
      });
    }
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

    // Obter estatísticas da queue
    const { syncQueueService } = await import('../services/sync-queue.service.js');
    const queueStats = syncQueueService.getStats();

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
        syncQueue: queueStats,
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

  /**
   * Obter estatísticas da queue de sincronização
   * GET /api/v1/sync/queue-stats
   */
  fastify.get('/queue-stats', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { syncQueueService } = await import('../services/sync-queue.service.js');
      const stats = syncQueueService.getStats();

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting queue stats:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Error getting queue stats',
      });
    }
  });
}
