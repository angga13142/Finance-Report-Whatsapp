import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Recommendation learning service
 * Learns from user acknowledgment patterns to improve future recommendations
 */

export interface LearningData {
  recommendationId: string;
  userId: string;
  recommendationType: string;
  acknowledged: boolean;
  dismissed: boolean;
  actionTaken?: string;
  feedbackScore?: number; // 1-5 rating
  timestamp: Date;
}

export interface RecommendationPerformance {
  type: string;
  totalShown: number;
  acknowledgedCount: number;
  dismissedCount: number;
  acknowledgmentRate: number;
  averageFeedback?: number;
  lastUpdated: Date;
}

export class RecommendationLearningService {
  private static instance: RecommendationLearningService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): RecommendationLearningService {
    if (!RecommendationLearningService.instance) {
      RecommendationLearningService.instance =
        new RecommendationLearningService();
    }
    return RecommendationLearningService.instance;
  }

  /**
   * Record user interaction with recommendation
   */
  async recordInteraction(data: LearningData): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO recommendation_learning 
        (id, recommendation_id, user_id, recommendation_type, acknowledged, dismissed, action_taken, feedback_score, timestamp)
        VALUES (
          gen_random_uuid()::text,
          ${data.recommendationId},
          ${data.userId},
          ${data.recommendationType},
          ${data.acknowledged},
          ${data.dismissed},
          ${data.actionTaken || null},
          ${data.feedbackScore || null},
          ${data.timestamp}
        )
      `;

      logger.info("Recommendation interaction recorded", {
        recommendationId: data.recommendationId,
        userId: data.userId,
        acknowledged: data.acknowledged,
        dismissed: data.dismissed,
      });

      // Update performance metrics
      await this.updatePerformanceMetrics(data.recommendationType);
    } catch (error) {
      logger.error("Failed to record recommendation interaction", {
        error,
        data,
      });
      throw error;
    }
  }

  /**
   * Get recommendation performance metrics
   */
  async getPerformanceMetrics(
    recommendationType?: string,
  ): Promise<RecommendationPerformance[]> {
    try {
      let query;

      if (recommendationType) {
        query = this.prisma.$queryRaw<
          Array<{
            recommendation_type: string;
            total_shown: bigint;
            acknowledged_count: bigint;
            dismissed_count: bigint;
            avg_feedback: number | null;
            last_updated: Date;
          }>
        >`
          SELECT 
            recommendation_type,
            COUNT(*) as total_shown,
            SUM(CASE WHEN acknowledged = true THEN 1 ELSE 0 END) as acknowledged_count,
            SUM(CASE WHEN dismissed = true THEN 1 ELSE 0 END) as dismissed_count,
            AVG(feedback_score) as avg_feedback,
            MAX(timestamp) as last_updated
          FROM recommendation_learning
          WHERE recommendation_type = ${recommendationType}
          GROUP BY recommendation_type
        `;
      } else {
        query = this.prisma.$queryRaw<
          Array<{
            recommendation_type: string;
            total_shown: bigint;
            acknowledged_count: bigint;
            dismissed_count: bigint;
            avg_feedback: number | null;
            last_updated: Date;
          }>
        >`
          SELECT 
            recommendation_type,
            COUNT(*) as total_shown,
            SUM(CASE WHEN acknowledged = true THEN 1 ELSE 0 END) as acknowledged_count,
            SUM(CASE WHEN dismissed = true THEN 1 ELSE 0 END) as dismissed_count,
            AVG(feedback_score) as avg_feedback,
            MAX(timestamp) as last_updated
          FROM recommendation_learning
          GROUP BY recommendation_type
          ORDER BY total_shown DESC
        `;
      }

      const results = await query;

      return results.map((r) => {
        const total = Number(r.total_shown);
        const acknowledged = Number(r.acknowledged_count);

        return {
          type: r.recommendation_type,
          totalShown: total,
          acknowledgedCount: acknowledged,
          dismissedCount: Number(r.dismissed_count),
          acknowledgmentRate: total > 0 ? (acknowledged / total) * 100 : 0,
          averageFeedback: r.avg_feedback || undefined,
          lastUpdated: r.last_updated,
        };
      });
    } catch (error) {
      logger.error("Failed to fetch performance metrics", { error });
      return [];
    }
  }

  /**
   * Update cached performance metrics
   */
  private async updatePerformanceMetrics(
    recommendationType: string,
  ): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics(recommendationType);

      if (metrics.length > 0) {
        const metric = metrics[0];

        await this.prisma.$executeRaw`
          INSERT INTO recommendation_performance 
          (recommendation_type, total_shown, acknowledged_count, dismissed_count, acknowledgment_rate, average_feedback, updated_at)
          VALUES (
            ${recommendationType},
            ${metric.totalShown},
            ${metric.acknowledgedCount},
            ${metric.dismissedCount},
            ${metric.acknowledgmentRate},
            ${metric.averageFeedback || null},
            NOW()
          )
          ON CONFLICT (recommendation_type)
          DO UPDATE SET
            total_shown = ${metric.totalShown},
            acknowledged_count = ${metric.acknowledgedCount},
            dismissed_count = ${metric.dismissedCount},
            acknowledgment_rate = ${metric.acknowledgmentRate},
            average_feedback = ${metric.averageFeedback || null},
            updated_at = NOW()
        `;
      }
    } catch (error) {
      logger.error("Failed to update performance metrics", {
        error,
        recommendationType,
      });
    }
  }

  /**
   * Get user-specific recommendation preferences
   */
  async getUserPreferences(userId: string): Promise<{
    preferredTypes: string[];
    avoidedTypes: string[];
    averageResponseTime: number; // seconds
  }> {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          recommendation_type: string;
          acknowledged_count: bigint;
          dismissed_count: bigint;
        }>
      >`
        SELECT 
          recommendation_type,
          SUM(CASE WHEN acknowledged = true THEN 1 ELSE 0 END) as acknowledged_count,
          SUM(CASE WHEN dismissed = true THEN 1 ELSE 0 END) as dismissed_count
        FROM recommendation_learning
        WHERE user_id = ${userId}
        GROUP BY recommendation_type
      `;

      const preferredTypes: string[] = [];
      const avoidedTypes: string[] = [];

      for (const result of results) {
        const acknowledged = Number(result.acknowledged_count);
        const dismissed = Number(result.dismissed_count);
        const total = acknowledged + dismissed;

        if (total >= 3) {
          // Need at least 3 interactions to be meaningful
          const acknowledgmentRate = (acknowledged / total) * 100;

          if (acknowledgmentRate >= 70) {
            preferredTypes.push(result.recommendation_type);
          } else if (acknowledgmentRate <= 30) {
            avoidedTypes.push(result.recommendation_type);
          }
        }
      }

      // Calculate average response time (placeholder - would need actual timing data)
      const averageResponseTime = 300; // 5 minutes default

      return {
        preferredTypes,
        avoidedTypes,
        averageResponseTime,
      };
    } catch (error) {
      logger.error("Failed to fetch user preferences", { error, userId });
      return {
        preferredTypes: [],
        avoidedTypes: [],
        averageResponseTime: 300,
      };
    }
  }

  /**
   * Adjust recommendation confidence based on learning
   */
  async adjustConfidence(
    recommendationType: string,
    baseConfidence: number,
  ): Promise<number> {
    try {
      const metrics = await this.getPerformanceMetrics(recommendationType);

      if (metrics.length === 0 || metrics[0].totalShown < 10) {
        // Not enough data, return base confidence
        return baseConfidence;
      }

      const metric = metrics[0];

      // Adjust confidence based on acknowledgment rate
      let adjustedConfidence = baseConfidence;

      if (metric.acknowledgmentRate >= 80) {
        // High acknowledgment rate - increase confidence
        adjustedConfidence = Math.min(100, baseConfidence * 1.2);
      } else if (metric.acknowledgmentRate >= 60) {
        // Medium acknowledgment rate - small increase
        adjustedConfidence = Math.min(100, baseConfidence * 1.1);
      } else if (metric.acknowledgmentRate <= 30) {
        // Low acknowledgment rate - decrease confidence
        adjustedConfidence = Math.max(0, baseConfidence * 0.8);
      } else if (metric.acknowledgmentRate <= 50) {
        // Below average - small decrease
        adjustedConfidence = Math.max(0, baseConfidence * 0.9);
      }

      // Factor in average feedback score if available
      if (metric.averageFeedback) {
        const feedbackFactor = metric.averageFeedback / 5; // Normalize to 0-1
        adjustedConfidence = adjustedConfidence * (0.8 + 0.4 * feedbackFactor);
      }

      logger.debug("Confidence adjusted based on learning", {
        type: recommendationType,
        baseConfidence,
        adjustedConfidence,
        acknowledgmentRate: metric.acknowledgmentRate,
      });

      return Math.round(adjustedConfidence);
    } catch (error) {
      logger.error("Failed to adjust confidence", {
        error,
        recommendationType,
      });
      return baseConfidence;
    }
  }

  /**
   * Get recommendation insights
   */
  async getInsights(_period: "daily" | "weekly" | "monthly"): Promise<{
    topPerformingTypes: string[];
    lowPerformingTypes: string[];
    trends: Array<{
      type: string;
      trend: "improving" | "declining" | "stable";
      change: number;
    }>;
  }> {
    try {
      const metrics = await this.getPerformanceMetrics();

      // Sort by acknowledgment rate
      const sorted = [...metrics].sort(
        (a, b) => b.acknowledgmentRate - a.acknowledgmentRate,
      );

      const topPerformingTypes = sorted
        .filter((m) => m.totalShown >= 5)
        .slice(0, 3)
        .map((m) => m.type);

      const lowPerformingTypes = sorted
        .filter((m) => m.totalShown >= 5)
        .slice(-3)
        .map((m) => m.type);

      // Calculate trends (simplified - would need historical data in production)
      const trends = metrics.map((m) => ({
        type: m.type,
        trend: "stable" as "improving" | "declining" | "stable",
        change: 0,
      }));

      return {
        topPerformingTypes,
        lowPerformingTypes,
        trends,
      };
    } catch (error) {
      logger.error("Failed to get recommendation insights", { error });
      return {
        topPerformingTypes: [],
        lowPerformingTypes: [],
        trends: [],
      };
    }
  }

  /**
   * Record feedback for a recommendation
   */
  async recordFeedback(
    recommendationId: string,
    userId: string,
    score: number,
    comment?: string,
  ): Promise<void> {
    try {
      if (score < 1 || score > 5) {
        throw new Error("Feedback score must be between 1 and 5");
      }

      await this.prisma.$executeRaw`
        INSERT INTO recommendation_feedback 
        (id, recommendation_id, user_id, score, comment, created_at)
        VALUES (
          gen_random_uuid()::text,
          ${recommendationId},
          ${userId},
          ${score},
          ${comment || null},
          NOW()
        )
      `;

      logger.info("Recommendation feedback recorded", {
        recommendationId,
        userId,
        score,
      });
    } catch (error) {
      logger.error("Failed to record recommendation feedback", {
        error,
        recommendationId,
      });
      throw error;
    }
  }

  /**
   * Get learning statistics
   */
  async getStatistics(): Promise<{
    totalInteractions: number;
    overallAcknowledgmentRate: number;
    averageFeedbackScore: number;
    mostEffectiveType: string;
    leastEffectiveType: string;
  }> {
    try {
      const metrics = await this.getPerformanceMetrics();

      if (metrics.length === 0) {
        return {
          totalInteractions: 0,
          overallAcknowledgmentRate: 0,
          averageFeedbackScore: 0,
          mostEffectiveType: "none",
          leastEffectiveType: "none",
        };
      }

      const totalInteractions = metrics.reduce(
        (sum, m) => sum + m.totalShown,
        0,
      );
      const totalAcknowledged = metrics.reduce(
        (sum, m) => sum + m.acknowledgedCount,
        0,
      );
      const overallAcknowledgmentRate =
        totalInteractions > 0
          ? (totalAcknowledged / totalInteractions) * 100
          : 0;

      const feedbackScores = metrics
        .map((m) => m.averageFeedback)
        .filter((f): f is number => f !== undefined);
      const averageFeedbackScore =
        feedbackScores.length > 0
          ? feedbackScores.reduce((sum, s) => sum + s, 0) /
            feedbackScores.length
          : 0;

      const sorted = [...metrics].sort(
        (a, b) => b.acknowledgmentRate - a.acknowledgmentRate,
      );
      const mostEffectiveType = sorted[0]?.type || "none";
      const leastEffectiveType = sorted[sorted.length - 1]?.type || "none";

      return {
        totalInteractions,
        overallAcknowledgmentRate,
        averageFeedbackScore,
        mostEffectiveType,
        leastEffectiveType,
      };
    } catch (error) {
      logger.error("Failed to get learning statistics", { error });
      return {
        totalInteractions: 0,
        overallAcknowledgmentRate: 0,
        averageFeedbackScore: 0,
        mostEffectiveType: "none",
        leastEffectiveType: "none",
      };
    }
  }
}

export const recommendationLearning =
  RecommendationLearningService.getInstance();
