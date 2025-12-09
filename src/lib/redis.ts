import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): ReturnType<typeof createClient> {
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      reconnectStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    },
    password: env.REDIS_PASSWORD || undefined,
    database: env.REDIS_DB,
  });

  client.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  client.on('connect', () => {
    logger.info('Redis client connected', { host: env.REDIS_HOST, port: env.REDIS_PORT });
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  redisClient = client;
  return redisClient;
}

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
    logger.info('Redis connection established');
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
    redisClient = null;
  }
}

/**
 * Redis helper functions
 */
export const redis = {
  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    return await client.get(key);
  },

  /**
   * Set value with optional expiration (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  },

  /**
   * Delete key
   */
  async del(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    await client.del(key);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    const result = await client.exists(key);
    return result === 1;
  },

  /**
   * Set expiration for key (in seconds)
   */
  async expire(key: string, seconds: number): Promise<void> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    await client.expire(key, seconds);
  },

  /**
   * Increment key value
   */
  async incr(key: string): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    return await client.incr(key);
  },

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string): Promise<void> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    await client.publish(channel, message);
  },
};

export default redis;

