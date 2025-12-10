import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import RecommendationModel from "../../models/recommendation";
import { RecommendationContent } from "../../models/recommendation";
import { UserModel } from "../../models/user";

/**
 * Recommendation Handler
 * Handles recommendation-related interactions and action buttons
 */
export class RecommendationHandler {
  /**
   * Handle [📊 Lihat Detail] button - Show detailed recommendation info
   */
  static async handleViewDetail(
    message: Message,
    userId: string,
    recommendationId: string,
  ): Promise<void> {
    logger.info("Handling view detail request", { userId, recommendationId });

    try {
      const recommendation =
        await RecommendationModel.getById(recommendationId);

      if (!recommendation) {
        await message.reply("❌ Rekomendasi tidak ditemukan.");
        return;
      }

      const content =
        recommendation.content as unknown as RecommendationContent;

      // Build detailed message
      let response = `📋 *Detail Rekomendasi*\n\n`;
      response += `${this.getPriorityEmoji(recommendation.priority)} *${content.title}*\n\n`;

      // Basic info
      response += `📅 *Dibuat:* ${recommendation.generatedAt.toLocaleString("id-ID")}\n`;
      response += `🎯 *Priority:* ${recommendation.priority.toUpperCase()}\n`;
      response += `✅ *Confidence:* ${recommendation.confidenceScore}%\n`;
      response += `👥 *Target Roles:* ${recommendation.targetRoles.join(", ")}\n\n`;

      // Message
      response += `💬 *Pesan:*\n${content.message}\n\n`;

      // Anomaly data
      if (content.anomalyData) {
        response += `📊 *Data Anomali:*\n`;
        response += `• Tipe: ${content.anomalyData.type}\n`;
        response += `• Nilai Saat Ini: ${this.formatValue(content.anomalyData.current)}\n`;
        response += `• Baseline: ${this.formatValue(content.anomalyData.baseline)}\n`;
        response += `• Variance: ${content.anomalyData.variance.toFixed(1)}%\n`;
        response += `• Threshold: ${content.anomalyData.threshold}%\n\n`;
      }

      // Recommendations
      response += `💡 *Rekomendasi Aksi:*\n`;
      content.recommendations.forEach((rec, index) => {
        response += `${index + 1}. ${rec}\n`;
      });
      response += `\n`;

      // Action required
      if (content.actionRequired) {
        response += `⚠️ *Action Required:*\n${content.actionRequired}\n\n`;
      }

      // Related data
      if (content.relatedData) {
        response += `📈 *Data Terkait:*\n`;
        Object.entries(content.relatedData).forEach(([key, value]) => {
          response += `• ${this.formatKey(key)}: ${this.formatValue(value as number)}\n`;
        });
        response += `\n`;
      }

      // Actions available
      response += `_Aksi yang tersedia:_\n`;
      response += `• Reply \`/dismiss ${recommendationId.slice(0, 8)}\` untuk dismiss\n`;
      response += `• Reply \`/discuss ${recommendationId.slice(0, 8)}\` untuk diskusi\n`;

      await message.reply(response);

      logger.info("Detail view sent", { userId, recommendationId });
    } catch (error) {
      logger.error("Failed to show recommendation detail", {
        userId,
        recommendationId,
        error,
      });
      await message.reply(
        "❌ Gagal menampilkan detail rekomendasi. Silakan coba lagi.",
      );
    }
  }

  /**
   * Handle [💬 Diskusi dengan Tim] button - Start team discussion
   */
  static async handleDiscussWithTeam(
    message: Message,
    userId: string,
    recommendationId: string,
  ): Promise<void> {
    logger.info("Handling discuss with team request", {
      userId,
      recommendationId,
    });

    try {
      const recommendation =
        await RecommendationModel.getById(recommendationId);

      if (!recommendation) {
        await message.reply("❌ Rekomendasi tidak ditemukan.");
        return;
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        await message.reply("❌ User tidak ditemukan.");
        return;
      }

      const content =
        recommendation.content as unknown as RecommendationContent;

      // Build discussion thread message
      let response = `💬 *Diskusi Tim - ${content.title}*\n\n`;
      response += `👤 Dimulai oleh: ${user.name || user.phoneNumber}\n`;
      response += `📅 Waktu: ${new Date().toLocaleString("id-ID")}\n\n`;

      response += `📋 *Topik Diskusi:*\n${content.message}\n\n`;

      response += `🎯 *Poin untuk Diskusi:*\n`;
      content.recommendations.slice(0, 3).forEach((rec, index) => {
        response += `${index + 1}. ${rec}\n`;
      });
      response += `\n`;

      response += `💡 *Tips Diskusi:*\n`;
      response += `• Share insights dan perspektif Anda\n`;
      response += `• Diskusikan root cause dari anomali\n`;
      response += `• Tentukan action items dan PIC\n`;
      response += `• Set timeline untuk follow-up\n\n`;

      response += `_Thread ini akan di-share ke team roles terkait._\n`;
      response += `_Reply di chat ini untuk melanjutkan diskusi._\n`;

      await message.reply(response);

      // TODO: In future, implement group chat creation or thread notification
      // For now, just log the discussion start
      logger.info("Team discussion started", {
        userId,
        userName: user.name,
        recommendationId,
        title: content.title,
      });
    } catch (error) {
      logger.error("Failed to start team discussion", {
        userId,
        recommendationId,
        error,
      });
      await message.reply("❌ Gagal memulai diskusi. Silakan coba lagi.");
    }
  }

