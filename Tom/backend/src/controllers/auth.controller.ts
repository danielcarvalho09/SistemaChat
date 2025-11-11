import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { AuthService } from '../services/auth.service.js';
import { validate } from '../utils/validators.js';
import { loginSchema, registerSchema } from '../utils/validators.js';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutos
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias
const CSRF_TOKEN_MAX_AGE = 24 * 60 * 60; // 24 horas

export class AuthController {
  private authService = new AuthService();

  private getFingerprint(request: FastifyRequest): string {
    const userAgent = request.headers['user-agent'] || '';
    const acceptLanguage = request.headers['accept-language'] || '';
    const acceptEncoding = request.headers['accept-encoding'] || '';
    const ip = request.ip || '';

    const rawFingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
    return crypto.createHash('sha256').update(rawFingerprint).digest('hex');
  }

  private setAuthCookies(reply: FastifyReply, tokens: { accessToken: string; refreshToken: string }): void {
    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'strict' as const,
      secure: config.server.isProduction,
    };

    reply.setCookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    reply.setCookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      path: '/api/v1/auth/refresh',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  private setCsrfCookie(reply: FastifyReply, csrfToken: string): void {
    reply.setCookie('csrfToken', csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: config.server.isProduction,
      path: '/',
      maxAge: CSRF_TOKEN_MAX_AGE,
    });
    reply.header('X-CSRF-Token', csrfToken);
  }

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = validate(registerSchema, request.body);
    const fingerprint = this.getFingerprint(request);

    const { user, tokens } = await this.authService.register(data, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string,
      fingerprint,
    });

    this.setAuthCookies(reply, tokens);
    const csrfToken = await this.authService.issueCsrfToken(user.id, {
      fingerprint,
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string,
    });
    this.setCsrfCookie(reply, csrfToken);

    logger.info(`New user registered: ${data.email}`, { ip: request.ip });

    return reply.status(201).send({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        csrfToken,
      },
    });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = validate(loginSchema, request.body);
    const fingerprint = this.getFingerprint(request);

    try {
      const { user, tokens } = await this.authService.login(data, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string,
        fingerprint,
      });

      this.setAuthCookies(reply, tokens);
      const csrfToken = await this.authService.issueCsrfToken(user.id, {
        fingerprint,
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });
      this.setCsrfCookie(reply, csrfToken);

      return reply.status(200).send({
        success: true,
        message: 'Login successful',
        data: {
          user,
          csrfToken,
        },
      });
    } catch (error) {
      const attempts = this.authService.getFailedAttempts(request.ip);
      const delay = Math.min(attempts * 1000, 5000);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      logger.warn('Login failed', {
        email: data.email,
        ip: request.ip,
        attempts,
      });

      return reply.status(401).send({
        success: false,
        message: 'Invalid email or password',
      });
    }
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        message: 'Refresh token not provided',
      });
    }

    const fingerprint = this.getFingerprint(request);
    const tokens = await this.authService.refreshTokens(refreshToken, fingerprint);

    this.setAuthCookies(reply, tokens);

    const userId = request.user?.userId;
    if (userId) {
      const csrfToken = await this.authService.issueCsrfToken(userId, {
        fingerprint,
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });
      this.setCsrfCookie(reply, csrfToken);
    }

    return reply.status(200).send({
      success: true,
      message: 'Tokens refreshed successfully',
    });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const refreshToken = request.cookies.refreshToken;

    await this.authService.logout(userId, refreshToken);

    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    reply.clearCookie('csrfToken', { path: '/' });

    logger.info(`User logged out: ${userId}`, { ip: request.ip });

    return reply.status(200).send({
      success: true,
      message: 'Logout successful',
    });
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const user = await this.authService.getUserById(userId);

    return reply.status(200).send({
      success: true,
      data: user,
    });
  };
}
