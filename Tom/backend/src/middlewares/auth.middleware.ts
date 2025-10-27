import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt';
import { getPrismaClient } from '../config/database';
import { logger } from '../config/logger';

// Estender FastifyRequest para incluir user
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

/**
 * Middleware de autenticação JWT
 * Verifica se o token é válido e adiciona informações do usuário à request
 */
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    // Extrair token do header
    const token = extractTokenFromHeader(request.headers.authorization);

    if (!token) {
      return reply.status(401).send({
        statusCode: 401,
        message: 'Authentication token is required',
      });
    }

    // Verificar e decodificar token
    const decoded = verifyAccessToken(token);

    // Buscar usuário no banco para verificar se ainda está ativo
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        statusCode: 401,
        message: 'User not found or inactive',
      });
    }

    // Extrair roles e permissões do banco (não do JWT)
    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions = user.roles.flatMap((userRole) =>
      userRole.role.permissions.map((rp) => rp.permission.name)
    );

    // Adicionar informações do usuário à request
    request.user = {
      userId: user.id,
      email: user.email,
      roles: roles, // Usar roles do banco, não do JWT
      permissions: [...new Set(permissions)], // Remove duplicatas
    };
  } catch (error: any) {
    logger.error('Authentication error:', error);
    return reply.status(401).send({
      statusCode: 401,
      message: error.message || 'Invalid or expired token',
    });
  }
};

/**
 * Middleware opcional de autenticação
 * Não retorna erro se não houver token, apenas não adiciona user à request
 */
export const optionalAuthenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(request.headers.authorization);

    if (token) {
      const decoded = verifyAccessToken(token);
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (user && user.isActive) {
        const permissions = user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rp) => rp.permission.name)
        );

        request.user = {
          userId: user.id,
          email: user.email,
          roles: decoded.roles,
          permissions: [...new Set(permissions)],
        };
      }
    }
  } catch (error) {
    // Silenciosamente ignora erros de autenticação
    logger.debug('Optional authentication failed:', error);
  }
};

/**
 * Middleware que requer autenticação
 */
export const requireAuth = authenticate;

/**
 * Middleware que requer role de admin
 */
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  await authenticate(request, reply);
  
  if (!request.user?.roles.includes('admin')) {
    return reply.status(403).send({
      statusCode: 403,
      message: 'Admin access required',
    });
  }
};
