import { FastifyInstance } from 'fastify';
import { QuickMessageController } from '../controllers/quick-message.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function quickMessageRoutes(fastify: FastifyInstance) {
  const controller = new QuickMessageController();

  fastify.addHook('preHandler', authenticate);

  fastify.post('/', controller.create);
  fastify.get('/', controller.list);
  fastify.get('/:id', controller.getById);
  fastify.patch('/:id', controller.update);
  fastify.delete('/:id', controller.delete);
  fastify.post('/reorder', controller.reorder);
}

