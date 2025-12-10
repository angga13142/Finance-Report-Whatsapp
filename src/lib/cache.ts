import { redis } from "./redis";
import { logger } from "./logger";
import {
  recordCacheHit,
  recordCacheMiss,
  recordCacheOperation,
} from "./metrics";
import type { User, Category } from "@prisma/client";

/**
 * Redis caching service for performance optimization
 * Caches frequently accessed data: daily totals, user roles, category lists
 */

// Cache key prefixes
const CACHE_PREFIX = {
  DAILY_TOTALS: "cache:daily_totals:",
  USER_ROLE: "cache:user_role:",
  USER_DATA: "cache:user_data:",
  CATEGORIES: "cache:categories:",
  ACTIVE_USERS: "cache:active_users:",
} as const;

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  DAILY_TOTALS: 300, // 5 minutes - changes frequently during the day
  USER_ROLE: 3600, // 1 hour - rarely changes
  USER_DATA: 1800, // 30 minutes
  CATEGORIES: 7200, // 2 hours - rarely changes
  ACTIVE_USERS: 60, // 1 minute - for real-time counts
} as const;

/**
 * Daily totals cache structure
 */
export interface DailyTotals {
  date: string; // YYYY-MM-DD
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  transactionCount: number;
  lastUpdated: string; // ISO timestamp
}

/**
 * User role cache structure
 */
export interface UserRoleCache {
  userId: string;
  role: string;
  isActive: boolean;
  cachedAt: string; // ISO timestamp
}

/**
 * Category cache structure
 */
export interface CategoryCache {
  categories: Category[];
  cachedAt: string; // ISO timestamp
}

/**
 * Cache service for frequently accessed data
 */
