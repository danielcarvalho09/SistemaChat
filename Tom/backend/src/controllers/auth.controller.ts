import { FastifyRequest, FastifyReply } from 'fastify';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema } from '../utils/validators.js';
import { resolveRequestUser } from '../services/public-user.service.js';
import { getPrismaClient } from '../config/database.js';

const prisma = getPrismaClient();

// Helper para formatar resposta do usuário com roles reais
const formatUserResponse = async (email: string, name?: string) => {
  const resolvedUser = await resolveRequestUser(email, name);
  
  // Buscar dados completos do usuário com roles
  const user = await prisma.user.findUnique({
    where: { id: resolvedUser.userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    status: user.status,
    isActive: user.isActive,
    roles: user.roles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export class AuthController {
  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validate(registerSchema, request.body) as { email: string; password: string; name: string };

    const userResponse = await formatUserResponse(body.email, body.name);

    return reply.status(200).send({
      success: true,
      message: 'Registration disabled (authentication bypassed).',
      data: {
        user: userResponse,
        csrfToken: null,
      },
    });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validate(loginSchema, request.body) as { email: string; password: string };

    const userResponse = await formatUserResponse(body.email);

    return reply.status(200).send({
      success: true,
      message: 'Login disabled (authentication bypassed).',
      data: {
        user: userResponse,
        csrfToken: null,
      },
    });
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const headerEmail = typeof request.headers['x-user-email'] === 'string' 
      ? request.headers['x-user-email'] 
      : undefined;
    
    const userResponse = await formatUserResponse(headerEmail || 'public@example.com');

    return reply.status(200).send({
      success: true,
      message: 'Tokens refreshed (authentication bypassed).',
      data: {
        user: userResponse,
        csrfToken: null,
      },
    });
  };

  logout = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      message: 'Logout successful.',
    });
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const headerEmail = typeof request.headers['x-user-email'] === 'string' 
      ? request.headers['x-user-email'] 
      : undefined;
    const headerName = typeof request.headers['x-user-name'] === 'string' 
      ? request.headers['x-user-name'] 
      : undefined;
    
    const userResponse = await formatUserResponse(headerEmail || 'public@example.com', headerName);

    return reply.status(200).send({
      success: true,
      data: userResponse,
    });
  };
}
