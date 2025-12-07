import { getPrismaClient } from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';

interface CreateQuickMessageData {
  name: string;
  content: string;
  category?: string;
  order?: number;
}

interface UpdateQuickMessageData {
  name?: string;
  content?: string;
  category?: string;
  order?: number;
}

export class QuickMessageService {
  private prisma = getPrismaClient();

  /**
   * Criar nova mensagem pronta
   */
  async create(userId: string, data: CreateQuickMessageData) {
    return await this.prisma.quickMessage.create({
      data: {
        userId,
        name: data.name,
        content: data.content,
        category: data.category || null,
        order: data.order || 0,
      },
    });
  }

  /**
   * Listar mensagens prontas do usuário
   */
  async list(userId: string, category?: string) {
    return await this.prisma.quickMessage.findMany({
      where: {
        userId,
        ...(category && { category }),
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Buscar mensagem pronta por ID
   */
  async getById(id: string, userId: string) {
    const message = await this.prisma.quickMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new AppError('Mensagem pronta não encontrada', 404);
    }

    if (message.userId !== userId) {
      throw new AppError('Não autorizado', 403);
    }

    return message;
  }

  /**
   * Atualizar mensagem pronta
   */
  async update(id: string, userId: string, data: UpdateQuickMessageData) {
    const message = await this.getById(id, userId);

    return await this.prisma.quickMessage.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.content && { content: data.content }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  /**
   * Deletar mensagem pronta
   */
  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await this.prisma.quickMessage.delete({
      where: { id },
    });
  }

  /**
   * Reordenar mensagens prontas
   */
  async reorder(userId: string, messageIds: string[]) {
    const updates = messageIds.map((id, index) =>
      this.prisma.quickMessage.updateMany({
        where: { id, userId },
        data: { order: index },
      })
    );

    await Promise.all(updates);
    return this.list(userId);
  }
}

