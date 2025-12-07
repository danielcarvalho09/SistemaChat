import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { departmentRoutes } from './department.routes.js';
import { whatsappRoutes } from './whatsapp.routes.js';
import { conversationRoutes } from './conversation.routes.js';
import { uploadRoutes } from './upload.routes.js';
import { syncRoutes } from './sync.routes.js';
import { tagRoutes } from './tag.routes.js';
import { monitorRoutes } from './monitor.routes.js';
import { broadcastRoutes } from './broadcast.routes.js';
import { contactListRoutes } from './contact-list.routes.js';
import { kanbanRoutes } from './kanban.routes.js';
import { healthRoutes } from './health.routes.js';
import { aiRoutes } from './ai.routes.js';
import { quickMessageRoutes } from './quick-message.routes.js';
import { config } from '../config/env.js';

export async function registerRoutes(fastify: FastifyInstance) {
  const apiPrefix = config.server.apiPrefix;

  // Health check routes
  await fastify.register(healthRoutes);

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
  await fastify.register(aiRoutes, { prefix: `${apiPrefix}/ai` });
  await fastify.register(quickMessageRoutes, { prefix: `${apiPrefix}/quick-messages` });
}
