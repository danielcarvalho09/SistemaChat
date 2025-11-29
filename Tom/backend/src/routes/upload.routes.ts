import { FastifyInstance } from 'fastify';
import { UploadController } from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function uploadRoutes(fastify: FastifyInstance) {
  const uploadController = new UploadController();
  const { logger } = await import('../config/logger.js');

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Upload de arquivo
  fastify.post('/', {
    preHandler: async (request, reply) => {
      logger.info('[UploadRoute] 📤 Upload request received:', {
        method: request.method,
        url: request.url,
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'],
        userId: request.user?.userId,
      });
    },
    handler: uploadController.uploadFile,
  });

  // Verificar se arquivo existe
  fastify.get('/check/:filename', {
    handler: uploadController.checkFile,
  });

  // Re-baixar mídia do WhatsApp
  fastify.post('/redownload/:messageId', {
    handler: uploadController.redownloadMedia,
  });
}
