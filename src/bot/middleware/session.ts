import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { SESSION_TIMEOUT_MS, MENU_STATES } from "../../config/constants";

export interface SessionState {
  menu: string;
  step?: number;
  transactionType?: "income" | "expense";
  category?: string;
  amount?: string;
  description?: string;
  editingField?: string; // Track which field is being edited
  preEditSnapshot?: Partial<SessionState>; // Store snapshot before editing
  lastActivityAt?: number; // Timestamp for timeout detection
  isEditing?: boolean; // Flag to indicate editing mode
  [key: string]: string | number | boolean | Partial<SessionState> | undefined;
}

export interface PartialTransactionData {
  userId: string;
  transactionType?: "income" | "expense";
  category?: string;
  amount?: string;
  description?: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Session state management middleware
 */
export class SessionManager {
  private static readonly SESSION_KEY_PREFIX = "session:";
  private static readonly PARTIAL_DATA_KEY_PREFIX = "partial:";
  private static readonly CLEANUP_LOCK_KEY = "cleanup:lock";
  private static readonly TTL_SECONDS = Math.floor(SESSION_TIMEOUT_MS / 1000);
  private static readonly PARTIAL_DATA_TTL_SECONDS = 3600; // 1 hour for recovery
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Get session key for user
   */
  private static getSessionKey(userId: string): string {
    return `${this.SESSION_KEY_PREFIX}${userId}`;
  }

  /**
   * Get user session state
   */
  static async getSession(userId: string): Promise<SessionState | null> {
    try {
      const key = this.getSessionKey(userId);
      const sessionData = await redis.get(key);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData) as SessionState;
    } catch (error) {
      logger.error("Error getting session", { error, userId });
      return null;
    }
  }

  /**
   * Set user session state
   */
  static async setSession(userId: string, state: SessionState): Promise<void> {
    try {
      const key = this.getSessionKey(userId);
      // Add lastActivityAt timestamp
      const stateWithActivity = {
        ...state,
        lastActivityAt: Date.now(),
      };
      await redis.set(key, JSON.stringify(stateWithActivity), this.TTL_SECONDS);
    } catch (error) {
      logger.error("Error setting session", { error, userId, state });
      throw error;
    }
  }

  /**
   * Update session state (merge with existing)
   */
  static async updateSession(
    userId: string,
    updates: Partial<SessionState>,
  ): Promise<SessionState> {
    try {
      const current = (await this.getSession(userId)) || {
        menu: MENU_STATES.MAIN,
      };
      const updated = { ...current, ...updates };
      await this.setSession(userId, updated);
      return updated;
    } catch (error) {
      logger.error("Error updating session", { error, userId, updates });
      throw error;
    }
  }

  /**
   * Clear user session
   */
  static async clearSession(userId: string): Promise<void> {
    try {
      const key = this.getSessionKey(userId);
      await redis.del(key);
    } catch (error) {
      logger.error("Error clearing session", { error, userId });
      // Don't throw, just log
    }
  }

  /**
   * Check if session is expired (cleanup old sessions)
   */
  static async isSessionExpired(userId: string): Promise<boolean> {
    try {
      const key = this.getSessionKey(userId);
      const exists = await redis.exists(key);
      return !exists;
    } catch (error) {
      logger.error("Error checking session expiration", { error, userId });
      return true; // Assume expired on error
    }
  }

  /**
   * Extend session TTL
   */
  static async extendSession(userId: string): Promise<void> {
    try {
      const key = this.getSessionKey(userId);
      await redis.expire(key, this.TTL_SECONDS);
    } catch (error) {
      logger.error("Error extending session", { error, userId });
      // Don't throw, just log
    }
  }

  /**
   * Get session context data (for transaction input)
   */
  static async getContextData(userId: string): Promise<Partial<SessionState>> {
    try {
      const session = await this.getSession(userId);
      if (!session) {
        return {};
      }

      return {
        transactionType: session.transactionType,
        category: session.category,
        amount: session.amount,
        description: session.description,
      };
    } catch (error) {
      logger.error("Error getting context data", { error, userId });
      return {};
    }
  }

  /**
   * Set context data for transaction input
   */
  static async setContextData(
    userId: string,
    data: Partial<SessionState>,
  ): Promise<void> {
    try {
      await this.updateSession(userId, data);
    } catch (error) {
      logger.error("Error setting context data", { error, userId, data });
      throw error;
    }
  }

  /**
   * Start editing a field - save snapshot of current state
   */
  static async startEditing(
    userId: string,
    field: string,
  ): Promise<SessionState> {
    try {
      const current = await this.getSession(userId);
      if (!current) {
        throw new Error("No active session to edit");
      }

      // Save pre-edit snapshot
      const snapshot: Partial<SessionState> = {
        transactionType: current.transactionType,
        category: current.category,
        amount: current.amount,
        description: current.description,
      };

      const updated = await this.updateSession(userId, {
        isEditing: true,
        editingField: field,
        preEditSnapshot: snapshot,
      });

      logger.info("Started editing field", { userId, field });
      return updated;
    } catch (error) {
      logger.error("Error starting edit", { error, userId, field });
      throw error;
    }
  }

  /**
   * Complete editing - clear edit state but keep updated data
   */
  static async finishEditing(userId: string): Promise<SessionState> {
    try {
      const current = await this.getSession(userId);
      if (!current) {
        throw new Error("No active session");
      }

      // Remove edit-related fields but keep the data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isEditing, editingField, preEditSnapshot, ...cleanState } =
        current;

      const updated = await this.updateSession(userId, {
        ...cleanState,
        isEditing: false,
        editingField: undefined,
        preEditSnapshot: undefined,
      });

      logger.info("Finished editing", { userId });
      return updated;
    } catch (error) {
      logger.error("Error finishing edit", { error, userId });
      throw error;
    }
  }

