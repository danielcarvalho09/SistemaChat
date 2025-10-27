import Redis from 'ioredis';
import { logger } from './logger.js';

let redisClient: Redis;
let redisPubClient: Redis;
let redisSubClient: Redis;

/**
 * Testa conexão Redis
 */
async function testRedisConnection(url: string): Promise<boolean> {
  const testClient = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await testClient.connect();
    await testClient.ping();
    testClient.disconnect();
    return true;
  } catch (error) {
    testClient.disconnect();
    return false;
  }
}

/**
 * Seleciona URL do Redis com fallback
 */
async function selectRedisUrl(): Promise<string> {
  const useSimpleFallback = process.env.USE_SIMPLE_FALLBACK !== 'false';

  if (!useSimpleFallback) {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  const redisConfigs = [
    {
      url: process.env.REDIS_URL,
      name: 'Redis Cloud',
    },
    {
      url: process.env.REDIS_FALLBACK_URL || 'redis://:redis_password@localhost:6380',
      name: 'Redis Local (Docker)',
    },
  ];

  logger.info('🔍 Testando conexões Redis...');

  for (const redis of redisConfigs) {
    if (!redis.url) {
      logger.warn(`⚠️  ${redis.name}: URL não configurada, pulando...`);
      continue;
    }

    logger.info(`🔌 Tentando conectar em: ${redis.name}...`);

    const isConnected = await testRedisConnection(redis.url);

    if (isConnected) {
      logger.info(`✅ Redis: ${redis.name} disponível`);
      return redis.url;
    } else {
      logger.warn(`❌ Redis: ${redis.name} não disponível`);
    }
  }

  logger.warn('⚠️  Nenhum Redis disponível, usando URL padrão');
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('❌ Redis connection error:', error);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('⚠️ Redis reconnecting...');
    });
  }

  return redisClient;
};

// Cliente para Pub/Sub (Socket.io adapter)
export const getRedisPubClient = (): Redis => {
  if (!redisPubClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisPubClient = new Redis(redisUrl);
    
    redisPubClient.on('connect', () => {
      logger.info('✅ Redis Pub client connected');
    });
  }
  return redisPubClient;
};

export const getRedisSubClient = (): Redis => {
  if (!redisSubClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisSubClient = new Redis(redisUrl);
    
    redisSubClient.on('connect', () => {
      logger.info('✅ Redis Sub client connected');
    });
  }
  return redisSubClient;
};

export const connectRedis = async (): Promise<void> => {
  try {
    // Selecionar melhor URL disponível com fallback
    const selectedUrl = await selectRedisUrl();
    process.env.REDIS_URL = selectedUrl;
    
    const client = getRedisClient();
    await client.ping();
    logger.info('✅ Redis connection verified');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) await redisClient.quit();
    if (redisPubClient) await redisPubClient.quit();
    if (redisSubClient) await redisSubClient.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

// Utility functions para cache
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: any,
  ttl?: number
): Promise<void> => {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    
    if (ttl) {
      await client.setex(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.error(`Cache delete error for key ${key}:`, error);
  }
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    logger.error(`Cache delete pattern error for ${pattern}:`, error);
  }
};

export default getRedisClient;
