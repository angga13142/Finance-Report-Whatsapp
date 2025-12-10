import { PrismaClient, Report, ReportType } from "@prisma/client";
import { logger } from "../lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/**
 * Delivery status for a specific role
 */
export interface RoleDeliveryStatus {
  role: string;
  phoneNumber: string;
  status: "pending" | "delivered" | "failed";
  deliveredAt?: string;
  error?: string;
  retryCount: number;
}

/**
 * Report model operations
 */
export class ReportModel {
  /**
   * Create a new report
   */
  static async create(data: {
    reportDate: Date;
    reportType: ReportType;
    filePath?: string;
    jsonSummary?: Record<string, unknown>;
    totalIncome: number | Decimal;
    totalExpense: number | Decimal;
    netCashflow: number | Decimal;
    deliveryStatus?: RoleDeliveryStatus[];
  }): Promise<Report> {
    try {
      return await prisma.report.create({
        data: {
          reportDate: data.reportDate,
          reportType: data.reportType,
          filePath: data.filePath,
          jsonSummary: data.jsonSummary as never,
          totalIncome: data.totalIncome,
          totalExpense: data.totalExpense,
          netCashflow: data.netCashflow,
          deliveryStatus: data.deliveryStatus as never,
        },
      });
    } catch (error) {
      logger.error("Error creating report", { error, data });
      throw error;
    }
  }

  /**
   * Find report by ID
   */
  static async findById(id: string): Promise<Report | null> {
    try {
      return await prisma.report.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Error finding report by ID", { error, id });
      throw error;
    }
  }

  /**
   * Find reports by date range
   */
  static async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Report[]> {
    try {
      return await prisma.report.findMany({
        where: {
          reportDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { generatedAt: "desc" },
      });
    } catch (error) {
      logger.error("Error finding reports by date range", {
        error,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  /**
   * Find latest daily report
   */
  static async findLatestDailyReport(): Promise<Report | null> {
    try {
      return await prisma.report.findFirst({
        where: {
          reportType: "daily",
        },
        orderBy: { generatedAt: "desc" },
      });
    } catch (error) {
      logger.error("Error finding latest daily report", { error });
      throw error;
    }
  }

  /**
   * Update report delivery status
   */
  static async updateDeliveryStatus(
    id: string,
    deliveryStatus: RoleDeliveryStatus[],
  ): Promise<Report> {
    try {
      return await prisma.report.update({
        where: { id },
        data: {
          deliveryStatus: deliveryStatus as never,
        },
      });
    } catch (error) {
      logger.error("Error updating report delivery status", { error, id });
      throw error;
    }
  }

  /**
   * Get delivery status for a report
   */
  static getDeliveryStatus(report: Report): RoleDeliveryStatus[] {
    try {
      if (!report.deliveryStatus || typeof report.deliveryStatus !== "object") {
        return [];
      }

      // Handle both array and object formats
      if (Array.isArray(report.deliveryStatus)) {
        return report.deliveryStatus as unknown as RoleDeliveryStatus[];
      }

      return [];
    } catch (error) {
      logger.error("Error parsing delivery status", {
        error,
        reportId: report.id,
      });
      return [];
    }
  }

  /**
   * Find reports pending delivery
   */
  static async findPendingDeliveries(
    maxRetries: number = 3,
  ): Promise<Report[]> {
    try {
      const reports = await prisma.report.findMany({
        where: {
          generatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { generatedAt: "asc" },
      });

      // Filter reports with pending or failed deliveries that haven't exceeded max retries
      return reports.filter((report) => {
        const statuses = this.getDeliveryStatus(report);
        return statuses.some(
          (s) =>
            (s.status === "pending" || s.status === "failed") &&
            s.retryCount < maxRetries,
        );
      });
    } catch (error) {
      logger.error("Error finding pending deliveries", { error });
      throw error;
    }
  }

  /**
   * Delete old reports (cleanup)
   */
  static async deleteOlderThan(date: Date): Promise<number> {
    try {
      const result = await prisma.report.deleteMany({
        where: {
          generatedAt: { lt: date },
        },
      });
      logger.info("Deleted old reports", {
        count: result.count,
        beforeDate: date,
      });
      return result.count;
    } catch (error) {
      logger.error("Error deleting old reports", { error, date });
      throw error;
    }
  }

  /**
   * Get report statistics
   */
  static async getStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    avgDeliveryTime: number | null;
  }> {
    try {
      const reports = await prisma.report.findMany({
        where: {
          generatedAt: { gte: startDate, lte: endDate },
        },
      });

      const total = reports.length;
      let delivered = 0;
      let failed = 0;
      let pending = 0;
      const deliveryTimes: number[] = [];

      reports.forEach((report) => {
        const statuses = this.getDeliveryStatus(report);

        statuses.forEach((status) => {
          if (status.status === "delivered") {
            delivered++;
            if (status.deliveredAt) {
              const generatedTime = report.generatedAt.getTime();
              const deliveredTime = new Date(status.deliveredAt).getTime();
              deliveryTimes.push((deliveredTime - generatedTime) / 1000);
            }
          } else if (status.status === "failed") {
            failed++;
          } else if (status.status === "pending") {
            pending++;
          }
        });
      });

      const avgDeliveryTime =
        deliveryTimes.length > 0
          ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
          : null;

      return {
        total,
        delivered,
        failed,
        pending,
        avgDeliveryTime,
      };
    } catch (error) {
      logger.error("Error getting report statistics", {
        error,
        startDate,
        endDate,
      });
      throw error;
    }
  }
}

export default ReportModel;
