/**
 * Unit tests for DataArchivalService
 * Tests 7-year data retention compliance and archival operations
 */

import { DataArchivalService } from "../../../../src/services/data/archival";
import { logger } from "../../../../src/lib/logger";
import * as database from "../../../../src/lib/database";

// Mock dependencies
jest.mock("../../../../src/lib/logger");
jest.mock("../../../../src/lib/database");

const mockPrisma = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

describe("DataArchivalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (database.getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);
  });

  describe("archiveOldTransactions", () => {
    it("should return 0 when no transactions to archive", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await DataArchivalService.archiveOldTransactions();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalledWith("No transactions to archive");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("DB error"));

      try {
        await DataArchivalService.archiveOldTransactions();
      } catch {
        // Service may rethrow in some cases
      }

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("archiveOldReports", () => {
    it("should return 0 when no reports to archive", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await DataArchivalService.archiveOldReports();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe("archiveOldAuditLogs", () => {
    it("should return 0 when no audit logs to archive", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await DataArchivalService.archiveOldAuditLogs();

      expect(result).toBe(0);
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe("getArchivalStatus", () => {
    it("should return archival status with counts", async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(100) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ oldest_date: new Date("2020-01-01") }]);

      const result = await DataArchivalService.getArchivalStatus();

      expect(result).toHaveProperty("transactionsArchived");
      expect(result).toHaveProperty("reportsArchived");
      expect(result).toHaveProperty("auditLogsArchived");
      expect(result).toHaveProperty("totalArchived");
      expect(result).toHaveProperty("nextArchivalDate");
      expect(result.totalArchived).toBe(180);
    });
  });

  describe("restoreArchivedItem", () => {
    it("should restore archived transaction", async () => {
      mockPrisma.$executeRaw.mockResolvedValueOnce(1);

      await DataArchivalService.restoreArchivedItem("txn123", "transaction");

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Archived item restored",
        expect.objectContaining({ itemId: "txn123", itemType: "transaction" }),
      );
    });

    it("should throw error when restoration fails", async () => {
      mockPrisma.$executeRaw.mockRejectedValueOnce(new Error("Restore failed"));

      await expect(
        DataArchivalService.restoreArchivedItem("txn123", "transaction"),
      ).rejects.toThrow();
    });
  });

  describe("purgeOldArchivedData", () => {
    it("should purge old archived data and return count", async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }]);
      mockPrisma.$executeRaw
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(20);

      const result = await DataArchivalService.purgeOldArchivedData();

      expect(result).toBe(100);
    });

    it("should handle purge errors", async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("Purge failed"));

      const result = await DataArchivalService.purgeOldArchivedData();

      expect(result).toBe(0);
    });
  });

  describe("getRetentionComplianceReport", () => {
    it("should generate compliance report with 7-year retention", async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(5000) }])
        .mockResolvedValueOnce([{ count: BigInt(1500) }])
        .mockResolvedValueOnce([{ oldest_date: new Date("2020-01-01") }])
        .mockResolvedValueOnce([{ oldest_date: new Date("2015-01-01") }]);

      const result = await DataArchivalService.getRetentionComplianceReport();

      expect(result).toHaveProperty("retentionPeriodYears", 7);
      expect(result).toHaveProperty("compliant");
      expect(result).toHaveProperty("recommendations");
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it("should handle errors and return default report", async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("Query failed"));

      const result = await DataArchivalService.getRetentionComplianceReport();

      expect(result.retentionPeriodYears).toBe(7);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
