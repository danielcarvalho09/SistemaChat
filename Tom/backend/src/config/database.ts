import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// Singleton instance do Prisma Client
let prisma: PrismaClient;
let currentDatabaseUrl: string | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log de queries em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query' as never, (e: any) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    prisma.$on('error' as never, (e: any) => {
      logger.error('Prisma Error:', e);
    });

    prisma.$on('warn' as never, (e: any) => {
      logger.warn('Prisma Warning:', e);
    });
  }

  return prisma;
};

/**
 * Testa conexão com banco de dados
 */
async function testDatabaseConnection(url?: string): Promise<boolean> {
  try {
    const testClient = new PrismaClient({
      datasources: url ? { db: { url } } : undefined,
    });
    await testClient.$connect();
    await testClient.$queryRaw`SELECT 1`;
    await testClient.$disconnect();
    return true;
  } catch (error) {
    return false;
  }
}

export const connectDatabase = async (): Promise<void> => {
  const useSimpleFallback = process.env.USE_SIMPLE_FALLBACK !== 'false'; // Ativado por padrão
  
  if (!useSimpleFallback) {
    // Modo simples: tenta conectar diretamente
    try {
      const client = getPrismaClient();
      await client.$connect();
      logger.info('✅ Database connected successfully');
      currentDatabaseUrl = process.env.DATABASE_URL || 'configured';
      return;
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  // Modo com fallback: tenta Supabase primeiro, depois local
  const databases = [
    {
      url: process.env.DATABASE_URL,
      name: 'Supabase (Cloud)',
    },
    {
      url: process.env.DATABASE_FALLBACK_URL || 'postgresql://postgres:postgres@localhost:5433/whatsapp_system',
      name: 'PostgreSQL Local (Docker)',
    },
  ];

  logger.info('🔍 Iniciando conexão com sistema de fallback...');

  for (const db of databases) {
    if (!db.url) {
      logger.warn(`⚠️  ${db.name}: URL não configurada, pulando...`);
      continue;
    }

    logger.info(`🔌 Tentando conectar em: ${db.name}...`);

    const isConnected = await testDatabaseConnection(db.url);

    if (isConnected) {
      // Atualizar DATABASE_URL para a conexão bem-sucedida
      process.env.DATABASE_URL = db.url;
      currentDatabaseUrl = db.url;
      
      try {
        const client = getPrismaClient();
        await client.$connect();
        logger.info(`✅ Conectado com sucesso em: ${db.name}`);
        return;
      } catch (error) {
        logger.warn(`❌ Falha ao conectar Prisma em: ${db.name}`);
      }
    } else {
      logger.warn(`❌ Falha ao conectar em: ${db.name}`);
    }
  }

  logger.error('❌ Nenhuma conexão de banco de dados disponível');
  process.exit(1);
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    const client = getPrismaClient();
    await client.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting database:', error);
  }
};

export default getPrismaClient;
