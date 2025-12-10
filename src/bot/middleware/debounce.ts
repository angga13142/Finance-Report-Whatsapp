import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";

/**
 * Button debounce configuration
 */
const DEBOUNCE_WINDOW_MS = 3000; // 3 seconds
const DEBOUNCE_KEY_PREFIX = "debounce:";

/**
 * Button debouncing middleware
 * Prevents duplicate button clicks within the debounce window
 */
export class DebounceMiddleware {
  /**
   * Get debounce key for user and button
   */
  private static getDebounceKey(userId: string, buttonId: string): string {
    return `${DEBOUNCE_KEY_PREFIX}${userId}:${buttonId}`;
  }

  /**
   * Check if button click should be debounced
   * @returns true if click should be ignored (is debounced), false if click should be processed
   */
  static async shouldDebounce(
    userId: string,
    buttonId: string,
  ): Promise<boolean> {
    try {
      const key = this.getDebounceKey(userId, buttonId);
      const exists = await redis.exists(key);

      if (exists) {
        logger.debug("Button click debounced", { userId, buttonId });
        return true; // Should debounce (ignore this click)
      }

      // Set debounce key with TTL
      const ttlSeconds = Math.ceil(DEBOUNCE_WINDOW_MS / 1000);
      await redis.set(key, Date.now().toString(), ttlSeconds);

      return false; // Should not debounce (process this click)
    } catch (error) {
      logger.error("Error checking debounce", { error, userId, buttonId });
      // On error, allow the click (fail open)
      return false;
    }
  }

  /**
   * Clear debounce for a specific button (for testing or manual override)
   */
  static async clearDebounce(userId: string, buttonId: string): Promise<void> {
    try {
      const key = this.getDebounceKey(userId, buttonId);
      await redis.del(key);
      logger.debug("Debounce cleared", { userId, buttonId });
    } catch (error) {
      logger.error("Error clearing debounce", { error, userId, buttonId });
    }
  }

  /**
   * Clear all debounce entries for a user (cleanup on logout/session clear)
   */
  static async clearAllDebounces(userId: string): Promise<void> {
    try {
      const pattern = `${DEBOUNCE_KEY_PREFIX}${userId}:*`;
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        await redis.del(key);
      }

      logger.debug("All debounces cleared for user", {
        userId,
        count: keys.length,
      });
    } catch (error) {
      logger.error("Error clearing all debounces", { error, userId });
    }
  }

  /**
   * Get remaining debounce time in milliseconds
   * @returns milliseconds remaining, or 0 if not debounced
   */
  static async getRemainingDebounceTime(
    userId: string,
    buttonId: string,
  ): Promise<number> {
    try {
      const key = this.getDebounceKey(userId, buttonId);
      const clickTime = await redis.get(key);

      if (!clickTime) {
        return 0;
      }

      const elapsed = Date.now() - parseInt(clickTime, 10);
      const remaining = Math.max(0, DEBOUNCE_WINDOW_MS - elapsed);

      return remaining;
    } catch (error) {
      logger.error("Error getting remaining debounce time", {
        error,
        userId,
        buttonId,
      });
      return 0;
    }
  }

  /**
   * Cleanup expired debounce entries (optional, Redis TTL handles this automatically)
   */
  static async cleanupExpiredDebounces(): Promise<number> {
    try {
      const pattern = `${DEBOUNCE_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const value = await redis.get(key);
        if (!value) {
          continue;
        }

        const clickTime = parseInt(value, 10);
        const elapsed = Date.now() - clickTime;

        if (elapsed > DEBOUNCE_WINDOW_MS) {
          await redis.del(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up expired debounce entries", { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error("Error cleaning up debounce entries", { error });
      return 0;
    }
  }
}

export default DebounceMiddleware;
