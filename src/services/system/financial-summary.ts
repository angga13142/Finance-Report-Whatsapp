/**
 * Financial summary service
 * Provides financial data aggregation with role-based filtering, caching, and trend calculation
 */

import { PrismaClient, TransactionType, ApprovalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../../lib/database";
import { getRedisClient } from "../../lib/redis";
import { logger } from "../../lib/logger";
import {
  getDayRangeWITA,
  getWeekRangeWITA,
  getMonthRangeWITA,
} from "../../lib/date";
import { USER_ROLES, type UserRoleType } from "../../config/constants";

export interface FinancialSummary {
  balance: number;
  income: number;
  expenses: number;
  cashflow: number;
  pendingCount: number;
  pendingAmount: number;
  trendData?: TrendData;
  calculatedAt: Date;
}

export interface TrendData {
  incomeChange?: number; // Percentage change vs previous period
  expenseChange?: number; // Percentage change vs previous period
  cashflowChange?: number; // Percentage change vs previous period
  previousPeriod?: {
    income: number;
    expenses: number;
    cashflow: number;
  };
}

export type DateRangeType =
  | "today"
  | "week"
  | "month"
  | `custom:${string}:${string}`;

/**
 * Financial summary service with role-based filtering and caching
 */
export class FinancialSummaryService {
  private static readonly CACHE_TTL_MIN = 30; // Minimum TTL in seconds
  private static readonly CACHE_TTL_MAX = 60; // Maximum TTL in seconds

  private static getPrisma(): PrismaClient {
    return getPrismaClient();
  }

  private static getRedis() {
    return getRedisClient();
  }

  /**
   * Get financial summary for user with role-based filtering
   * T030: Create financial summary service with aggregation logic
   * T031: Implement financial data caching with Redis (30-60s TTL)
   * T032: Implement role-based data filtering
   * T033: Implement pending transaction separation logic
   * T034: Implement trend calculation
   */
  static async getFinancialSummary(
    userId: string,
    role: UserRoleType,
    startDate: Date,
    endDate: Date,
    refresh: boolean = false,
  ): Promise<FinancialSummary> {
    const dateRange = this.getDateRangeKey(startDate, endDate);
    const cacheKey = `financial:summary:${userId}:${dateRange}`;

    // Check cache first (unless refresh is requested)
    if (!refresh) {
      const cached = await this.getCachedSummary(cacheKey);
      if (cached) {
        logger.debug("Financial summary cache hit", { userId, dateRange });
        return cached;
      }
    }

    logger.debug("Financial summary cache miss, querying database", {
      userId,
      role,
      dateRange,
    });

    // Query database based on role
    let transactions: Array<{
      id: string;
      userId: string;
      type: TransactionType;
      amount: Decimal;
      approvalStatus: ApprovalStatus;
    }> = [];

    if (role === USER_ROLES.EMPLOYEE) {
      // Employee: own transactions only
      transactions = await this.getPrisma().transaction.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          userId: true,
          type: true,
          amount: true,
          approvalStatus: true,
        },
      });
    } else if (role === USER_ROLES.BOSS || role === USER_ROLES.DEV) {
      // Boss/Dev: all transactions
      transactions = await this.getPrisma().transaction.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          userId: true,
          type: true,
          amount: true,
          approvalStatus: true,
        },
      });
    } else if (role === USER_ROLES.INVESTOR) {
      // Investor: aggregated only (no individual transactions)
      // Use aggregate query for better performance
      const incomeAgg = await this.getPrisma().transaction.aggregate({
        where: {
          type: "income",
          approvalStatus: "approved",
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      const expenseAgg = await this.getPrisma().transaction.aggregate({
        where: {
          type: "expense",
          approvalStatus: "approved",
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      const income = incomeAgg._sum.amount ? Number(incomeAgg._sum.amount) : 0;
      const expenses = expenseAgg._sum.amount
        ? Number(expenseAgg._sum.amount)
        : 0;
      const cashflow = income - expenses;

      // Get pending count (aggregated)
      const pendingAgg = await this.getPrisma().transaction.aggregate({
        where: {
          approvalStatus: "pending",
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      const pendingCount = pendingAgg._count?.id || 0;
      const pendingAmount = pendingAgg._sum?.amount
        ? Number(pendingAgg._sum.amount)
        : 0;

      // Calculate balance (sum of all approved transactions)
      const balance = income - expenses;

      // Calculate trends
      const trendData = await this.calculateTrends(
        startDate,
        endDate,
        income,
        expenses,
        cashflow,
      );

      const summary: FinancialSummary = {
        balance,
        income,
        expenses,
        cashflow,
        pendingCount,
        pendingAmount,
        trendData,
        calculatedAt: new Date(),
      };

      // Cache the result
      await this.cacheSummary(cacheKey, summary);

      return summary;
    }

    // Calculate summary from transactions (Employee, Boss, Dev)
    const approvedTransactions = transactions.filter(
      (t) => t.approvalStatus === "approved",
    );
    const pendingTransactions = transactions.filter(
      (t) => t.approvalStatus === "pending",
    );

    const income = approvedTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = approvedTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const cashflow = income - expenses;
    const balance = income - expenses;

    const pendingCount = pendingTransactions.length;
    const pendingAmount = pendingTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );

    // Calculate trends
    const trendData = await this.calculateTrends(
      startDate,
      endDate,
      income,
      expenses,
      cashflow,
    );

    const summary: FinancialSummary = {
      balance,
      income,
      expenses,
      cashflow,
      pendingCount,
      pendingAmount,
      trendData,
      calculatedAt: new Date(),
    };

    // Cache the result
    await this.cacheSummary(cacheKey, summary);

    return summary;
  }

  /**
   * Get financial summary for date range type (today, week, month)
   * T035: Implement report command handlers for date ranges
   */
  static async getFinancialSummaryByRange(
    userId: string,
    role: UserRoleType,
    rangeType: DateRangeType,
    refresh: boolean = false,
  ): Promise<FinancialSummary> {
    let startDate: Date;
    let endDate: Date;

    switch (rangeType) {
      case "today":
        ({ start: startDate, end: endDate } = getDayRangeWITA());
        break;
      case "week":
        ({ start: startDate, end: endDate } = getWeekRangeWITA());
        break;
      case "month":
        ({ start: startDate, end: endDate } = getMonthRangeWITA());
        break;
      default:
        // Custom range format: "custom:YYYY-MM-DD:YYYY-MM-DD"
        if (typeof rangeType === "string" && rangeType.startsWith("custom:")) {
          const parts = rangeType.split(":");
          if (parts.length === 3 && parts[1] && parts[2]) {
            startDate = new Date(parts[1]);
            endDate = new Date(parts[2]);
          } else {
            throw new Error(`Invalid custom date range format: ${rangeType}`);
          }
        } else {
          // Default to today
          ({ start: startDate, end: endDate } = getDayRangeWITA());
        }
        break;
    }

    return this.getFinancialSummary(userId, role, startDate, endDate, refresh);
  }

  /**
   * Calculate trends by comparing with previous period
   * T034: Implement trend calculation
   */
  private static async calculateTrends(
    startDate: Date,
    endDate: Date,
    currentIncome: number,
    currentExpenses: number,
    currentCashflow: number,
  ): Promise<TrendData> {
    // Calculate previous period (same duration before startDate)
    const duration = endDate.getTime() - startDate.getTime();
    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - duration);

    // Get previous period data (aggregated, no role filtering needed for trend calculation)
    const prevIncomeAgg = await this.getPrisma().transaction.aggregate({
      where: {
        type: "income",
        approvalStatus: "approved",
        timestamp: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
      _sum: { amount: true },
    });

    const prevExpenseAgg = await this.getPrisma().transaction.aggregate({
      where: {
        type: "expense",
        approvalStatus: "approved",
        timestamp: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
      _sum: { amount: true },
    });

    const previousIncome = prevIncomeAgg._sum.amount
      ? Number(prevIncomeAgg._sum.amount)
      : 0;
    const previousExpenses = prevExpenseAgg._sum.amount
      ? Number(prevExpenseAgg._sum.amount)
      : 0;
    const previousCashflow = previousIncome - previousExpenses;

    // Calculate percentage changes
    const incomeChange =
      previousIncome > 0
        ? ((currentIncome - previousIncome) / previousIncome) * 100
        : currentIncome > 0
          ? 100
          : 0;

    const expenseChange =
      previousExpenses > 0
        ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
        : currentExpenses > 0
          ? 100
          : 0;

    const cashflowChange =
      previousCashflow !== 0
        ? ((currentCashflow - previousCashflow) / Math.abs(previousCashflow)) *
          100
        : currentCashflow !== 0
          ? 100
          : 0;

    return {
      incomeChange: Math.round(incomeChange * 100) / 100,
      expenseChange: Math.round(expenseChange * 100) / 100,
      cashflowChange: Math.round(cashflowChange * 100) / 100,
      previousPeriod: {
        income: previousIncome,
        expenses: previousExpenses,
        cashflow: previousCashflow,
      },
    };
  }

  /**
   * Get cached summary from Redis
   * T031: Implement financial data caching
   */
  private static async getCachedSummary(
    cacheKey: string,
  ): Promise<FinancialSummary | null> {
    try {
      const cached = await this.getRedis().get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as FinancialSummary;
        // Convert date strings back to Date objects
        parsed.calculatedAt = new Date(parsed.calculatedAt);
        return parsed;
      }
      return null;
    } catch (error) {
      logger.error("Error reading financial summary cache", {
        error,
        cacheKey,
      });
      return null;
    }
  }

  /**
   * Cache summary in Redis with TTL
   * T031: Implement financial data caching
   */
  private static async cacheSummary(
    cacheKey: string,
    summary: FinancialSummary,
  ): Promise<void> {
    try {
      // Random TTL between 30-60 seconds
      const ttl =
        Math.floor(
          Math.random() * (this.CACHE_TTL_MAX - this.CACHE_TTL_MIN + 1),
        ) + this.CACHE_TTL_MIN;

      await this.getRedis().setEx(cacheKey, ttl, JSON.stringify(summary));
      logger.debug("Financial summary cached", { cacheKey, ttl });
    } catch (error) {
      logger.error("Error caching financial summary", { error, cacheKey });
      // Don't throw - caching is best effort
    }
  }

  /**
   * Invalidate cache for user
   * T039: Implement on-demand cache refresh mechanism
   */
  static async invalidateCache(
    userId: string,
    dateRange?: string,
  ): Promise<void> {
    try {
      if (dateRange) {
        const cacheKey = `financial:summary:${userId}:${dateRange}`;
        await this.getRedis().del(cacheKey);
        logger.debug("Financial summary cache invalidated", { cacheKey });
      } else {
        // Invalidate all date ranges for user
        // Note: Redis doesn't support pattern deletion directly, need to scan
        // For now, invalidate common ranges
        const ranges = ["today", "week", "month"];
        for (const range of ranges) {
          const cacheKey = `financial:summary:${userId}:${range}`;
          await this.getRedis().del(cacheKey);
        }
        logger.debug("All financial summary cache invalidated for user", {
          userId,
        });
      }
    } catch (error) {
      logger.error("Error invalidating financial summary cache", {
        error,
        userId,
        dateRange,
      });
    }
  }

  /**
   * Get date range key for cache
   */
  private static getDateRangeKey(startDate: Date, endDate: Date): string {
    const today = getDayRangeWITA();
    const week = getWeekRangeWITA();
    const month = getMonthRangeWITA();

    // Check if it's today
    if (
      startDate.getTime() === today.start.getTime() &&
      endDate.getTime() === today.end.getTime()
    ) {
      return "today";
    }

    // Check if it's this week
    if (
      startDate.getTime() === week.start.getTime() &&
      endDate.getTime() === week.end.getTime()
    ) {
      return "week";
    }

    // Check if it's this month
    if (
      startDate.getTime() === month.start.getTime() &&
      endDate.getTime() === month.end.getTime()
    ) {
      return "month";
    }

    // Custom range
    return `custom:${startDate.toISOString().split("T")[0]}:${endDate.toISOString().split("T")[0]}`;
  }
}
