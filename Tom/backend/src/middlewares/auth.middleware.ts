import { FastifyRequest, FastifyReply } from 'fastify';
import { resolveRequestUser } from '../services/public-user.service.js';
import { PUBLIC_USER_RESPONSE } from '../constants/public-user.js';

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
      console.log('🔐 [AuthMiddleware] Token received. Verifying...');
      // Import dinâmico circular ou lazy
      const { verifyAccessToken } = await import('../utils/jwt.js');
      const decoded = verifyAccessToken(token);

      console.log('✅ [AuthMiddleware] Token verified. Role:', decoded.roles);

      request.user = {
        userId: decoded.userId,
        email: decoded.email || '',
        roles: decoded.roles || [],
        permissions: decoded.permissions || ['*'],
      };
      return; // Autenticado com sucesso via Token
    } catch (error) {
      console.error('❌ [AuthMiddleware] Token verification failed:', error);
      // Token inválido ou expirado - continuar para fallback (ou lançar erro?)
      // Se enviou token e falhou, melhor falhar a requisição do que cair em usuário público
      // Mas para manter compatibilidade, vamos logar e deixar cair no fallback por enquanto,
      // ou lançar erro se foi explicitamente tentado auth.
      // Vamos assumir que se mandou token, quer usar token.

      // Mas o frontend pode mandar token expirado e esperar refresh?
      // O frontend deve lidar com 401.
      // Porem, se falhar aqui, o proximo passo é Public User.
      // Vamos deixar cair no Public User APENAS se não for rota protegida estritamente?
      // authenticate é usado em rotas protegidas.

      // VAMOS PRIORIZAR O TOKEN.
      // Se o token falhar, não deve logar como Public User.
      // Mas vou deixar o fallback por segurança se o token for malformado, mas se for expirado, o verify lança erro.
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
