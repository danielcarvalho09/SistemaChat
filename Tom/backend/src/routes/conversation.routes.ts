import { FastifyInstance } from 'fastify';
import { ConversationController } from '../controllers/conversation.controller';
import { authenticate } from '../middlewares/auth.middleware';

export async function conversationRoutes(fastify: FastifyInstance) {
  const conversationController = new ConversationController();

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Listar conversas
  fastify.get('/', {
    handler: conversationController.listConversations,
  });

  // Buscar conversa por ID
  fastify.get('/:conversationId', {
    handler: conversationController.getConversationById,
  });

  // Aceitar conversa
  fastify.post('/:conversationId/accept', {
    handler: conversationController.acceptConversation,
  });

  fastify.patch('/:conversationId/accept', {
    handler: conversationController.acceptConversation,
  });

  // Transferir conversa
  fastify.post('/:conversationId/transfer', {
    handler: conversationController.transferConversation,
  });

  // Atualizar status
  fastify.patch('/:conversationId/status', {
    handler: conversationController.updateStatus,
  });

  // Atualizar notas internas
  fastify.patch('/:conversationId/notes', {
    handler: conversationController.updateNotes,
  });

  // Marcar como lida
  fastify.post('/:conversationId/read', {
    handler: conversationController.markAsRead,
  });

  // Listar mensagens
  fastify.get('/:conversationId/messages', {
    handler: conversationController.listMessages,
  });

  // Enviar mensagem
  fastify.post('/:conversationId/messages', {
    handler: conversationController.sendMessage,
  });
}
