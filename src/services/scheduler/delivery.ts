/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { ReportGenerator, type RoleReportData } from "../report/generator";
import { ReportFormatter } from "../report/formatter";
import { PDFReportGenerator } from "../report/pdf";
import { getWhatsAppClient } from "../../bot/client/client";
import { promises as fs } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

/**
 * Report delivery service
 * Delivers generated reports to users via WhatsApp with rate limiting and retry logic
 */
export class ReportDeliveryService {
  private static job: cron.ScheduledTask | null = null;
  private static isRunning = false;

  // Rate limiting: 15-20 messages per minute
  private static readonly MESSAGE_RATE_LIMIT = 18; // messages per minute
  private static readonly MESSAGE_DELAY = 60000 / this.MESSAGE_RATE_LIMIT; // ~3.3 seconds

  // Retry configuration
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 5 * 60 * 1000; // 5 minutes in ms

  /**
   * Start the report delivery cron job
   * Runs at 24:00 WITA every day (16:00 UTC)
   */
  static start(): void {
    if (this.job) {
      logger.warn("Report delivery job is already running");
      return;
    }

    // Cron expression: "0 16 * * *" = 16:00 UTC = 24:00 WITA (UTC+8)
    this.job = cron.schedule(
      "0 16 * * *",
      () => {
        void this.executeDelivery();
      },
      {
        timezone: "Asia/Makassar",
      },
    );

    logger.info("Report delivery job started", {
      schedule: "24:00 WITA (16:00 UTC)",
      timezone: "Asia/Makassar",
    });
  }

