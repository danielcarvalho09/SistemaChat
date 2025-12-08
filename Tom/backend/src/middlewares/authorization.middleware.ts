import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';

/**
 * Middleware de autorização baseado em roles
 * Verifica se o usuário possui pelo menos uma das roles especificadas
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      logger.warn('[Authorization] No user found in request');
      return reply.status(401).send({
        statusCode: 401,
        message: 'Authentication required',
      });
    }

    logger.info(`[Authorization] Checking roles for user ${request.user.userId}:`, {
      userRoles: request.user.roles,
      requiredRoles: allowedRoles,
      hasRole: request.user.roles.some((role) => allowedRoles.includes(role))
    });

    const hasRole = request.user.roles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasRole) {
      logger.warn(
        `[Authorization] User ${request.user.userId} (roles: ${JSON.stringify(request.user.roles)}) attempted to access resource requiring roles: ${allowedRoles.join(', ')}`
      );
      return reply.status(403).send({
        statusCode: 403,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRoles: request.user.roles,
      });
    }
  };
};

/**
 * Middleware de autorização baseado em permissões
 * Verifica se o usuário possui pelo menos uma das permissões especificadas
 * ✅ Admin tem acesso total (bypass automático)
 */
export const requirePermission = (requiredPermissions: string[]) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        statusCode: 401,
        message: 'Authentication required',
      });
    }

    // ✅ Admin tem acesso total - bypass automático
    if (request.user.roles.includes('admin')) {
      return;
    }

    // ✅ Verificar wildcard ou permissões específicas
    const hasWildcard = request.user.permissions.includes('*');
    const hasPermission = hasWildcard || requiredPermissions.some((permission) =>
      request.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn(
        `User ${request.user.userId} (roles: ${request.user.roles.join(', ')}) attempted to access resource requiring permissions: ${requiredPermissions.join(', ')}`
      );
      return reply.status(403).send({
        statusCode: 403,
        message: 'Insufficient permissions',
        requiredPermissions,
      });
    }
  };
};

/**
 * Middleware para verificar se usuário é admin
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware para verificar se usuário é admin ou gerente
 */
export const requireAdminOrGerente = requireRole(['admin', 'gerente']);

/**
 * Middleware para verificar se usuário tem acesso a uma conexão específica
 */
export const requireConnectionAccess = async (
  request: FastifyRequest<{ Params: { connectionId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  if (!request.user) {
    return reply.status(401).send({
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { connectionId } = request.params;

  // Admins e gerentes têm acesso a todas as conexões
  if (request.user.roles.includes('admin') || request.user.roles.includes('gerente')) {
    return;
  }

  // Verificar se usuário tem acesso à conexão (NOVA LÓGICA)
  const { getPrismaClient } = await import('../config/database');
  const prisma = getPrismaClient();

  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      id: connectionId,
      userId: request.user.userId,
    },
  });

  if (!connection) {
    logger.warn(
      `User ${request.user.userId} attempted to access connection ${connectionId} without permission`
    );
    return reply.status(403).send({
      statusCode: 403,
      message: 'Access to this connection is not allowed',
    });
  }
};

/**
 * Middleware para verificar se usuário tem acesso a um departamento específico
 */
export const requireDepartmentAccess = async (
  request: FastifyRequest<{ Params: { departmentId: string } }>,
  reply: FastifyReply
): Promise<void> => {
  if (!request.user) {
    return reply.status(401).send({
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const { departmentId } = request.params;

  // Admins e gerentes têm acesso a todos os departamentos
  if (request.user.roles.includes('admin') || request.user.roles.includes('gerente')) {
    return;
  }

  // Verificar se usuário tem acesso ao departamento
  const { getPrismaClient } = await import('../config/database');
  const prisma = getPrismaClient();

  const userDepartmentAccess = await prisma.userDepartmentAccess.findFirst({
    where: {
      userId: request.user.userId,
      departmentId,
    },
  });

  if (!userDepartmentAccess) {
    logger.warn(
      `User ${request.user.userId} attempted to access department ${departmentId} without permission`
    );
    return reply.status(403).send({
      statusCode: 403,
      message: 'Access to this department is not allowed',
    });
  }
};

/**
 * Middleware para verificar se usuário é dono do recurso ou admin
 */
export const requireOwnershipOrAdmin = (userIdField: string = 'userId') => {
  return async (
    request: FastifyRequest<{ Params: Record<string, string> }>,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        statusCode: 401,
        message: 'Authentication required',
      });
    }

    // Admins e gerentes podem acessar qualquer recurso
    if (request.user.roles.includes('admin') || request.user.roles.includes('gerente')) {
      return;
    }

    const resourceUserId = request.params[userIdField];

    if (resourceUserId !== request.user.userId) {
      logger.warn(
        `User ${request.user.userId} attempted to access resource owned by ${resourceUserId}`
      );
      return reply.status(403).send({
        statusCode: 403,
        message: 'You can only access your own resources',
      });
    }
  };
};
