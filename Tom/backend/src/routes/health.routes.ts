import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /ping - Endpoint super leve para UptimeRobot/Cron-job
   * Evita que Railway/Render/Fly.io entrem em sleep
   * Use serviços como UptimeRobot, Cron-job.org ou BetterStack para pingar a cada 5 minutos
   */
  fastify.get('/ping', async (request, reply) => {
    return reply.send('pong');
  });

  /**
   * GET /keep-alive - Endpoint otimizado para manter servidor acordado
   * Além de responder, aciona pequenas tarefas para manter conexões ativas
   */
  fastify.get('/keep-alive', async (request, reply) => {
    try {
      // Ping no banco para manter conexão ativa
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;

      // Ping no Redis para manter conexão ativa
      const redis = getRedisClient();
      await redis.ping();

      return reply.send({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        message: 'Server is awake and all connections are active',
      });
    } catch (error) {
      logger.error('Keep-alive check failed:', error);
      return reply.status(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

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

  /**
   * GET /health/roles - Verifica se as roles estão configuradas
   */
  fastify.get('/health/roles', async (request, reply) => {
    try {
      const prisma = getPrismaClient();
      const roles = await prisma.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const hasAdmin = roles.some(r => r.name === 'admin');
      const hasUser = roles.some(r => r.name === 'user');
      const isConfigured = hasAdmin && hasUser;

      return reply.send({
        status: isConfigured ? 'configured' : 'missing_roles',
        timestamp: new Date().toISOString(),
        roles: roles,
        hasAdmin,
        hasUser,
        message: isConfigured 
          ? 'Roles configured correctly' 
          : 'Missing required roles. Run: node create-roles-only.js',
      });
    } catch (error) {
      logger.error('Roles check failed:', error);
      return reply.status(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
