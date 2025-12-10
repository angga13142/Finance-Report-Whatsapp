import * as cron from "node-cron";
import { ReportGenerator } from "../report/generator";
import { logger } from "../../lib/logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Daily report cron job service
 * Triggers at 23:55 WITA (UTC+8) to generate daily reports
 */
export class DailyReportJob {
  private static job: cron.ScheduledTask | null = null;
  private static isRunning = false;

  /**
   * Start the daily report cron job
   * Runs at 23:55 WITA every day (15:55 UTC)
   */
  static start(): void {
    if (this.job) {
      logger.warn("Daily report job is already running");
      return;
    }

    // Cron expression: "55 15 * * *" = 15:55 UTC = 23:55 WITA (UTC+8)
    // Format: minute hour day month weekday
    this.job = cron.schedule(
      "55 15 * * *",
      () => {
        void this.executeJob();
      },
      {
        timezone: "Asia/Makassar", // WITA timezone
      },
    );

    logger.info("Daily report job started", {
      schedule: "23:55 WITA (15:55 UTC)",
      timezone: "Asia/Makassar",
    });
  }

  /**
   * Stop the daily report cron job
   */
  static stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info("Daily report job stopped");
    }
  }

  /**
   * Execute the daily report generation job
   */
  static async executeJob(): Promise<void> {
    // Prevent concurrent executions
    if (this.isRunning) {
      logger.warn("Daily report job is already running, skipping execution");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info("Starting daily report generation job");

      // Get current date in WITA timezone
      const now = new Date();
      const reportDate = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Makassar" }),
      );

      // Generate reports for all roles
      const reportData = await ReportGenerator.generateDailyReport(reportDate);

      // Create report records in database
      const reportRecords = [];

      for (const [role, data] of Array.from(reportData.entries())) {
        const report = await prisma.report.create({
          data: {
            reportDate,
            reportType: "daily",
            totalIncome: data.summary.totalIncome,
            totalExpense: data.summary.totalExpense,
            netCashflow: data.summary.netCashflow,
            jsonSummary: {
              role,
              transactionCount: data.summary.transactionCount,
              incomeCount: data.summary.incomeCount,
              expenseCount: data.summary.expenseCount,
              avgTransaction: data.summary.avgTransaction.toString(),
              categoryBreakdown: data.categoryBreakdown.map((cat) => ({
                category: cat.category,
                amount: cat.amount.toString(),
                count: cat.count,
                percentage: cat.percentage,
              })),
              topTransactions: data.topTransactions.slice(0, 10).map((txn) => ({
                id: txn.id,
                type: txn.type,
                category: txn.category,
                amount: txn.amount.toString(),
                description: txn.description,
                timestamp: txn.timestamp.toISOString(),
                userName: txn.userName,
              })),
              trends: data.trends,
            },
            deliveryStatus: {
              status: "pending",
              attempts: 0,
              lastAttempt: null,
              error: null,
            },
          },
        });

        reportRecords.push(report);

        logger.info("Report record created", {
          reportId: report.id,
          role,
          date: reportDate,
        });
      }

      // Check for negative cashflow alerts
      await this.checkNegativeCashflowAlert(reportDate);

      // Check if it's the last day of the month - trigger monthly analysis
      await this.checkMonthlyReportTrigger(reportDate);

      const duration = Date.now() - startTime;
      logger.info("Daily report generation job completed", {
        duration: `${duration}ms`,
        reportsGenerated: reportRecords.length,
      });
    } catch (error) {
      logger.error("Failed to execute daily report job", { error });

      // Create error report record for monitoring
      await prisma.report.create({
        data: {
          reportDate: new Date(),
          reportType: "daily",
          totalIncome: 0,
          totalExpense: 0,
          netCashflow: 0,
          jsonSummary: {
            role: "dev",
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
          },
          deliveryStatus: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check for consecutive negative cashflow days and create alert
   */
  private static async checkNegativeCashflowAlert(
    reportDate: Date,
  ): Promise<void> {
    try {
      // Get last 7 days of reports to check for consecutive negative days
      const sevenDaysAgo = new Date(reportDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentReports = await prisma.report.findMany({
        where: {
          reportType: "daily",
          reportDate: {
            gte: sevenDaysAgo,
            lte: reportDate,
          },
        },
        orderBy: {
          reportDate: "desc",
        },
        take: 7,
      });

      // Count consecutive negative cashflow days
      let consecutiveNegativeDays = 0;
      let totalDeficit = 0;

      for (const report of recentReports) {
        const netCashflow = Number(report.netCashflow);

        if (netCashflow < 0) {
          consecutiveNegativeDays++;
          totalDeficit += Math.abs(netCashflow);
        } else {
          break; // Stop counting when we hit a positive day
        }
      }

      // Create alert if 3+ consecutive negative days
      if (consecutiveNegativeDays >= 3) {
        logger.warn("Negative cashflow alert triggered", {
          consecutiveDays: consecutiveNegativeDays,
          totalDeficit,
        });

        // Create alert report for Boss and Dev
        await prisma.report.create({
          data: {
            reportDate,
            reportType: "daily", // Use daily type for now, alerts are in jsonSummary
            totalIncome: 0,
            totalExpense: 0,
            netCashflow: totalDeficit * -1, // Negative deficit
            jsonSummary: {
              role: "boss",
              alertType: "negative_cashflow",
              consecutiveDays: consecutiveNegativeDays,
              totalDeficit,
              message: `Cashflow negatif selama ${consecutiveNegativeDays} hari berturut-turut`,
            },
            deliveryStatus: {
              status: "pending",
              attempts: 0,
              isAlert: true,
            },
          },
        });

        // Also create alert for Dev
        await prisma.report.create({
          data: {
            reportDate,
            reportType: "daily",
            totalIncome: 0,
            totalExpense: 0,
            netCashflow: totalDeficit * -1,
            jsonSummary: {
              role: "dev",
              alertType: "negative_cashflow",
              consecutiveDays: consecutiveNegativeDays,
              totalDeficit,
              message: `Cashflow negatif selama ${consecutiveNegativeDays} hari berturut-turut`,
            },
            deliveryStatus: {
              status: "pending",
              attempts: 0,
              isAlert: true,
            },
          },
        });
      }
    } catch (error) {
      logger.error("Failed to check negative cashflow alert", { error });
      // Don't throw - this is a non-critical feature
    }
  }

  /**
   * Check if it's month boundary and trigger detailed monthly analysis
   */
  private static async checkMonthlyReportTrigger(
    reportDate: Date,
  ): Promise<void> {
    try {
      // Check if this is the last day of the month
      const tomorrow = new Date(reportDate);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // If tomorrow is the 1st of next month, generate monthly report
      if (tomorrow.getDate() === 1) {
        logger.info("Month boundary detected - generating monthly analysis", {
          reportDate,
          month: reportDate.getMonth() + 1,
          year: reportDate.getFullYear(),
        });

        // Generate monthly reports for all roles
        const monthlyReportData =
          await ReportGenerator.generateMonthlyReport(reportDate);

        // Create monthly report records
        for (const [role, data] of Array.from(monthlyReportData.entries())) {
          const report = await prisma.report.create({
            data: {
              reportDate,
              reportType: "monthly",
              totalIncome: data.summary.totalIncome,
              totalExpense: data.summary.totalExpense,
              netCashflow: data.summary.netCashflow,
              jsonSummary: {
                role,
                reportPeriod: "monthly",
                month: reportDate.getMonth() + 1,
                year: reportDate.getFullYear(),
                transactionCount: data.summary.transactionCount,
                incomeCount: data.summary.incomeCount,
                expenseCount: data.summary.expenseCount,
                avgTransaction: data.summary.avgTransaction.toString(),
                categoryBreakdown: data.categoryBreakdown.map((cat) => ({
                  category: cat.category,
                  amount: cat.amount.toString(),
                  count: cat.count,
                  percentage: cat.percentage,
                })),
                topTransactions: data.topTransactions
                  .slice(0, 10)
                  .map((txn) => ({
                    id: txn.id,
                    type: txn.type,
                    category: txn.category,
                    amount: txn.amount.toString(),
                    description: txn.description,
                    timestamp: txn.timestamp.toISOString(),
                    userName: txn.userName,
                  })),
                trends: data.trends,
              },
              deliveryStatus: {
                status: "pending",
                attempts: 0,
                lastAttempt: null,
                error: null,
              },
            },
          });

          logger.info("Monthly report record created", {
            reportId: report.id,
            role,
            month: reportDate.getMonth() + 1,
            year: reportDate.getFullYear(),
          });
        }

        logger.info("Monthly analysis generation completed");
      }
    } catch (error) {
      logger.error("Failed to check/generate monthly report", { error });
      // Don't throw - this is a non-critical feature
    }
  }

  /**
   * Manually trigger report generation (for testing or catch-up)
   */
  static async triggerManual(date?: Date): Promise<void> {
    const reportDate = date || new Date();

    logger.info("Manually triggering daily report generation", {
      date: reportDate,
    });

    await this.executeJob();
  }

  /**
   * Get job status
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
   * Reschedule the job (useful for timezone changes or testing)
   */
  static reschedule(cronExpression: string, timezone = "Asia/Makassar"): void {
    this.stop();

    this.job = cron.schedule(
      cronExpression,
      () => {
        void this.executeJob();
      },
      {
        timezone,
      },
    );

    logger.info("Daily report job rescheduled", {
      schedule: cronExpression,
      timezone,
    });
  }
}
