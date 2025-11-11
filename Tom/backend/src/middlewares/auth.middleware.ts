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
