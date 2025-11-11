import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
import { getPrismaClient } from '../config/database.js';

/**
 * Middleware de proteção CSRF (Cross-Site Request Forgery)
 * Implementa Double Submit Cookie + Synchronizer Token Pattern
 */

const CSRF_EXCLUDED_ROUTES = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
]);

// Cache de tokens CSRF em memória (com TTL)
const csrfTokenCache = new Map<string, { token: string; expires: number }>();

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokenCache.entries()) {
    if (value.expires < now) {
      csrfTokenCache.delete(key);
    }
  }
}, 60 * 1000); // A cada minuto

/**
 * Gera um novo token CSRF
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida origem da requisição
 */
function validateOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  
  if (!origin && !referer) {
    // Requisições same-origin não enviam esses headers
    return true;
  }
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    logger.warn(`CSRF: Invalid origin ${origin}`);
    return false;
  }
  
  if (referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    if (!allowedOrigins.includes(refererOrigin)) {
      logger.warn(`CSRF: Invalid referer ${referer}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Middleware de proteção CSRF para métodos que modificam estado
 */
export const csrfProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Apenas verificar em métodos que modificam estado
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(request.method)) {
    return;
  }

  const pathname = request.url.split('?')[0];
  if (CSRF_EXCLUDED_ROUTES.has(pathname)) {
    return;
  }
  
  // Validar origem
  if (!validateOrigin(request)) {
    logger.error(`CSRF attack detected from ${request.ip}`, {
      method: request.method,
      url: request.url,
      origin: request.headers.origin,
      referer: request.headers.referer
    });
    
    return reply.status(403).send({
      statusCode: 403,
      message: 'Invalid request origin'
    });
  }
  
  // Obter tokens
  const headerToken = request.headers['x-csrf-token'] as string;
  const cookieToken = request.cookies.csrfToken;
  
  if (!headerToken || !cookieToken) {
    logger.warn(`Missing CSRF token from ${request.ip}`);
    return reply.status(403).send({
      statusCode: 403,
      message: 'CSRF token required'
    });
  }
  
  // Validar que os tokens coincidem (Double Submit Cookie)
  if (headerToken !== cookieToken) {
    logger.warn(`CSRF token mismatch from ${request.ip}`);
    return reply.status(403).send({
      statusCode: 403,
      message: 'Invalid CSRF token'
    });
  }
  
  // Validar token no backend (Synchronizer Token Pattern)
  const user = (request as any).user;
  if (user) {
    const cacheKey = `${user.userId}:${headerToken}`;
    const cached = csrfTokenCache.get(cacheKey);
    
    if (!cached || cached.expires < Date.now()) {
      // Verificar no banco se não está em cache
      const prisma = getPrismaClient();
      const session = await prisma.userSession.findFirst({
        where: {
          userId: user.userId,
          csrfToken: headerToken,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!session) {
        logger.error(`Invalid CSRF token for user ${user.userId}`);
        return reply.status(403).send({
          statusCode: 403,
          message: 'Invalid or expired CSRF token'
        });
      }
      
      // Adicionar ao cache
      csrfTokenCache.set(cacheKey, {
        token: headerToken,
        expires: Date.now() + 15 * 60 * 1000 // 15 minutos
      });
    }
  }
  
  // Token válido, continuar
  logger.debug(`CSRF token validated for ${request.ip}`);
};

/**
 * Middleware para gerar e enviar token CSRF em requisições GET
 */
export const csrfTokenGenerator = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Apenas gerar em requisições autenticadas
  const user = (request as any).user;
  if (!user) {
    return;
  }

  const pathname = request.url.split('?')[0];
  if (CSRF_EXCLUDED_ROUTES.has(pathname)) {
    return;
  }
  
  // Apenas em métodos seguros
  if (!['GET', 'HEAD'].includes(request.method)) {
    return;
  }
  
  // Gerar novo token
  const csrfToken = generateCsrfToken();
  
  // Salvar no banco
  const prisma = getPrismaClient();
  await prisma.userSession.upsert({
    where: { userId: user.userId },
    create: {
      userId: user.userId,
      csrfToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    },
    update: {
      csrfToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
  
  // Adicionar ao cache
  const cacheKey = `${user.userId}:${csrfToken}`;
  csrfTokenCache.set(cacheKey, {
    token: csrfToken,
    expires: Date.now() + 15 * 60 * 1000
  });
  
  // Enviar como cookie e header
  reply.setCookie('csrfToken', csrfToken, {
    httpOnly: false, // Precisa ser lido pelo JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  });
  
  reply.header('X-CSRF-Token', csrfToken);
};

/**
 * Validação adicional para requisições críticas
 */
export const strictCsrfProtection = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Aplicar proteção CSRF normal
  await csrfProtection(request, reply);
  if (reply.sent) return;
  
  // Validações adicionais para operações críticas
  
  // 1. Verificar User-Agent
  const userAgent = request.headers['user-agent'];
  if (!userAgent || userAgent.length < 10) {
    logger.warn(`Suspicious request without proper User-Agent from ${request.ip}`);
    return reply.status(403).send({
      statusCode: 403,
      message: 'Invalid request'
    });
  }
  
  // 2. Verificar tempo desde login (prevenir session fixation)
  const user = (request as any).user;
  if (user) {
    const prisma = getPrismaClient();
    const session = await prisma.userSession.findUnique({
      where: { userId: user.userId }
    });
    
    if (session) {
      const sessionAge = Date.now() - session.createdAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      
      if (sessionAge > maxAge) {
        logger.warn(`Session too old for critical operation: ${user.userId}`);
        return reply.status(403).send({
          statusCode: 403,
          message: 'Session expired for this operation. Please login again.'
        });
      }
    }
  }
  
  // 3. Rate limiting específico para operações críticas
  const criticalOpsKey = `critical:${request.ip}:${user?.userId || 'anon'}`;
  const criticalOpsCount = await incrementRateLimit(criticalOpsKey, 60 * 1000); // 1 minuto
  
  if (criticalOpsCount > 10) {
    logger.error(`Too many critical operations from ${request.ip}`);
    return reply.status(429).send({
      statusCode: 429,
      message: 'Too many requests. Please try again later.'
    });
  }
};

// Helper para rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function incrementRateLimit(key: string, windowMs: number): Promise<number> {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return 1;
  }
  
  record.count++;
  return record.count;
}

// Limpar rate limit map periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);
