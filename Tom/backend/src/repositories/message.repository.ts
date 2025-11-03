import { PrismaClient, Message, Prisma } from '@prisma/client';
import { GetMessagesInput } from '../schemas/message.schema.js';

export interface IMessageRepository {
  findById(id: string): Promise<Message | null>;
  findByConversation(conversationId: string, options?: GetMessagesInput): Promise<Message[]>;
  create(data: Prisma.MessageCreateInput): Promise<Message>;
  update(id: string, data: Prisma.MessageUpdateInput): Promise<Message>;
  delete(id: string): Promise<void>;
  countByConversation(conversationId: string): Promise<number>;
}

export class MessageRepository implements IMessageRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            status: true,
          }
        }
      }
    });
  }

  async findByConversation(
    conversationId: string,
    options: GetMessagesInput = { conversationId, limit: 50, offset: 0 }
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(options.before && { timestamp: { lt: new Date(options.before) } }),
      ...(options.after && { timestamp: { gt: new Date(options.after) } }),
    };

    return this.prisma.message.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: options.limit,
      skip: options.offset,
    });
  }

  async create(data: Prisma.MessageCreateInput): Promise<Message> {
    return this.prisma.message.create({
      data,
      include: {
        conversation: true,
      }
    });
  }

  async update(id: string, data: Prisma.MessageUpdateInput): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.message.delete({
      where: { id },
    });
  }

  async countByConversation(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId },
    });
  }
}
