import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health - Health check simples
   */
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /health/detailed - Health check detalhado com todas as dependências
   */
  fastify.get('/health/detailed', async (request, reply) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      services: {},
    };

    // Check Database
    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      health.services.database = { status: 'healthy', latency: 0 };
    } catch (error) {
      health.status = 'degraded';
      health.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Database health check failed:', error);
    }

    // Check Redis
    try {
      const redis = getRedisClient();
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      health.services.redis = { status: 'healthy', latency };
    } catch (error) {
      health.status = 'degraded';
      health.services.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Redis health check failed:', error);
    }

    // Check disk space (se disponível)
    try {
      const { execSync } = await import('child_process');
      const diskSpace = execSync('df -h / | tail -1').toString().trim();
      const parts = diskSpace.split(/\s+/);
      health.disk = {
        available: parts[3],
        used: parts[4],
      };
    } catch (error) {
      // Silenciosamente ignora se não conseguir obter info de disco
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  /**
   * GET /health/readiness - Verifica se a aplicação está pronta para receber tráfego
   */
  fastify.get('/health/readiness', async (request, reply) => {
    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      
      const redis = getRedisClient();
      await redis.ping();

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      return reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /health/liveness - Verifica se a aplicação está viva
   */
  fastify.get('/health/liveness', async (request, reply) => {
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
}
