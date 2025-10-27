/**
 * Sistema de Cache com Redis
 * Melhora performance armazenando resultados de queries frequentes
 */

import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

export class CacheService {
  private redis = getRedisClient();
  private defaultTTL = 300; // 5 minutos padrão

  /**
   * Buscar do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Salvar no cache
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Cache SET error for ${key}:`, error);
    }
  }

  /**
   * Deletar do cache
   */
  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        if (key.length > 0) {
          await this.redis.del(...key);
          logger.debug(`Cache DEL: ${key.join(', ')}`);
        }
      } else {
        await this.redis.del(key);
        logger.debug(`Cache DEL: ${key}`);
      }
    } catch (error) {
      logger.error(`Cache DEL error:`, error);
    }
  }

  /**
   * Deletar por padrão (ex: "user:*")
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache DEL pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Wrapper para cachear resultado de função
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Tentar buscar do cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Executar função e cachear resultado
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Incrementar contador
   */
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      if (ttl) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error(`Cache INCR error for ${key}:`, error);
      return 0;
    }
  }

  /**
   * Verificar se existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache EXISTS error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Obter múltiplas chaves
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      const values = await this.redis.mget(...keys);
      return values.map(v => (v ? JSON.parse(v) : null));
    } catch (error) {
      logger.error(`Cache MGET error:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Limpar todo o cache
   */
  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
    }
  }

  /**
   * Obter estatísticas do cache
   */
  async stats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const info = await this.redis.info('stats');
      const keys = await this.redis.dbsize();
      
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

      return {
        keys,
        memory: memoryMatch ? memoryMatch[1] : '0',
        hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
        misses: missesMatch ? parseInt(missesMatch[1]) : 0,
      };
    } catch (error) {
      logger.error('Cache STATS error:', error);
      return { keys: 0, memory: '0', hits: 0, misses: 0 };
    }
  }
}

// Singleton
export const cache = new CacheService();

/**
 * Chaves de cache padronizadas
 */
export const CacheKeys = {
  // Usuários
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userList: (page: number, limit: number) => `users:list:${page}:${limit}`,
  userDepartments: (userId: string) => `user:${userId}:departments`,
  userRoles: (userId: string) => `user:${userId}:roles`,

  // Conversas
  conversation: (id: string) => `conversation:${id}`,
  conversationList: (filters: string) => `conversations:list:${filters}`,
  conversationMessages: (id: string, page: number) => `conversation:${id}:messages:${page}`,
  conversationMetrics: (id: string) => `conversation:${id}:metrics`,

  // Contatos
  contact: (id: string) => `contact:${id}`,
  contactByPhone: (phone: string) => `contact:phone:${phone}`,
  contactList: (page: number) => `contacts:list:${page}`,

  // Departamentos
  department: (id: string) => `department:${id}`,
  departmentList: () => `departments:list`,
  departmentActive: () => `departments:active`,

  // Tags
  tag: (id: string) => `tag:${id}`,
  tagList: () => `tags:list`,

  // Templates
  template: (id: string) => `template:${id}`,
  templateList: (departmentId?: string) => 
    departmentId ? `templates:dept:${departmentId}` : `templates:list`,

  // Conexões WhatsApp
  connection: (id: string) => `connection:${id}`,
  connectionList: () => `connections:list`,
  connectionActive: () => `connections:active`,

  // Métricas
  metrics: (type: string, period: string) => `metrics:${type}:${period}`,
  dashboardStats: () => `dashboard:stats`,

  // Kanban
  kanbanStages: () => `kanban:stages`,
  kanbanBoard: (filters: string) => `kanban:board:${filters}`,
};

/**
 * TTLs recomendados (em segundos)
 */
export const CacheTTL = {
  SHORT: 60,        // 1 minuto - dados que mudam frequentemente
  MEDIUM: 300,      // 5 minutos - dados moderados
  LONG: 1800,       // 30 minutos - dados estáveis
  VERY_LONG: 3600,  // 1 hora - dados raramente alterados
  DAY: 86400,       // 1 dia - dados quase estáticos
};
