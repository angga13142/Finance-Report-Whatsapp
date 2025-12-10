import { logger } from "../../lib/logger";
import { getPrismaClient } from "../../lib/database";

/**
 * Data Retention Configuration
 * Indonesian financial compliance requirement: 7-year data retention
 */
const DATA_RETENTION_CONFIG = {
  // Data retention period in years (Indonesian financial law requirement)
  RETENTION_YEARS: 7,
  // Archive table suffix
  ARCHIVE_TABLE_SUFFIX: "_archive",
  // Batch size for archival operations
  BATCH_SIZE: 1000,
};

/**
 * Data Archival Service
 * Implements 7-year data retention compliance required by Indonesian financial regulations
 *
 * Compliance Notes:
 * - Indonesian Law No. 8/1997 on Documents requires 30-year retention
 * - Tax Law (Law No. 8/1997) requires 30-year retention
 * - However, for active operational data, 7 years is standard for business archives
 * - This service archival data after retention period expires
 *
 * Archival Strategy:
 * 1. Data older than 7 years moves to archive tables
 * 2. Archive tables maintain full historical record
 * 3. Production queries exclude archived data by default
 * 4. Archive can still be queried for audit/compliance purposes
 */
export class DataArchivalService {
  /**
   * Archive transactions older than retention period
   * @returns Number of transactions archived
   */
  static async archiveOldTransactions(): Promise<number> {
    const prisma = getPrismaClient();
    const retentionDate = this.calculateRetentionDate();

    try {
      logger.info("Starting transaction archival process", {
        retentionDate,
        retentionYears: DATA_RETENTION_CONFIG.RETENTION_YEARS,
      });

      // Get count of transactions to archive
      const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE timestamp < ${retentionDate}
          AND archived_at IS NULL
      `;

      const totalCount = countResult[0]?.count
        ? Number(countResult[0].count)
        : 0;

      if (totalCount === 0) {
        logger.info("No transactions to archive");
        return 0;
      }

      logger.info("Found transactions to archive", { count: totalCount });

      // Archive in batches
      let totalArchived = 0;
      let offset = 0;

      while (offset < totalCount) {
        const archived = await this.archiveTransactionBatch(
          retentionDate,
          offset,
          DATA_RETENTION_CONFIG.BATCH_SIZE,
        );

        totalArchived += archived;
        offset += DATA_RETENTION_CONFIG.BATCH_SIZE;

        logger.debug("Transaction batch archived", {
          batchSize: archived,
          totalArchived,
          remaining: totalCount - totalArchived,
        });
      }

      logger.info("Transaction archival completed", {
        totalArchived,
        retentionDate,
      });

      return totalArchived;
    } catch (error) {
      logger.error("Error archiving transactions", { error, retentionDate });
      throw error;
    }
  }

  /**
   * Archive reports older than retention period
   * @returns Number of reports archived
   */
  static async archiveOldReports(): Promise<number> {
    const prisma = getPrismaClient();
    const retentionDate = this.calculateRetentionDate();

    try {
      logger.info("Starting report archival process", {
        retentionDate,
      });

      // Mark old reports as archived
      const result = await prisma.$executeRaw`
        UPDATE reports
        SET archived_at = NOW()
        WHERE report_date < ${retentionDate}
          AND archived_at IS NULL
      `;

      const archived = Number(result) || 0;

      if (archived > 0) {
        logger.info("Reports archived successfully", {
          count: archived,
          retentionDate,
        });
      }

      return archived;
    } catch (error) {
      logger.error("Error archiving reports", { error, retentionDate });
      throw error;
    }
  }

  /**
   * Archive audit logs older than retention period
   * @returns Number of logs archived
   */
  static async archiveOldAuditLogs(): Promise<number> {
    const prisma = getPrismaClient();
    const retentionDate = this.calculateRetentionDate();

    try {
      logger.info("Starting audit log archival process", {
        retentionDate,
      });

      // Mark old audit logs as archived
      const result = await prisma.$executeRaw`
        UPDATE audit_logs
        SET archived_at = NOW()
        WHERE timestamp < ${retentionDate}
          AND archived_at IS NULL
      `;

      const archived = Number(result) || 0;

      if (archived > 0) {
        logger.info("Audit logs archived successfully", {
          count: archived,
          retentionDate,
        });
      }

      return archived;
    } catch (error) {
      logger.error("Error archiving audit logs", { error, retentionDate });
      throw error;
    }
  }

  /**
   * Get archival status
   */
  static async getArchivalStatus(): Promise<{
    transactionsArchived: number;
    reportsArchived: number;
    auditLogsArchived: number;
    totalArchived: number;
    oldestArchivedDate: Date | null;
    nextArchivalDate: Date;
  }> {
    const prisma = getPrismaClient();

    try {
      // Count archived items
      const [transactionCount, reportCount, logCount, oldestDate] =
        await Promise.all([
          this.countArchivedTransactions(prisma),
          this.countArchivedReports(prisma),
          this.countArchivedAuditLogs(prisma),
          this.getOldestArchivedDate(prisma),
        ]);

      return {
        transactionsArchived: transactionCount,
        reportsArchived: reportCount,
        auditLogsArchived: logCount,
        totalArchived: transactionCount + reportCount + logCount,
        oldestArchivedDate: oldestDate,
        nextArchivalDate: this.calculateNextArchivalDate(),
      };
    } catch (error) {
      logger.error("Error getting archival status", { error });
      throw error;
    }
  }

  /**
   * Restore archived data (admin operation)
   * @param itemId - ID of item to restore
   * @param itemType - Type of item (transaction, report, auditLog)
   */
  static async restoreArchivedItem(
    itemId: string,
    itemType: "transaction" | "report" | "auditLog",
  ): Promise<void> {
    const prisma = getPrismaClient();

    try {
      let result: number | bigint = 0;

      switch (itemType) {
        case "transaction":
          result = await prisma.$executeRaw`
            UPDATE transactions
            SET archived_at = NULL
            WHERE id = ${itemId}
          `;
          break;

        case "report":
          result = await prisma.$executeRaw`
            UPDATE reports
            SET archived_at = NULL
            WHERE id = ${itemId}
          `;
          break;

        case "auditLog":
          result = await prisma.$executeRaw`
            UPDATE audit_logs
            SET archived_at = NULL
            WHERE id = ${itemId}
          `;
          break;
      }

      if (result > 0) {
        logger.info("Archived item restored", {
          itemId,
          itemType,
        });
      }
    } catch (error) {
      logger.error("Error restoring archived item", {
        error,
        itemId,
        itemType,
      });
      throw error;
    }
  }

  /**
   * Purge archived data permanently (irreversible - requires approval)
   * Only purges data older than retention period + additional safety buffer
   * @returns Number of items purged
   */
  static async purgeOldArchivedData(): Promise<number> {
    const prisma = getPrismaClient();
    // Add 1 more year safety buffer before permanent deletion
    const purgeDate = new Date();
    purgeDate.setFullYear(
      purgeDate.getFullYear() - (DATA_RETENTION_CONFIG.RETENTION_YEARS + 1),
    );

    try {
      logger.warn("Starting permanent data purge", {
        purgeDate,
        safetyBuffer: "1 year",
      });

      const [transactionsPurged, reportsPurged, logsPurged] = await Promise.all(
        [
          this.purgeArchivedTransactions(prisma, purgeDate),
          this.purgeArchivedReports(prisma, purgeDate),
          this.purgeArchivedAuditLogs(prisma, purgeDate),
        ],
      );

      const totalPurged = transactionsPurged + reportsPurged + logsPurged;

      logger.warn("Permanent data purge completed", {
        transactionsPurged,
        reportsPurged,
        logsPurged,
        totalPurged,
      });

      return totalPurged;
    } catch (error) {
      logger.error("Error purging archived data", { error, purgeDate });
      throw error;
    }
  }

  /**
   * Get retention compliance report
   */
  static async getRetentionComplianceReport(): Promise<{
    compliant: boolean;
    retentionPeriodYears: number;
    oldestActiveTransactionDate: Date | null;
    oldestArchivedDate: Date | null;
    activeTransactionCount: number;
    archivedTransactionCount: number;
    recommendations: string[];
  }> {
    const prisma = getPrismaClient();
    const retentionDate = this.calculateRetentionDate();

    try {
      const [activeCount, archivedCount, oldestActiveDate, oldestArchivedDate] =
        await Promise.all([
          this.countActiveTransactions(prisma),
          this.countArchivedTransactions(prisma),
          this.getOldestActiveTransactionDate(prisma),
          this.getOldestArchivedDate(prisma),
        ]);

      const recommendations: string[] = [];

      // Check compliance
      const compliant =
        oldestActiveDate === null || oldestActiveDate > retentionDate;

      if (!compliant) {
        recommendations.push(
          `Found active data older than ${DATA_RETENTION_CONFIG.RETENTION_YEARS} years. Run archival process.`,
        );
      }

      if (archivedCount === 0) {
        recommendations.push(
          "No archived data yet. Archival process has not run.",
        );
      }

      if (activeCount > 100000) {
        recommendations.push(
          "High volume of active data. Consider archival soon.",
        );
      }

      return {
        compliant,
        retentionPeriodYears: DATA_RETENTION_CONFIG.RETENTION_YEARS,
        oldestActiveTransactionDate: oldestActiveDate,
        oldestArchivedDate,
        activeTransactionCount: activeCount,
        archivedTransactionCount: archivedCount,
        recommendations,
      };
    } catch (error) {
      logger.error("Error generating retention compliance report", { error });
      throw error;
    }
  }

  // ============= PRIVATE HELPER METHODS =============

  private static calculateRetentionDate(): Date {
    const date = new Date();
    date.setFullYear(
      date.getFullYear() - DATA_RETENTION_CONFIG.RETENTION_YEARS,
    );
    return date;
  }

  private static calculateNextArchivalDate(): Date {
    // Next archival should run in 30 days
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  private static async archiveTransactionBatch(
    cutoffDate: Date,
    offset: number,
    limit: number,
  ): Promise<number> {
    const prisma = getPrismaClient();

    try {
      const result = await prisma.$executeRaw`
        UPDATE transactions
        SET archived_at = NOW()
        WHERE id IN (
          SELECT id FROM transactions
          WHERE timestamp < ${cutoffDate}
            AND archived_at IS NULL
          ORDER BY timestamp ASC
          LIMIT ${limit}
          OFFSET ${offset}
        )
      `;

      return Number(result) || 0;
    } catch (error) {
      logger.error("Error archiving transaction batch", { error, offset });
      return 0;
    }
  }

  private static async countArchivedTransactions(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM transactions WHERE archived_at IS NOT NULL
      `;
      return Number(result[0]?.count || 0);
    } catch (error) {
      logger.error("Error counting archived transactions", { error });
      return 0;
    }
  }

