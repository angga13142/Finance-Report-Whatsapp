import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";
import type {
  RecommendationType,
  RecommendationPriority,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Recommendation content structure
 */
export interface RecommendationContent {
  title: string;
  message: string;
  anomalyData?: {
    type: string;
    current: number;
    baseline: number;
    variance: number;
    threshold: number;
  };
  recommendations: string[];
  actionRequired?: string;
  relatedData?: Record<string, unknown>;
}

/**
 * Recommendation creation parameters
 */
export interface CreateRecommendationParams {
  type: RecommendationType;
  priority: RecommendationPriority;
  confidenceScore: number;
  targetRoles: UserRole[];
  content: RecommendationContent;
}

/**
 * Recommendation model operations
 * Handles CRUD operations, status tracking, and dismissal management
 */
export class RecommendationModel {
  /**
   * Create a new recommendation
   */
  static async create(
    params: CreateRecommendationParams,
  ): Promise<{ id: string; generatedAt: Date }> {
    logger.info("Creating recommendation", {
      type: params.type,
      priority: params.priority,
      confidenceScore: params.confidenceScore,
      targetRoles: params.targetRoles,
    });

    const recommendation = await prisma.recommendation.create({
      data: {
        type: params.type,
        priority: params.priority,
        confidenceScore: params.confidenceScore,
        targetRoles: params.targetRoles as string[],
        content: params.content as never,
      },
      select: {
        id: true,
        generatedAt: true,
      },
    });

    logger.info("Recommendation created", {
      id: recommendation.id,
      generatedAt: recommendation.generatedAt,
    });

    return recommendation;
  }

  /**
   * Get recommendation by ID
   */
  static async getById(id: string) {
    return prisma.recommendation.findUnique({
      where: { id },
    });
  }

  /**
   * Get recent recommendations for a specific role
   */
  static async getRecentForRole(
    role: UserRole,
    limit: number = 10,
    hoursBack: number = 24,
  ) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    return prisma.recommendation.findMany({
      where: {
        targetRoles: {
          has: role,
        },
        generatedAt: {
          gte: cutoffTime,
        },
      },
      orderBy: [
        { priority: "desc" },
        { confidenceScore: "desc" },
        { generatedAt: "desc" },
      ],
      take: limit,
    });
  }

  /**
   * Get unacknowledged critical recommendations
   */
  static async getUnacknowledgedCritical(role: UserRole) {
    return prisma.recommendation.findMany({
      where: {
        targetRoles: {
          has: role,
        },
        priority: "critical",
        acknowledgedAt: null,
      },
      orderBy: [{ confidenceScore: "desc" }, { generatedAt: "desc" }],
    });
  }

  /**
   * Mark recommendation as acknowledged
   */
  static async markAsAcknowledged(id: string): Promise<void> {
    logger.info("Marking recommendation as acknowledged", { id });

    await prisma.recommendation.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Dismiss recommendation for a specific user
   */
  static async dismissByUser(id: string, userId: string): Promise<void> {
    logger.info("Dismissing recommendation for user", { id, userId });

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: { dismissedByUsers: true },
    });

    if (!recommendation) {
      throw new Error(`Recommendation ${id} not found`);
    }

    // Add user to dismissed list if not already there
    if (!recommendation.dismissedByUsers.includes(userId)) {
      await prisma.recommendation.update({
        where: { id },
        data: {
          dismissedByUsers: {
            push: userId,
          },
        },
      });
    }
  }

  /**
   * Check if recommendation is dismissed by user
   */
  static async isDismissedByUser(id: string, userId: string): Promise<boolean> {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: { dismissedByUsers: true },
    });

    if (!recommendation) {
      return false;
    }

    return recommendation.dismissedByUsers.includes(userId);
  }

  /**
   * Get recommendations not dismissed by user
   */
  static async getActiveForUser(
    userId: string,
    role: UserRole,
    limit: number = 10,
  ) {
    const allRecommendations = await this.getRecentForRole(role, limit * 2); // Get more to filter

    // Filter out dismissed ones
    return allRecommendations
      .filter((rec) => !rec.dismissedByUsers.includes(userId))
      .slice(0, limit);
  }

  /**
   * Get recommendation statistics
   */
  static async getStatistics(hoursBack: number = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const [total, bySeverity, byType, avgConfidence] = await Promise.all([
      // Total count
      prisma.recommendation.count({
        where: {
          generatedAt: {
            gte: cutoffTime,
          },
        },
      }),

      // Count by severity
      prisma.recommendation.groupBy({
        by: ["priority"],
        where: {
          generatedAt: {
            gte: cutoffTime,
          },
        },
        _count: true,
      }),

      // Count by type
      prisma.recommendation.groupBy({
        by: ["type"],
        where: {
          generatedAt: {
            gte: cutoffTime,
          },
        },
        _count: true,
      }),

      // Average confidence
      prisma.recommendation.aggregate({
        where: {
          generatedAt: {
            gte: cutoffTime,
          },
        },
        _avg: {
          confidenceScore: true,
        },
      }),
    ]);

    return {
      total,
      bySeverity: bySeverity.map((s) => ({
        priority: s.priority,
        count: s._count,
      })),
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count,
      })),
      avgConfidence: avgConfidence._avg.confidenceScore || 0,
    };
  }

  /**
   * Delete old recommendations
   */
  static async cleanupOld(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    logger.info("Cleaning up old recommendations", {
      cutoffDate,
      daysOld,
    });

    const result = await prisma.recommendation.deleteMany({
      where: {
        generatedAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info("Old recommendations cleaned up", {
      count: result.count,
    });

    return result.count;
  }

  /**
   * Check for duplicate recommendations
   * Prevents creating similar recommendations within a time window
   */
  static async hasDuplicateRecent(
    type: RecommendationType,
    minutesBack: number = 60,
  ): Promise<boolean> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);

    const count = await prisma.recommendation.count({
      where: {
        type,
        generatedAt: {
          gte: cutoffTime,
        },
      },
    });

    return count > 0;
  }

  /**
   * Get recommendations that need delivery
   * Returns recommendations created in the last hour that haven't been acknowledged
   */
  static async getPendingDelivery(minutesBack: number = 60) {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);

    return prisma.recommendation.findMany({
      where: {
        generatedAt: {
          gte: cutoffTime,
        },
        acknowledgedAt: null,
      },
      orderBy: [{ priority: "desc" }, { confidenceScore: "desc" }],
    });
  }
}

export default RecommendationModel;
