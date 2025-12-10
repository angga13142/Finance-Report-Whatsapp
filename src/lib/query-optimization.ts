/**
 * Database Query Optimization Guide
 * Target: <500ms response time for 95th percentile queries
 *
 * This file documents optimization strategies and provides utilities
 * for analyzing and improving database query performance.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

/**
 * Query performance targets (95th percentile)
 */
export const QUERY_PERFORMANCE_TARGETS = {
  SIMPLE_QUERY: 50, // ms - Single record by ID
  LIST_QUERY: 200, // ms - List with filters
  AGGREGATION: 300, // ms - Aggregations and calculations
  COMPLEX_REPORT: 500, // ms - Complex joins and aggregations
  BULK_OPERATION: 1000, // ms - Bulk inserts/updates
} as const;

/**
 * Database optimization best practices
 */
export const OPTIMIZATION_BEST_PRACTICES = {
  /**
   * 1. Use indexes for frequently queried columns
   * - Already implemented in schema.prisma
   * - userId, timestamp, type, approvalStatus
   * - Composite indexes for common query patterns
   */
  INDEXES: {
    user: ["role", "isActive", "role+isActive"],
    transaction: [
      "userId",
      "timestamp",
      "type",
      "approvalStatus",
      "userId+timestamp",
      "timestamp+type",
    ],
    auditLog: [
      "userId",
      "action",
      "timestamp",
      "userId+timestamp",
      "action+timestamp",
    ],
    report: ["reportDate", "reportType", "reportDate+reportType"],
    session: ["userId", "phoneNumber", "expiresAt", "userId+expiresAt"],
    recommendation: [
      "generatedAt",
      "type",
      "priority",
      "priority+confidenceScore",
    ],
  },

  /**
   * 2. Limit result sets with pagination
   */
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    RECOMMENDED_CURSORS: true, // Use cursor-based pagination for large datasets
  },

  /**
   * 3. Use select to fetch only required fields
   */
  SELECT_OPTIMIZATION: {
    // Instead of fetching all fields, select only what you need
    RECOMMENDED: true,
    EXAMPLES: {
      userMinimal: { id: true, name: true, role: true },
      transactionSummary: {
        id: true,
        amount: true,
        type: true,
        timestamp: true,
      },
      reportSummary: {
        id: true,
        reportDate: true,
        totalIncome: true,
        totalExpense: true,
      },
    },
  },

  /**
   * 4. Batch queries instead of N+1 queries
   */
  BATCHING: {
    USE_INCLUDE_INSTEAD_OF_MULTIPLE_QUERIES: true,
    USE_WHERE_IN_FOR_MULTIPLE_IDS: true,
    EXAMPLE:
      "Use findMany with 'where: { id: { in: ids } }' instead of multiple findUnique",
  },

  /**
   * 5. Use database-level aggregations
   */
  AGGREGATIONS: {
    USE_PRISMA_AGGREGATE: true, // Use Prisma's _sum, _avg, _count
    USE_RAW_SQL_FOR_COMPLEX: true, // Use $queryRaw for complex aggregations
    AVOID_FETCHING_ALL_THEN_CALCULATING: true,
  },

  /**
   * 6. Cache frequently accessed data
   */
  CACHING: {
    USE_REDIS_CACHE: true,
    CACHE_DAILY_TOTALS: true,
    CACHE_USER_ROLES: true,
    CACHE_CATEGORIES: true,
    TTL_RECOMMENDATIONS: {
      DAILY_TOTALS: 300, // 5 minutes
      USER_ROLES: 3600, // 1 hour
      CATEGORIES: 7200, // 2 hours
    },
  },

  /**
   * 7. Connection pooling
   */
  CONNECTION_POOL: {
    MIN_CONNECTIONS: 5,
    MAX_CONNECTIONS: 50,
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    IDLE_TIMEOUT: 60000, // 1 minute
  },

  /**
   * 8. Query timeout settings
   */
  TIMEOUTS: {
    DEFAULT_QUERY_TIMEOUT: 10000, // 10 seconds
    LONG_RUNNING_QUERY_TIMEOUT: 30000, // 30 seconds
    BACKGROUND_JOB_TIMEOUT: 60000, // 1 minute
  },
} as const;

/**
 * Common query patterns with optimization tips
 */
