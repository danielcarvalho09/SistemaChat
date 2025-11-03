import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '../config/redis.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

interface RateLimitOptions {
  max: number; // Máximo de requisições
  windowMs: number; // Janela de tempo em milissegundos
  message?: string;
  keyGenerator?: (request: FastifyRequest) => string;
}

/**
 * Middleware de rate limiting usando Redis
 */
export const rateLimit = (options: RateLimitOptions) => {
  const {
    max = config.security.rateLimitMax,
    windowMs = config.security.rateLimitWindowMs,
    message = 'Too many requests, please try again later',
    keyGenerator = (request: FastifyRequest) => {
      // Por padrão, usa IP do cliente
      return request.ip;
    },
  } = options;

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const redis = getRedisClient();
      const key = `ratelimit:${keyGenerator(request)}`;

      // Incrementar contador
      const current = await redis.incr(key);

      // Se é a primeira requisição, definir expiração
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }

      // Obter TTL restante
      const ttl = await redis.pttl(key);

      // Adicionar headers de rate limit
      reply.header('X-RateLimit-Limit', max);
      reply.header('X-RateLimit-Remaining', Math.max(0, max - current));
      reply.header('X-RateLimit-Reset', Date.now() + ttl);

      // Verificar se excedeu o limite
      if (current > max) {
        logger.warn(`Rate limit exceeded for key: ${key}`);
        return reply.status(429).send({
          statusCode: 429,
          message,
          retryAfter: Math.ceil(ttl / 1000),
        });
      }
    } catch (error) {
      logger.error('Rate limit error:', error);
      // Em caso de erro no Redis, permitir a requisição
    }
  };
};

/**
 * Rate limit específico para autenticação (mais restritivo)
 * Previne ataques de brute force combinando IP + email
 */
export const authRateLimit = rateLimit({
  max: config.server.isDevelopment ? 100 : 5, // 100 em dev, 5 em prod
  windowMs: config.server.isDevelopment ? 60 * 1000 : 15 * 60 * 1000, // 1min em dev, 15min em prod
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (request: FastifyRequest) => {
    // Combinar IP + email para prevenir brute force distribuído
    const body = request.body as any;
    const email = body?.email || 'unknown';
    return `${request.ip}:${email}`;
  },
});

/**
 * Rate limit MUITO agressivo para login falho
 * Bloqueia IP após 3 tentativas falhas consecutivas
 */
export const loginFailureRateLimit = rateLimit({
  max: config.server.isDevelopment ? 50 : 3, // 50 em dev, 3 em prod
  windowMs: config.server.isDevelopment ? 60 * 1000 : 30 * 60 * 1000, // 1min em dev, 30min em prod
  message: 'Too many failed login attempts. Your IP has been temporarily blocked. Please try again in 30 minutes.',
  keyGenerator: (request: FastifyRequest) => {
    return `${request.ip}:failed-login`;
  },
});

/**
 * Rate limit para usuários autenticados (menos restritivo)
 */
export const authenticatedRateLimit = rateLimit({
  max: 1000,
  windowMs: 15 * 60 * 1000, // 15 minutos
  keyGenerator: (request: FastifyRequest) => {
    return request.user?.userId || request.ip;
  },
});

/**
 * Rate limit para APIs públicas
 */
export const publicRateLimit = rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutos
});
