import Redis from 'ioredis';
import { logger } from '../config/logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private defaultTTL = 300; // 5 minutes
  private keyPrefix = 'cache:';

  constructor(private redis: Redis) {}

  private getKey(key: string, prefix?: string): string {
    return `${prefix || this.keyPrefix}${key}`;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.getKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);
      
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.getKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      
      await this.redis.setex(
        fullKey,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key: string, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.getKey(key, options?.prefix);
      await this.redis.del(fullKey);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      logger.error('Cache invalidate pattern error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    logger.debug(`Cache MISS: ${key}`);
    
    // Execute factory and cache
    const value = await factory();
    await this.set(key, value, options);
    
    return value;
  }

  // Invalidate cache for specific entities
  async invalidateConversation(conversationId: string): Promise<void> {
    await this.invalidatePattern(`conversations:${conversationId}*`);
    await this.invalidatePattern(`messages:${conversationId}*`);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.invalidatePattern(`user:${userId}*`);
  }
}
