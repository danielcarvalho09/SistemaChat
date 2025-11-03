import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authRateLimit, loginFailureRateLimit } from '../middlewares/rateLimit.middleware.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authController = new AuthController();

  // ✅ Rotas públicas COM rate limiting agressivo
  fastify.post('/register', {
    preHandler: [authRateLimit], // ✅ 5 tentativas / 15min (produção)
    handler: authController.register,
  });

  fastify.post('/login', {
    preHandler: [authRateLimit, loginFailureRateLimit], // ✅ DUPLA proteção
    handler: authController.login,
  });

  fastify.post('/refresh', {
    preHandler: [authRateLimit], // ✅ 5 tentativas / 15min
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
