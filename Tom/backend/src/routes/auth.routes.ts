import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authController = new AuthController();

  fastify.post('/register', {
    handler: authController.register,
  });

  fastify.post('/login', {
    handler: authController.login,
  });

  fastify.post('/refresh', {
    handler: authController.refresh,
  });

  fastify.post('/logout', {
    handler: authController.logout,
  });

  fastify.get('/me', {
    handler: authController.me,
  });
}
