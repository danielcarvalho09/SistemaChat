import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';

/**
 * Middleware de detecção de SQL Injection
 */
export const sqlInjectionProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
  ];

  const checkPayload = (payload: any): boolean => {
    if (typeof payload === 'string') {
      return sqlPatterns.some(pattern => pattern.test(payload));
    }
    if (typeof payload === 'object' && payload !== null) {
      return Object.values(payload).some(val => checkPayload(val));
    }
    return false;
  };

  // Verificar query params
  if (checkPayload(request.query)) {
    logger.warn(`SQL Injection attempt detected in query params from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request parameters',
    });
  }

  // Verificar body
  if (request.body && checkPayload(request.body)) {
    logger.warn(`SQL Injection attempt detected in body from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request body',
    });
  }
};

/**
 * Middleware de detecção de XSS
 */
export const xssProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  const checkPayload = (payload: any): boolean => {
    if (typeof payload === 'string') {
      return xssPatterns.some(pattern => pattern.test(payload));
    }
    if (typeof payload === 'object' && payload !== null) {
      return Object.values(payload).some(val => checkPayload(val));
    }
    return false;
  };

  // Verificar query params
  if (checkPayload(request.query)) {
    logger.warn(`XSS attempt detected in query params from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request parameters',
    });
  }

  // Verificar body
  if (request.body && checkPayload(request.body)) {
    logger.warn(`XSS attempt detected in body from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request body',
    });
  }
};

/**
 * Middleware de detecção de Path Traversal
 */
export const pathTraversalProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const pathTraversalPattern = /(\.\.(\/|\\))|(\.\.$)/i;

  const checkPayload = (payload: any): boolean => {
    if (typeof payload === 'string') {
      return pathTraversalPattern.test(payload);
    }
    if (typeof payload === 'object' && payload !== null) {
      return Object.values(payload).some(val => checkPayload(val));
    }
    return false;
  };

  // Verificar URL
  if (pathTraversalPattern.test(request.url)) {
    logger.warn(`Path traversal attempt detected in URL from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request path',
    });
  }

  // Verificar query params
  if (checkPayload(request.query)) {
    logger.warn(`Path traversal attempt detected in query params from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request parameters',
    });
  }

  // Verificar body
  if (request.body && checkPayload(request.body)) {
    logger.warn(`Path traversal attempt detected in body from ${request.ip}`);
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request body',
    });
  }
};

/**
 * Middleware combinado de segurança
 */
export const securityMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  await sqlInjectionProtection(request, reply);
  if (reply.sent) return;
  
  await xssProtection(request, reply);
  if (reply.sent) return;
  
  await pathTraversalProtection(request, reply);
};

/**
 * Middleware de limite de requisições por IP (anti-bruteforce)
 */
const requestCountByIp = new Map<string, { count: number; resetAt: number }>();

export const bruteForceProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const ip = request.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 1000; // máximo de requisições na janela

  const record = requestCountByIp.get(ip);

  if (!record || now > record.resetAt) {
    requestCountByIp.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (record.count >= maxRequests) {
    logger.warn(`Brute force attempt detected from ${ip}`);
    return reply.status(429).send({
      statusCode: 429,
      message: 'Too many requests, please try again later',
    });
  }

  record.count++;
};

// Limpar cache de IPs a cada hora
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCountByIp.entries()) {
    if (now > record.resetAt) {
      requestCountByIp.delete(ip);
    }
  }
}, 60 * 60 * 1000);