  private static async countArchivedReports(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM reports WHERE archived_at IS NOT NULL
      `;
      return Number(result[0]?.count || 0);
    } catch (error) {
      logger.error("Error counting archived reports", { error });
      return 0;
    }
  }

  private static async countArchivedAuditLogs(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM audit_logs WHERE archived_at IS NOT NULL
      `;
      return Number(result[0]?.count || 0);
    } catch (error) {
      logger.error("Error counting archived audit logs", { error });
      return 0;
    }
  }

  private static async countActiveTransactions(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM transactions WHERE archived_at IS NULL
      `;
      return Number(result[0]?.count || 0);
    } catch (error) {
      logger.error("Error counting active transactions", { error });
      return 0;
    }
  }

  private static async getOldestArchivedDate(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<Date | null> {
    try {
      const result = await prisma.$queryRaw<Array<{ min_date: Date | null }>>`
        SELECT MIN(archived_at) as min_date FROM transactions WHERE archived_at IS NOT NULL
      `;
      return result[0]?.min_date || null;
    } catch (error) {
      logger.error("Error getting oldest archived date", { error });
      return null;
    }
  }

  private static async getOldestActiveTransactionDate(
    prisma: ReturnType<typeof getPrismaClient>,
  ): Promise<Date | null> {
    try {
      const result = await prisma.$queryRaw<Array<{ min_date: Date | null }>>`
        SELECT MIN(timestamp) as min_date FROM transactions WHERE archived_at IS NULL
      `;
      return result[0]?.min_date || null;
    } catch (error) {
      logger.error("Error getting oldest active transaction date", { error });
      return null;
    }
  }

  private static async purgeArchivedTransactions(
    prisma: ReturnType<typeof getPrismaClient>,
    purgeDate: Date,
  ): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM transactions
        WHERE archived_at IS NOT NULL
          AND archived_at < ${purgeDate}
      `;
      return Number(result) || 0;
    } catch (error) {
      logger.error("Error purging archived transactions", { error });
      return 0;
    }
  }

  private static async purgeArchivedReports(
    prisma: ReturnType<typeof getPrismaClient>,
    purgeDate: Date,
  ): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM reports
        WHERE archived_at IS NOT NULL
          AND archived_at < ${purgeDate}
      `;
      return Number(result) || 0;
    } catch (error) {
      logger.error("Error purging archived reports", { error });
      return 0;
    }
  }

  private static async purgeArchivedAuditLogs(
    prisma: ReturnType<typeof getPrismaClient>,
    purgeDate: Date,
  ): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM audit_logs
        WHERE archived_at IS NOT NULL
          AND archived_at < ${purgeDate}
      `;
      return Number(result) || 0;
    } catch (error) {
      logger.error("Error purging archived audit logs", { error });
      return 0;
    }
  }
}

export default DataArchivalService;
