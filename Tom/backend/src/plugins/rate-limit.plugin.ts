import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getRedisClient } from '../config/redis.js';

export async function rateLimitPlugin(fastify: FastifyInstance) {
  const redis = getRedisClient();

  await fastify.register(rateLimit, {
    global: true,
    max: 100, // 100 requests
    timeWindow: '1 minute',
    cache: 10000,
    redis: redis,
    skipOnError: false,
    ban: 5, // Ban após 5 violações
    continueExceeding: true,
    enableDraftSpec: true,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    }
  });

  fastify.log.info('✅ Rate limiting plugin registered');
}