export class CacheService {
  /**
   * Get daily totals from cache
   */
  static async getDailyTotals(date: string): Promise<DailyTotals | null> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.DAILY_TOTALS}${date}`;

    try {
      const cached = await redis.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (cached) {
        recordCacheHit("daily_totals");
        recordCacheOperation("get", duration);
        logger.debug("Cache hit: daily totals", { date });
        return JSON.parse(cached) as DailyTotals;
      }

      recordCacheMiss("daily_totals");
      recordCacheOperation("get", duration);
      logger.debug("Cache miss: daily totals", { date });
      return null;
    } catch (error) {
      logger.error("Error getting daily totals from cache", { error, date });
      return null;
    }
  }

  /**
   * Set daily totals in cache
   */
  static async setDailyTotals(
    date: string,
    totals: Omit<DailyTotals, "date" | "lastUpdated">,
  ): Promise<void> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.DAILY_TOTALS}${date}`;

    try {
      const cacheData: DailyTotals = {
        date,
        ...totals,
        lastUpdated: new Date().toISOString(),
      };

      await redis.set(key, JSON.stringify(cacheData), CACHE_TTL.DAILY_TOTALS);

      const duration = (Date.now() - startTime) / 1000;
      recordCacheOperation("set", duration);

      logger.debug("Cached daily totals", {
        date,
        ttl: CACHE_TTL.DAILY_TOTALS,
      });
    } catch (error) {
      logger.error("Error setting daily totals in cache", { error, date });
    }
  }

  /**
   * Invalidate daily totals cache for a specific date
   */
  static async invalidateDailyTotals(date: string): Promise<void> {
    const key = `${CACHE_PREFIX.DAILY_TOTALS}${date}`;

    try {
      await redis.del(key);
      logger.debug("Invalidated daily totals cache", { date });
    } catch (error) {
      logger.error("Error invalidating daily totals cache", { error, date });
    }
  }

  /**
   * Get user role from cache
   */
  static async getUserRole(userId: string): Promise<UserRoleCache | null> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.USER_ROLE}${userId}`;

    try {
      const cached = await redis.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (cached) {
        recordCacheHit("user_role");
        recordCacheOperation("get", duration);
        logger.debug("Cache hit: user role", { userId });
        return JSON.parse(cached) as UserRoleCache;
      }

      recordCacheMiss("user_role");
      recordCacheOperation("get", duration);
      logger.debug("Cache miss: user role", { userId });
      return null;
    } catch (error) {
      logger.error("Error getting user role from cache", { error, userId });
      return null;
    }
  }

  /**
   * Set user role in cache
   */
  static async setUserRole(user: User): Promise<void> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.USER_ROLE}${user.id}`;

    try {
      const cacheData: UserRoleCache = {
        userId: user.id,
        role: user.role,
        isActive: user.isActive,
        cachedAt: new Date().toISOString(),
      };

      await redis.set(key, JSON.stringify(cacheData), CACHE_TTL.USER_ROLE);

      const duration = (Date.now() - startTime) / 1000;
      recordCacheOperation("set", duration);

      logger.debug("Cached user role", { userId: user.id, role: user.role });
    } catch (error) {
      logger.error("Error setting user role in cache", {
        error,
        userId: user.id,
      });
    }
  }

  /**
   * Invalidate user role cache
   */
  static async invalidateUserRole(userId: string): Promise<void> {
    const key = `${CACHE_PREFIX.USER_ROLE}${userId}`;

    try {
      await redis.del(key);
      logger.debug("Invalidated user role cache", { userId });
    } catch (error) {
      logger.error("Error invalidating user role cache", { error, userId });
    }
  }

  /**
   * Get user data from cache
   */
  static async getUserData(userId: string): Promise<User | null> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.USER_DATA}${userId}`;

    try {
      const cached = await redis.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (cached) {
        recordCacheHit("user_data");
        recordCacheOperation("get", duration);
        logger.debug("Cache hit: user data", { userId });
        return JSON.parse(cached) as User;
      }

      recordCacheMiss("user_data");
      recordCacheOperation("get", duration);
      logger.debug("Cache miss: user data", { userId });
      return null;
    } catch (error) {
      logger.error("Error getting user data from cache", { error, userId });
      return null;
    }
  }

  /**
   * Set user data in cache
   */
  static async setUserData(user: User): Promise<void> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.USER_DATA}${user.id}`;

    try {
      await redis.set(key, JSON.stringify(user), CACHE_TTL.USER_DATA);

      const duration = (Date.now() - startTime) / 1000;
      recordCacheOperation("set", duration);

      logger.debug("Cached user data", { userId: user.id });
    } catch (error) {
      logger.error("Error setting user data in cache", {
        error,
        userId: user.id,
      });
    }
  }

  /**
   * Invalidate user data cache
   */
  static async invalidateUserData(userId: string): Promise<void> {
    const keys = [
      `${CACHE_PREFIX.USER_DATA}${userId}`,
      `${CACHE_PREFIX.USER_ROLE}${userId}`,
    ];

    try {
      await Promise.all(keys.map((key) => redis.del(key)));
      logger.debug("Invalidated user cache", { userId });
    } catch (error) {
      logger.error("Error invalidating user cache", { error, userId });
    }
  }

  /**
   * Get categories from cache
   */
  static async getCategories(
    type?: "income" | "expense",
  ): Promise<Category[] | null> {
    const startTime = Date.now();
    const key = type
      ? `${CACHE_PREFIX.CATEGORIES}${type}`
      : `${CACHE_PREFIX.CATEGORIES}all`;

    try {
      const cached = await redis.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (cached) {
        recordCacheHit("categories");
        recordCacheOperation("get", duration);
        logger.debug("Cache hit: categories", { type: type || "all" });

        const data = JSON.parse(cached) as CategoryCache;
        return data.categories;
      }

      recordCacheMiss("categories");
      recordCacheOperation("get", duration);
      logger.debug("Cache miss: categories", { type: type || "all" });
      return null;
    } catch (error) {
      logger.error("Error getting categories from cache", { error, type });
      return null;
    }
  }

  /**
   * Set categories in cache
   */
  static async setCategories(
    categories: Category[],
    type?: "income" | "expense",
  ): Promise<void> {
    const startTime = Date.now();
    const key = type
      ? `${CACHE_PREFIX.CATEGORIES}${type}`
      : `${CACHE_PREFIX.CATEGORIES}all`;

    try {
      const cacheData: CategoryCache = {
        categories,
        cachedAt: new Date().toISOString(),
      };

      await redis.set(key, JSON.stringify(cacheData), CACHE_TTL.CATEGORIES);

      const duration = (Date.now() - startTime) / 1000;
      recordCacheOperation("set", duration);

      logger.debug("Cached categories", {
        type: type || "all",
        count: categories.length,
      });
    } catch (error) {
      logger.error("Error setting categories in cache", { error, type });
    }
  }

  /**
   * Invalidate categories cache
   */
  static async invalidateCategories(): Promise<void> {
    try {
      const keys = [
        `${CACHE_PREFIX.CATEGORIES}all`,
        `${CACHE_PREFIX.CATEGORIES}income`,
        `${CACHE_PREFIX.CATEGORIES}expense`,
      ];

      await Promise.all(keys.map((key) => redis.del(key)));
      logger.debug("Invalidated categories cache");
    } catch (error) {
      logger.error("Error invalidating categories cache", { error });
    }
  }

  /**
   * Get active users count from cache
   */
  static async getActiveUsersCount(): Promise<number | null> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.ACTIVE_USERS}count`;

    try {
      const cached = await redis.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (cached) {
        recordCacheHit("active_users");
        recordCacheOperation("get", duration);
        return parseInt(cached, 10);
      }

      recordCacheMiss("active_users");
      recordCacheOperation("get", duration);
      return null;
    } catch (error) {
      logger.error("Error getting active users count from cache", { error });
      return null;
    }
  }

  /**
   * Set active users count in cache
   */
  static async setActiveUsersCount(count: number): Promise<void> {
    const startTime = Date.now();
    const key = `${CACHE_PREFIX.ACTIVE_USERS}count`;

    try {
      await redis.set(key, count.toString(), CACHE_TTL.ACTIVE_USERS);

      const duration = (Date.now() - startTime) / 1000;
      recordCacheOperation("set", duration);

      logger.debug("Cached active users count", { count });
    } catch (error) {
      logger.error("Error setting active users count in cache", { error });
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  static async clearAll(): Promise<void> {
    try {
      const patterns = Object.values(CACHE_PREFIX);

      for (const pattern of patterns) {
        const keys = await redis.keys(`${pattern}*`);
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)));
        }
      }

      logger.warn("Cleared all cache");
    } catch (error) {
      logger.error("Error clearing all cache", { error });
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    dailyTotalsCount: number;
    userRoleCount: number;
    userDataCount: number;
    categoriesCount: number;
    totalKeys: number;
  }> {
    try {
      const [dailyTotals, userRole, userData, categories] = await Promise.all([
        redis.keys(`${CACHE_PREFIX.DAILY_TOTALS}*`),
        redis.keys(`${CACHE_PREFIX.USER_ROLE}*`),
        redis.keys(`${CACHE_PREFIX.USER_DATA}*`),
        redis.keys(`${CACHE_PREFIX.CATEGORIES}*`),
      ]);

      return {
        dailyTotalsCount: dailyTotals.length,
        userRoleCount: userRole.length,
        userDataCount: userData.length,
        categoriesCount: categories.length,
        totalKeys:
          dailyTotals.length +
          userRole.length +
          userData.length +
          categories.length,
      };
    } catch (error) {
      logger.error("Error getting cache stats", { error });
      return {
        dailyTotalsCount: 0,
        userRoleCount: 0,
        userDataCount: 0,
        categoriesCount: 0,
        totalKeys: 0,
      };
    }
  }

  /**
   * Warm up cache with commonly accessed data
   */
  static async warmUp(data: {
    categories?: Category[];
    activeUsers?: User[];
  }): Promise<void> {
    try {
      logger.info("Warming up cache...");

      if (data.categories && data.categories.length > 0) {
        await this.setCategories(data.categories);

        const incomeCategories = data.categories.filter(
          (c) => c.type === "income",
        );
        const expenseCategories = data.categories.filter(
          (c) => c.type === "expense",
        );

        await this.setCategories(incomeCategories, "income");
        await this.setCategories(expenseCategories, "expense");
      }

      if (data.activeUsers && data.activeUsers.length > 0) {
        await Promise.all(
          data.activeUsers.map((user) => this.setUserRole(user)),
        );
        await this.setActiveUsersCount(data.activeUsers.length);
      }

      logger.info("Cache warm-up completed");
    } catch (error) {
      logger.error("Error warming up cache", { error });
    }
  }
}

export default CacheService;
