import { FastifyRequest, FastifyReply } from 'fastify';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema } from '../utils/validators.js';
import { resolveRequestUser } from '../services/public-user.service.js';
import { getPrismaClient } from '../config/database.js';

const prisma = getPrismaClient();

// Helper para formatar resposta do usuário com roles reais
const formatUserResponse = async (email: string, name?: string) =\u003e {
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
  roles: user.roles.map(ur =\u003e({
    id: ur.role.id,
    name: ur.role.name,
    description: ur.role.description,
  })),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};
};

export class AuthController {
  register = async (request: FastifyRequest, reply: FastifyReply) =\u003e {
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

login = async (request: FastifyRequest, reply: FastifyReply) =\u003e {
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

refresh = async (request: FastifyRequest, reply: FastifyReply) =\u003e {
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

logout = async (_request: FastifyRequest, reply: FastifyReply) =\u003e {
  return reply.status(200).send({
    success: true,
    message: 'Logout successful.',
  });
};

me = async (request: FastifyRequest, reply: FastifyReply) =\u003e {
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
