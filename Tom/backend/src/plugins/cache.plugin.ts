/**
 * Plugin de Cache para Fastify
 * Acelera respostas usando Redis
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { cache, CacheKeys, CacheTTL } from '../config/cache.js';
import { logger } from '../config/logger.js';

/**
 * Gerar chave de cache baseada na requisição
 */
function generateCacheKey(request: FastifyRequest, prefix: string = 'route'): string {
  const { method, url } = request;
  const userId = (request as any).user?.id || 'anonymous';
  
  // Incluir query params na chave
  const queryString = JSON.stringify(request.query);
  
  return `${prefix}:${method}:${url}:${userId}:${queryString}`;
}

/**
 * Decorator para adicionar cache em rotas
 */
async function cachePlugin(fastify: FastifyInstance) {
  // Decorator para habilitar cache em uma rota
  fastify.decorateRequest('cacheKey', null);
  fastify.decorateRequest('cacheTTL', null);

  /**
   * Hook para verificar cache antes de processar a requisição
   */
  fastify.addHook('preHandler', async (request: any, reply) => {
    // Só cachear GET requests
    if (request.method !== 'GET') {
      return;
    }

    // Verificar se a rota tem cache habilitado
    const routeConfig = request.routeConfig as any;
    if (!routeConfig?.cache) {
      return;
    }

    const ttl = routeConfig.cache.ttl || CacheTTL.MEDIUM;
    const keyPrefix = routeConfig.cache.prefix || 'route';
    const cacheKey = generateCacheKey(request, keyPrefix);

    try {
      // Tentar buscar do cache
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache HIT: ${cacheKey}`);
        
        // Retornar dados do cache
        reply.send({
          ...cachedData,
          _cached: true,
          _cachedAt: new Date().toISOString(),
        });
        
        return reply;
      }

      // Cache miss - armazenar chave e TTL para usar no onSend
      request.cacheKey = cacheKey;
      request.cacheTTL = ttl;
      
      logger.debug(`Cache MISS: ${cacheKey}`);
    } catch (error) {
      logger.error('Cache preHandler error:', error);
    }
  });

  /**
   * Hook para salvar resposta no cache
   */
  fastify.addHook('onSend', async (request: any, reply, payload) => {
    // Só cachear se tiver chave definida (GET request com cache habilitado)
    if (!request.cacheKey) {
      return payload;
    }

    // Só cachear respostas de sucesso
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      try {
        // Parse do payload se for string
        let data = payload;
        if (typeof payload === 'string') {
          try {
            data = JSON.parse(payload);
          } catch (e) {
            // Se não for JSON válido, não cachear
            return payload;
          }
        }

        // Salvar no cache
        await cache.set(request.cacheKey, data, request.cacheTTL);
        logger.debug(`Cache SAVED: ${request.cacheKey} (TTL: ${request.cacheTTL}s)`);
      } catch (error) {
        logger.error('Cache onSend error:', error);
      }
    }

    return payload;
  });
}

export default fp(cachePlugin, {
  name: 'cache-plugin',
});

/**
 * Configuração de cache para rotas
 */
export interface CacheConfig {
  ttl?: number;
  prefix?: string;
}

/**
 * Helper para adicionar cache em rotas
 */
export function withCache(config: CacheConfig = {}) {
  return {
    cache: {
      ttl: config.ttl || CacheTTL.MEDIUM,
      prefix: config.prefix || 'route',
    },
  };
}
