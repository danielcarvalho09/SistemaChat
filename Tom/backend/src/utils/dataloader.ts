import DataLoader from 'dataloader';
import { getPrismaClient } from '../config/database.js';
import type { Message, User, WhatsAppConnection, Contact, Department } from '@prisma/client';

/**
 * DataLoader para batch loading e caching
 * 
 * Resolve o problema N+1: ao invés de fazer 1 query por item,
 * faz 1 query para buscar múltiplos itens de uma vez.
 * 
 * Exemplo:
 * SEM DataLoader (N+1):
 *   SELECT * FROM conversations; -- 1 query
 *   SELECT * FROM messages WHERE conversationId = 1; -- +1 query
 *   SELECT * FROM messages WHERE conversationId = 2; -- +1 query
 *   SELECT * FROM messages WHERE conversationId = 3; -- +1 query
 *   Total: 4 queries
 * 
 * COM DataLoader:
 *   SELECT * FROM conversations; -- 1 query
 *   SELECT * FROM messages WHERE conversationId IN (1,2,3); -- 1 query
 *   Total: 2 queries (50% redução)
 */

const prisma = getPrismaClient();

/**
 * DataLoader para mensagens por conversação
 * Busca última mensagem de múltiplas conversas de uma vez
 */
export const lastMessageLoader = new DataLoader<string, Message | null>(
  async (conversationIds: readonly string[]) => {
    // Buscar últimas mensagens de todas as conversas de uma vez
    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: [...conversationIds] },
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['conversationId'],
      take: conversationIds.length,
    });

    // Criar mapa conversationId -> message
    const messageMap = new Map<string, Message>();
    messages.forEach(message => {
      if (!messageMap.has(message.conversationId)) {
        messageMap.set(message.conversationId, message);
      }
    });

    // Retornar mensagens na ordem correta (mesma ordem dos IDs)
    return conversationIds.map(id => messageMap.get(id) || null);
  },
  {
    cache: true,
    maxBatchSize: 100, // Limitar batch para evitar queries muito grandes
  }
);

/**
 * DataLoader para usuários
 * Busca múltiplos usuários de uma vez (atribuídos a conversas)
 */
export const userLoader = new DataLoader<string, User | null>(
  async (userIds: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: {
        id: { in: [...userIds] },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Criar mapa userId -> user
    const userMap = new Map<string, User>();
    users.forEach(user => {
      userMap.set(user.id, user as User);
    });

    // Retornar na ordem correta
    return userIds.map(id => userMap.get(id) || null);
  },
  {
    cache: true,
    maxBatchSize: 50,
  }
);

/**
 * DataLoader para conexões WhatsApp
 */
export const connectionLoader = new DataLoader<string, WhatsAppConnection | null>(
  async (connectionIds: readonly string[]) => {
    const connections = await prisma.whatsAppConnection.findMany({
      where: {
        id: { in: [...connectionIds] },
      },
    });

    const connectionMap = new Map<string, WhatsAppConnection>();
    connections.forEach(conn => {
      connectionMap.set(conn.id, conn);
    });

    return connectionIds.map(id => connectionMap.get(id) || null);
  },
  {
    cache: true,
    maxBatchSize: 50,
  }
);

/**
 * DataLoader para contatos
 */
export const contactLoader = new DataLoader<string, Contact | null>(
  async (contactIds: readonly string[]) => {
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: [...contactIds] },
      },
    });

    const contactMap = new Map<string, Contact>();
    contacts.forEach(contact => {
      contactMap.set(contact.id, contact);
    });

    return contactIds.map(id => contactMap.get(id) || null);
  },
  {
    cache: true,
    maxBatchSize: 100,
  }
);

/**
 * DataLoader para departamentos
 */
export const departmentLoader = new DataLoader<string, Department | null>(
  async (departmentIds: readonly string[]) => {
    const departments = await prisma.department.findMany({
      where: {
        id: { in: [...departmentIds] },
      },
    });

    const deptMap = new Map<string, Department>();
    departments.forEach(dept => {
      deptMap.set(dept.id, dept);
    });

    return departmentIds.map(id => deptMap.get(id) || null);
  },
  {
    cache: true,
    maxBatchSize: 20, // Poucos departamentos, batch pequeno
  }
);

/**
 * DataLoader para contador de mensagens por conversa
 */
export const messageCountLoader = new DataLoader<string, number>(
  async (conversationIds: readonly string[]) => {
    // Usar groupBy do Prisma para contar em 1 query
    const counts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: [...conversationIds] },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map<string, number>();
    counts.forEach(({ conversationId, _count }) => {
      countMap.set(conversationId, _count.id);
    });

    return conversationIds.map(id => countMap.get(id) || 0);
  },
  {
    cache: true,
    maxBatchSize: 100,
  }
);

/**
 * DataLoader para mensagens não lidas por conversa
 */
export const unreadCountLoader = new DataLoader<string, number>(
  async (conversationIds: readonly string[]) => {
    const counts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: [...conversationIds] },
        status: { not: 'read' },
        isFromContact: true, // Apenas mensagens do contato
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map<string, number>();
    counts.forEach(({ conversationId, _count }) => {
      countMap.set(conversationId, _count.id);
    });

    return conversationIds.map(id => countMap.get(id) || 0);
  },
  {
    cache: true,
    maxBatchSize: 100,
  }
);

/**
 * Limpa todos os caches dos DataLoaders
 * Útil após mutações (create, update, delete)
 */
export function clearAllDataLoaderCaches(): void {
  lastMessageLoader.clearAll();
  userLoader.clearAll();
  connectionLoader.clearAll();
  contactLoader.clearAll();
  departmentLoader.clearAll();
  messageCountLoader.clearAll();
  unreadCountLoader.clearAll();
}

/**
 * Limpa cache de um loader específico para um ID
 */
export function clearDataLoaderCache(loader: DataLoader<string, any>, id: string): void {
  loader.clear(id);
}

/**
 * Contexto de DataLoaders para ser usado em requests
 * Cada request deve ter sua própria instância para isolar caches
 */
export interface DataLoaderContext {
  lastMessageLoader: typeof lastMessageLoader;
  userLoader: typeof userLoader;
  connectionLoader: typeof connectionLoader;
  contactLoader: typeof contactLoader;
  departmentLoader: typeof departmentLoader;
  messageCountLoader: typeof messageCountLoader;
  unreadCountLoader: typeof unreadCountLoader;
}

/**
 * Cria novo contexto de DataLoaders para uma request
 * 
 * IMPORTANTE: Criar novo contexto por request para evitar
 * cache entre diferentes usuários/requests
 */
export function createDataLoaderContext(): DataLoaderContext {
  return {
    lastMessageLoader: new DataLoader<string, Message | null>(
      async (conversationIds) => {
        const messages = await prisma.message.findMany({
          where: {
            conversationId: { in: [...conversationIds] },
          },
          orderBy: { timestamp: 'desc' },
          distinct: ['conversationId'],
        });

        const messageMap = new Map<string, Message>();
        messages.forEach(message => {
          if (!messageMap.has(message.conversationId)) {
            messageMap.set(message.conversationId, message);
          }
        });

        return conversationIds.map(id => messageMap.get(id) || null);
      }
    ),
    userLoader,
    connectionLoader,
    contactLoader,
    departmentLoader,
    messageCountLoader,
    unreadCountLoader,
  };
}

