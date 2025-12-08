import { FastifyRequest, FastifyReply } from 'fastify';
import { resolveRequestUser } from '../services/public-user.service.js';
import { PUBLIC_USER_RESPONSE } from '../constants/public-user.js';
import { logger } from '../config/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      roles: string[];
      permissions: string[];
    };
  }
}

const extractHeaderValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === 'string' ? first.trim() : undefined;
  }
  return undefined;
};

const attachRequestUser = (request: FastifyRequest, user: Awaited<ReturnType<typeof resolveRequestUser>>): void => {
  request.user = {
    userId: user.userId,
    email: user.email,
    roles: user.roles,
    permissions: ['*'],
  };
};

export const authenticate = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  // 1. Tentar autenticação via Token (JWT)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      logger.info('🔐 [AuthMiddleware] Token received. Verifying...');
      // Import dinâmico circular ou lazy
      const { verifyAccessToken } = await import('../utils/jwt.js');
      const decoded = verifyAccessToken(token);

      logger.info(`✅ [AuthMiddleware] Token verified. UserId: ${decoded.userId}, Email: ${decoded.email}, Roles: ${JSON.stringify(decoded.roles)}`);

      // Garantir que roles seja um array
      const roles = Array.isArray(decoded.roles) ? decoded.roles : (decoded.roles ? [decoded.roles] : []);
      
      request.user = {
        userId: decoded.userId,
        email: decoded.email || '',
        roles: roles,
        permissions: ['*'], // Default permissions
      };
      
      logger.info(`✅ [AuthMiddleware] User attached to request:`, {
        userId: request.user.userId,
        email: request.user.email,
        roles: request.user.roles
      });
      
      return; // Autenticado com sucesso via Token
    } catch (error) {
      logger.error('❌ [AuthMiddleware] Token verification failed:', error);
      // Se um token foi fornecido mas é inválido/expirado, devemos rejeitar a requisição
      // ao invés de cair silenciosamente no fallback de public-user
      // Isso estava causando admins serem tratados como public-user
      throw new Error('Invalid or expired token');
    }
  }

  // 2. Fallback: Autenticação via Headers (Public User / Gateway)
  const headerEmail = extractHeaderValue(request.headers['x-user-email']);
  const headerName = extractHeaderValue(request.headers['x-user-name']);

  const resolvedUser = await resolveRequestUser(
    headerEmail ?? PUBLIC_USER_RESPONSE.email,
    headerName ?? PUBLIC_USER_RESPONSE.name
  );

  attachRequestUser(request, resolvedUser);
};

export const optionalAuthenticate = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  const headerEmail = extractHeaderValue(request.headers['x-user-email']);
  const headerName = extractHeaderValue(request.headers['x-user-name']);

  const resolvedUser = await resolveRequestUser(
    headerEmail ?? PUBLIC_USER_RESPONSE.email,
    headerName ?? PUBLIC_USER_RESPONSE.name
  );

  attachRequestUser(request, resolvedUser);
};

export const requireAuth = authenticate;

export const requireAdmin = authenticate;
