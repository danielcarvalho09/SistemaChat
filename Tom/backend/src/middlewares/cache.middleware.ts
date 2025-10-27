/**
 * Middleware de Cache para rotas Express
 */

import { Request, Response, NextFunction } from 'express';
import { cache } from '../config/cache';
import { logger } from '../config/logger';

/**
 * Gerar chave de cache baseada na requisição
 */
function generateCacheKey(req: Request, prefix: string = 'route'): string {
  const { method, originalUrl } = req;
  const user = (req as any).user;
  const userId = user?.id || 'anonymous';
  
  // Incluir query params na chave
  const queryString = JSON.stringify(req.query);
  
  return `${prefix}:${method}:${originalUrl}:${userId}:${queryString}`;
}

/**
 * Middleware de cache para rotas GET
 * 
 * @param ttl - Tempo de vida do cache em segundos
 * @param keyPrefix - Prefixo para a chave de cache
 * 
 * @example
 * router.get('/users', cacheMiddleware(300), userController.list);
 */
export function cacheMiddleware(ttl: number = 300, keyPrefix?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Só cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(req, keyPrefix);

    try {
      // Tentar buscar do cache
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache hit for: ${cacheKey}`);
        return res.json({
          ...cachedData,
          _cached: true,
          _cachedAt: new Date().toISOString(),
        });
      }

      // Cache miss - interceptar res.json para cachear a resposta
      const originalJson = res.json.bind(res);

      res.json = function (data: any) {
        // Só cachear respostas de sucesso (200-299)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, data, ttl).catch(err => {
            logger.error('Error caching response:', err);
          });
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware para invalidar cache após mutations (POST, PUT, DELETE, PATCH)
 * 
 * @param patterns - Padrões de chaves para invalidar
 * 
 * @example
 * router.post('/users', invalidateCacheMiddleware(['user:*', 'users:*']), userController.create);
 */
export function invalidateCacheMiddleware(patterns: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Interceptar res.json para invalidar cache após resposta bem-sucedida
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      // Só invalidar em respostas de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300) {
        Promise.all(patterns.map(pattern => cache.delPattern(pattern)))
          .catch(err => {
            logger.error('Error invalidating cache:', err);
          });
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware para cachear por usuário específico
 */
export function userCacheMiddleware(ttl: number = 300) {
  return cacheMiddleware(ttl, 'user-route');
}

/**
 * Middleware para cachear dados públicos (sem autenticação)
 */
export function publicCacheMiddleware(ttl: number = 600) {
  return cacheMiddleware(ttl, 'public');
}