export const OPTIMIZED_QUERY_PATTERNS = {
  /**
   * Get daily transactions with aggregation
   * OPTIMIZED: Uses database aggregation instead of fetching all rows
   */
  getDailyTotals: async (prisma: PrismaClient, date: Date) => {
    const startTime = Date.now();

    // Calculate start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Use Prisma aggregation for better performance
    const [income, expense, count] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          timestamp: { gte: startOfDay, lte: endOfDay },
          type: "income",
          approvalStatus: "approved",
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          timestamp: { gte: startOfDay, lte: endOfDay },
          type: "expense",
          approvalStatus: "approved",
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          timestamp: { gte: startOfDay, lte: endOfDay },
          approvalStatus: "approved",
        },
      }),
    ]);

    const duration = Date.now() - startTime;
    logger.debug("Daily totals query completed", { duration, date });

    return {
      totalIncome: Number(income._sum.amount || 0),
      totalExpense: Number(expense._sum.amount || 0),
      transactionCount: count,
      duration,
    };
  },

  /**
   * Get user transactions with pagination
   * OPTIMIZED: Uses cursor-based pagination and selective fields
   */
  getUserTransactionsPaginated: async (
    prisma: PrismaClient,
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) => {
    const startTime = Date.now();
    const limit = Math.min(options.limit || 20, 100);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        ...(options.startDate && options.endDate
          ? {
              timestamp: {
                gte: options.startDate,
                lte: options.endDate,
              },
            }
          : {}),
      },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        timestamp: true,
        approvalStatus: true,
        category: true,
      },
      orderBy: { timestamp: "desc" },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    });

    const hasNextPage = transactions.length > limit;
    const items = hasNextPage ? transactions.slice(0, -1) : transactions;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

    const duration = Date.now() - startTime;
    logger.debug("User transactions query completed", {
      duration,
      userId,
      count: items.length,
    });

    return {
      items,
      nextCursor,
      hasNextPage,
      duration,
    };
  },

  /**
   * Get transactions by date range with aggregation
   * OPTIMIZED: Single query with aggregation
   */
  getTransactionsByDateRange: async (
    prisma: PrismaClient,
    startDate: Date,
    endDate: Date,
    userId?: string,
  ) => {
    const startTime = Date.now();

    const where = {
      timestamp: { gte: startDate, lte: endDate },
      approvalStatus: "approved" as const,
      ...(userId ? { userId } : {}),
    };

    const [transactions, aggregation] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          timestamp: true,
          category: true,
          user: { select: { name: true, role: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 1000, // Limit for safety
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const duration = Date.now() - startTime;
    logger.debug("Date range transactions query completed", {
      duration,
      count: transactions.length,
    });

    return {
      transactions,
      summary: aggregation,
      duration,
    };
  },

  /**
   * Batch get users by IDs
   * OPTIMIZED: Single query instead of N queries
   */
  getUsersByIds: async (prisma: PrismaClient, userIds: string[]) => {
    const startTime = Date.now();

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        role: true,
        phoneNumber: true,
        isActive: true,
      },
    });

    const duration = Date.now() - startTime;
    logger.debug("Batch user query completed", {
      duration,
      count: users.length,
    });

    return { users, duration };
  },

  /**
   * Get active categories by type
   * OPTIMIZED: Filtered query with cache potential
   */
  getActiveCategories: async (
    prisma: PrismaClient,
    type?: "income" | "expense",
  ) => {
    const startTime = Date.now();

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
      },
      orderBy: { name: "asc" },
    });

    const duration = Date.now() - startTime;
    logger.debug("Categories query completed", {
      duration,
      count: categories.length,
    });

    return { categories, duration };
  },
};

/**
 * Query performance monitor
 * Logs slow queries and provides recommendations
 */
export class QueryPerformanceMonitor {
  private static slowQueryThreshold = 500; // ms

  /**
   * Track query execution time
   */
  static async trackQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      expectedDuration?: number;
      logSlow?: boolean;
    } = {},
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      const expectedDuration =
        options.expectedDuration || this.slowQueryThreshold;
      const isSlow = duration > expectedDuration;

      if (isSlow && options.logSlow !== false) {
        logger.warn("Slow query detected", {
          queryName,
          duration,
          expectedDuration,
          exceededBy: duration - expectedDuration,
        });
      } else {
        logger.debug("Query executed", { queryName, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Query failed", { queryName, duration, error });
      throw error;
    }
  }

  /**
   * Set slow query threshold
   */
  static setSlowQueryThreshold(thresholdMs: number): void {
    this.slowQueryThreshold = thresholdMs;
    logger.info("Slow query threshold updated", { threshold: thresholdMs });
  }
}

/**
 * Database optimization recommendations
 */
export const OPTIMIZATION_CHECKLIST = {
  indexes: {
    description: "Ensure all frequently queried columns have indexes",
    status: "✅ COMPLETE",
    notes: "All indexes defined in schema.prisma",
  },
  pagination: {
    description: "Use cursor-based pagination for large result sets",
    status: "✅ RECOMMENDED",
    notes: "Implement in all list endpoints",
  },
  selectFields: {
    description: "Use select to fetch only required fields",
    status: "⚠️ IN PROGRESS",
    notes: "Apply to all query patterns",
  },
  batchQueries: {
    description: "Avoid N+1 queries by batching",
    status: "✅ IMPLEMENTED",
    notes: "Use findMany with 'in' operator",
  },
  aggregations: {
    description: "Use database-level aggregations",
    status: "✅ IMPLEMENTED",
    notes: "Use Prisma aggregate and groupBy",
  },
  caching: {
    description: "Cache frequently accessed data in Redis",
    status: "✅ COMPLETE",
    notes: "Daily totals, user roles, categories cached",
  },
  connectionPool: {
    description: "Configure optimal connection pool",
    status: "✅ COMPLETE",
    notes: "Min 5, Max 50 connections configured",
  },
  monitoring: {
    description: "Monitor query performance",
    status: "✅ COMPLETE",
    notes: "Prometheus metrics and slow query logging",
  },
} as const;

export default {
  QUERY_PERFORMANCE_TARGETS,
  OPTIMIZATION_BEST_PRACTICES,
  OPTIMIZED_QUERY_PATTERNS,
  QueryPerformanceMonitor,
  OPTIMIZATION_CHECKLIST,
};
