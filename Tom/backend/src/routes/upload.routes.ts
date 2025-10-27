import { FastifyInstance } from 'fastify';
import { UploadController } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth.middleware';

export async function uploadRoutes(fastify: FastifyInstance) {
  const uploadController = new UploadController();

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Upload de arquivo
  fastify.post('/', {
    handler: uploadController.uploadFile,
  });
}
