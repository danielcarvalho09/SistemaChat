import { FastifyRequest, FastifyReply } from 'fastify';
import { sanitizeObject, containsMaliciousContent } from '../utils/sanitizer.js';
import { logger } from '../config/logger.js';

/**
 * Middleware global de sanitização de inputs
 * 
 * Aplica automaticamente sanitização a:
 * - request.body
 * - request.query
 * - request.params
 * 
 * Previne XSS, SQL Injection, Path Traversal, etc.
 */
export const sanitizeInputs = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    // Sanitizar body
    if (request.body && typeof request.body === 'object') {
      request.body = sanitizeObject(request.body as Record<string, any>, {
        htmlFields: ['description', 'bio', 'notes'],
        textFields: ['name', 'content', 'message', 'title', 'reason'],
        emailFields: ['email'],
        urlFields: ['avatar', 'url', 'website', 'mediaUrl'],
        phoneFields: ['phone', 'phoneNumber'],
      });
      
      // Verificar conteúdo malicioso
      const bodyString = JSON.stringify(request.body);
      if (containsMaliciousContent(bodyString)) {
        logger.warn(`Malicious content detected from IP: ${request.ip}`, {
          url: request.url,
          method: request.method,
          body: request.body,
        });
        
        return reply.status(400).send({
          statusCode: 400,
          message: 'Invalid input detected. Please check your data.',
        });
      }
    }
    
    // Sanitizar query parameters
    if (request.query && typeof request.query === 'object') {
      request.query = sanitizeObject(request.query as Record<string, any>);
    }
    
    // Não sanitizar params (são geralmente IDs/UUIDs validados por schemas)
    // Mas podemos validar formato
    if (request.params && typeof request.params === 'object') {
      const paramsString = JSON.stringify(request.params);
      if (containsMaliciousContent(paramsString)) {
        logger.warn(`Malicious params detected from IP: ${request.ip}`, {
          url: request.url,
          params: request.params,
        });
        
        return reply.status(400).send({
          statusCode: 400,
          message: 'Invalid URL parameters.',
        });
      }
    }
  } catch (error) {
    logger.error('Sanitization middleware error:', error);
    // Em caso de erro, permitir requisição (fail-safe)
  }
};

/**
 * Middleware de sanitização específico para mensagens de chat
 * Mais permissivo (permite emojis, formatação básica)
 */
export const sanitizeChatInput = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const body = request.body as any;
    
    if (body && body.content && typeof body.content === 'string') {
      // Importar função específica
      const { sanitizeChatMessage } = await import('../utils/sanitizer.js');
      body.content = sanitizeChatMessage(body.content);
    }
    
    if (body && body.message && typeof body.message === 'string') {
      const { sanitizeChatMessage } = await import('../utils/sanitizer.js');
      body.message = sanitizeChatMessage(body.message);
    }
  } catch (error) {
    logger.error('Chat sanitization error:', error);
  }
};

