import { FastifyInstance } from 'fastify';
import { DepartmentController } from '../controllers/department.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/authorization.middleware.js';

export async function departmentRoutes(fastify: FastifyInstance) {
  const departmentController = new DepartmentController();

  // Todas as rotas requerem autenticação
  fastify.addHook('preHandler', authenticate);

  // Listar departamentos (todos os usuários autenticados)
  fastify.get('/', {
    handler: departmentController.listDepartments,
  });

  // Buscar departamento por ID (todos os usuários autenticados)
  fastify.get('/:departmentId', {
    handler: departmentController.getDepartmentById,
  });

  // Criar departamento (apenas admin)
  fastify.post('/', {
    preHandler: [requireAdmin],
    handler: departmentController.createDepartment,
  });

  // Atualizar departamento (apenas admin)
  fastify.patch('/:departmentId', {
    preHandler: [requireAdmin],
    handler: departmentController.updateDepartment,
  });

  // Desativar departamento (apenas admin)
  fastify.delete('/:departmentId', {
    preHandler: [requireAdmin],
    handler: departmentController.deactivateDepartment,
  });

  // Reativar departamento (apenas admin)
  fastify.post('/:departmentId/activate', {
    preHandler: [requireAdmin],
    handler: departmentController.activateDepartment,
  });

  // Deletar permanentemente (apenas admin)
  fastify.delete('/:departmentId/permanent', {
    preHandler: [requireAdmin],
    handler: departmentController.deleteDepartment,
  });

  // Listar usuários do departamento
  fastify.get('/:departmentId/users', {
    handler: departmentController.getDepartmentUsers,
  });
}
