import { FastifyInstance } from 'fastify';
import { UploadController } from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function uploadRoutes(fastify: FastifyInstance) {
  const uploadController = new UploadController();

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Upload de arquivo
  fastify.post('/', {
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
