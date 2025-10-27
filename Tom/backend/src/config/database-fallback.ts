/**
 * Sistema de Fallback de Banco de Dados
 * Tenta conectar no Supabase primeiro, se falhar usa Docker local
 */

import { logger } from './logger';

interface DatabaseConfig {
  url: string;
  provider: 'supabase' | 'local';
  name: string;
}

// Configurações de banco de dados
const databases: DatabaseConfig[] = [
  {
    url: process.env.DATABASE_URL || '',
    provider: 'supabase',
    name: 'Supabase (Cloud)',
  },
  {
    url: process.env.DATABASE_FALLBACK_URL || 'postgresql://postgres:postgres@localhost:5433/whatsapp_system',
    provider: 'local',
    name: 'PostgreSQL Local (Docker)',
  },
];

// Configurações de Redis
const redisConfigs = [
  {
    url: process.env.REDIS_URL || '',
    provider: 'cloud',
    name: 'Redis Cloud',
  },
  {
    url: process.env.REDIS_FALLBACK_URL || 'redis://:redis_password@localhost:6380',
    provider: 'local',
    name: 'Redis Local (Docker)',
  },
];

/**
 * Testa conexão com PostgreSQL
 */
async function testPostgresConnection(url: string): Promise<boolean> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

/**
 * Testa conexão com Redis
 */
async function testRedisConnection(url: string): Promise<boolean> {
  const Redis = (await import('ioredis')).default;
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    redis.disconnect();
    return true;
  } catch (error) {
    redis.disconnect();
    return false;
  }
}

/**
 * Seleciona melhor configuração de banco de dados com fallback
 */
export async function getDatabaseUrl(): Promise<string> {
  logger.info('🔍 Testando conexões de banco de dados...');

  for (const db of databases) {
    if (!db.url) {
      logger.warn(`⚠️  ${db.name}: URL não configurada, pulando...`);
      continue;
    }

    logger.info(`🔌 Tentando conectar em: ${db.name}...`);

    const isConnected = await testPostgresConnection(db.url);

    if (isConnected) {
      logger.info(`✅ Conectado com sucesso em: ${db.name}`);
      return db.url;
    } else {
      logger.warn(`❌ Falha ao conectar em: ${db.name}`);
    }
  }

  throw new Error('❌ Nenhuma conexão de banco de dados disponível');
}

/**
 * Seleciona melhor configuração de Redis com fallback
 */
export async function getRedisUrl(): Promise<string> {
  logger.info('🔍 Testando conexões Redis...');

  for (const redis of redisConfigs) {
    if (!redis.url) {
      logger.warn(`⚠️  ${redis.name}: URL não configurada, pulando...`);
      continue;
    }

    logger.info(`🔌 Tentando conectar em: ${redis.name}...`);

    const isConnected = await testRedisConnection(redis.url);

    if (isConnected) {
      logger.info(`✅ Conectado com sucesso em: ${redis.name}`);
      return redis.url;
    } else {
      logger.warn(`❌ Falha ao conectar em: ${redis.name}`);
    }
  }

  throw new Error('❌ Nenhuma conexão Redis disponível');
}

/**
 * Inicializa sistema com fallback automático
 */
export async function initializeDatabaseWithFallback(): Promise<{
  databaseUrl: string;
  redisUrl: string;
}> {
  try {
    const [databaseUrl, redisUrl] = await Promise.all([
      getDatabaseUrl(),
      getRedisUrl(),
    ]);

    logger.info('✅ Sistema de fallback inicializado com sucesso');

    return { databaseUrl, redisUrl };
  } catch (error) {
    logger.error('❌ Erro ao inicializar sistema de fallback:', error);
    throw error;
  }
}
