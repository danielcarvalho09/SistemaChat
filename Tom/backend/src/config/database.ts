import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// Singleton instance do Prisma Client
let prisma: PrismaClient;
let currentDatabaseUrl: string | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    // Modificar URL para otimizar pool
    const url = process.env.DATABASE_URL;
    let datasources;

    if (url) {
      const hasParams = url.includes('?');
      const separator = hasParams ? '&' : '?';
      // Forçar limite de 20 conexões e 20s de timeout no pool
      const newUrl = url.includes('connection_limit')
        ? url
        : `${url}${separator}connection_limit=20&pool_timeout=20`;

      datasources = {
        db: {
          url: newUrl
        }
      };
      logger.info(`🔌 Prisma Pool Configured: Limit=20, Timeout=20s`);
    }

    prisma = new PrismaClient({
      datasources,
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
 * Conecta ao banco de dados cloud (Supabase)
 * SEM FALLBACK para bancos locais
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      logger.error('❌ DATABASE_URL não configurada!');
      logger.error('Configure a variável DATABASE_URL com a connection string do Supabase');
      process.exit(1);
    }

    logger.info('🔌 Conectando ao banco de dados cloud...');

    const client = getPrismaClient();
    await client.$connect();
    await client.$queryRaw`SELECT 1`;

    currentDatabaseUrl = process.env.DATABASE_URL;
    logger.info('✅ Database connected successfully (Supabase Cloud)');
  } catch (error) {
    logger.error('❌ Falha ao conectar no banco de dados:', error);
    logger.error('Verifique se DATABASE_URL está correta e o banco está acessível');
    process.exit(1);
  }
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
