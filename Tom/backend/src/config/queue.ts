import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

// Configuração base para todas as queues
const queueConfig: QueueOptions = {
  connection: {
    ...getRedisClient(),
    maxRetriesPerRequest: null, // OBRIGATÓRIO para BullMQ
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: {
      count: 100, // Manter últimos 100 jobs completos
      age: 24 * 3600, // 24 horas
    },
    removeOnFail: {
      count: 500, // Manter últimos 500 jobs falhados
      age: 7 * 24 * 3600, // 7 dias
    },
  },
};

// Queue para sincronização de mensagens
export const syncQueue = new Queue('sync-messages', queueConfig);

// Queue para envio de notificações
export const notificationQueue = new Queue('notifications', queueConfig);

// Queue para processamento de mídia
export const mediaQueue = new Queue('media-processing', queueConfig);

// Queue para limpeza de dados antigos
export const cleanupQueue = new Queue('cleanup', queueConfig);

// Inicializar queues
export async function initializeQueues(): Promise<void> {
  try {
    logger.info('📋 Initializing job queues...');
    
    // Verificar conexão
    await syncQueue.waitUntilReady();
    await notificationQueue.waitUntilReady();
    await mediaQueue.waitUntilReady();
    await cleanupQueue.waitUntilReady();
    
    logger.info('✅ Job queues initialized successfully');
    logger.info(`   - Sync Queue: ${syncQueue.name}`);
    logger.info(`   - Notification Queue: ${notificationQueue.name}`);
    logger.info(`   - Media Queue: ${mediaQueue.name}`);
    logger.info(`   - Cleanup Queue: ${cleanupQueue.name}`);
  } catch (error) {
    logger.error('❌ Failed to initialize queues:', error);
    throw error;
  }
}

// Fechar todas as queues
export async function closeQueues(): Promise<void> {
  await Promise.all([
    syncQueue.close(),
    notificationQueue.close(),
    mediaQueue.close(),
    cleanupQueue.close(),
  ]);
  logger.info('Job queues closed');
}

// Tipos de jobs
export interface SyncJob {
  type: 'conversation' | 'connection' | 'all';
  conversationId?: string;
  connectionId?: string;
  userId?: string;
}

export interface NotificationJob {
  userId: string;
  type: 'new_message' | 'conversation_assigned' | 'mention';
  data: any;
}

export interface MediaJob {
  messageId: string;
  mediaUrl: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

export interface CleanupJob {
  type: 'old_messages' | 'temp_files' | 'expired_sessions';
  olderThan?: Date;
}
