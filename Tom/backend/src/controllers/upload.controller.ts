import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getPrismaClient } from '../config/database.js';

export class UploadController {
  private uploadsDir: string;

  constructor() {
    // Diretório para salvar uploads
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Criar diretório se não existir
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * GET /api/v1/upload/check/:filename
   * Verificar se arquivo existe
   */
  checkFile = async (request: FastifyRequest<{ Params: { filename: string } }>, reply: FastifyReply) => {
    try {
      const { filename } = request.params;
      const filepath = path.join(this.uploadsDir, filename);
      const exists = fs.existsSync(filepath);

      return reply.status(200).send({
        success: true,
        data: {
          exists,
          filename,
        },
      });
    } catch (error) {
      logger.error('Error checking file:', error);
      return reply.status(500).send({
        success: false,
        message: 'Error checking file',
      });
    }
  };

  /**
   * POST /api/v1/upload
   * Upload de arquivo (imagem, áudio, vídeo, documento)
   */
  uploadFile = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          message: 'No file uploaded',
        });
      }

      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const ext = path.extname(data.filename);
      const filename = `${timestamp}-${randomString}${ext}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Salvar arquivo
      await pipeline(data.file, fs.createWriteStream(filepath));

      // URL pública do arquivo
      const fileUrl = `/uploads/${filename}`;

      logger.info(`File uploaded: ${filename}`);

      return reply.status(200).send({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename,
          url: fileUrl,
          mimetype: data.mimetype,
          size: fs.statSync(filepath).size,
        },
      });
    } catch (error) {
      logger.error('Error uploading file:', error);
      return reply.status(500).send({
        success: false,
        message: 'Error uploading file',
      });
    }
  };

  /**
   * POST /api/v1/upload/redownload/:messageId
   * Re-baixar mídia do WhatsApp para mensagem expirada
   */
  redownloadMedia = async (request: FastifyRequest<{ Params: { messageId: string } }>, reply: FastifyReply) => {
    try {
      const { messageId } = request.params;
      const prisma = getPrismaClient();

      // Buscar mensagem no banco
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: {
            include: {
              connection: true,
              contact: true,
            },
          },
        },
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          message: 'Mensagem não encontrada',
        });
      }

      if (!message.mediaUrl) {
        return reply.status(400).send({
          success: false,
          message: 'Mensagem não possui mídia',
        });
      }

      if (!message.externalId) {
        return reply.status(400).send({
          success: false,
          message: 'Mensagem não possui ID externo do WhatsApp',
        });
      }

      // Verificar se arquivo já existe
      const filename = message.mediaUrl.split('/').pop();
      if (filename) {
        const filepath = path.join(this.uploadsDir, filename);
        if (fs.existsSync(filepath)) {
          return reply.status(200).send({
            success: true,
            message: 'Arquivo já existe',
            data: {
              url: message.mediaUrl,
            },
          });
        }
      }

      // Re-baixar mídia do WhatsApp usando Baileys
      logger.info(`🔄 Re-downloading media for message ${messageId} from WhatsApp...`);

      const buffer = await baileysManager.downloadMedia(
        message.conversation.connectionId,
        message.externalId,
        message.conversation.contact?.phoneNumber || ''
      );

      if (!buffer) {
        return reply.status(400).send({
          success: false,
          message: 'Não foi possível baixar a mídia do WhatsApp. A mensagem pode ser muito antiga ou não estar mais disponível.',
        });
      }

      // Salvar mídia baixada
      const timestamp = Date.now();
      const ext = path.extname(message.mediaUrl);
      const newFilename = `${timestamp}-redownload${ext}`;
      const filepath = path.join(this.uploadsDir, newFilename);

      fs.writeFileSync(filepath, buffer);

      // Atualizar URL da mídia no banco
      const newMediaUrl = `/uploads/${newFilename}`;
      await prisma.message.update({
        where: { id: messageId },
        data: { mediaUrl: newMediaUrl },
      });

      logger.info(`✅ Media re-downloaded and saved: ${newFilename}`);

      return reply.status(200).send({
        success: true,
        message: 'Mídia baixada com sucesso',
        data: {
          url: newMediaUrl,
        },
      });

    } catch (error) {
      logger.error('Error re-downloading media:', error);
      return reply.status(500).send({
        success: false,
        message: 'Error re-downloading media',
      });
    }
  };
}
