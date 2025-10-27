import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user.service.js';
import { validate } from '../utils/validators.js';
import {
  updateUserSchema,
  assignUserRoleSchema,
  assignUserConnectionSchema,
  assignUserDepartmentSchema,
  paginationSchema,
} from '../utils/validators.js';

export class UserController {
  private userService = new UserService();

  /**
   * GET /api/v1/users
   * Lista todos os usuários (apenas admin)
   */
  listUsers = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = validate(paginationSchema, request.query);
    const users = await this.userService.listUsers(params);

    return reply.status(200).send({
      success: true,
      data: users.data,
      pagination: users.pagination,
    });
  };

  /**
   * POST /api/v1/users
   * Cria novo usuário (apenas admin)
   */
  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as { email: string; password: string; name: string; role?: 'admin' | 'user' };
      
      // Validação básica
      if (!data.email || !data.password || !data.name) {
        return reply.status(400).send({
          success: false,
          message: 'Email, password and name are required',
        });
      }

      // Validar formato do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return reply.status(400).send({
          success: false,
          message: 'Invalid email format',
        });
      }

      // Validar tamanho da senha
      if (data.password.length < 6) {
        return reply.status(400).send({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      const user = await this.userService.createUser(data);

      return reply.status(201).send({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar usuário:', error);
      
      // Tratar erros específicos
      if (error.message === 'Email already in use') {
        return reply.status(409).send({
          success: false,
          message: 'Email already in use',
        });
      }
      
      if (error.message?.includes('Role') && error.message?.includes('not found')) {
        return reply.status(500).send({
          success: false,
          message: 'System roles not configured. Please run database seed.',
        });
      }

      return reply.status(500).send({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  };

  /**
   * GET /api/v1/users/:userId
   * Busca usuário por ID
   */
  getUserById = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const user = await this.userService.getUserById(userId);

    return reply.status(200).send({
      success: true,
      data: user,
    });
  };

  /**
   * PATCH /api/v1/users/:userId
   * Atualiza informações do usuário
   */
  updateUser = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const data = validate(updateUserSchema, request.body);
    const user = await this.userService.updateUser(userId, data);

    return reply.status(200).send({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  };

  /**
   * DELETE /api/v1/users/:userId
   * Desativa usuário (apenas admin)
   */
  deactivateUser = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    await this.userService.deactivateUser(userId);

    return reply.status(200).send({
      success: true,
      message: 'User deactivated successfully',
    });
  };

  /**
   * POST /api/v1/users/:userId/activate
   * Reativa usuário (apenas admin)
   */
  activateUser = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    await this.userService.activateUser(userId);

    return reply.status(200).send({
      success: true,
      message: 'User activated successfully',
    });
  };

  /**
   * POST /api/v1/users/:userId/roles
   * Atribui role a um usuário (apenas admin)
   */
  assignRole = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { roleId } = validate(assignUserRoleSchema, request.body);

    await this.userService.assignRole(userId, roleId);

    return reply.status(200).send({
      success: true,
      message: 'Role assigned successfully',
    });
  };

  /**
   * DELETE /api/v1/users/:userId/roles/:roleId
   * Remove role de um usuário (apenas admin)
   */
  removeRole = async (
    request: FastifyRequest<{ Params: { userId: string; roleId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId, roleId } = request.params;
    await this.userService.removeRole(userId, roleId);

    return reply.status(200).send({
      success: true,
      message: 'Role removed successfully',
    });
  };

  /**
   * PATCH /api/v1/users/:userId/role
   * Atualiza role do usuário (admin ou user)
   */
  updateUserRole = async (
    request: FastifyRequest<{ Params: { userId: string }; Body: { role: 'admin' | 'user' } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { role } = request.body as { role: 'admin' | 'user' };

    await this.userService.updateUserRole(userId, role);

    return reply.status(200).send({
      success: true,
      message: `User role updated to ${role}`,
    });
  };

  /**
   * POST /api/v1/users/:userId/connections
   * Atribui acesso a uma conexão (apenas admin)
   */
  assignConnection = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { connectionId } = validate(assignUserConnectionSchema, request.body);

    await this.userService.assignConnection(userId, connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Connection assigned successfully',
    });
  };

  /**
   * DELETE /api/v1/users/:userId/connections/:connectionId
   * Remove acesso a uma conexão (apenas admin)
   */
  removeConnection = async (
    request: FastifyRequest<{ Params: { userId: string; connectionId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId, connectionId } = request.params;
    await this.userService.removeConnection(userId, connectionId);

    return reply.status(200).send({
      success: true,
      message: 'Connection access removed successfully',
    });
  };

  /**
   * POST /api/v1/users/:userId/departments
   * Atribui acesso a um departamento (apenas admin)
   */
  assignDepartment = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { departmentId } = validate(assignUserDepartmentSchema, request.body);

    await this.userService.assignDepartment(userId, departmentId);

    return reply.status(200).send({
      success: true,
      message: 'Department assigned successfully',
    });
  };

  /**
   * DELETE /api/v1/users/:userId/departments/:departmentId
   * Remove acesso a um departamento (apenas admin)
   */
  removeDepartment = async (
    request: FastifyRequest<{ Params: { userId: string; departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId, departmentId } = request.params;
    await this.userService.removeDepartment(userId, departmentId);

    return reply.status(200).send({
      success: true,
      message: 'Department access removed successfully',
    });
  };

  /**
   * GET /api/v1/users/:userId/connections
   * Lista conexões do usuário
   */
  getUserConnections = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const connections = await this.userService.getUserConnections(userId);

    return reply.status(200).send({
      success: true,
      data: connections,
    });
  };

  /**
   * GET /api/v1/users/:userId/departments
   * Lista departamentos do usuário
   */
  getUserDepartments = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const departments = await this.userService.getUserDepartments(userId);

    return reply.status(200).send({
      success: true,
      data: departments,
    });
  };
}
