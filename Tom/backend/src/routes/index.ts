import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { departmentRoutes } from './department.routes';
import { whatsappRoutes } from './whatsapp.routes';
import { conversationRoutes } from './conversation.routes';
import { uploadRoutes } from './upload.routes';
import { syncRoutes } from './sync.routes';
import { tagRoutes } from './tag.routes';
import { monitorRoutes } from './monitor.routes';
import { broadcastRoutes } from './broadcast.routes';
import { contactListRoutes } from './contact-list.routes';
import { kanbanRoutes } from './kanban.routes';
import { config } from '../config/env';

export async function registerRoutes(fastify: FastifyInstance) {
  const apiPrefix = config.server.apiPrefix;

  // Health check
  fastify.get('/health', async (request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.env,
    });
  });

  // Registrar rotas da API
  await fastify.register(authRoutes, { prefix: `${apiPrefix}/auth` });
  await fastify.register(userRoutes, { prefix: `${apiPrefix}/users` });
  await fastify.register(departmentRoutes, { prefix: `${apiPrefix}/departments` });
  await fastify.register(whatsappRoutes, { prefix: `${apiPrefix}/connections` });
  await fastify.register(conversationRoutes, { prefix: `${apiPrefix}/conversations` });
  await fastify.register(uploadRoutes, { prefix: `${apiPrefix}/upload` });
  await fastify.register(syncRoutes, { prefix: `${apiPrefix}/sync` });
  await fastify.register(tagRoutes, { prefix: `${apiPrefix}` });
  await fastify.register(monitorRoutes, { prefix: `${apiPrefix}` });
  await fastify.register(broadcastRoutes, { prefix: `${apiPrefix}/broadcast` });
  await fastify.register(contactListRoutes, { prefix: `${apiPrefix}/contact-lists` });
  await fastify.register(kanbanRoutes, { prefix: `${apiPrefix}/kanban` });
}
