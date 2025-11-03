import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { register } from '../config/metrics.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/metrics
   * Endpoint para Prometheus scraping
   * Requer autenticação
   */
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = await register.metrics();
        
        reply
          .header('Content-Type', register.contentType)
          .send(metrics);
      } catch (error) {
        reply.status(500).send({
          success: false,
          message: 'Failed to collect metrics',
        });
      }
    }
  );

  /**
   * GET /api/v1/metrics/health
   * Health check específico para métricas
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      success: true,
      message: 'Metrics endpoint is healthy',
      timestamp: new Date().toISOString(),
    });
  });
}
