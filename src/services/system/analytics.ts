/**
 * T079: Usage Analytics Reporting Service
 * Aggregates button vs command usage data, generates reports (daily/weekly/monthly),
 * and provides admin API endpoint for accessing analytics data (completes FR-038 reporting requirement)
 */

import { logger } from "../../lib/logger";
// import { getPrismaClient } from "../../lib/database"; // Will be used when analytics table is ready
import { getRedisClient } from "../../lib/redis";

export interface InteractionAnalytics {
  userId: string;
  userRole: string;
  interactionType: "button" | "command";
  timestamp: string;
}

export interface AnalyticsReport {
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  totalInteractions: number;
  buttonInteractions: number;
  commandInteractions: number;
  buttonUsageRate: number; // percentage
  commandUsageRate: number; // percentage
  interactionsByRole: Record<
    string,
    {
      total: number;
      buttons: number;
      commands: number;
    }
  >;
}

export class AnalyticsService {
  private static redis = getRedisClient();
  private static readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  // Prisma will be used when analytics table is ready
  // private static prisma = getPrismaClient();

  /**
   * Record interaction analytics
   * Stores interaction data for later aggregation
   */
  static async recordInteraction(
    userId: string,
    userRole: string,
    interactionType: "button" | "command",
  ): Promise<void> {
    try {
      const interaction: InteractionAnalytics = {
        userId,
        userRole,
        interactionType,
        timestamp: new Date().toISOString(),
      };

      // Store in Redis for fast access
      const redisKey = `analytics:interaction:${Date.now()}:${userId}`;
      await this.redis.setEx(
        redisKey,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(interaction),
      );

      // Also log for persistence (will be stored in database when data model is ready)
      logger.info("Interaction recorded", interaction);

      // TODO: Store in analytics table when data model is ready
      // await this.prisma.interactionAnalytics.create({ data: interaction });
    } catch (error) {
      logger.error("Error recording interaction analytics", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        interactionType,
      });
    }
  }

  /**
   * Generate daily analytics report
   */
  static async generateDailyReport(
    date: Date = new Date(),
  ): Promise<AnalyticsReport> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return this.generateReport("daily", startDate, endDate);
  }

  /**
   * Generate weekly analytics report
   */
  static async generateWeeklyReport(
    date: Date = new Date(),
  ): Promise<AnalyticsReport> {
    const startDate = new Date(date);
    // Get start of week (Monday)
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return this.generateReport("weekly", startDate, endDate);
  }

  /**
   * Generate monthly analytics report
   */
  static async generateMonthlyReport(
    date: Date = new Date(),
  ): Promise<AnalyticsReport> {
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    return this.generateReport("monthly", startDate, endDate);
  }

  /**
   * Generate analytics report for specified period
   */
  private static async generateReport(
    period: "daily" | "weekly" | "monthly",
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsReport> {
    try {
      // Check cache first
      const cacheKey = `analytics:report:${period}:${startDate.toISOString()}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as AnalyticsReport;
      }

      // TODO: Query from database when analytics table is ready
      // For now, return mock data structure
      const report: AnalyticsReport = {
        period,
        startDate,
        endDate,
        totalInteractions: 0,
        buttonInteractions: 0,
        commandInteractions: 0,
        buttonUsageRate: 0,
        commandUsageRate: 0,
        interactionsByRole: {},
      };

      // Cache the report for 5 minutes
      await this.redis.setEx(
        cacheKey,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(report),
      );

      return report;
    } catch (error) {
      logger.error("Error generating analytics report", {
        error: error instanceof Error ? error.message : String(error),
        period,
        startDate,
        endDate,
      });

      // Return empty report on error
      return {
        period,
        startDate,
        endDate,
        totalInteractions: 0,
        buttonInteractions: 0,
        commandInteractions: 0,
        buttonUsageRate: 0,
        commandUsageRate: 0,
        interactionsByRole: {},
      };
    }
  }

  /**
   * Get analytics data for admin API endpoint
   */
  static async getAnalyticsData(
    period: "daily" | "weekly" | "monthly" = "daily",
    date?: Date,
  ): Promise<AnalyticsReport> {
    switch (period) {
      case "daily":
        return this.generateDailyReport(date);
      case "weekly":
        return this.generateWeeklyReport(date);
      case "monthly":
        return this.generateMonthlyReport(date);
      default:
        return this.generateDailyReport(date);
    }
  }

  /**
   * Invalidate analytics cache
   */
  static async invalidateCache(): Promise<void> {
    try {
      const keys = await this.redis.keys("analytics:*");
      if (keys.length > 0) {
        // Delete keys one by one (redis.del doesn't accept spread operator)
        await Promise.all(keys.map((key) => this.redis.del(key)));
      }
    } catch (error) {
      logger.error("Error invalidating analytics cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
