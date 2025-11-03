import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { SyncJob } from '../config/queue.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getPrismaClient } from '../config/database.js';
import { getSocketServer } from '../websocket/socket.server.js';

const prisma = getPrismaClient();

// Worker para processar jobs de sincronização
export const syncWorker = new Worker<SyncJob>(
  'sync-messages',
  async (job: Job<SyncJob>) => {
    const { type, conversationId, connectionId, userId } = job.data;
    
    logger.info(`[SyncWorker] Processing job ${job.id}: ${type}`);
    
    try {
      let syncedCount = 0;
      
      switch (type) {
        case 'conversation':
          if (!conversationId) throw new Error('conversationId required');
          
          // Buscar conversa
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
          });
          
          if (!conversation) throw new Error('Conversation not found');
          
          // Sincronizar via Baileys
          const success = await baileysManager.syncConversationMessages(
            conversation.connectionId,
            conversation.contact.phoneNumber
          );
          
          syncedCount = success ? 1 : 0;
          
          // Notificar via WebSocket
          if (success && userId) {
            const socketServer = getSocketServer();
            socketServer.emitNotification(userId, {
              type: 'sync_complete',
              conversationId,
              message: 'Conversation synced successfully',
            });
          }
          
          break;
          
        case 'connection':
          if (!connectionId) throw new Error('connectionId required');
          
          syncedCount = await baileysManager.syncAllActiveConversations(connectionId);
          
          // Notificar via WebSocket
          if (userId) {
            const socketServer = getSocketServer();
            socketServer.emitNotification(userId, {
              type: 'sync_complete',
              connectionId,
              syncedCount,
              message: `${syncedCount} conversations synced`,
            });
          }
          
          break;
          
        case 'all':
          // Buscar todas conexões ativas
          const connections = await prisma.whatsAppConnection.findMany({
            where: { status: 'connected' },
          });
          
          for (const connection of connections) {
            const synced = await baileysManager.syncAllActiveConversations(connection.id);
            syncedCount += synced;
          }
          
          // Notificar via WebSocket
          if (userId) {
            const socketServer = getSocketServer();
            socketServer.emitNotification(userId, {
              type: 'sync_complete',
              syncedCount,
              connectionsProcessed: connections.length,
              message: `${syncedCount} conversations synced from ${connections.length} connections`,
            });
          }
          
          break;
      }
      
      // Atualizar progresso
      await job.updateProgress(100);
      
      logger.info(`[SyncWorker] ✅ Job ${job.id} completed: ${syncedCount} synced`);
      
      return { syncedCount, type };
      
    } catch (error) {
      logger.error(`[SyncWorker] ❌ Job ${job.id} failed:`, error);
      throw error; // BullMQ vai retentar automaticamente
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 5, // Processar até 5 jobs simultaneamente
    limiter: {
      max: 10, // Máximo 10 jobs
      duration: 1000, // Por segundo
    },
  }
);

// Event listeners
syncWorker.on('completed', (job) => {
  logger.info(`[SyncWorker] Job ${job.id} completed successfully`);
});

syncWorker.on('failed', (job, err) => {
  logger.error(`[SyncWorker] Job ${job?.id} failed:`, err);
});

syncWorker.on('error', (err) => {
  logger.error('[SyncWorker] Worker error:', err);
});

logger.info('✅ Sync worker initialized');
