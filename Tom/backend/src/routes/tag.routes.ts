import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../config/database';
import { authenticate } from '../middlewares/auth.middleware';
import { z } from 'zod';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isGlobal: z.boolean().optional().default(false),
});

const addTagToConversationSchema = z.object({
  conversationId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export async function tagRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  // Listar todas as tags (próprias + globais)
  fastify.get(
    '/tags',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;

      const tags = await prisma.tag.findMany({
        where: {
          OR: [
            { createdBy: userId }, // Tags criadas pelo usuário
            { isGlobal: true }, // Tags globais
          ],
        },
        include: {
          _count: {
            select: { conversations: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(tags);
    }
  );

  // Criar nova tag
  fastify.post(
    '/tags',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const body = createTagSchema.parse(request.body);

      // Verificar se já existe tag com esse nome para o usuário
      const existingTag = await prisma.tag.findUnique({
        where: {
          name_createdBy: {
            name: body.name,
            createdBy: userId,
          },
        },
      });

      if (existingTag) {
        return reply.status(409).send({
          error: 'Tag with this name already exists',
        });
      }

      const tag = await prisma.tag.create({
        data: {
          name: body.name,
          color: body.color,
          isGlobal: body.isGlobal,
          createdBy: userId,
        },
      });

      return reply.status(201).send(tag);
    }
  );

  // Atualizar tag
  fastify.put(
    '/tags/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { id } = request.params as { id: string };
      const body = createTagSchema.parse(request.body);

      // Verificar se a tag pertence ao usuário
      const tag = await prisma.tag.findUnique({
        where: { id },
      });

      if (!tag) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      if (tag.createdBy !== userId) {
        return reply.status(403).send({ error: 'Not authorized to edit this tag' });
      }

      const updatedTag = await prisma.tag.update({
        where: { id },
        data: {
          name: body.name,
          color: body.color,
          isGlobal: body.isGlobal,
        },
      });

      return reply.send(updatedTag);
    }
  );

  // Deletar tag
  fastify.delete(
    '/tags/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { id } = request.params as { id: string };

      // Verificar se a tag pertence ao usuário
      const tag = await prisma.tag.findUnique({
        where: { id },
      });

      if (!tag) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      if (tag.createdBy !== userId) {
        return reply.status(403).send({ error: 'Not authorized to delete this tag' });
      }

      await prisma.tag.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Adicionar tag a uma conversa
  fastify.post(
    '/conversations/tags',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const body = addTagToConversationSchema.parse(request.body);

      // Verificar se a conversa existe
      const conversation = await prisma.conversation.findUnique({
        where: { id: body.conversationId },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      // Verificar se a tag existe e o usuário tem acesso
      const tag = await prisma.tag.findFirst({
        where: {
          id: body.tagId,
          OR: [
            { createdBy: userId },
            { isGlobal: true },
          ],
        },
      });

      if (!tag) {
        return reply.status(404).send({ error: 'Tag not found or not accessible' });
      }

      // Adicionar tag à conversa
      const conversationTag = await prisma.conversationTag.create({
        data: {
          conversationId: body.conversationId,
          tagId: body.tagId,
          addedBy: userId,
        },
        include: {
          tag: true,
        },
      });

      return reply.status(201).send(conversationTag);
    }
  );

  // Remover tag de uma conversa
  fastify.delete(
    '/conversations/:conversationId/tags/:tagId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { conversationId, tagId } = request.params as {
        conversationId: string;
        tagId: string;
      };

      const conversationTag = await prisma.conversationTag.findUnique({
        where: {
          conversationId_tagId: {
            conversationId,
            tagId,
          },
        },
      });

      if (!conversationTag) {
        return reply.status(404).send({ error: 'Tag not found in conversation' });
      }

      await prisma.conversationTag.delete({
        where: {
          conversationId_tagId: {
            conversationId,
            tagId,
          },
        },
      });

      return reply.status(204).send();
    }
  );

  // Listar tags de uma conversa
  fastify.get(
    '/conversations/:conversationId/tags',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };

      const tags = await prisma.conversationTag.findMany({
        where: { conversationId },
        include: {
          tag: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(tags);
    }
  );
}
