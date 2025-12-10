import { getPrismaClient } from '../config/database.js';
import { UserResponse, PaginatedResponse, PaginationParams } from '../models/types.js';
import { NotFoundError, ConflictError } from '../middlewares/error.middleware.js';
import { logger } from '../config/logger.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import bcrypt from 'bcrypt';

export class UserService {
  private prisma = getPrismaClient();
  private CACHE_TTL = 300; // 5 minutos

  /**
   * Lista todos os usuários com paginação
   */
  async listUsers(params: PaginationParams): Promise<PaginatedResponse<UserResponse>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        where: {
          isActive: true, // ✅ Apenas usuários ativos por padrão
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          isActive: true, // ✅ Contar apenas usuários ativos
        },
      }),
    ]);

    return {
      data: users.map(this.formatUserResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Busca usuário por ID
   */
  async getUserById(userId: string): Promise<UserResponse> {
    // Tentar buscar do cache
    const cacheKey = `user:${userId}`;
    const cached = await cacheGet<UserResponse>(cacheKey);
    if (cached) return cached;

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

    const formatted = this.formatUserResponse(user);
    await cacheSet(cacheKey, formatted, this.CACHE_TTL);

    return formatted;
  }

  /**
   * Cria novo usuário (apenas admin)
   */
  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'user' | 'gerente';
  }): Promise<UserResponse> {
    try {
      logger.info(`Creating user: ${data.email} with role ${data.role || 'user'}`);
      
      // Verificar se email já existe
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        logger.warn(`Email already exists: ${data.email}`);
        throw new ConflictError('Email already in use');
      }

      // Verificar se a role existe antes de criar o usuário
      const roleName = data.role || 'user';
      const role = await this.prisma.role.findUnique({
        where: { name: roleName },
      });

      if (!role) {
        logger.error(`Role not found: ${roleName}`);
        throw new Error(`Role '${roleName}' not found. Please run database seed.`);
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Criar usuário em uma transação
      const result = await this.prisma.$transaction(async (tx) => {
        // Criar usuário
        const user = await tx.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            isActive: true,
          },
        });

        // Atribuir role (verificar se já existe antes de criar para evitar duplicatas)
        const existingUserRole = await tx.userRole.findFirst({
          where: {
            userId: user.id,
            roleId: role.id,
          },
        });

        if (!existingUserRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
            },
          });
        } else {
          logger.warn(`User ${user.id} already has role ${roleName}, skipping assignment`);
        }

        // Buscar usuário completo com roles
        return await tx.user.findUnique({
          where: { id: user.id },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });
      });

      if (!result) {
        throw new Error('Failed to create user');
      }

      logger.info(`✅ User created successfully: ${result.email} with role ${roleName}`);

      return this.formatUserResponse(result);
    } catch (error: any) {
      logger.error(`❌ Error creating user ${data.email}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza informações do usuário
   */
  async updateUser(
    userId: string,
    data: { name?: string; avatar?: string; status?: string }
  ): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`User updated: ${userId}`);

    return this.formatUserResponse(user);
  }

  /**
   * Desativa usuário (soft delete)
   */
  async deactivateUser(userId: string): Promise<void> {
    // Verificar se o usuário existe
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

    // Verificar se o usuário já está desativado
    if (!user.isActive) {
      logger.warn(`User ${userId} is already deactivated`);
      return; // Não precisa fazer nada se já está desativado
    }

    // Verificar se é o último admin ativo
    const isAdmin = user.roles.some(ur => ur.role.name === 'admin');
    if (isAdmin) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          isActive: true,
          roles: {
            some: {
              role: {
                name: 'admin',
              },
            },
          },
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictError('Cannot deactivate the last active admin user');
      }
    }

    // Desativar usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, status: 'offline' },
    });

    // Invalidar todos os refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`User deactivated: ${userId} (${user.email})`);
  }

  /**
   * Exclui usuário permanentemente (hard delete)
   * ⚠️ ATENÇÃO: Esta operação é irreversível!
   */
  async deleteUser(userId: string): Promise<void> {
    // Verificar se o usuário existe
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

    // Verificar se é o último admin ativo
    const isAdmin = user.roles.some(ur => ur.role.name === 'admin');
    if (isAdmin && user.isActive) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          isActive: true,
          roles: {
            some: {
              role: {
                name: 'admin',
              },
            },
          },
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictError('Cannot delete the last active admin user. Deactivate it instead.');
      }
    }

    // Excluir usuário permanentemente
    // As relações com onDelete: Cascade serão removidas automaticamente
    // As relações com onDelete: SetNull terão o campo setado como null
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`User deleted permanently: ${userId} (${user.email})`);
  }

  /**
   * Reativa usuário
   */
  async activateUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`User activated: ${userId}`);
  }

  /**
   * Atribui role a um usuário
   * IMPORTANTE: Remove todas as outras roles antes de adicionar a nova
   * Garante que o usuário tenha APENAS UMA role
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    // Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verificar se role existe
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Verificar se já possui essa role e é a única
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });

    const allUserRoles = await this.prisma.userRole.findMany({
      where: { userId },
    });

    if (existing && allUserRoles.length === 1) {
      logger.info(`User ${userId} already has role ${role.name} as the only role, skipping assignment`);
      return; // Já tem essa role e é a única, não precisa fazer nada
    }

    // Remover TODAS as roles existentes antes de adicionar a nova
    // Isso garante que o usuário tenha apenas uma role
    await this.prisma.$transaction(async (tx) => {
      // Remover todas as roles
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Adicionar a nova role
      await tx.userRole.create({
        data: { userId, roleId },
      });
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`Role ${role.name} assigned to user ${userId} (all other roles removed)`);
  }

  /**
   * Remove role de um usuário
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });

    if (!userRole) {
      throw new NotFoundError('User does not have this role');
    }

    await this.prisma.userRole.delete({
      where: { id: userRole.id },
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`Role removed from user ${userId}`);
  }

  /**
   * Atualiza role do usuário (SEMPRE remove todas as outras roles primeiro)
   * Garante que o usuário tenha APENAS UMA role
   */
  async updateUserRole(userId: string, roleName: 'admin' | 'user' | 'gerente'): Promise<void> {
    // Buscar role pelo nome
    const newRole = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!newRole) {
      throw new NotFoundError(`Role ${roleName} not found`);
    }

    // Verificar se usuário já tem essa role e é a única
    const existingUserRole = await this.prisma.userRole.findFirst({
      where: { 
        userId,
        roleId: newRole.id,
      },
    });

    const allUserRoles = await this.prisma.userRole.findMany({
      where: { userId },
    });

    // Se já tem a role correta e é a única, não fazer nada
    if (existingUserRole && allUserRoles.length === 1) {
      logger.info(`User ${userId} already has role ${roleName} as the only role, no changes needed`);
      return;
    }

    // SEMPRE remover todas as roles antes de adicionar a nova (garantir apenas 1 role)
    await this.prisma.$transaction(async (tx) => {
      // Remover TODAS as roles existentes
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Atribuir nova role (única)
      await tx.userRole.create({
        data: { userId, roleId: newRole.id },
      });
    });

    // Invalidar cache
    await cacheDel(`user:${userId}`);

    logger.info(`User ${userId} role updated to ${roleName} (all other roles removed)`);
  }

  /**
   * Atribui conexão a um usuário (NOVA LÓGICA)
   */
  async assignConnection(userId: string, connectionId: string): Promise<void> {
    // Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verificar se conexão existe
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    // Verificar se a conexão já pertence a outro usuário
    if (connection.userId && connection.userId !== userId) {
      throw new ConflictError('Connection is already assigned to another user');
    }

    // Atribuir conexão ao usuário
    await this.prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: { userId },
    });

    logger.info(`Connection ${connectionId} assigned to user ${userId}`);
  }

  /**
   * Remove conexão de um usuário (NOVA LÓGICA)
   */
  async removeConnection(userId: string, connectionId: string): Promise<void> {
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    if (connection.userId !== userId) {
      throw new NotFoundError('User does not have this connection');
    }

    // Remover associação
    await this.prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: { userId: null },
    });

    logger.info(`Connection access removed from user ${userId}`);
  }

  /**
   * Atribui acesso a um departamento
   */
  async assignDepartment(userId: string, departmentId: string): Promise<void> {
    // Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verificar se departamento existe
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Verificar se já possui acesso
    const existing = await this.prisma.userDepartmentAccess.findFirst({
      where: { userId, departmentId },
    });

    if (existing) {
      throw new ConflictError('User already has access to this department');
    }

    // Atribuir acesso
    await this.prisma.userDepartmentAccess.create({
      data: { userId, departmentId },
    });

    logger.info(`Department ${departmentId} assigned to user ${userId}`);
  }

  /**
   * Remove acesso a um departamento
   */
  async removeDepartment(userId: string, departmentId: string): Promise<void> {
    const userDepartment = await this.prisma.userDepartmentAccess.findFirst({
      where: { userId, departmentId },
    });

    if (!userDepartment) {
      throw new NotFoundError('User does not have access to this department');
    }

    await this.prisma.userDepartmentAccess.delete({
      where: { id: userDepartment.id },
    });

    logger.info(`Department access removed from user ${userId}`);
  }

  /**
   * Lista conexões de um usuário (NOVA LÓGICA)
   */
  async getUserConnections(userId: string) {
    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { userId },
    });

    return connections;
  }

  /**
   * Lista departamentos de um usuário
   */
  async getUserDepartments(userId: string) {
    const departments = await this.prisma.userDepartmentAccess.findMany({
      where: { userId },
      include: {
        department: true,
      },
    });

    return departments.map((ud) => ud.department);
  }

  /**
   * Formata resposta do usuário
   */
  private formatUserResponse(user: any): UserResponse {
    // ✅ Remover roles duplicadas usando Map (por roleId)
    const uniqueRolesMap = new Map<string, { id: string; name: string; description: string | null }>();
    
    if (user.roles && Array.isArray(user.roles)) {
      for (const ur of user.roles) {
        if (ur.role && ur.role.id) {
          // Usar roleId como chave para garantir unicidade
          if (!uniqueRolesMap.has(ur.role.id)) {
            uniqueRolesMap.set(ur.role.id, {
              id: ur.role.id,
              name: ur.role.name,
              description: ur.role.description,
            });
          }
        }
      }
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      isActive: user.isActive,
      roles: Array.from(uniqueRolesMap.values()), // Converter Map para Array
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
