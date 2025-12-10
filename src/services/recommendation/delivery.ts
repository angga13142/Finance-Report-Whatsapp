import { Client } from "whatsapp-web.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import RecommendationModel from "../../models/recommendation";
import type { UserRole } from "@prisma/client";
import type { RecommendationContent } from "../../models/recommendation";

const prisma = new PrismaClient();

/**
 * Delivery result for a single user
 */
export interface UserDeliveryResult {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  success: boolean;
  error?: string;
}

/**
 * Overall delivery result
 */
export interface DeliveryResult {
  recommendationId: string;
  targetRoles: UserRole[];
  totalUsers: number;
  delivered: number;
  failed: number;
  userResults: UserDeliveryResult[];
}

/**
 * Recommendation Delivery Service
 * Handles delivery of recommendations via WhatsApp
 */
export class RecommendationDeliveryService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Deliver a recommendation to target users
   */
  async deliverRecommendation(
    recommendationId: string,
  ): Promise<DeliveryResult> {
    logger.info("Delivering recommendation", { recommendationId });

    // Get recommendation
    const recommendation = await RecommendationModel.getById(recommendationId);

    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }

    // Get target users (active users with target roles)
    const targetUsers = await prisma.user.findMany({
      where: {
        role: {
          in: recommendation.targetRoles as UserRole[],
        },
        isActive: true,
      },
      select: {
        id: true,
        phoneNumber: true,
        role: true,
      },
    });

    logger.info("Target users found", {
      recommendationId,
      totalUsers: targetUsers.length,
      targetRoles: recommendation.targetRoles,
    });

    const result: DeliveryResult = {
      recommendationId,
      targetRoles: recommendation.targetRoles as UserRole[],
      totalUsers: targetUsers.length,
      delivered: 0,
      failed: 0,
      userResults: [],
    };

    // Deliver to each user
    for (const user of targetUsers) {
      try {
        // Check if user has dismissed this recommendation
        const isDismissed = await RecommendationModel.isDismissedByUser(
          recommendationId,
          user.id,
        );

        if (isDismissed) {
          logger.debug("Skipping dismissed recommendation for user", {
            userId: user.id,
            recommendationId,
          });

          result.userResults.push({
            userId: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role,
            success: true, // Count as success (user chose to dismiss)
          });

          result.delivered++;
          continue;
        }

        // Format and send message
        await this.sendRecommendationMessage(
          user.phoneNumber,
          recommendation.content as unknown as RecommendationContent,
          recommendation.priority,
          recommendation.confidenceScore,
          recommendationId,
        );

        result.userResults.push({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          success: true,
        });

        result.delivered++;

        logger.info("Recommendation delivered to user", {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          recommendationId,
        });
      } catch (error) {
        logger.error("Failed to deliver recommendation to user", {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          recommendationId,
          error,
        });

        result.userResults.push({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        result.failed++;
      }
    }

    logger.info("Recommendation delivery completed", result);

    return result;
  }

  /**
   * Send recommendation message to a user
   */
  private async sendRecommendationMessage(
    phoneNumber: string,
    content: RecommendationContent,
    priority: string,
    confidenceScore: number,
    recommendationId: string,
  ): Promise<void> {
    // Format priority emoji
    const priorityEmoji = this.getPriorityEmoji(priority);

    // Format confidence level
    const confidenceLevel = this.getConfidenceLevel(confidenceScore);

    // Build message
    let message = `${priorityEmoji} *${content.title}*\n\n`;
    message += `${content.message}\n\n`;

    // Add anomaly data if available
    if (content.anomalyData) {
      message += `📊 *Data Anomali:*\n`;
      message += `• Nilai Saat Ini: ${this.formatValue(content.anomalyData.current)}\n`;
      message += `• Baseline: ${this.formatValue(content.anomalyData.baseline)}\n`;
      message += `• Variance: ${content.anomalyData.variance.toFixed(1)}%\n`;
      message += `• Threshold: ${content.anomalyData.threshold}%\n\n`;
    }

    // Add recommendations
    message += `💡 *Rekomendasi:*\n`;
    content.recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });
    message += `\n`;

    // Add action required
    if (content.actionRequired) {
      message += `⚠️ *Action Required:*\n${content.actionRequired}\n\n`;
    }

    // Add metadata
    message += `🎯 *Priority:* ${priority.toUpperCase()}\n`;
    message += `✅ *Confidence:* ${confidenceScore}% (${confidenceLevel})\n\n`;

    // Add action buttons instruction
    message += `_Untuk detail lebih lanjut atau diskusi, reply dengan:_\n`;
    message += `• \`/detail ${recommendationId.slice(0, 8)}\` - Lihat detail lengkap\n`;
    message += `• \`/dismiss ${recommendationId.slice(0, 8)}\` - Dismiss alert ini\n`;

    // Send message
    const chatId = phoneNumber.replace(/\D/g, "") + "@c.us";
    await this.client.sendMessage(chatId, message);
  }

  /**
   * Deliver pending recommendations
   * Called periodically to ensure recommendations are delivered
   */
  async deliverPending(maxAgeMinutes: number = 60): Promise<DeliveryResult[]> {
    logger.info("Delivering pending recommendations", { maxAgeMinutes });

    const pendingRecommendations =
      await RecommendationModel.getPendingDelivery(maxAgeMinutes);

    logger.info("Pending recommendations found", {
      count: pendingRecommendations.length,
    });

    const results: DeliveryResult[] = [];

    for (const recommendation of pendingRecommendations) {
      try {
        const result = await this.deliverRecommendation(recommendation.id);
        results.push(result);

        // Mark as acknowledged after successful delivery
        if (result.delivered > 0) {
          await RecommendationModel.markAsAcknowledged(recommendation.id);
        }
      } catch (error) {
        logger.error("Failed to deliver pending recommendation", {
          recommendationId: recommendation.id,
          error,
        });
      }
    }

    return results;
  }

  /**
   * Send notification to specific role
   */
  async notifyRole(
    role: UserRole,
    title: string,
    message: string,
    priority: "critical" | "high" | "medium" | "low" = "medium",
  ): Promise<number> {
    logger.info("Sending notification to role", { role, title, priority });

    const users = await prisma.user.findMany({
      where: {
        role,
        isActive: true,
      },
      select: {
        phoneNumber: true,
      },
    });

    let successCount = 0;

    const priorityEmoji = this.getPriorityEmoji(priority);
    const formattedMessage = `${priorityEmoji} *${title}*\n\n${message}`;

    for (const user of users) {
      try {
        const chatId = user.phoneNumber.replace(/\D/g, "") + "@c.us";
        await this.client.sendMessage(chatId, formattedMessage);
        successCount++;
      } catch (error) {
        logger.error("Failed to send notification to user", {
          phoneNumber: user.phoneNumber,
          error,
        });
      }
    }

    logger.info("Role notification completed", {
      role,
      totalUsers: users.length,
      successCount,
    });

    return successCount;
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority.toLowerCase()) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "ℹ️";
      case "low":
        return "💡";
      default:
        return "📢";
    }
  }

  /**
   * Get confidence level label
   */
  private getConfidenceLevel(score: number): string {
    if (score >= 90) return "Sangat Tinggi";
    if (score >= 80) return "Tinggi";
    if (score >= 70) return "Cukup Tinggi";
    if (score >= 60) return "Sedang";
    return "Rendah";
  }

  /**
   * Format value for display
   */
  private formatValue(value: number): string {
    // If looks like currency (large number)
    if (value > 1000) {
      return `Rp ${value.toLocaleString("id-ID")}`;
    }
    return value.toFixed(2);
  }
}

export default RecommendationDeliveryService;
