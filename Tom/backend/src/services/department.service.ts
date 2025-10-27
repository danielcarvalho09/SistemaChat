import { getPrismaClient } from '../config/database';
import {
  DepartmentResponse,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  PaginatedResponse,
  PaginationParams,
} from '../models/types';
import { NotFoundError, ConflictError } from '../middlewares/error.middleware';
import { logger } from '../config/logger';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../config/redis';

export class DepartmentService {
  private prisma = getPrismaClient();
  private CACHE_TTL = 300; // 5 minutos

  /**
   * Lista todos os departamentos
   */
  async listDepartments(
    params: PaginationParams & { includeInactive?: boolean }
  ): Promise<PaginatedResponse<DepartmentResponse>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      includeInactive = false,
    } = params;
    const skip = (page - 1) * limit;

    const where = includeInactive ? {} : { isActive: true };

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { 
              conversations: true,
              userAccess: true,
            },
          },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        color: dept.color,
        icon: dept.icon,
        isActive: dept.isActive,
        conversationCount: dept._count.conversations,
        _count: {
          users: dept._count.userAccess,
        },
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
      })),
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
   * Busca departamento por ID
   */
  async getDepartmentById(departmentId: string): Promise<DepartmentResponse> {
    const cacheKey = `department:${departmentId}`;
    const cached = await cacheGet<DepartmentResponse>(cacheKey);
    if (cached) return cached;

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        _count: {
          select: { 
            conversations: true,
            userAccess: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const formatted: DepartmentResponse = {
      id: department.id,
      name: department.name,
      description: department.description,
      color: department.color,
      icon: department.icon,
      isActive: department.isActive,
      isPrimary: department.isPrimary || false,
      conversationCount: department._count.conversations,
      _count: {
        users: department._count.userAccess,
      },
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };

    await cacheSet(cacheKey, formatted, this.CACHE_TTL);
    return formatted;
  }

  /**
   * Cria novo departamento
   */
  async createDepartment(data: CreateDepartmentRequest): Promise<DepartmentResponse> {
    // Verificar se nome já existe (apenas entre ativos)
    const existing = await this.prisma.department.findFirst({
      where: { 
        name: data.name,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictError('Department with this name already exists');
    }

    // Se existe um departamento inativo com o mesmo nome, reativá-lo
    const inactive = await this.prisma.department.findFirst({
      where: {
        name: data.name,
        isActive: false,
      },
    });

    if (inactive) {
      logger.info(`Reactivating existing department: ${inactive.name}`);
      
      const reactivated = await this.prisma.department.update({
        where: { id: inactive.id },
        data: {
          isActive: true,
          description: data.description || inactive.description,
          color: data.color || inactive.color,
          icon: data.icon || inactive.icon,
        },
        include: {
          _count: {
            select: { conversations: true, userAccess: true },
          },
        },
      });

      // Invalidar cache de lista
      await cacheDelPattern('departments:*');

      return {
        id: reactivated.id,
        name: reactivated.name,
        description: reactivated.description,
        color: reactivated.color,
        icon: reactivated.icon,
        isActive: reactivated.isActive,
        conversationCount: reactivated._count.conversations,
        _count: {
          users: reactivated._count.userAccess,
        },
        createdAt: reactivated.createdAt,
        updatedAt: reactivated.updatedAt,
      };
    }

    const department = await this.prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#3B82F6',
        icon: data.icon || 'folder',
      },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    // Invalidar cache de lista
    await cacheDelPattern('departments:*');

    logger.info(`Department created: ${department.name}`);

    return {
      id: department.id,
      name: department.name,
      description: department.description,
      color: department.color,
      icon: department.icon,
      isActive: department.isActive,
      isPrimary: department.isPrimary || false,
      conversationCount: department._count.conversations,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }

  /**
   * Atualiza departamento
   */
  async updateDepartment(
    departmentId: string,
    data: UpdateDepartmentRequest
  ): Promise<DepartmentResponse> {
    // Verificar se departamento existe
    const existing = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    // Se está alterando o nome, verificar se novo nome já existe (apenas entre ativos)
    if (data.name && data.name !== existing.name) {
      const nameExists = await this.prisma.department.findFirst({
        where: { 
          name: data.name,
          isActive: true,
          id: { not: departmentId }, // Excluir o próprio departamento
        },
      });

      if (nameExists) {
        throw new ConflictError('Department with this name already exists');
      }
    }

    const department = await this.prisma.department.update({
      where: { id: departmentId },
      data,
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    // Invalidar cache
    await cacheDel(`department:${departmentId}`);
    await cacheDelPattern('departments:*');

    logger.info(`Department updated: ${departmentId}`);

    return {
      id: department.id,
      name: department.name,
      description: department.description,
      color: department.color,
      icon: department.icon,
      isActive: department.isActive,
      isPrimary: department.isPrimary || false,
      conversationCount: department._count.conversations,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }

  /**
   * Desativa departamento (soft delete)
   */
  async deactivateDepartment(departmentId: string): Promise<void> {
    await this.prisma.department.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    // Invalidar cache
    await cacheDel(`department:${departmentId}`);
    await cacheDelPattern('departments:*');

    logger.info(`Department deactivated: ${departmentId}`);
  }

  /**
   * Reativa departamento
   */
  async activateDepartment(departmentId: string): Promise<void> {
    await this.prisma.department.update({
      where: { id: departmentId },
      data: { isActive: true },
    });

    // Invalidar cache
    await cacheDel(`department:${departmentId}`);
    await cacheDelPattern('departments:*');

    logger.info(`Department activated: ${departmentId}`);
  }

  /**
   * Deleta departamento permanentemente
   */
  async deleteDepartment(departmentId: string): Promise<void> {
    // Verificar se há conversas associadas
    const conversationCount = await this.prisma.conversation.count({
      where: { departmentId },
    });

    if (conversationCount > 0) {
      throw new ConflictError(
        'Cannot delete department with active conversations. Deactivate it instead.'
      );
    }

    await this.prisma.department.delete({
      where: { id: departmentId },
    });

    // Invalidar cache
    await cacheDel(`department:${departmentId}`);
    await cacheDelPattern('departments:*');

    logger.info(`Department deleted: ${departmentId}`);
  }

  /**
   * Adiciona conexão a um setor
   * DEPRECATED: Conexões agora são associadas a usuários, não a setores
   */
  async addConnectionToDepartment(connectionId: string, departmentId: string): Promise<void> {
    logger.warn('addConnectionToDepartment is deprecated. Connections are now associated with users.');
    // Não faz nada - mantém por compatibilidade
  }

  /**
   * Remove conexão de um setor
   * DEPRECATED: Conexões agora são associadas a usuários, não a setores
   */
  async removeConnectionFromDepartment(connectionId: string, departmentId: string): Promise<void> {
    logger.warn('removeConnectionFromDepartment is deprecated. Connections are now associated with users.');
    // Não faz nada - mantém por compatibilidade
  }

  /**
   * Lista setores de uma conexão
   * DEPRECATED: Conexões agora são associadas a usuários, não a setores
   */
  async getConnectionDepartments(connectionId: string) {
    logger.warn('getConnectionDepartments is deprecated. Connections are now associated with users.');
    return []; // Retorna array vazio
  }

  /**
   * Lista usuários com acesso ao departamento
   */
  async getDepartmentUsers(departmentId: string) {
    const userAccess = await this.prisma.userDepartmentAccess.findMany({
      where: { departmentId },
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

    return userAccess.map((ua) => ({
      id: ua.user.id,
      email: ua.user.email,
      name: ua.user.name,
      avatar: ua.user.avatar,
      status: ua.user.status,
      isActive: ua.user.isActive,
      roles: ua.user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
      })),
      createdAt: ua.user.createdAt,
      updatedAt: ua.user.updatedAt,
    }));
  }
}
