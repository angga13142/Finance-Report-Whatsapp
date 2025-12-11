/**
 * Cache Service
 * Provides cache management operations with pattern matching using Redis SCAN
 */

import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";

/**
 * Cache clear result
 */
export interface CacheClearResult {
  deleted: number;
  failed: number;
  pattern?: string;
}

/**
 * Cache Service
 * Handles cache operations with pattern matching
 */
export class CacheService {
  /**
   * Clear cache by pattern using Redis SCAN (not KEYS)
   * @param pattern - Pattern to match (e.g., "user:*", "cache:*")
   * @returns Result with deleted and failed counts
   */
  async clear(pattern?: string): Promise<CacheClearResult> {
    try {
      if (!pattern) {
        return await this.clearAll();
      }

      const keys: string[] = [];
      let cursor = 0;

      // Use SCAN instead of KEYS for better performance
      do {
        const result = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });

        cursor = result.cursor;
        if (result.keys && result.keys.length > 0) {
          keys.push(...result.keys);
        }
      } while (cursor !== 0);

      if (keys.length === 0) {
        return {
          deleted: 0,
          failed: 0,
          pattern,
        };
      }

      // Delete all matched keys
      let deleted = 0;
      let failed = 0;

      for (const key of keys) {
        try {
          await redis.del(key);
          deleted++;
        } catch (error) {
          logger.warn("Failed to delete cache key", { error, key });
          failed++;
        }
      }

      logger.info("Cache cleared by pattern", {
        pattern,
        deleted,
        failed,
        total: keys.length,
      });

      return {
        deleted,
        failed,
        pattern,
      };
    } catch (error) {
      logger.error("Error clearing cache", { error, pattern });
      throw error;
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<CacheClearResult> {
    try {
      const keys: string[] = [];
      let cursor = 0;

      // SCAN all keys
      do {
        const result = await redis.scan(cursor, {
          COUNT: 100,
        });

        cursor = result.cursor;
        if (result.keys && result.keys.length > 0) {
          keys.push(...result.keys);
        }
      } while (cursor !== 0);

      if (keys.length === 0) {
        return {
          deleted: 0,
          failed: 0,
        };
      }

      // Delete all keys
      let deleted = 0;
      let failed = 0;

      for (const key of keys) {
        try {
          await redis.del(key);
          deleted++;
        } catch (error) {
          logger.warn("Failed to delete cache key", { error, key });
          failed++;
        }
      }

      logger.info("All cache cleared", {
        deleted,
        failed,
        total: keys.length,
      });

      return {
        deleted,
        failed,
      };
    } catch (error) {
      logger.error("Error clearing all cache", { error });
      throw error;
    }
  }
}

export default CacheService;
