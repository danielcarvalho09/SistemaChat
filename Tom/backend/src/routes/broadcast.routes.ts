import { FastifyInstance } from 'fastify';
import { BroadcastController } from '../controllers/broadcast.controller';
import { authenticate } from '../middlewares/auth.middleware';

export async function broadcastRoutes(fastify: FastifyInstance) {
  const broadcastController = new BroadcastController();

  // Enviar broadcast
  fastify.post('/', {
    preHandler: [authenticate],
    handler: broadcastController.sendBroadcast,
  });

  // Histórico de broadcasts
  fastify.get('/history', {
    preHandler: [authenticate],
    handler: broadcastController.getBroadcastHistory,
  });

  // Configurações de intervalo
  fastify.get('/config/interval', {
    preHandler: [authenticate],
    handler: broadcastController.getIntervalConfig,
  });

  fastify.put('/config/interval', {
    preHandler: [authenticate],
    handler: broadcastController.updateIntervalConfig,
  });

  // Detalhes de um broadcast
  fastify.get('/:id', {
    preHandler: [authenticate],
    handler: broadcastController.getBroadcastDetails,
  });

  // Cancelar broadcast
  fastify.post('/:id/cancel', {
    preHandler: [authenticate],
    handler: broadcastController.cancelBroadcast,
  });
}
