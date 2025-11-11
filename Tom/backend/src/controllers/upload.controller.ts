import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { logger } from '../config/logger.js';
import { baileysManager } from '../whatsapp/baileys.manager.js';
import { getPrismaClient } from '../config/database.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/mpeg',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
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
    this.uploadsDir = path.join(process.cwd(), 'uploads');

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

  private resolveUploadPath(filename: string): string {
    const sanitized = this.sanitizeFileName(filename);
    const resolved = path.resolve(path.join(this.uploadsDir, sanitized));
    const uploadsRoot = path.resolve(this.uploadsDir);

    if (!resolved.startsWith(uploadsRoot)) {
      throw new Error('Invalid file path');
    }

    return resolved;
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
      const filepath = this.resolveUploadPath(safeName);
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
      const filepath = this.resolveUploadPath(uniqueName);
      savedPath = filepath;

      fs.writeFileSync(filepath, buffer, { mode: 0o600 });

      const response = {
        filename: uniqueName,
        url: `/uploads/${uniqueName}`,
        mimetype: typeCheck.mime,
        size: total,
        hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      };

      logger.info('Secure upload complete', {
        ...response,
        userId: request.user?.userId,
        ip: request.ip,
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

      const existingFilename = message.mediaUrl.split('/').pop();
      if (existingFilename) {
        const existingPath = this.resolveUploadPath(existingFilename);
        if (fs.existsSync(existingPath)) {
          return reply.status(200).send({
            success: true,
            message: 'Arquivo já existe',
            data: { url: message.mediaUrl },
          });
        }
      }

      const buffer = await baileysManager.downloadMedia(
        message.conversation.connectionId,
        message.externalId,
        message.conversation.contact?.phoneNumber || '',
      );

      if (!buffer) {
        return reply.status(400).send({
          success: false,
          message: 'Não foi possível baixar a mídia. Ela pode não estar mais disponível.',
        });
      }

      const ext = path.extname(message.mediaUrl) || '';
      const filename = `${Date.now()}_redownload${ext}`;
      const filepath = this.resolveUploadPath(filename);
      fs.writeFileSync(filepath, buffer, { mode: 0o600 });

      const newUrl = `/uploads/${filename}`;
      await prisma.message.update({ where: { id: message.id }, data: { mediaUrl: newUrl } });

      logger.info('Media re-downloaded', {
        messageId: message.id,
        filename,
      });

      return reply.status(200).send({
        success: true,
        message: 'Mídia baixada com sucesso',
        data: { url: newUrl },
      });
    } catch (error) {
      logger.error('Error re-downloading media:', error);
      return reply.status(500).send({ success: false, message: 'Error re-downloading media' });
    }
  };
}
