import { FastifyInstance } from 'fastify';
import { AIService } from '../services/ai.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/authorization.middleware.js';
import { logger } from '../config/logger.js';

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
      try {
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

        // ✅ Validação dos campos obrigatórios
        if (!data.name || !data.name.trim()) {
          return reply.status(400).send({
            success: false,
            message: 'Nome do assistente é obrigatório',
          });
        }

        if (!data.apiKey || !data.apiKey.trim()) {
          return reply.status(400).send({
            success: false,
            message: 'API Key é obrigatória',
          });
        }

        if (!data.model || !data.model.trim()) {
          return reply.status(400).send({
            success: false,
            message: 'Modelo é obrigatório',
          });
        }

        if (!data.instructions || !data.instructions.trim()) {
          return reply.status(400).send({
            success: false,
            message: 'Instruções são obrigatórias',
          });
        }

        logger.info(`[AI Routes] 📝 Creating assistant: ${data.name}`);
        logger.debug(`[AI Routes] 📝 Request data:`, {
          name: data.name,
          model: data.model,
          hasApiKey: !!data.apiKey,
          apiKeyLength: data.apiKey?.length || 0,
          instructionsLength: data.instructions?.length || 0,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          memoryContext: data.memoryContext,
          memoryCacheDays: data.memoryCacheDays,
        });

        const assistant = await aiService.createAssistant(data);
        
        logger.info(`[AI Routes] ✅ Assistant created successfully: ${assistant.id}`);
        
        return reply.status(201).send({
          success: true,
          message: 'Assistente criado com sucesso',
          data: assistant,
        });
      } catch (error: any) {
        logger.error('[AI Routes] ❌ Error creating assistant:', error);
        logger.error('[AI Routes] ❌ Error stack:', error?.stack);
        
        // Retornar erro mais específico
        const errorMessage = error?.message || 'Erro ao criar assistente';
        const statusCode = error?.message?.includes('already exists') ? 409 : 
                          error?.message?.includes('Invalid OpenAI API Key') ? 400 : 500;
        
        return reply.status(statusCode).send({
          success: false,
          message: errorMessage,
          error: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        });
      }
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
