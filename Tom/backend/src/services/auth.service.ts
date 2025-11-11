import crypto from 'crypto';
import { getPrismaClient } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import {
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  UserResponse,
  JWTPayload,
  RefreshTokenPayload,
} from '../models/types.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';

interface LoginContext {
  ip: string;
  userAgent?: string;
  fingerprint: string;
}

const FAILED_LOGIN_MAX_ATTEMPTS = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export class AuthService {
  private prisma = getPrismaClient();
  private static failedLoginAttempts = new Map<string, { count: number; firstAttemptAt: number; lastAttemptAt: number }>();

  private static registerFailedAttempt(ip: string): number {
    const now = Date.now();
    const record = AuthService.failedLoginAttempts.get(ip);

    if (!record || now - record.firstAttemptAt > FAILED_LOGIN_WINDOW_MS) {
      AuthService.failedLoginAttempts.set(ip, {
        count: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return 1;
    }

    record.count += 1;
    record.lastAttemptAt = now;
    AuthService.failedLoginAttempts.set(ip, record);
    return record.count;
  }

  private static resetFailedAttempts(ip: string): void {
    AuthService.failedLoginAttempts.delete(ip);
  }

  getFailedAttempts(ip: string): number {
    const record = AuthService.failedLoginAttempts.get(ip);
    if (!record) {
      return 0;
    }

    if (Date.now() - record.firstAttemptAt > FAILED_LOGIN_WINDOW_MS) {
      AuthService.failedLoginAttempts.delete(ip);
      return 0;
    }

    return record.count;
  }

  private buildSessionUpdate(data: {
    fingerprint?: string;
    ip?: string;
    userAgent?: string;
    csrfToken?: string;
    failedCount?: number;
    failedAt?: Date;
  }) {
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    };

    if (data.fingerprint) {
      update.fingerprint = data.fingerprint;
    }
    if (data.ip) {
      update.ipAddress = data.ip;
    }
    if (data.userAgent) {
      update.userAgent = data.userAgent;
    }
    if (data.csrfToken) {
      update.csrfToken = data.csrfToken;
    }
    if (typeof data.failedCount === 'number') {
      update.failedCount = data.failedCount;
      update.lastFailedAt = data.failedAt ?? new Date();
    }

    return update;
  }

  private async upsertSession(
    userId: string,
    data: {
      fingerprint?: string;
      ip?: string;
      userAgent?: string;
      csrfToken?: string;
      failedCount?: number;
      failedAt?: Date;
    },
  ) {
    await this.prisma.userSession.upsert({
      where: { userId },
      create: {
        userId,
        fingerprint: data.fingerprint,
        ipAddress: data.ip,
        userAgent: data.userAgent,
        csrfToken: data.csrfToken,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        failedCount: data.failedCount ?? 0,
        lastFailedAt: data.failedAt,
      },
      update: this.buildSessionUpdate(data),
    });
  }

  async issueCsrfToken(
    userId: string,
    params: { fingerprint?: string; ip?: string; userAgent?: string } = {},
  ): Promise<string> {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    await this.upsertSession(userId, {
      fingerprint: params.fingerprint,
      ip: params.ip,
      userAgent: params.userAgent,
      csrfToken,
    });
    return csrfToken;
  }

  async register(
    data: RegisterRequest,
    context?: LoginContext,
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const userRole = await this.prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (userRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: userRole.id,
        },
      });
    }

    await this.prisma.notificationPreference.create({
      data: { userId: user.id },
    });

    const roles = ['user'];
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles,
    };

    const tokens = generateTokens(payload, { fingerprint: context?.fingerprint });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    if (context) {
      await this.upsertSession(user.id, {
        fingerprint: context.fingerprint,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }

    logger.info(`User registered: ${user.email}`, { ip: context?.ip });

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async login(
    data: LoginRequest,
    context: LoginContext,
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      const attempts = AuthService.registerFailedAttempt(context.ip);
      logger.warn('Failed login attempt - user not found', {
        email: data.email,
        ip: context.ip,
        attempts,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      const attempts = AuthService.registerFailedAttempt(context.ip);
      await this.upsertSession(user.id, {
        failedCount: attempts,
        failedAt: new Date(),
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    AuthService.resetFailedAttempts(context.ip);

    const roles = user.roles.map((ur) => ur.role.name);
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles,
    };

    const tokens = generateTokens(payload, { fingerprint: context.fingerprint });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    await this.upsertSession(user.id, {
      fingerprint: context.fingerprint,
      ip: context.ip,
      userAgent: context.userAgent,
      failedCount: 0,
    });

    logger.info(`User logged in: ${user.email}`, { ip: context.ip });

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string, fingerprint?: string): Promise<AuthTokens> {
    let decoded: RefreshTokenPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      logger.warn('Refresh token verification failed', { error });
      throw new UnauthorizedError('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Verificar fingerprint (defesa contra roubo de token)
    if (decoded.fingerprint && fingerprint && decoded.fingerprint !== fingerprint) {
      logger.error('Fingerprint mismatch on refresh token', {
        userId: storedToken.user.id,
      });
      await this.prisma.refreshToken.deleteMany({ where: { userId: storedToken.user.id } });
      throw new UnauthorizedError('Security validation failed');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { userId: storedToken.user.id },
    });

    if (session?.fingerprint && fingerprint && session.fingerprint !== fingerprint) {
      logger.error('Session fingerprint mismatch', { userId: storedToken.user.id });
      await this.prisma.refreshToken.deleteMany({ where: { userId: storedToken.user.id } });
      throw new UnauthorizedError('Security validation failed');
    }

    const roles = storedToken.user.roles.map((ur) => ur.role.name);
    const payload: JWTPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      roles,
    };

    const tokens = generateTokens(payload, { fingerprint });

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt,
      },
    });

    await this.upsertSession(storedToken.user.id, {
      fingerprint,
    });

    logger.info(`Tokens refreshed for user: ${storedToken.user.email}`);

    return tokens;
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { csrfToken: null, fingerprint: null },
    });
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'offline' },
    });

    await this.prisma.userSession.updateMany({
      where: { userId },
      data: {
        csrfToken: null,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    logger.info(`User logged out: ${userId}`);
  }

  async getUserById(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.formatUserResponse(user);
  }

  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      isActive: user.isActive,
      roles:
        user.roles?.map((ur: any) => ({
          id: ur.role.id,
          name: ur.role.name,
          description: ur.role.description,
        })) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
