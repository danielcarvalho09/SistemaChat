import { FastifyInstance } from 'fastify';
import { KanbanController } from '../controllers/kanban.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function kanbanRoutes(fastify: FastifyInstance) {
  const controller = new KanbanController();

  // Aplicar autenticação em todas as rotas
  fastify.addHook('onRequest', authenticate);

  // ==================== ETAPAS ====================

  // Criar nova etapa
  fastify.post('/stages', controller.createStage);

  // Listar todas as etapas
  fastify.get('/stages', controller.listStages);

  // Obter etapa por ID
  fastify.get('/stages/:id', controller.getStage);

  // Atualizar etapa
  fastify.put('/stages/:id', controller.updateStage);

  // Deletar etapa
  fastify.delete('/stages/:id', controller.deleteStage);

  // Reordenar etapas
  fastify.put('/stages/reorder', controller.reorderStages);

  // ==================== KANBAN BOARD ====================

  // Obter board completo
  fastify.get('/board', controller.getBoard);

  // Obter conversas de uma etapa
  fastify.get('/stages/:id/conversations', controller.getStageConversations);

  // Mover conversa para outra etapa
  fastify.put('/conversations/:id/move', controller.moveConversation);

  // Obter histórico de movimentações
  fastify.get('/conversations/:id/history', controller.getConversationHistory);

  // Inicializar etapas padrão
  fastify.post('/initialize', controller.initializeStages);
}
