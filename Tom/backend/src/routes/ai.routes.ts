import { FastifyInstance } from 'fastify';
import { AIService } from '../services/ai.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/authorization.middleware.js';

export async function aiRoutes(app: FastifyInstance) {
  const aiService = new AIService();

  // Listar assistentes de IA
  app.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const assistants = await aiService.listAssistants();
      return reply.send(assistants);
    }
  );

  // Buscar assistente por ID
  app.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const assistant = await aiService.getAssistant(id);
      return reply.send(assistant);
    }
  );

  // Criar assistente
  app.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const data = request.body as {
        name: string;
        apiKey: string;
        model: string;
        instructions: string;
        temperature?: number;
        maxTokens?: number;
        memoryContext?: number;
        memoryCacheDays?: number;
      };

      const assistant = await aiService.createAssistant(data);
      return reply.status(201).send(assistant);
    }
  );

  // Atualizar assistente
  app.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as {
        name?: string;
        apiKey?: string;
        model?: string;
        instructions?: string;
        temperature?: number;
        maxTokens?: number;
        memoryContext?: number;
        memoryCacheDays?: number;
        isActive?: boolean;
      };

      const assistant = await aiService.updateAssistant(id, data);
      return reply.send(assistant);
    }
  );

  // Deletar assistente
  app.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await aiService.deleteAssistant(id);
      return reply.status(204).send();
    }
  );

  // Limpar memória de uma conversa
  app.delete(
    '/memory/:conversationId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };
      await aiService.clearConversationMemory(conversationId);
      return reply.status(204).send();
    }
  );
}
