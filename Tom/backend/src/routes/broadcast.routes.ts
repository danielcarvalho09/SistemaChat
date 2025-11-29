import { FastifyInstance } from 'fastify';
import { BroadcastController } from '../controllers/broadcast.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/authorization.middleware.js';

export async function broadcastRoutes(fastify: FastifyInstance) {
  const broadcastController = new BroadcastController();

  // ✅ Verificar permissão de broadcast (admin ou gerente)
  const broadcastAuth = [authenticate, requirePermission(['manage_broadcast', 'view_broadcast'])];

  // Enviar broadcast
  fastify.post('/', {
    preHandler: [authenticate, requirePermission(['manage_broadcast'])],
    handler: broadcastController.sendBroadcast,
  });

  // Histórico de broadcasts
  fastify.get('/history', {
    preHandler: [authenticate, requirePermission(['view_broadcast'])],
    handler: broadcastController.getBroadcastHistory,
  });

  // Configurações de intervalo
  fastify.get('/config/interval', {
    preHandler: [authenticate, requirePermission(['manage_broadcast_settings'])],
    handler: broadcastController.getIntervalConfig,
  });

  fastify.put('/config/interval', {
    preHandler: [authenticate, requirePermission(['manage_broadcast_settings'])],
    handler: broadcastController.updateIntervalConfig,
  });

  // Detalhes de um broadcast
  fastify.get('/:id', {
    preHandler: [authenticate, requirePermission(['view_broadcast'])],
    handler: broadcastController.getBroadcastDetails,
  });

  // Cancelar broadcast
  fastify.post('/:id/cancel', {
    preHandler: [authenticate, requirePermission(['manage_broadcast'])],
    handler: broadcastController.cancelBroadcast,
  });
}
