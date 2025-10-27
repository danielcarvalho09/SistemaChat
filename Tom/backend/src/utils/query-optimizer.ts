/**
 * Helpers para otimização de queries
 */

import { logger } from '../config/logger.js';
import { performance } from 'perf_hooks';

/**
 * Wrapper para medir performance de queries
 */
export async function measureQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query: ${name} took ${duration.toFixed(2)}ms`);
    } else {
      logger.debug(`Query: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Query failed: ${name} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Campos mínimos para usuário (evitar buscar senha, etc)
 */
export const userMinimalSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  isActive: true,
};

/**
 * Campos mínimos para conversa
 */
export const conversationMinimalSelect = {
  id: true,
  contactId: true,
  userId: true,
  departmentId: true,
  status: true,
  unreadCount: true,
  lastMessageAt: true,
  createdAt: true,
};

/**
 * Campos mínimos para mensagem
 */
export const messageMinimalSelect = {
  id: true,
  conversationId: true,
  body: true,
  fromMe: true,
  type: true,
  createdAt: true,
};

/**
 * Campos mínimos para contato
 */
export const contactMinimalSelect = {
  id: true,
  name: true,
  phone: true,
  profilePicUrl: true,
};

/**
 * Include otimizado para conversas (lista)
 */
export const conversationListInclude = {
  contact: {
    select: contactMinimalSelect,
  },
  user: {
    select: userMinimalSelect,
  },
  department: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
  _count: {
    select: {
      messages: true,
    },
  },
};

/**
 * Include otimizado para conversa individual
 */
export const conversationDetailInclude = {
  contact: {
    select: {
      ...contactMinimalSelect,
      email: true,
      notes: true,
    },
  },
  user: {
    select: userMinimalSelect,
  },
  department: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  },
  kanbanStage: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
};

/**
 * Helper para paginação eficiente
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  model: any,
  params: PaginationParams,
  where?: any,
  include?: any,
  orderBy?: any
): Promise<PaginationResult<T>> {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      orderBy,
      take: limit,
      skip,
    }),
    model.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Helper para queries paralelas
 */
export async function parallelQueries<T extends Record<string, Promise<any>>>(
  queries: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(queries);
  const promises = Object.values(queries);

  const results = await Promise.all(promises);

  return keys.reduce((acc, key, index) => {
    acc[key as keyof T] = results[index];
    return acc;
  }, {} as any);
}

/**
 * Helper para busca com debounce no backend
 */
const searchCache = new Map<string, { result: any; timestamp: number }>();
const SEARCH_CACHE_TTL = 5000; // 5 segundos

export async function cachedSearch<T>(
  cacheKey: string,
  searchFn: () => Promise<T>
): Promise<T> {
  const cached = searchCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < SEARCH_CACHE_TTL) {
    logger.debug(`Search cache hit: ${cacheKey}`);
    return cached.result;
  }

  const result = await searchFn();
  searchCache.set(cacheKey, { result, timestamp: now });

  // Limpar cache antigo
  if (searchCache.size > 100) {
    const oldestKey = Array.from(searchCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    searchCache.delete(oldestKey);
  }

  return result;
}

/**
 * Helper para agregações eficientes
 */
export async function aggregateByField<T extends string>(
  model: any,
  field: T,
  where?: any
): Promise<Record<string, number>> {
  const results = await model.groupBy({
    by: [field],
    where,
    _count: true,
  });

  return results.reduce((acc: any, item: any) => {
    acc[item[field]] = item._count;
    return acc;
  }, {});
}

/**
 * Exemplo de uso:
 * 
 * const statusCounts = await aggregateByField(
 *   prisma.conversation,
 *   'status',
 *   { userId: 'xxx' }
 * );
 * 
 * // Resultado: { pending: 5, active: 10, resolved: 20 }
 */
