import { logger } from '../config/logger.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';

/**
 * Sistema de Queue para Sincronizações Pendentes
 * 
 * Gerencia uma fila de conversas que precisam ser sincronizadas
 * Útil para:
 * - Recuperar mensagens perdidas quando detectar gaps
 * - Processar sincronizações em lote sem sobrecarregar
 * - Retry automático de sincronizações falhadas
 */

interface SyncQueueItem {
  connectionId: string;
  phoneNumber: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retries: number;
  lastAttempt?: Date;
  reason: string; // Ex: "gap_detected", "manual_request", "periodic_sync"
}

export class SyncQueueService {
  private queue: SyncQueueItem[] = [];
  private processing = false;
  private maxRetries = 3;
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Inicia o processador de queue
   */
  start(): void {
    if (this.processing) {
      logger.warn('[SyncQueue] Already processing queue');
      return;
    }

    logger.info('[SyncQueue] 🚀 Starting sync queue processor...');
    this.processing = true;

    // Processar queue a cada 5 segundos
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(err => {
        logger.error('[SyncQueue] Error processing queue:', err);
      });
    }, 5000);
  }

  /**
   * Para o processador de queue
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.processing = false;
    logger.info('[SyncQueue] ⏹️  Sync queue processor stopped');
  }

  /**
   * Adiciona item à queue
   */
  enqueue(item: Omit<SyncQueueItem, 'retries' | 'lastAttempt'>): void {
    // Verificar se já existe na queue
    const exists = this.queue.some(
      q => q.connectionId === item.connectionId && q.phoneNumber === item.phoneNumber
    );

    if (exists) {
      logger.debug(`[SyncQueue] Item already in queue: ${item.phoneNumber}`);
      // Atualizar prioridade se a nova for maior
      const existingItem = this.queue.find(
        q => q.connectionId === item.connectionId && q.phoneNumber === item.phoneNumber
      );
      if (existingItem && this.getPriorityValue(item.priority) > this.getPriorityValue(existingItem.priority)) {
        existingItem.priority = item.priority;
        logger.info(`[SyncQueue] Updated priority to ${item.priority} for ${item.phoneNumber}`);
      }
      return;
    }

    // Adicionar à queue
    this.queue.push({
      ...item,
      retries: 0,
    });

    // Ordenar por prioridade (urgent > high > normal > low)
    this.queue.sort((a, b) => {
      return this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
    });

    logger.info(`[SyncQueue] ➕ Added to queue: ${item.phoneNumber} (priority: ${item.priority}, reason: ${item.reason})`);
    logger.debug(`[SyncQueue] Queue size: ${this.queue.length}`);
  }

  /**
   * Processa a queue
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return; // Queue vazia
    }

    // Pegar item de maior prioridade
    const item = this.queue.shift();
    if (!item) return;

    logger.info(`[SyncQueue] 🔄 Processing: ${item.phoneNumber} (priority: ${item.priority}, reason: ${item.reason}, attempt: ${item.retries + 1}/${this.maxRetries})`);

    try {
      // Tentar sincronizar
      const success = await baileysManager.syncConversationMessages(
        item.connectionId,
        item.phoneNumber,
        100 // Buscar mais mensagens para garantir
      );

      if (success) {
        logger.info(`[SyncQueue] ✅ Successfully synced: ${item.phoneNumber}`);
      } else {
        throw new Error('Sync returned false');
      }
    } catch (error) {
      logger.error(`[SyncQueue] ❌ Failed to sync ${item.phoneNumber}:`, error);

      // Incrementar retry
      item.retries++;
      item.lastAttempt = new Date();

      // Se não excedeu limite de retries, recolocar na queue
      if (item.retries < this.maxRetries) {
        logger.warn(`[SyncQueue] 🔄 Retry ${item.retries}/${this.maxRetries} for ${item.phoneNumber}`);
        // Reduzir prioridade em cada retry
        if (item.priority === 'urgent') item.priority = 'high';
        else if (item.priority === 'high') item.priority = 'normal';
        else if (item.priority === 'normal') item.priority = 'low';
        
        this.queue.push(item);
      } else {
        logger.error(`[SyncQueue] ❌ Max retries reached for ${item.phoneNumber}, giving up`);
      }
    }
  }

  /**
   * Converte prioridade em valor numérico para ordenação
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  /**
   * Obtém estatísticas da queue
   */
  getStats(): {
    queueSize: number;
    byPriority: Record<string, number>;
    isProcessing: boolean;
  } {
    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    this.queue.forEach(item => {
      byPriority[item.priority]++;
    });

    return {
      queueSize: this.queue.length,
      byPriority,
      isProcessing: this.processing,
    };
  }

  /**
   * Limpa queue
   */
  clear(): void {
    this.queue = [];
    logger.info('[SyncQueue] 🗑️  Queue cleared');
  }
}

// Singleton instance
export const syncQueueService = new SyncQueueService();

