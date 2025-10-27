import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/rateLimit.middleware.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authController = new AuthController();

  // Rotas públicas (com rate limiting mais restritivo)
  fastify.post('/register', {
    preHandler: [authRateLimit],
    handler: authController.register,
  });

  fastify.post('/login', {
    preHandler: [authRateLimit],
    handler: authController.login,
  });

  fastify.post('/refresh', {
    preHandler: [authRateLimit],
    handler: authController.refresh,
  });

  // Rotas protegidas
  fastify.post('/logout', {
    preHandler: [authenticate],
    handler: authController.logout,
  });

  fastify.get('/me', {
    preHandler: [authenticate],
    handler: authController.me,
  });
}
