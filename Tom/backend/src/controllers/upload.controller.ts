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

  private async detectMime(buffer: Buffer, filename?: string): Promise<{ isValid: boolean; mime?: string; error?: string }> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        // Fallback: tentar detectar pelo nome do arquivo se fornecido
        if (filename) {
          const ext = path.extname(filename).toLowerCase();
          const mimeFromExt = this.getMimeTypeFromExtension(ext);
          
          if (mimeFromExt && mimeFromExt !== 'application/octet-stream' && ALLOWED_MIME_TYPES.has(mimeFromExt)) {
            logger.warn(`[UploadController] Could not detect MIME from buffer, using extension fallback: ${mimeFromExt}`);
            return { isValid: true, mime: mimeFromExt };
          }
        }
        
        return { isValid: false, error: 'Could not determine file type' };
      }

      if (!ALLOWED_MIME_TYPES.has(fileType.mime)) {
        return { isValid: false, error: `File type ${fileType.mime} is not allowed` };
      }

      return { isValid: true, mime: fileType.mime };
    } catch (error) {
      logger.error('[UploadController] Error detecting MIME:', error);
      return { isValid: false, error: 'Error detecting file type' };
    }
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
      logger.info('[UploadController] 📤 ========== STARTING FILE UPLOAD ==========');
      logger.info('[UploadController] Request details:', {
        method: request.method,
        url: request.url,
        headers: {
          'content-type': request.headers['content-type'],
          'content-length': request.headers['content-length'],
          'user-agent': request.headers['user-agent'],
        },
        userId: request.user?.userId,
        ip: request.ip,
      });
      
      // ✅ Passo 1: Verificar se o request é multipart
      const contentType = request.headers['content-type'] || '';
      logger.info('[UploadController] Content-Type:', contentType);
      
      if (!contentType.includes('multipart/form-data')) {
        logger.error('[UploadController] ❌ Invalid Content-Type. Expected multipart/form-data, got:', contentType);
        return reply.status(400).send({ 
          success: false, 
          message: 'Invalid Content-Type. Expected multipart/form-data',
          received: contentType
        });
      }
      
      // ✅ Passo 2: Obter arquivo do request
      let data;
      try {
        logger.info('[UploadController] 📥 Attempting to read file from request...');
        data = await request.file();
        logger.info('[UploadController] File read result:', {
          hasData: !!data,
          filename: data?.filename || 'N/A',
          mimetype: data?.mimetype || 'N/A',
          encoding: data?.encoding || 'N/A',
          fieldname: data?.fieldname || 'N/A',
        });
        
        if (!data) {
          logger.warn('[UploadController] ❌ No file uploaded - request.file() returned null/undefined');
          logger.warn('[UploadController] Request body type:', typeof request.body);
          logger.warn('[UploadController] Request body keys:', request.body ? Object.keys(request.body) : 'no body');
          return reply.status(400).send({ success: false, message: 'No file uploaded' });
        }
        
        logger.info(`[UploadController] ✅ File received: ${data.filename || 'unnamed'}, mimetype: ${data.mimetype || 'unknown'}`);
      } catch (fileError: any) {
        logger.error('[UploadController] ❌ Error reading file from request:', {
          error: fileError?.message || String(fileError),
          stack: fileError?.stack,
          name: fileError?.name,
          code: fileError?.code,
          statusCode: fileError?.statusCode,
          contentType: request.headers['content-type'],
          hasBody: !!request.body,
          bodyType: typeof request.body,
        });
        
        // Verificar se é erro específico do Fastify multipart
        if (fileError?.code === 'FST_ERR_REQ_INVALID_CONTENT_TYPE') {
          logger.error('[UploadController] ❌ Fastify multipart error: Invalid content type');
          return reply.status(400).send({ 
            success: false, 
            message: 'Invalid request format. Please use multipart/form-data',
            error: 'FST_ERR_REQ_INVALID_CONTENT_TYPE'
          });
        }
        
        return reply.status(400).send({ 
          success: false, 
          message: 'Error reading file from request',
          error: process.env.NODE_ENV === 'development' ? (fileError?.message || String(fileError)) : undefined,
          errorCode: fileError?.code
        });
      }

      // ✅ Passo 3: Ler chunks do arquivo
      const chunks: Buffer[] = [];
      let total = 0;
      let chunkCount = 0;
      
      try {
        logger.info('[UploadController] 📖 Starting to read file chunks...');
        
        if (!data.file) {
          logger.error('[UploadController] ❌ data.file is null or undefined');
          return reply.status(400).send({
            success: false,
            message: 'File stream is not available'
          });
        }
        
        for await (const chunk of data.file) {
          chunkCount++;
          total += chunk.length;
          
          if (chunkCount % 10 === 0) {
            logger.debug(`[UploadController] Read ${chunkCount} chunks, ${total} bytes so far...`);
          }
          
          if (total > MAX_FILE_SIZE) {
            logger.warn(`[UploadController] ❌ File size exceeds limit: ${total} bytes (max: ${MAX_FILE_SIZE} bytes)`);
            return reply.status(413).send({
              success: false,
              message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
            });
          }
          chunks.push(chunk);
        }
        
        logger.info(`[UploadController] ✅ File read complete: ${chunkCount} chunks, ${total} bytes total`);
      } catch (readError: any) {
        logger.error('[UploadController] ❌ Error reading file chunks:', {
          error: readError?.message || String(readError),
          stack: readError?.stack,
          name: readError?.name,
          code: readError?.code,
          chunksRead: chunkCount,
          bytesRead: total,
        });
        return reply.status(400).send({
          success: false,
          message: 'Error reading file',
          error: process.env.NODE_ENV === 'development' ? (readError?.message || String(readError)) : undefined
        });
      }

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        logger.warn('[UploadController] ❌ File buffer is empty');
        return reply.status(400).send({ success: false, message: 'File is empty' });
      }
      
      // ✅ Passo 3: Detectar tipo MIME
      let typeCheck;
      try {
        typeCheck = await this.detectMime(buffer, data.filename);
        logger.info(`[UploadController] MIME detection:`, { 
          isValid: typeCheck.isValid, 
          mime: typeCheck.mime, 
          error: typeCheck.error 
        });
      } catch (mimeError: any) {
        logger.error('[UploadController] ❌ Error detecting MIME type:', mimeError);
        // Continuar mesmo se falhar - usar mimetype do request como fallback
        typeCheck = {
          isValid: true,
          mime: data.mimetype || 'application/octet-stream'
        };
        logger.warn('[UploadController] ⚠️ Using request mimetype as fallback:', typeCheck.mime);
      }
      
      if (!typeCheck.isValid) {
        logger.warn(`[UploadController] ❌ Invalid file type: ${typeCheck.error}`);
        return reply.status(415).send({ success: false, message: typeCheck.error || 'Invalid file type' });
      }

      // ✅ Passo 4: Validar extensão e conteúdo
      const originalName = data.filename || 'upload';
      const sanitizedName = this.sanitizeFileName(originalName);
      const ext = path.extname(sanitizedName).toLowerCase();
      
      if (BLOCKED_EXTENSIONS.has(ext)) {
        logger.warn(`[UploadController] ❌ Blocked extension: ${ext}`);
        return reply.status(400).send({ success: false, message: 'File extension is not allowed' });
      }

      try {
        if (this.hasMaliciousContent(buffer)) {
          logger.warn(`[UploadController] ❌ Malicious content detected from ${request.ip}`);
          return reply.status(400).send({ success: false, message: 'File contains malicious content' });
        }
      } catch (securityError: any) {
        logger.error('[UploadController] ⚠️ Error checking for malicious content:', securityError);
        // Continuar mesmo se a verificação de segurança falhar
      }

      // ✅ Passo 5: Gerar nome único e fazer upload
      const uniqueName = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext || ''}`;
      let fileUrl: string;
      
      try {
        if (supabaseStorageService.isConfigured()) {
          logger.info('[UploadController] 📤 Attempting Supabase Storage upload...');
          try {
            const supabaseUrl = await supabaseStorageService.uploadFile(
              buffer,
              uniqueName,
              typeCheck.mime || 'application/octet-stream'
            );

            if (supabaseUrl) {
              fileUrl = supabaseUrl;
              logger.info('[UploadController] ✅ File uploaded to Supabase Storage successfully');
            } else {
              throw new Error('Supabase upload returned null');
            }
          } catch (supabaseError: any) {
            logger.error('[UploadController] ❌ Supabase upload failed:', supabaseError);
            logger.warn('[UploadController] ⚠️ Falling back to local storage');
            
            // Fallback para armazenamento local
            const filepath = path.join(this.uploadsDir, uniqueName);
            savedPath = filepath;
            fs.writeFileSync(filepath, buffer, { mode: 0o600 });
            fileUrl = `/secure-uploads/${uniqueName}`;
            logger.info('[UploadController] ✅ File saved to local storage');
          }
        } else {
          logger.info('[UploadController] 📤 Uploading to local storage (Supabase not configured)...');
          const filepath = path.join(this.uploadsDir, uniqueName);
          savedPath = filepath;
          
          // Garantir que o diretório existe
          if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true, mode: 0o700 });
          }
          
          fs.writeFileSync(filepath, buffer, { mode: 0o600 });
          fileUrl = `/secure-uploads/${uniqueName}`;
          logger.info('[UploadController] ✅ File saved to local storage');
        }
      } catch (uploadError: any) {
        logger.error('[UploadController] ❌ Error during file upload/save:', uploadError);
        throw uploadError; // Re-throw para ser capturado no catch externo
      }

      // ✅ Passo 6: Preparar resposta
      const response = {
        filename: uniqueName,
        url: fileUrl,
        mimetype: typeCheck.mime || 'application/octet-stream',
        size: total,
        hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      };

      logger.info('[UploadController] ✅ Upload complete', {
        filename: response.filename,
        size: response.size,
        mimetype: response.mimetype,
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
      // Limpar arquivo salvo se houve erro
      if (savedPath && fs.existsSync(savedPath)) {
        try {
          fs.unlinkSync(savedPath);
          logger.info('[UploadController] 🗑️ Cleaned up partial file:', savedPath);
        } catch (cleanupError) {
          logger.error('[UploadController] ❌ Error cleaning up file:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[UploadController] ❌ Error uploading file:', {
        message: errorMessage,
        stack: errorStack,
        userId: request.user?.userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.status(500).send({ 
        success: false, 
        message: 'Error uploading file',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
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
