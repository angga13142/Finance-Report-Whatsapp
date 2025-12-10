import * as cron from "node-cron";
import { logger } from "../../lib/logger";
import { trendingInsights } from "../recommendation/trending";
import { getWhatsAppClient } from "../../bot/client/client";
import { PrismaClient } from "@prisma/client";

/**
 * Monthly insights generation scheduler
 * Runs at month-end to generate trending insights
 */

export class MonthlyInsightsScheduler {
  private static instance: MonthlyInsightsScheduler;
  private scheduledTask: cron.ScheduledTask | null = null;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): MonthlyInsightsScheduler {
    if (!MonthlyInsightsScheduler.instance) {
      MonthlyInsightsScheduler.instance = new MonthlyInsightsScheduler();
    }
    return MonthlyInsightsScheduler.instance;
  }

  /**
   * Initialize monthly insights scheduler
   */
  initialize(): void {
    // Run on the last day of each month at 23:00 WITA
    this.scheduledTask = cron.schedule(
      "0 23 28-31 * *",
      () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Check if tomorrow is the 1st (meaning today is month-end)
        if (tomorrow.getDate() === 1) {
          void this.generateAndDeliverInsights();
        }
      },
      {
        timezone: "Asia/Makassar", // WITA
      },
    );

    logger.info("Monthly insights scheduler initialized");
  }

  /**
   * Generate and deliver monthly insights
   */
  async generateAndDeliverInsights(): Promise<void> {
    try {
      logger.info("Generating monthly insights");

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Generate insights
      const insights =
        await trendingInsights.generateMonthlyInsights(currentMonth);

      if (insights.length === 0) {
        logger.warn("No monthly insights generated");
        return;
      }

      // Get Boss and Investor users
      const recipients = await this.prisma.user.findMany({
        where: {
          role: {
            in: ["boss", "investor"],
          },
          isActive: true,
        },
      });

      // Deliver insights
      await this.deliverInsights(
        insights,
        recipients.map((u) => u.phoneNumber),
      );

      logger.info("Monthly insights delivered", {
        insightCount: insights.length,
        recipientCount: recipients.length,
      });
    } catch (error) {
      logger.error("Failed to generate/deliver monthly insights", { error });
    }
  }

  /**
   * Deliver insights to users
   */
  private async deliverInsights(
    insights: Array<{ title: string; description: string }>,
    phoneNumbers: string[],
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      logger.error("WhatsApp client not available for insights delivery");
      return;
    }

    const message = this.formatInsightsMessage(insights);

    for (const phone of phoneNumbers) {
      try {
        const chatId = `${phone}@c.us`;
        await client.sendMessage(chatId, message);
        logger.debug("Monthly insights sent", { phone });

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error("Failed to send monthly insights", { error, phone });
      }
    }
  }

  /**
   * Format insights message
   */
  private formatInsightsMessage(
    insights: Array<{ title: string; description: string }>,
  ): string {
    const month = new Date().toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
    });

    let message = `📊 *Insight Bulanan ${month}*\n\n`;
    message += `Berikut ringkasan tren finansial bulan ini:\n\n`;

    insights.forEach((insight, index) => {
      message += `${index + 1}. *${insight.title}*\n`;
      message += `   ${insight.description}\n\n`;
    });

    message += `_Insight ini dihasilkan otomatis berdasarkan data transaksi Anda._`;

    return message;
  }

  /**
   * Manually trigger insights generation
   */
  async triggerManually(): Promise<boolean> {
    try {
      await this.generateAndDeliverInsights();
      return true;
    } catch (error) {
      logger.error("Failed to manually trigger insights", { error });
      return false;
    }
  }

  /**
   * Stop scheduler
   */
  shutdown(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info("Monthly insights scheduler stopped");
    }
  }
}

export const monthlyInsightsScheduler = MonthlyInsightsScheduler.getInstance();
