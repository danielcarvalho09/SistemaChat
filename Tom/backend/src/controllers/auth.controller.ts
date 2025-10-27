import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema, refreshTokenSchema } from '../utils/validators.js';
import { logger } from '../config/logger.js';

export class AuthController {
  private authService = new AuthService();

  /**
   * POST /api/v1/auth/register
   * Registra novo usuário
   */
  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = validate(registerSchema, request.body);
    const result = await this.authService.register(data);

    logger.info(`New user registered: ${data.email}`);

    return reply.status(201).send({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  };

  /**
   * POST /api/v1/auth/login
   * Autentica usuário
   */
  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = validate(loginSchema, request.body);
    const result = await this.authService.login(data);

    logger.info(`User logged in: ${data.email}`);

    return reply.status(200).send({
      success: true,
      message: 'Login successful',
      data: result,
    });
  };

  /**
   * POST /api/v1/auth/refresh
   * Renova tokens de autenticação
   */
  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = validate(refreshTokenSchema, request.body);
    const tokens = await this.authService.refreshTokens(refreshToken);

    return reply.status(200).send({
      success: true,
      message: 'Tokens refreshed successfully',
      data: tokens,
    });
  };

  /**
   * POST /api/v1/auth/logout
   * Faz logout do usuário
   */
  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const body = request.body as { refreshToken?: string };

    await this.authService.logout(userId, body.refreshToken);

    logger.info(`User logged out: ${userId}`);

    return reply.status(200).send({
      success: true,
      message: 'Logout successful',
    });
  };

  /**
   * GET /api/v1/auth/me
   * Retorna informações do usuário autenticado
   */
  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const user = await this.authService.getUserById(userId);

    return reply.status(200).send({
      success: true,
      data: user,
    });
  };
}