  /**
   * Stop the report delivery cron job
   */
  static stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info("Report delivery job stopped");
    }
  }

  /**
   * Execute report delivery
   */
  static async executeDelivery(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Report delivery is already running, skipping execution");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info("Starting report delivery job");

      // Get today's date in WITA
      const now = new Date();
      const reportDate = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Makassar" }),
      );
      reportDate.setHours(0, 0, 0, 0);

      // Get pending reports for today
      const pendingReports = await this.getPendingReports(reportDate);

      if (pendingReports.length === 0) {
        logger.info("No pending reports to deliver");
        return;
      }

      logger.info("Found pending reports", { count: pendingReports.length });

      // Deliver reports with rate limiting
      await this.deliverReportsWithRateLimit(pendingReports);

      const duration = Date.now() - startTime;
      logger.info("Report delivery job completed", {
        duration: `${duration}ms`,
        reportsDelivered: pendingReports.length,
      });
    } catch (error) {
      logger.error("Failed to execute report delivery job", { error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get pending reports for delivery
   */
  private static async getPendingReports(reportDate: Date): Promise<
    Array<{
      id: string;
      reportDate: Date;
      reportType: string;
      totalIncome: number;
      totalExpense: number;
      netCashflow: number;
      jsonSummary: Record<string, unknown>;
      deliveryStatus: Record<string, unknown>;
    }>
  > {
    const reports = await prisma.report.findMany({
      where: {
        reportDate,
        deliveryStatus: {
          path: ["status"],
          equals: "pending",
        },
      },
      orderBy: {
        generatedAt: "asc",
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reportDate: report.reportDate,
      reportType: report.reportType,
      totalIncome: Number(report.totalIncome),
      totalExpense: Number(report.totalExpense),
      netCashflow: Number(report.netCashflow),
      jsonSummary: report.jsonSummary as Record<string, unknown>,
      deliveryStatus: report.deliveryStatus as Record<string, unknown>,
    }));
  }

  /**
   * Deliver reports with rate limiting
   */
  private static async deliverReportsWithRateLimit(
    reports: Array<{
      id: string;
      reportDate: Date;
      jsonSummary: Record<string, unknown>;
      deliveryStatus: Record<string, unknown>;
    }>,
  ): Promise<void> {
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];

      try {
        await this.deliverSingleReport(report);

        // Rate limiting: wait between messages
        if (i < reports.length - 1) {
          await this.delay(this.MESSAGE_DELAY);
        }
      } catch (error) {
        logger.error("Failed to deliver report", {
          reportId: report.id,
          error,
        });

        // Update delivery status with error
        await this.updateDeliveryStatus(report.id, "failed", error as Error);

        // Schedule retry if within retry limit
        const currentAttempts = (report.deliveryStatus.attempts as number) || 0;
        if (currentAttempts < this.MAX_RETRIES) {
          this.scheduleRetry(report.id);
        }
      }
    }
  }

  /**
   * Deliver single report to user
   */
  private static async deliverSingleReport(report: {
    id: string;
    reportDate: Date;
    jsonSummary: Record<string, unknown>;
  }): Promise<void> {
    const { role } = report.jsonSummary as { role: string };

    // Get users with this role
    const users = await prisma.user.findMany({
      where: {
        role: role as "dev" | "boss" | "employee" | "investor",
        isActive: true,
      },
    });

    if (users.length === 0) {
      logger.warn("No active users found for role", { role });
      await this.updateDeliveryStatus(report.id, "skipped");
      return;
    }

    // Regenerate report data for this role
    const reportData = await ReportGenerator.generateRoleSpecificReport(
      role as "dev" | "boss" | "employee" | "investor",
      report.reportDate,
      new Date(report.reportDate.getTime() + 24 * 60 * 60 * 1000 - 1),
    );

    // Format text message
    const textMessage = ReportFormatter.formatDailyReport(
      reportData,
      report.reportDate,
    );

    // Generate PDF
    const pdfPath = await this.generatePDF(
      report.id,
      reportData,
      report.reportDate,
    );

    // Send to all users with this role
    const client = getWhatsAppClient();
    if (!client) {
      throw new Error("WhatsApp client not initialized");
    }

    for (const user of users) {
      try {
        // TODO: Implement actual WhatsApp message sending
        // Send text message
        // await client.sendMessage(user.phoneNumber, textMessage);

        // Send PDF attachment
        // const pdfMedia = await MessageMedia.fromFilePath(pdfPath);
        // await client.sendMessage(user.phoneNumber, pdfMedia, {
        //   caption: `Laporan Harian - ${report.reportDate.toLocaleDateString("id-ID")}`,
        // });

        logger.info("Report delivery scheduled", {
          reportId: report.id,
          userId: user.id,
          phoneNumber: user.phoneNumber,
          pdfPath,
          textLength: textMessage.length,
        });
      } catch (error) {
        logger.error("Failed to send report to user", {
          reportId: report.id,
          userId: user.id,
          error,
        });
        throw error;
      }
    }

    // Update delivery status to delivered
    await this.updateDeliveryStatus(report.id, "delivered");
  }

  /**
   * Generate PDF for report
   */
  private static async generatePDF(
    reportId: string,
    reportData: RoleReportData,
    reportDate: Date,
  ): Promise<string> {
    const outputDir = join(process.cwd(), "temp", "reports");
    await fs.mkdir(outputDir, { recursive: true });

    const filename = `report-${reportId}-${Date.now()}.pdf`;
    const outputPath = join(outputDir, filename);

    await PDFReportGenerator.generatePDFReport(
      reportData,
      reportDate,
      outputPath,
    );

    return outputPath;
  }

  /**
   * Update delivery status in database
   */
  private static async updateDeliveryStatus(
    reportId: string,
    status: string,
    error?: Error,
  ): Promise<void> {
    const currentReport = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!currentReport) {
      logger.error("Report not found for status update", { reportId });
      return;
    }

    const deliveryStatus = currentReport.deliveryStatus as Record<
      string,
      unknown
    >;
    const currentAttempts = (deliveryStatus.attempts as number) || 0;

    await prisma.report.update({
      where: { id: reportId },
      data: {
        deliveryStatus: {
          status,
          attempts: currentAttempts + 1,
          lastAttempt: new Date().toISOString(),
          error: error ? error.message : null,
          errorStack: error ? error.stack : null,
        },
      },
    });
  }

  /**
   * Schedule retry for failed delivery
   */
  private static scheduleRetry(reportId: string): void {
    logger.info("Scheduling retry for report", {
      reportId,
      delay: `${this.RETRY_DELAY / 60000} minutes`,
    });

    setTimeout(() => {
      void (async () => {
        try {
          const report = await prisma.report.findUnique({
            where: { id: reportId },
          });

          if (!report) {
            logger.error("Report not found for retry", { reportId });
            return;
          }

          // Reset status to pending for retry
          await prisma.report.update({
            where: { id: reportId },
            data: {
              deliveryStatus: {
                ...((report.deliveryStatus as Record<string, unknown>) || {}),
                status: "pending",
              },
            },
          });

          // Retry delivery
          await this.deliverSingleReport({
            id: report.id,
            reportDate: report.reportDate,
            jsonSummary: report.jsonSummary as Record<string, unknown>,
          });
        } catch (error) {
          logger.error("Retry failed", { reportId, error });
          await this.updateDeliveryStatus(reportId, "failed", error as Error);
        }
      })();
    }, this.RETRY_DELAY);
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger report delivery (for testing)
   */
  static async triggerManual(reportDate?: Date): Promise<void> {
    const date = reportDate || new Date();
    logger.info("Manually triggering report delivery", { date });

    await this.executeDelivery();
  }

  /**
   * Get delivery status
   */
  static getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.job !== null,
    };
  }

  /**
   * Process failed reports (manual retry)
   */
  static async retryFailedReports(reportDate: Date): Promise<void> {
    logger.info("Retrying failed reports", { reportDate });

    const failedReports = await prisma.report.findMany({
      where: {
        reportDate,
        deliveryStatus: {
          path: ["status"],
          equals: "failed",
        },
      },
    });

    logger.info("Found failed reports", { count: failedReports.length });

    for (const report of failedReports) {
      try {
        await this.deliverSingleReport({
          id: report.id,
          reportDate: report.reportDate,
          jsonSummary: report.jsonSummary as Record<string, unknown>,
        });

        await this.delay(this.MESSAGE_DELAY);
      } catch (error) {
        logger.error("Retry failed for report", {
          reportId: report.id,
          error,
        });
      }
    }
  }
}
