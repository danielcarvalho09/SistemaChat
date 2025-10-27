import { FastifyInstance } from 'fastify';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';

export async function whatsappRoutes(fastify: FastifyInstance) {
  const whatsappController = new WhatsAppController();

  // Criar nova conexão (apenas admin)
  fastify.post('/', {
    preHandler: [requireAdmin],
    handler: whatsappController.createConnection,
  });

  // Listar todas as conexões
  fastify.get('/', {
    preHandler: [requireAuth],
    handler: whatsappController.listConnections,
  });

  // Buscar conexão por ID
  fastify.get('/:connectionId', {
    preHandler: [requireAuth],
    handler: whatsappController.getConnectionById,
  });

  // Atualizar conexão (apenas admin)
  fastify.patch('/:connectionId', {
    preHandler: [requireAdmin],
    handler: whatsappController.updateConnection,
  });

  // Conectar conexão e gerar QR Code (apenas admin)
  fastify.post('/:connectionId/connect', {
    preHandler: [requireAdmin],
    handler: whatsappController.connectConnection,
  });

  // Desconectar conexão (apenas admin)
  fastify.post('/:connectionId/disconnect', {
    preHandler: [requireAdmin],
    handler: whatsappController.disconnectConnection,
  });

  // Deletar conexão (apenas admin)
  fastify.delete('/:connectionId', {
    preHandler: [requireAdmin],
    handler: whatsappController.deleteConnection,
  });
}
