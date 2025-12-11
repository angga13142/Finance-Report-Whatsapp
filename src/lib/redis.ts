import { createClient } from "redis";
import { env } from "../config/env";
import { logger } from "./logger";

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
        logger.warn(
          `Redis connection retry attempt ${times}, waiting ${delay}ms`,
        );
        return delay;
      },
    },
    password: env.REDIS_PASSWORD || undefined,
    database: env.REDIS_DB,
  });

  client.on("error", (err: unknown) => {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error("Redis client error", { error: errorObj.message });
  });

  client.on("connect", () => {
    logger.info("Redis client connected", {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
  });

  client.on("ready", () => {
    logger.info("Redis client ready");
  });

  client.on("reconnecting", () => {
    logger.warn("Redis client reconnecting");
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
    logger.info("Redis connection established");
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info("Redis connection closed");
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

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    return await client.keys(pattern);
  },

  /**
   * Set if not exists (NX option)
   */
  async setNX(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await connectRedis();
    }
    if (ttlSeconds) {
      const result = await client.set(key, value, {
        EX: ttlSeconds,
        NX: true,
      });
      return result === "OK";
    } else {
      const result = await client.set(key, value, { NX: true });
      return result === "OK";
    }
  },
};

/**
 * Conversation context management
 * Manages user conversation state for multi-step workflows
 * TTL: 1800 seconds (30 minutes) per FR-007
 */
export interface ConversationContext {
  userId: string;
  workflowType?: "transaction_entry" | "report_view" | null;
  currentStep?: number;
  enteredData?: Record<string, unknown>;
  pendingTransaction?: {
    amount?: number;
    category?: string;
    type?: "income" | "expense";
  };
  lastActivity: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
}

const CONTEXT_TTL = 1800; // 30 minutes in seconds
const CONTEXT_KEY_PREFIX = "conversation:";

/**
 * Get conversation context for user
 */
export async function getContext(
  userId: string,
): Promise<ConversationContext | null> {
  try {
    const key = `${CONTEXT_KEY_PREFIX}${userId}`;
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as ConversationContext;
  } catch (error) {
    logger.error("Failed to get conversation context", { userId, error });
    return null;
  }
}

/**
 * Set conversation context for user
 * Creates new context or updates existing one with TTL refresh
 */
export async function setContext(context: ConversationContext): Promise<void> {
  try {
    const key = `${CONTEXT_KEY_PREFIX}${context.userId}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONTEXT_TTL * 1000);

    const contextWithTimestamps: ConversationContext = {
      ...context,
      lastActivity: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await redis.set(key, JSON.stringify(contextWithTimestamps), CONTEXT_TTL);

    logger.info("Conversation context set", {
      userId: context.userId,
      workflowType: context.workflowType,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error("Failed to set conversation context", {
      userId: context.userId,
      error,
    });
    throw error;
  }
}

/**
 * Update conversation context
 * Updates existing context and refreshes TTL
 */
export async function updateContext(
  userId: string,
  updates: Partial<
    Omit<ConversationContext, "userId" | "lastActivity" | "expiresAt">
  >,
): Promise<void> {
  try {
    const existing = await getContext(userId);
    if (!existing) {
      // Create new context if doesn't exist
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONTEXT_TTL * 1000);
      const newContext: ConversationContext = {
        userId,
        lastActivity: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        ...updates,
      };
      await setContext(newContext);
      return;
    }

    // Update existing context
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONTEXT_TTL * 1000);
    const updated: ConversationContext = {
      ...existing,
      ...updates,
      lastActivity: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await setContext(updated);

    logger.info("Conversation context updated", {
      userId,
      updates: Object.keys(updates),
    });
  } catch (error) {
    logger.error("Failed to update conversation context", { userId, error });
    throw error;
  }
}

/**
 * Clear conversation context for user
 */
export async function clearContext(userId: string): Promise<void> {
  try {
    const key = `${CONTEXT_KEY_PREFIX}${userId}`;
    await redis.del(key);
    logger.info("Conversation context cleared", { userId });
  } catch (error) {
    logger.error("Failed to clear conversation context", { userId, error });
    throw error;
  }
}

export default redis;
