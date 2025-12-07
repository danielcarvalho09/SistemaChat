import { FastifyRequest, FastifyReply } from 'fastify';
import { QuickMessageService } from '../services/quick-message.service.js';

export class QuickMessageController {
  private service = new QuickMessageService();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const data = request.body as any;

    const message = await this.service.create(userId, {
      name: data.name,
      content: data.content,
      category: data.category,
      order: data.order,
    });

    return reply.status(201).send({
      success: true,
      message: 'Mensagem pronta criada com sucesso',
      data: message,
    });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const category = (request.query as any)?.category;

    const messages = await this.service.list(userId, category);

    return reply.status(200).send({
      success: true,
      data: messages,
    });
  };

  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const message = await this.service.getById(id, userId);

    return reply.status(200).send({
      success: true,
      data: message,
    });
  };

  update = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const userId = request.user!.userId;
    const { id } = request.params;
    const data = request.body as any;

    const message = await this.service.update(id, userId, data);

    return reply.status(200).send({
      success: true,
      message: 'Mensagem pronta atualizada com sucesso',
      data: message,
    });
  };

  delete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    await this.service.delete(id, userId);

    return reply.status(200).send({
      success: true,
      message: 'Mensagem pronta deletada com sucesso',
    });
  };

  reorder = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const { messageIds } = request.body as { messageIds: string[] };

    const messages = await this.service.reorder(userId, messageIds);

    return reply.status(200).send({
      success: true,
      message: 'Mensagens reordenadas com sucesso',
      data: messages,
    });
  };
}

