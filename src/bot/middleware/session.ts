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
  [key: string]: string | number | boolean | undefined;
}

/**
 * Session state management middleware
 */
export class SessionManager {
  private static readonly SESSION_KEY_PREFIX = "session:";
  private static readonly TTL_SECONDS = Math.floor(SESSION_TIMEOUT_MS / 1000);

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
      await redis.set(key, JSON.stringify(state), this.TTL_SECONDS);
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
}

export default SessionManager;
