import { getPrismaClient } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import {
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  UserResponse,
  JWTPayload,
} from '../models/types.js';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';

export class AuthService {
  private prisma = getPrismaClient();

  /**
   * Registra um novo usuário
   */
  async register(data: RegisterRequest): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    // Verificar se email já existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash da senha
    const hashedPassword = await hashPassword(data.password);

    // Criar usuário
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

    // Atribuir role padrão "user"
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

    // Criar preferências de notificação padrão
    await this.prisma.notificationPreference.create({
      data: {
        userId: user.id,
      },
    });

    // Gerar tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles: ['user'],
    };

    const tokens = generateTokens(payload);

    // Salvar refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    logger.info(`User registered: ${user.email}`);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  /**
   * Autentica um usuário
   */
  async login(data: LoginRequest): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    // Buscar usuário
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
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verificar se usuário está ativo
    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Verificar senha
    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Gerar tokens
    const roles = user.roles.map((ur) => ur.role.name);
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles,
    };

    const tokens = generateTokens(payload);

    // Salvar refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Atualizar status para online
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  /**
   * Refresh de tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verificar refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Buscar refresh token no banco
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

    // Verificar se token expirou
    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedError('Refresh token expired');
    }

    // Verificar se usuário está ativo
    if (!storedToken.user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Gerar novos tokens
    const roles = storedToken.user.roles.map((ur) => ur.role.name);
    const payload: JWTPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      roles,
    };

    const tokens = generateTokens(payload);

    // Deletar refresh token antigo
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Salvar novo refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt,
      },
    });

    logger.info(`Tokens refreshed for user: ${storedToken.user.email}`);

    return tokens;
  }

  /**
   * Logout (invalida refresh token)
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Deletar refresh token específico
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // Deletar todos os refresh tokens do usuário
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    // Atualizar status para offline
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'offline' },
    });

    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Busca usuário por ID
   */
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

  /**
   * Formata resposta do usuário (remove senha)
   */
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      isActive: user.isActive,
      roles: user.roles?.map((ur: any) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
      })) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