  /**
   * Cancel editing - restore pre-edit snapshot
   */
  static async cancelEditing(userId: string): Promise<SessionState> {
    try {
      const current = await this.getSession(userId);
      if (!current || !current.preEditSnapshot) {
        throw new Error("No edit in progress");
      }

      // Restore from snapshot
      const restored = await this.updateSession(userId, {
        ...current.preEditSnapshot,
        isEditing: false,
        editingField: undefined,
        preEditSnapshot: undefined,
      });

      logger.info("Cancelled editing", { userId });
      return restored;
    } catch (error) {
      logger.error("Error cancelling edit", { error, userId });
      throw error;
    }
  }

  /**
   * Save partial transaction data for network recovery
   */
  static async savePartialData(
    userId: string,
    data: Omit<PartialTransactionData, "userId" | "timestamp" | "retryCount">,
  ): Promise<void> {
    try {
      const key = `${this.PARTIAL_DATA_KEY_PREFIX}${userId}`;
      const partialData: PartialTransactionData = {
        userId,
        ...data,
        timestamp: Date.now(),
        retryCount: 0,
      };

      await redis.set(
        key,
        JSON.stringify(partialData),
        this.PARTIAL_DATA_TTL_SECONDS,
      );
      logger.info("Saved partial transaction data", { userId });
    } catch (error) {
      logger.error("Error saving partial data", { error, userId });
      throw error;
    }
  }

  /**
   * Get partial transaction data for recovery
   */
  static async getPartialData(
    userId: string,
  ): Promise<PartialTransactionData | null> {
    try {
      const key = `${this.PARTIAL_DATA_KEY_PREFIX}${userId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as PartialTransactionData;
    } catch (error) {
      logger.error("Error getting partial data", { error, userId });
      return null;
    }
  }

  /**
   * Clear partial transaction data after successful recovery
   */
  static async clearPartialData(userId: string): Promise<void> {
    try {
      const key = `${this.PARTIAL_DATA_KEY_PREFIX}${userId}`;
      await redis.del(key);
      logger.info("Cleared partial transaction data", { userId });
    } catch (error) {
      logger.error("Error clearing partial data", { error, userId });
      // Don't throw, just log
    }
  }

  /**
   * Increment retry count for partial data
   */
  static async incrementRetryCount(userId: string): Promise<number> {
    try {
      const partialData = await this.getPartialData(userId);
      if (!partialData) {
        return 0;
      }

      partialData.retryCount += 1;
      const key = `${this.PARTIAL_DATA_KEY_PREFIX}${userId}`;
      await redis.set(
        key,
        JSON.stringify(partialData),
        this.PARTIAL_DATA_TTL_SECONDS,
      );

      return partialData.retryCount;
    } catch (error) {
      logger.error("Error incrementing retry count", { error, userId });
      return 0;
    }
  }

  /**
   * Cleanup expired sessions (10 minutes inactivity)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      // Try to acquire lock
      const lockAcquired = await redis.setNX(this.CLEANUP_LOCK_KEY, "1", 10);
      if (!lockAcquired) {
        logger.debug("Cleanup already in progress, skipping");
        return 0;
      }

      const pattern = `${this.SESSION_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);
      const now = Date.now();
      const timeoutMs = SESSION_TIMEOUT_MS;
      let cleanedCount = 0;

      for (const key of keys) {
        try {
          const sessionData = await redis.get(key);
          if (!sessionData) continue;

          const session = JSON.parse(sessionData) as SessionState;
          const lastActivity = session.lastActivityAt || 0;

          if (now - lastActivity > timeoutMs) {
            await redis.del(key);
            cleanedCount++;
            logger.info("Cleaned up expired session", {
              key,
              inactiveFor: now - lastActivity,
            });
          }
        } catch (err) {
          logger.error("Error processing session for cleanup", {
            error: err,
            key,
          });
        }
      }

      // Release lock
      await redis.del(this.CLEANUP_LOCK_KEY);

      logger.info("Session cleanup completed", { cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error("Error during session cleanup", { error });
      // Release lock on error
      await redis.del(this.CLEANUP_LOCK_KEY);
      return 0;
    }
  }

  /**
   * Start automatic cleanup interval (every 5 minutes)
   */
  static startCleanupInterval(): void {
    if (this.cleanupInterval) {
      logger.warn("Cleanup interval already running");
      return;
    }

    this.cleanupInterval = setInterval(
      () => {
        void this.cleanupExpiredSessions();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    logger.info("Started session cleanup interval");
  }

  /**
   * Stop automatic cleanup interval
   */
  static stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info("Stopped session cleanup interval");
    }
  }

  /**
   * Check if user has editing context that needs recovery
   */
  static async hasRecoverableContext(userId: string): Promise<boolean> {
    try {
      const partialData = await this.getPartialData(userId);
      return partialData !== null;
    } catch (error) {
      logger.error("Error checking recoverable context", { error, userId });
      return false;
    }
  }

  /**
   * Restore session from partial data
   */
  static async restoreFromPartialData(userId: string): Promise<SessionState> {
    try {
      const partialData = await this.getPartialData(userId);
      if (!partialData) {
        throw new Error("No partial data to restore");
      }

      const session: SessionState = {
        menu: MENU_STATES.MAIN,
        transactionType: partialData.transactionType,
        category: partialData.category,
        amount: partialData.amount,
        description: partialData.description,
        lastActivityAt: Date.now(),
      };

      await this.setSession(userId, session);
      logger.info("Restored session from partial data", {
        userId,
        retryCount: partialData.retryCount,
      });

      return session;
    } catch (error) {
      logger.error("Error restoring from partial data", { error, userId });
      throw error;
    }
  }
}

export default SessionManager;
