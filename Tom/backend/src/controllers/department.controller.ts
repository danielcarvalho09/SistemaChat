import { FastifyRequest, FastifyReply } from 'fastify';
import { DepartmentService } from '../services/department.service';
import { validate } from '../utils/validators';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  paginationSchema,
} from '../utils/validators';

export class DepartmentController {
  private departmentService = new DepartmentService();

  /**
   * GET /api/v1/departments
   * Lista todos os departamentos
   */
  listDepartments = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = validate(paginationSchema, request.query);
    const query = request.query as any;
    const includeInactive = query.includeInactive === 'true';

    const departments = await this.departmentService.listDepartments({
      ...params,
      includeInactive,
    });

    return reply.status(200).send({
      success: true,
      data: departments.data,
      pagination: departments.pagination,
    });
  };

  /**
   * GET /api/v1/departments/:departmentId
   * Busca departamento por ID
   */
  getDepartmentById = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    const department = await this.departmentService.getDepartmentById(departmentId);

    return reply.status(200).send({
      success: true,
      data: department,
    });
  };

  /**
   * POST /api/v1/departments
   * Cria novo departamento (apenas admin)
   */
  createDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = validate(createDepartmentSchema, request.body);
    const department = await this.departmentService.createDepartment(data);

    return reply.status(201).send({
      success: true,
      message: 'Department created successfully',
      data: department,
    });
  };

  /**
   * PATCH /api/v1/departments/:departmentId
   * Atualiza departamento (apenas admin)
   */
  updateDepartment = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    const data = validate(updateDepartmentSchema, request.body);
    const department = await this.departmentService.updateDepartment(departmentId, data);

    return reply.status(200).send({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  };

  /**
   * DELETE /api/v1/departments/:departmentId
   * Desativa departamento (apenas admin)
   */
  deactivateDepartment = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    await this.departmentService.deactivateDepartment(departmentId);

    return reply.status(200).send({
      success: true,
      message: 'Department deactivated successfully',
    });
  };

  /**
   * POST /api/v1/departments/:departmentId/activate
   * Reativa departamento (apenas admin)
   */
  activateDepartment = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    await this.departmentService.activateDepartment(departmentId);

    return reply.status(200).send({
      success: true,
      message: 'Department activated successfully',
    });
  };

  /**
   * DELETE /api/v1/departments/:departmentId/permanent
   * Deleta departamento permanentemente (apenas admin)
   */
  deleteDepartment = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    await this.departmentService.deleteDepartment(departmentId);

    return reply.status(200).send({
      success: true,
      message: 'Department deleted successfully',
    });
  };

  /**
   * GET /api/v1/departments/:departmentId/users
   * Lista usuários com acesso ao departamento
   */
  getDepartmentUsers = async (
    request: FastifyRequest<{ Params: { departmentId: string } }>,
    reply: FastifyReply
  ) => {
    const { departmentId } = request.params;
    const users = await this.departmentService.getDepartmentUsers(departmentId);

    return reply.status(200).send({
      success: true,
      data: users,
    });
  };
}
