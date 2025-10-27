import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

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
}
