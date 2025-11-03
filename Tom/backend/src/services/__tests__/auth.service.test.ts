import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../auth.service';
import { getPrismaClient } from '../../config/database';
import { ConflictError, UnauthorizedError } from '../../middlewares/error.middleware';
import type { PrismaClient } from '@prisma/client';

// Mock do Prisma
jest.mock('../../config/database');

describe('AuthService', () => {
  let authService: AuthService;
  let prismaMock: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Setup mock do Prisma
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      notificationPreference: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);
    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'SecurePassword123',
      name: 'Test User',
    };

    it('should register new user successfully', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null); // Email não existe
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'role-123',
        name: 'user',
        description: 'Regular user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'user-123',
        email: validRegisterData.email,
        password: 'hashed_password',
        name: validRegisterData.name,
        avatar: null,
        status: 'offline',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            id: 'ur-123',
            userId: 'user-123',
            roleId: 'role-123',
            createdAt: new Date(),
            role: {
              id: 'role-123',
              name: 'user',
              description: 'Regular user',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      } as any);

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(validRegisterData.email);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.userRole.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notificationPreference.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictError if email already exists', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
        email: validRegisterData.email,
      } as any);

      // Act & Assert
      await expect(authService.register(validRegisterData)).rejects.toThrow(ConflictError);
      await expect(authService.register(validRegisterData)).rejects.toThrow('Email already registered');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.role.findUnique.mockResolvedValueOnce({ id: 'role-123', name: 'user' } as any);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'user-123',
        password: 'hashed_password',
        roles: [],
      } as any);

      // Act
      await authService.register(validRegisterData);

      // Assert
      const createCall = prismaMock.user.create.mock.calls[0][0] as any;
      expect(createCall.data.password).not.toBe(validRegisterData.password);
      expect(createCall.data.password).toMatch(/^\$2[aby]\$.{56}$/); // Bcrypt format
    });
  });

  describe('login()', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'SecurePassword123',
    };

    it('should login with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: validLoginData.email,
        password: '$2b$12$...',  // Bcrypt hash
        name: 'Test User',
        isActive: true,
        roles: [
          {
            role: {
              id: 'role-123',
              name: 'user',
            },
          },
        ],
      };

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.user.update.mockResolvedValueOnce(mockUser as any);

      // Mock bcrypt.compare
      const bcrypt = await import('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(validLoginData.email);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { status: 'online' },
      });
    });

    it('should throw UnauthorizedError for non-existent user', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(authService.login(validLoginData)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validLoginData)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedError for inactive user', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: validLoginData.email,
        isActive: false,
        roles: [],
      } as any);

      // Act & Assert
      await expect(authService.login(validLoginData)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validLoginData)).rejects.toThrow('Account is inactive');
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: validLoginData.email,
        password: '$2b$12$...',
        isActive: true,
        roles: [],
      } as any);

      const bcrypt = await import('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);

      // Act & Assert
      await expect(authService.login(validLoginData)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validLoginData)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('logout()', () => {
    it('should delete specific refresh token', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'token-xyz';

      // Act
      await authService.logout(userId, refreshToken);

      // Assert
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId,
          token: refreshToken,
        },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { status: 'offline' },
      });
    });

    it('should delete all refresh tokens if no specific token provided', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await authService.logout(userId);

      // Assert
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('refreshTokens()', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Arrange
      const mockRefreshToken = {
        id: 'rt-123',
        token: 'valid-refresh-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        user: {
          id: 'user-123',
          email: 'test@example.com',
          isActive: true,
          roles: [
            {
              role: {
                id: 'role-123',
                name: 'user',
              },
            },
          ],
        },
      };

      prismaMock.refreshToken.findUnique.mockResolvedValueOnce(mockRefreshToken as any);
      prismaMock.refreshToken.delete.mockResolvedValueOnce(mockRefreshToken as any);
      prismaMock.refreshToken.create.mockResolvedValueOnce(mockRefreshToken as any);

      // Mock JWT verification
      const jwt = await import('../../utils/jwt');
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValueOnce({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });

      // Act
      const result = await authService.refreshTokens('valid-refresh-token');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaMock.refreshToken.delete).toHaveBeenCalledTimes(1);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedError for expired token', async () => {
      // Arrange
      const expiredToken = {
        id: 'rt-123',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Expirado
        user: { isActive: true },
      };

      prismaMock.refreshToken.findUnique.mockResolvedValueOnce(expiredToken as any);

      const jwt = await import('../../utils/jwt');
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValueOnce({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });

      // Act & Assert
      await expect(authService.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshTokens('expired-token')).rejects.toThrow('Refresh token expired');
      expect(prismaMock.refreshToken.delete).toHaveBeenCalledTimes(1);
    });
  });
});

