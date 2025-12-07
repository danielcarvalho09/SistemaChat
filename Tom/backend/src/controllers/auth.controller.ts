import { FastifyRequest, FastifyReply } from 'fastify';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema } from '../utils/validators.js';
import { resolveRequestUser } from '../services/public-user.service.js';
import { getPrismaClient } from '../config/database.js';
import { AuthService } from '../services/auth.service.js';

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
  private authService = new AuthService();

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    // Pegar IP do x-forwarded-for ou socket
    const ip = (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || '127.0.0.1';
    const userAgent = request.headers['user-agent'];
    const fingerprint = (request.headers['x-fingerprint'] as string) || 'browser';

    const body = validate(registerSchema, request.body) as any;

    const result = await this.authService.register(body, {
      ip,
      userAgent,
      fingerprint
    });

    return reply.status(200).send({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || '127.0.0.1';
    const userAgent = request.headers['user-agent'];
    const fingerprint = (request.headers['x-fingerprint'] as string) || 'browser';

    const body = validate(loginSchema, request.body) as any;

    const result = await this.authService.login(body, {
      ip,
      userAgent,
      fingerprint
    });

    return reply.status(200).send({
      success: true,
      message: 'Login successful',
      data: result,
    });
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const headerEmail = typeof request.headers['x-user-email'] === 'string'
      ? request.headers['x-user-email']
      : undefined;

    // ✅ FIX: Não usar "public@example.com" como fallback
    // Se não tem email no header, retornar erro 401
    if (!headerEmail) {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized: No user email provided',
      });
    }

    const userResponse = await formatUserResponse(headerEmail);

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

    // ✅ FIX: Não usar "public@example.com" como fallback 
    // Se não tem email no header, retornar erro 401
    if (!headerEmail) {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized: No user email provided',
      });
    }

    const userResponse = await formatUserResponse(headerEmail, headerName);

    return reply.status(200).send({
      success: true,
      data: userResponse,
    });
  };
}
