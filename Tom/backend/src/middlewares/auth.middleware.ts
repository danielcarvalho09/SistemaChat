import { FastifyRequest, FastifyReply } from 'fastify';
import { PUBLIC_REQUEST_USER } from '../constants/public-user.js';

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

const attachPublicUser = (request: FastifyRequest): void => {
  request.user = { ...PUBLIC_REQUEST_USER };
};

export const authenticate = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  attachPublicUser(request);
};

export const optionalAuthenticate = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  attachPublicUser(request);
};

export const requireAuth = authenticate;

export const requireAdmin = authenticate;
