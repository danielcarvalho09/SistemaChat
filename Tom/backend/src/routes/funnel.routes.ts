import { FastifyInstance } from 'fastify';
import { FunnelController } from '../controllers/funnel.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const funnelController = new FunnelController();

// Middleware para verificar se usuário é admin ou gerente
const requireManagerOrAdmin = async (request: any, reply: any) => {
  const userRoles = request.user?.roles || [];
  const isAuthorized = userRoles.includes('admin') || userRoles.includes('gerente');
  
  if (!isAuthorized) {
    return reply.status(403).send({
      success: false,
      message: 'Access denied. Only administrators and managers can access this feature.',
    });
  }
};

export async function funnelRoutes(fastify: FastifyInstance) {
  // Todas as rotas requerem autenticação + cargo de admin/gerente
  const preHandler = [requireAuth, requireManagerOrAdmin];

  // Gerar funil com IA
  fastify.post('/generate', { preHandler, handler: funnelController.generateFunnel });

  // CRUD de funis
  fastify.get('/', { preHandler, handler: funnelController.listFunnels });
  fastify.get('/:funnelId', { preHandler, handler: funnelController.getFunnelById });
  fastify.patch('/:funnelId', { preHandler, handler: funnelController.updateFunnel });
  fastify.delete('/:funnelId', { preHandler, handler: funnelController.deleteFunnel });

  // CRUD de etapas
  fastify.post('/:funnelId/stages', { preHandler, handler: funnelController.createStage });
  fastify.patch('/stages/:stageId', { preHandler, handler: funnelController.updateStage });
  fastify.delete('/stages/:stageId', { preHandler, handler: funnelController.deleteStage });

  // CRUD de conexões
  fastify.post('/connections', { preHandler, handler: funnelController.createConnection });
  fastify.delete('/connections/:connectionId', { preHandler, handler: funnelController.deleteConnection });
}

