import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../config/database.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { z } from 'zod';

const monitorConversationSchema = z.object({
  conversationId: z.string().uuid(),
});

export async function monitorRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  // Iniciar monitoramento de uma conversa (modo espião)
  fastify.post(
    '/monitor/start',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const body = monitorConversationSchema.parse(request.body);

      // Verificar se usuário é admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      const isAdmin = user?.roles.some((ur) => ur.role.name === 'admin');
      if (!isAdmin) {
        return reply.status(403).send({
          error: 'Only admins can monitor conversations',
        });
      }

      // Ativar monitoramento
      await prisma.conversation.update({
        where: { id: body.conversationId },
        data: {
          isMonitored: true,
          monitoredBy: userId,
        },
      });

      return reply.send({
        message: 'Monitoring started',
        conversationId: body.conversationId,
      });
    }
  );

  // Parar monitoramento de uma conversa
  fastify.post(
    '/monitor/stop',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const body = monitorConversationSchema.parse(request.body);

      // Verificar se é o admin que está monitorando
      const conversation = await prisma.conversation.findUnique({
        where: { id: body.conversationId },
      });

      if (conversation?.monitoredBy !== userId) {
        return reply.status(403).send({
          error: 'You are not monitoring this conversation',
        });
      }

      // Desativar monitoramento
      await prisma.conversation.update({
        where: { id: body.conversationId },
        data: {
          isMonitored: false,
          monitoredBy: null,
        },
      });

      return reply.send({
        message: 'Monitoring stopped',
        conversationId: body.conversationId,
      });
    }
  );

  // Listar conversas monitoradas pelo admin
  fastify.get(
    '/monitor/conversations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;

      const conversations = await prisma.conversation.findMany({
        where: {
          isMonitored: true,
          monitoredBy: userId,
        },
        include: {
          contact: true,
          connection: true,
          department: true,
          assignedUser: true,
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
      });

      return reply.send(conversations);
    }
  );

  // Obter mensagens de uma conversa monitorada (sem marcar como lida)
  fastify.get(
    '/monitor/conversations/:conversationId/messages',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { conversationId } = request.params as { conversationId: string };

      // Verificar se o admin está monitorando esta conversa
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation?.isMonitored || conversation.monitoredBy !== userId) {
        return reply.status(403).send({
          error: 'You are not monitoring this conversation',
        });
      }

      // Buscar mensagens SEM marcar como lidas (modo invisível)
      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      return reply.send(messages);
    }
  );
}
