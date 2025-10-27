/**
 * Helpers para invalidação de cache
 * Centraliza a lógica de limpeza de cache
 */

import { cache } from '../config/cache';
import { logger } from '../config/logger';

/**
 * Invalidar cache relacionado a conversas
 */
export async function invalidateConversationCache(conversationId?: string) {
  try {
    if (conversationId) {
      await cache.delPattern(`*conversation*${conversationId}*`);
    }
    await cache.delPattern('*conversations*');
    await cache.delPattern('*dashboard*');
    logger.debug('Conversation cache invalidated');
  } catch (error) {
    logger.error('Error invalidating conversation cache:', error);
  }
}

/**
 * Invalidar cache relacionado a usuários
 */
export async function invalidateUserCache(userId?: string) {
  try {
    if (userId) {
      await cache.delPattern(`*user*${userId}*`);
    }
    await cache.delPattern('*users*');
    logger.debug('User cache invalidated');
  } catch (error) {
    logger.error('Error invalidating user cache:', error);
  }
}

/**
 * Invalidar cache relacionado a departamentos
 */
export async function invalidateDepartmentCache(departmentId?: string) {
  try {
    if (departmentId) {
      await cache.delPattern(`*department*${departmentId}*`);
    }
    await cache.delPattern('*departments*');
    logger.debug('Department cache invalidated');
  } catch (error) {
    logger.error('Error invalidating department cache:', error);
  }
}

/**
 * Invalidar cache relacionado a contatos
 */
export async function invalidateContactCache(contactId?: string) {
  try {
    if (contactId) {
      await cache.delPattern(`*contact*${contactId}*`);
    }
    await cache.delPattern('*contacts*');
    logger.debug('Contact cache invalidated');
  } catch (error) {
    logger.error('Error invalidating contact cache:', error);
  }
}

/**
 * Invalidar cache relacionado a mensagens
 */
export async function invalidateMessageCache(conversationId: string) {
  try {
    await cache.delPattern(`*conversation*${conversationId}*messages*`);
    await cache.delPattern(`*conversation*${conversationId}*`);
    logger.debug('Message cache invalidated');
  } catch (error) {
    logger.error('Error invalidating message cache:', error);
  }
}

/**
 * Invalidar cache relacionado a tags
 */
export async function invalidateTagCache(tagId?: string) {
  try {
    if (tagId) {
      await cache.delPattern(`*tag*${tagId}*`);
    }
    await cache.delPattern('*tags*');
    logger.debug('Tag cache invalidated');
  } catch (error) {
    logger.error('Error invalidating tag cache:', error);
  }
}

/**
 * Invalidar cache relacionado a conexões WhatsApp
 */
export async function invalidateConnectionCache(connectionId?: string) {
  try {
    if (connectionId) {
      await cache.delPattern(`*connection*${connectionId}*`);
    }
    await cache.delPattern('*connections*');
    logger.debug('Connection cache invalidated');
  } catch (error) {
    logger.error('Error invalidating connection cache:', error);
  }
}

/**
 * Invalidar cache do dashboard
 */
export async function invalidateDashboardCache() {
  try {
    await cache.delPattern('*dashboard*');
    await cache.delPattern('*stats*');
    await cache.delPattern('*metrics*');
    logger.debug('Dashboard cache invalidated');
  } catch (error) {
    logger.error('Error invalidating dashboard cache:', error);
  }
}

/**
 * Invalidar cache do Kanban
 */
export async function invalidateKanbanCache() {
  try {
    await cache.delPattern('*kanban*');
    logger.debug('Kanban cache invalidated');
  } catch (error) {
    logger.error('Error invalidating kanban cache:', error);
  }
}

/**
 * Invalidar todo o cache (usar com cuidado!)
 */
export async function invalidateAllCache() {
  try {
    await cache.flush();
    logger.warn('ALL cache invalidated');
  } catch (error) {
    logger.error('Error invalidating all cache:', error);
  }
}