  /**
   * Handle dismiss command - Dismiss recommendation
   */
  static async handleDismiss(
    message: Message,
    userId: string,
    recommendationId: string,
  ): Promise<void> {
    logger.info("Handling dismiss request", { userId, recommendationId });

    try {
      const recommendation =
        await RecommendationModel.getById(recommendationId);

      if (!recommendation) {
        await message.reply("❌ Rekomendasi tidak ditemukan.");
        return;
      }

      // Dismiss recommendation for this user
      await RecommendationModel.dismissByUser(recommendationId, userId);

      const content =
        recommendation.content as unknown as RecommendationContent;

      let response = `✅ *Rekomendasi Dismissed*\n\n`;
      response += `Rekomendasi "${content.title}" telah di-dismiss untuk Anda.\n`;
      response += `Anda tidak akan menerima notifikasi lagi untuk rekomendasi ini.\n\n`;
      response += `_Note: Rekomendasi masih aktif untuk user lain yang belum dismiss._\n`;

      await message.reply(response);

      logger.info("Recommendation dismissed", { userId, recommendationId });
    } catch (error) {
      logger.error("Failed to dismiss recommendation", {
        userId,
        recommendationId,
        error,
      });
      await message.reply("❌ Gagal dismiss rekomendasi. Silakan coba lagi.");
    }
  }

  /**
   * Handle list active recommendations
   */
  static async handleListActive(
    message: Message,
    userId: string,
    userRole: string,
  ): Promise<void> {
    logger.info("Handling list active recommendations", { userId, userRole });

    try {
      const recommendations = await RecommendationModel.getActiveForUser(
        userId,
        userRole as never,
        10,
      );

      if (recommendations.length === 0) {
        await message.reply("✅ Tidak ada rekomendasi aktif saat ini.");
        return;
      }

      let response = `📋 *Rekomendasi Aktif* (${recommendations.length})\n\n`;

      recommendations.forEach((rec, index) => {
        const content = rec.content as unknown as RecommendationContent;
        const priorityEmoji = this.getPriorityEmoji(rec.priority);

        response += `${index + 1}. ${priorityEmoji} *${content.title}*\n`;
        response += `   Priority: ${rec.priority} | Confidence: ${rec.confidenceScore}%\n`;
        response += `   ID: \`${rec.id.slice(0, 8)}\`\n`;
        response += `   Created: ${rec.generatedAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}\n\n`;
      });

      response += `_Reply dengan \`/detail <ID>\` untuk melihat detail._\n`;

      await message.reply(response);

      logger.info("Active recommendations listed", {
        userId,
        count: recommendations.length,
      });
    } catch (error) {
      logger.error("Failed to list active recommendations", { userId, error });
      await message.reply(
        "❌ Gagal mengambil daftar rekomendasi. Silakan coba lagi.",
      );
    }
  }

  /**
   * Get priority emoji
   */
  private static getPriorityEmoji(priority: string): string {
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
   * Format key for display
   */
  private static formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Format value for display
   */
  private static formatValue(value: number | string | boolean): string {
    if (typeof value === "boolean") {
      return value ? "Ya" : "Tidak";
    }

    if (typeof value === "string") {
      return value;
    }

    // If looks like currency (large number)
    if (value > 1000) {
      return `Rp ${value.toLocaleString("id-ID")}`;
    }

    // If looks like percentage (0-100 range)
    if (value >= 0 && value <= 100 && Number.isInteger(value)) {
      return `${value}%`;
    }

    return value.toFixed(2);
  }
}

export default RecommendationHandler;
