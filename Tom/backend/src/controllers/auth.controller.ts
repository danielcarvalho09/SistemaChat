import { FastifyRequest, FastifyReply } from 'fastify';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema } from '../utils/validators.js';
import { PUBLIC_USER_RESPONSE } from '../constants/public-user.js';

export class AuthController {
  register = async (request: FastifyRequest, reply: FastifyReply) => {
    validate(registerSchema, request.body);

    return reply.status(200).send({
      success: true,
      message: 'Registration disabled (authentication bypassed).',
      data: {
        user: PUBLIC_USER_RESPONSE,
        csrfToken: null,
      },
    });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    validate(loginSchema, request.body);

    return reply.status(200).send({
      success: true,
      message: 'Login disabled (authentication bypassed).',
      data: {
        user: PUBLIC_USER_RESPONSE,
        csrfToken: null,
      },
    });
  };

  refresh = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      message: 'Tokens refreshed (authentication bypassed).',
      data: {
        user: PUBLIC_USER_RESPONSE,
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

  me = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: PUBLIC_USER_RESPONSE,
    });
  };
}
