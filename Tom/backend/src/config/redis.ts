import Redis from 'ioredis';
import { logger } from './logger.js';

let redisClient: Redis;
let redisPubClient: Redis;
let redisSubClient: Redis;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    if (!process.env.REDIS_URL) {
      logger.error('❌ REDIS_URL não configurada!');
      logger.error('Configure a variável REDIS_URL com a connection string do Redis Cloud');
      throw new Error('REDIS_URL is required');
    }

    const redisUrl = process.env.REDIS_URL;
    
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
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is required');
    }
    
    const redisUrl = process.env.REDIS_URL;
    redisPubClient = new Redis(redisUrl);
    
    redisPubClient.on('connect', () => {
      logger.info('✅ Redis Pub client connected');
    });
  }
  return redisPubClient;
};

export const getRedisSubClient = (): Redis => {
  if (!redisSubClient) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is required');
    }
    
    const redisUrl = process.env.REDIS_URL;
    redisSubClient = new Redis(redisUrl);
    
    redisSubClient.on('connect', () => {
      logger.info('✅ Redis Sub client connected');
    });
  }
  return redisSubClient;
};

export const connectRedis = async (): Promise<void> => {
  try {
    if (!process.env.REDIS_URL) {
      logger.error('❌ REDIS_URL não configurada!');
      throw new Error('REDIS_URL is required');
    }
    
    logger.info('🔌 Conectando ao Redis Cloud...');
    
    const client = getRedisClient();
    await client.ping();
    
    logger.info('✅ Redis connection verified (Redis Cloud)');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    logger.error('Verifique se REDIS_URL está correta e o Redis Cloud está acessível');
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
