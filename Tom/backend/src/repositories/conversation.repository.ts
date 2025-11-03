import { PrismaClient, Conversation, Prisma } from '@prisma/client';
import { GetConversationsInput } from '../schemas/conversation.schema.js';

export interface IConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByUser(userId: string, options?: GetConversationsInput): Promise<Conversation[]>;
  create(data: Prisma.ConversationCreateInput): Promise<Conversation>;
  update(id: string, data: Prisma.ConversationUpdateInput): Promise<Conversation>;
  delete(id: string): Promise<void>;
}

export class ConversationRepository implements IConversationRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        tags: true,
        // Incluir última mensagem (FIX N+1)
        messages: {
          take: 1,
          orderBy: { timestamp: 'desc' },
        }
      },
    });
  }

  async findByUser(
    userId: string,
    options: GetConversationsInput = { limit: 50, offset: 0 }
  ): Promise<Conversation[]> {
    const where: Prisma.ConversationWhereInput = {
      ...(options.assignedUserId && { assignedUserId: options.assignedUserId }),
      ...(options.status && { status: options.status }),
      ...(options.search && {
        OR: [
          { contact: { name: { contains: options.search, mode: 'insensitive' } } },
          { contact: { phoneNumber: { contains: options.search } } },
        ]
      }),
    };

    // FIX N+1: Uma query com includes
    return this.prisma.conversation.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            avatar: true, // campo correto do schema
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              }
            }
          }
        },
        // Incluir última mensagem diretamente
        messages: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            content: true,
            timestamp: true,
            status: true,
            sender: true,
          }
        },
        _count: {
          select: {
            messages: true,
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }

  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return this.prisma.conversation.create({
      data,
      include: {
        contact: true,
        assignedUser: true,
      }
    });
  }

  async update(id: string, data: Prisma.ConversationUpdateInput): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data,
      include: {
        contact: true,
        assignedUser: true,
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.conversation.delete({
      where: { id },
    });
  }
}
