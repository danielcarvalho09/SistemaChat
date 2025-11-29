import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { logger } from '../config/logger.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getPrismaClient } from '../config/database.js';
import { getAllowedMimeTypes } from '../utils/file-validation.js';
import { supabaseStorageService } from '../services/supabase-storage.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(getAllowedMimeTypes());
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.php',
  '.jsp',
  '.asp',
  '.aspx',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
  '.jar',
  '.war',
  '.class',
  '.msi',
  '.vbs',
  '.wsf',
]);

export class UploadController {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'secure-uploads');

    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true, mode: 0o700 });
    }
  }

  private sanitizeFileName(filename: string): string {
    const withoutPath = filename.replace(/\.\./g, '').replace(/[/\\]/g, '_');
    const sanitized = withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const base = path.basename(sanitized, ext);
      return `${base.slice(0, 255 - ext.length)}${ext}`;
    }
    return sanitized;
  }

  private async detectMime(buffer: Buffer): Promise<{ isValid: boolean; mime?: string; error?: string }> {
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType) {
      return { isValid: false, error: 'Could not determine file type' };
    }

    if (!ALLOWED_MIME_TYPES.has(fileType.mime)) {
      return { isValid: false, error: `File type ${fileType.mime} is not allowed` };
    }

    return { isValid: true, mime: fileType.mime };
  }

  private hasMaliciousContent(buffer: Buffer): boolean {
    const sample = buffer.toString('utf8', 0, Math.min(buffer.length, 8192));
    const maliciousPatterns = [
      /<\?php/i,
      /<script\b/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /\$_(GET|POST|COOKIE|REQUEST|FILES|SERVER|SESSION)/i,
    ];
    return maliciousPatterns.some((pattern) => pattern.test(sample));
  }

  checkFile = async (request: FastifyRequest<{ Params: { filename: string } }>, reply: FastifyReply) => {
    try {
      const safeName = this.sanitizeFileName(request.params.filename);
      const filepath = path.join(this.uploadsDir, safeName);
      const exists = fs.existsSync(filepath);

      return reply.status(200).send({
        success: true,
        data: { exists, filename: safeName },
      });
    } catch (error) {
      logger.error('Error checking file:', error);
      return reply.status(500).send({ success: false, message: 'Error checking file' });
    }
  };

  uploadFile = async (request: FastifyRequest, reply: FastifyReply) => {
    let savedPath: string | null = null;

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, message: 'No file uploaded' });
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of data.file) {
        total += chunk.length;
        if (total > MAX_FILE_SIZE) {
          return reply.status(413).send({
            success: false,
            message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
          });
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const typeCheck = await this.detectMime(buffer);
      if (!typeCheck.isValid) {
        return reply.status(415).send({ success: false, message: typeCheck.error || 'Invalid file type' });
      }

      const originalName = this.sanitizeFileName(data.filename);
      const ext = path.extname(originalName).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        return reply.status(400).send({ success: false, message: 'File extension is not allowed' });
      }

      if (this.hasMaliciousContent(buffer)) {
        logger.warn(`Malicious content detected in upload from ${request.ip}`);
        return reply.status(400).send({ success: false, message: 'File contains malicious content' });
      }

      const uniqueName = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext}`;
      
      // ✅ Tentar fazer upload para Supabase Storage primeiro
      let fileUrl: string;
      
      if (supabaseStorageService.isConfigured()) {
        logger.info('📤 Uploading to Supabase Storage...');
        const supabaseUrl = await supabaseStorageService.uploadFile(
          buffer,
          uniqueName,
          typeCheck.mime || 'application/octet-stream'
        );

        if (supabaseUrl) {
          fileUrl = supabaseUrl;
          logger.info('✅ File uploaded to Supabase Storage successfully');
        } else {
          // Fallback para armazenamento local se Supabase falhar
          logger.warn('⚠️ Supabase upload failed, falling back to local storage');
          const filepath = path.join(this.uploadsDir, uniqueName);
          savedPath = filepath;
          fs.writeFileSync(filepath, buffer, { mode: 0o600 });
          fileUrl = `/secure-uploads/${uniqueName}`;
        }
      } else {
        // Usar armazenamento local se Supabase não estiver configurado
        logger.info('📤 Uploading to local storage...');
        const filepath = path.join(this.uploadsDir, uniqueName);
        savedPath = filepath;
        fs.writeFileSync(filepath, buffer, { mode: 0o600 });
        fileUrl = `/secure-uploads/${uniqueName}`;
      }

      const response = {
        filename: uniqueName,
        url: fileUrl,
        mimetype: typeCheck.mime,
        size: total,
        hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      };

      logger.info('Secure upload complete', {
        ...response,
        userId: request.user?.userId,
        ip: request.ip,
        storage: supabaseStorageService.isConfigured() ? 'supabase' : 'local',
      });

      return reply.status(200).send({
        success: true,
        message: 'File uploaded successfully',
        data: response,
      });
    } catch (error) {
      if (savedPath && fs.existsSync(savedPath)) {
        fs.unlinkSync(savedPath);
      }
      logger.error('Error uploading file:', error);
      return reply.status(500).send({ success: false, message: 'Error uploading file' });
    }
  };

  redownloadMedia = async (
    request: FastifyRequest<{ Params: { messageId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const prisma = getPrismaClient();
      const message = await prisma.message.findUnique({
        where: { id: request.params.messageId },
        include: {
          conversation: { include: { connection: true, contact: true } },
        },
      });

      if (!message) {
        return reply.status(404).send({ success: false, message: 'Mensagem não encontrada' });
      }
      if (!message.mediaUrl || !message.externalId) {
        return reply.status(400).send({ success: false, message: 'Mensagem não possui mídia' });
      }

      // ✅ Verificar se a URL já é do Supabase e o arquivo existe
      const isSupabaseUrl = message.mediaUrl.includes('supabase.co') || message.mediaUrl.includes('storage.supabase');
      if (isSupabaseUrl && supabaseStorageService.isConfigured()) {
        // Se já está no Supabase, verificar se o arquivo existe
        const filename = message.mediaUrl.split('/').pop()?.split('?')[0];
        if (filename) {
          logger.info(`Media already in Supabase: ${filename}`);
          return reply.status(200).send({
            success: true,
            message: 'Mídia já está disponível no Supabase',
            data: { url: message.mediaUrl },
          });
        }
      }

      // ✅ Verificar se arquivo existe localmente
      const existingFilename = message.mediaUrl.split('/').pop()?.split('?')[0];
      if (existingFilename && !isSupabaseUrl) {
        const existingPath = path.join(this.uploadsDir, this.sanitizeFileName(existingFilename));
        if (fs.existsSync(existingPath)) {
          // Se existe localmente mas não está no Supabase, fazer upload para Supabase
          if (supabaseStorageService.isConfigured()) {
            try {
              logger.info(`File exists locally, uploading to Supabase: ${existingFilename}`);
              const buffer = fs.readFileSync(existingPath);
              
              // Detectar mimetype
              const ext = path.extname(existingFilename);
              const mimetype = this.getMimeTypeFromExtension(ext);
              
              const supabaseUrl = await supabaseStorageService.uploadFile(
                buffer,
                existingFilename,
                mimetype
              );

              if (supabaseUrl) {
                // Atualizar mensagem com URL do Supabase
                await prisma.message.update({
                  where: { id: message.id },
                  data: { mediaUrl: supabaseUrl },
                });

                logger.info('Media uploaded to Supabase from local file', {
                  messageId: message.id,
                  filename: existingFilename,
                });

                return reply.status(200).send({
                  success: true,
                  message: 'Mídia migrada para Supabase com sucesso',
                  data: { url: supabaseUrl },
                });
              }
            } catch (uploadError) {
              logger.error('Error uploading to Supabase:', uploadError);
              // Continuar com resposta local se upload falhar
            }
          }

          return reply.status(200).send({
            success: true,
            message: 'Arquivo já existe localmente',
            data: { url: message.mediaUrl },
          });
        }
      }

      // ✅ Tentar baixar do WhatsApp
      logger.info(`Attempting to re-download media from WhatsApp: ${message.externalId}`);
      const buffer = await baileysManager.downloadMedia(
        message.conversation.connectionId,
        message.externalId,
        message.conversation.contact?.phoneNumber || '',
      );

      if (!buffer) {
        return reply.status(400).send({
          success: false,
          message: 'Não foi possível baixar a mídia. Ela pode ter expirado (mídias do WhatsApp expiram após 7 dias) ou não estar mais disponível no WhatsApp.',
        });
      }

      // ✅ Determinar extensão e mimetype
      const ext = path.extname(message.mediaUrl) || this.getExtensionFromMimeType(message.messageType) || '';
      const mimetype = this.getMimeTypeFromExtension(ext) || 'application/octet-stream';
      const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;

      // ✅ Upload para Supabase Storage (prioridade) ou armazenamento local
      let newUrl: string;

      if (supabaseStorageService.isConfigured()) {
        logger.info('Uploading re-downloaded media to Supabase Storage...');
        const supabaseUrl = await supabaseStorageService.uploadFile(
          buffer,
          filename,
          mimetype
        );

        if (supabaseUrl) {
          newUrl = supabaseUrl;
          logger.info('✅ Media uploaded to Supabase Storage successfully');
        } else {
          // Fallback para armazenamento local
          logger.warn('⚠️ Supabase upload failed, falling back to local storage');
          const filepath = path.join(this.uploadsDir, filename);
          fs.writeFileSync(filepath, buffer, { mode: 0o600 });
          newUrl = `/secure-uploads/${filename}`;
        }
      } else {
        // Armazenamento local
        const filepath = path.join(this.uploadsDir, filename);
        fs.writeFileSync(filepath, buffer, { mode: 0o600 });
        newUrl = `/secure-uploads/${filename}`;
      }

      // ✅ Atualizar mensagem com nova URL
      await prisma.message.update({
        where: { id: message.id },
        data: { mediaUrl: newUrl },
      });

      logger.info('Media re-downloaded successfully', {
        messageId: message.id,
        filename,
        storage: supabaseStorageService.isConfigured() ? 'supabase' : 'local',
      });

      return reply.status(200).send({
        success: true,
        message: 'Mídia baixada com sucesso',
        data: { url: newUrl },
      });
    } catch (error) {
      logger.error('Error re-downloading media:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({
        success: false,
        message: `Erro ao baixar mídia: ${errorMessage}`,
      });
    }
  };

  /**
   * Helper para obter mimetype a partir da extensão
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Helper para obter extensão a partir do tipo de mensagem
   */
  private getExtensionFromMimeType(messageType: string): string {
    const extensions: Record<string, string> = {
      image: '.jpg',
      video: '.mp4',
      audio: '.ogg',
      document: '.pdf',
    };
    return extensions[messageType] || '';
  }
}
