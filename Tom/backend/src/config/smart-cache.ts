/**
 * Cache Inteligente
 * Carrega 1x, usa sempre. Só recarrega quando há mudanças.
 */

import { cache, CacheTTL } from './cache.js';
import { logger } from './logger.js';

export class SmartCache {
  /**
   * Buscar dados com cache de longa duração
   * Só busca do banco na primeira vez ou após invalidação
   */
  static async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CacheTTL.VERY_LONG // 1 hora por padrão
  ): Promise<{ data: T; fromCache: boolean }> {
    // Tentar buscar do cache
    const cached = await cache.get<T>(key);
    
    if (cached) {
      logger.debug(`✨ Smart cache HIT: ${key}`);
      return { data: cached, fromCache: true };
    }
    
    // Cache miss - buscar do banco
    logger.info(`🔍 Smart cache MISS: ${key} - Fetching from database`);
    const data = await fetchFn();
    
    // Cachear por tempo longo
    await cache.set(key, data, ttl);
    logger.debug(`💾 Cached for ${ttl}s: ${key}`);
    
    return { data, fromCache: false };
  }

  /**
   * Invalidar cache quando dados mudam
   */
  static async invalidate(pattern: string): Promise<void> {
    logger.info(`🗑️  Smart cache INVALIDATE: ${pattern}`);
    await cache.delPattern(pattern);
  }

  /**
   * Invalidar múltiplos padrões
   */
  static async invalidateMany(patterns: string[]): Promise<void> {
    logger.info(`🗑️  Smart cache INVALIDATE MANY: ${patterns.join(', ')}`);
    await Promise.all(patterns.map(p => cache.delPattern(p)));
  }

  /**
   * Atualizar cache após mutation (optimistic update)
   */
  static async updateAfterMutation<T>(
    key: string,
    newData: T,
    invalidatePatterns: string[] = [],
    ttl: number = CacheTTL.VERY_LONG
  ): Promise<void> {
    // Atualizar cache com novos dados
    await cache.set(key, newData, ttl);
    logger.debug(`✅ Cache updated: ${key}`);
    
    // Invalidar caches relacionados
    if (invalidatePatterns.length > 0) {
      await this.invalidateMany(invalidatePatterns);
    }
  }

  /**
   * Pré-aquecer cache (warm-up)
   */
  static async warmUp<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CacheTTL.VERY_LONG
  ): Promise<void> {
    logger.info(`🔥 Warming up cache: ${key}`);
    const data = await fetchFn();
    await cache.set(key, data, ttl);
  }

  /**
   * Verificar se cache existe
   */
  static async exists(key: string): Promise<boolean> {
    return await cache.exists(key);
  }

  /**
   * Obter estatísticas do cache
   */
  static async getStats() {
    return await cache.stats();
  }
}

/**
 * Decorator para métodos de controller
 * Adiciona cache inteligente automaticamente
 */
export function WithSmartCache(
  keyFn: (...args: any[]) => string,
  ttl: number = CacheTTL.VERY_LONG
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyFn(...args);
      
      const { data, fromCache } = await SmartCache.getOrFetch(
        cacheKey,
        () => originalMethod.apply(this, args),
        ttl
      );

      return { ...(data as object), _fromCache: fromCache } as any;
    };

    return descriptor;
  };
}
