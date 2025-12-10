import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";

/**
 * Rate limiting configuration for WhatsApp messages
 * WhatsApp limit: ~15-20 messages per minute per chat
 */
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 15; // Conservative limit
const RATE_LIMIT_KEY_PREFIX = "ratelimit:";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Rate limiting middleware for WhatsApp messages
 * Prevents exceeding WhatsApp's rate limits and throttling
 */
export class RateLimitMiddleware {
  /**
   * Get counter key for current window
   */
  private static getCounterKey(chatId: string, windowStart: number): string {
    return `${RATE_LIMIT_KEY_PREFIX}${chatId}:${windowStart}`;
  }

  /**
   * Check if message is rate limited
   * @returns RateLimitResult with allowed status and metadata
   */
  static async checkRateLimit(chatId: string): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
      const counterKey = this.getCounterKey(chatId, windowStart);

      // Get current count
      const countStr = await redis.get(counterKey);
      const currentCount = countStr ? parseInt(countStr, 10) : 0;

      const remaining = Math.max(0, MAX_MESSAGES_PER_WINDOW - currentCount);
      const resetTime = windowStart + RATE_LIMIT_WINDOW_MS;

      if (currentCount >= MAX_MESSAGES_PER_WINDOW) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        logger.warn("Rate limit exceeded", {
          chatId,
          currentCount,
          limit: MAX_MESSAGES_PER_WINDOW,
          retryAfter,
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      // Increment counter
      await redis.incr(counterKey);

      // Set expiration on first increment
      if (currentCount === 0) {
        const ttlSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 5; // +5s buffer
        await redis.expire(counterKey, ttlSeconds);
      }

      logger.debug("Rate limit check passed", {
        chatId,
        count: currentCount + 1,
        remaining: remaining - 1,
      });

      return {
        allowed: true,
        remaining: remaining - 1,
        resetTime,
      };
    } catch (error) {
      logger.error("Error checking rate limit", { error, chatId });
      // On error, allow the message (fail open)
      return {
        allowed: true,
        remaining: MAX_MESSAGES_PER_WINDOW,
        resetTime: Date.now() + RATE_LIMIT_WINDOW_MS,
      };
    }
  }

  /**
   * Wait for rate limit to reset (for retry logic)
   */
  static async waitForReset(chatId: string): Promise<void> {
    const result = await this.checkRateLimit(chatId);
    if (!result.allowed && result.retryAfter) {
      const waitMs = result.retryAfter * 1000;
      logger.info("Waiting for rate limit reset", { chatId, waitMs });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  static async getRateLimitStatus(chatId: string): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
      const counterKey = this.getCounterKey(chatId, windowStart);

      const countStr = await redis.get(counterKey);
      const currentCount = countStr ? parseInt(countStr, 10) : 0;

      const remaining = Math.max(0, MAX_MESSAGES_PER_WINDOW - currentCount);
      const resetTime = windowStart + RATE_LIMIT_WINDOW_MS;

      if (currentCount >= MAX_MESSAGES_PER_WINDOW) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error("Error getting rate limit status", { error, chatId });
      return {
        allowed: true,
        remaining: MAX_MESSAGES_PER_WINDOW,
        resetTime: Date.now() + RATE_LIMIT_WINDOW_MS,
      };
    }
  }

  /**
   * Reset rate limit for a chat (for testing or manual override)
   */
  static async resetRateLimit(chatId: string): Promise<void> {
    try {
      const pattern = `${RATE_LIMIT_KEY_PREFIX}${chatId}:*`;
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        await redis.del(key);
      }

      logger.debug("Rate limit reset", { chatId, keysCleared: keys.length });
    } catch (error) {
      logger.error("Error resetting rate limit", { error, chatId });
    }
  }

  /**
   * Clear all rate limit entries (cleanup)
   */
  static async clearAllRateLimits(): Promise<number> {
    try {
      const pattern = `${RATE_LIMIT_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);
      let clearedCount = 0;

      for (const key of keys) {
        await redis.del(key);
        clearedCount++;
      }

      logger.info("All rate limits cleared", { clearedCount });
      return clearedCount;
    } catch (error) {
      logger.error("Error clearing all rate limits", { error });
      return 0;
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  static async getRateLimitStats(): Promise<{
    totalChats: number;
    rateLimitedChats: number;
  }> {
    try {
      const pattern = `${RATE_LIMIT_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);

      // Group by chat ID
      const chatIds = new Set<string>();
      const rateLimitedChats = new Set<string>();

      for (const key of keys) {
        const match = key.match(/ratelimit:([^:]+):/);
        if (match) {
          const chatId = match[1];
          chatIds.add(chatId);

          const countStr = await redis.get(key);
          const count = countStr ? parseInt(countStr, 10) : 0;
          if (count >= MAX_MESSAGES_PER_WINDOW) {
            rateLimitedChats.add(chatId);
          }
        }
      }

      return {
        totalChats: chatIds.size,
        rateLimitedChats: rateLimitedChats.size,
      };
    } catch (error) {
      logger.error("Error getting rate limit stats", { error });
      return {
        totalChats: 0,
        rateLimitedChats: 0,
      };
    }
  }
}

export default RateLimitMiddleware;
