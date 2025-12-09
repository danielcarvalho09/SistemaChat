import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin, requireOwnershipOrAdmin } from '../middlewares/authorization.middleware.js';

export async function userRoutes(fastify: FastifyInstance) {
  const userController = new UserController();

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Listar usuários (apenas admin)
  fastify.get('/', {
    preHandler: [requireAdmin],
    handler: userController.listUsers,
  });

  // Criar novo usuário (apenas admin)
  fastify.post('/', {
    preHandler: [requireAdmin],
    handler: userController.createUser,
  });

  // Buscar usuário por ID
  fastify.get('/:userId', {
    handler: userController.getUserById,
  });

  // Atualizar usuário (próprio usuário ou admin)
  fastify.patch('/:userId', {
    preHandler: [requireOwnershipOrAdmin('userId')],
    handler: userController.updateUser,
  });

  // Desativar usuário (apenas admin)
  fastify.delete('/:userId', {
    preHandler: [requireAdmin],
    handler: userController.deactivateUser,
  });

  // Reativar usuário (apenas admin)
  fastify.post('/:userId/activate', {
    preHandler: [requireAdmin],
    handler: userController.activateUser,
  });

  // Gerenciar roles (apenas admin)
  fastify.post('/:userId/roles', {
    preHandler: [requireAdmin],
    handler: userController.assignRole,
  });

  fastify.delete('/:userId/roles/:roleId', {
    preHandler: [requireAdmin],
    handler: userController.removeRole,
  });

  // Atualizar role do usuário (apenas admin)
  fastify.patch('/:userId/role', {
    preHandler: [requireAdmin],
    handler: userController.updateUserRole,
  });

  // Gerenciar conexões (apenas admin)
  fastify.post('/:userId/connections', {
    preHandler: [requireAdmin],
    handler: userController.assignConnection,
  });

  fastify.delete('/:userId/connections/:connectionId', {
    preHandler: [requireAdmin],
    handler: userController.removeConnection,
  });

  fastify.get('/:userId/connections', {
    handler: userController.getUserConnections,
  });

  // Gerenciar departamentos (apenas admin)
  fastify.post('/:userId/departments', {
    preHandler: [requireAdmin],
    handler: userController.assignDepartment,
  });

  fastify.delete('/:userId/departments/:departmentId', {
    preHandler: [requireAdmin],
    handler: userController.removeDepartment,
  });

  fastify.get('/:userId/departments', {
    handler: userController.getUserDepartments,
  });

  // Corrigir roles duplicadas (apenas admin)
  fastify.post('/fix-duplicate-roles', {
    preHandler: [requireAdmin],
    handler: userController.fixDuplicateRoles,
  });

  // Corrigir múltiplas roles (apenas admin)
  fastify.post('/fix-multiple-roles', {
    preHandler: [requireAdmin],
    handler: userController.fixMultipleRoles,
  });
}
