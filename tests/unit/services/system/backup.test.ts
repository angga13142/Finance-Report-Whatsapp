/**
 * Unit tests for BackupService
 * Tests database backup creation, restoration, and management
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import { BackupService } from "../../../../src/services/system/backup";
import { logger } from "../../../../src/lib/logger";
import * as fs from "fs/promises";
import { exec } from "child_process";

// Mock dependencies
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("fs/promises");
jest.mock("child_process");

describe("BackupService", () => {
  const mockUserId = "dev123";
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
      BACKUP_DIR: "./test-backups",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createBackup", () => {
    it("should create database backup successfully", async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 * 1024 * 5 }); // 5MB

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: "Backup created", stderr: "" });
        return {} as any;
      });

      const result = await BackupService.createBackup(mockUserId);

      expect(result.success).toBe(true);
      expect(result.filename).toContain("backup-");
      expect(result.filename).toContain(".sql");
      expect(result.size).toContain("MB");
      expect(logger.info).toHaveBeenCalledWith(
        "Database backup created successfully",
        expect.any(Object),
      );
    });

    it("should create backup directory if not exists", async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      await BackupService.createBackup(mockUserId);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it("should handle backup creation errors", async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error("pg_dump failed"), { stdout: "", stderr: "error" });
        return {} as any;
      });

      const result = await BackupService.createBackup(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create database backup",
        expect.any(Object),
      );
    });

    it("should generate filename with timestamp", async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      const result = await BackupService.createBackup(mockUserId);

      expect(result.filename).toMatch(
        /backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/,
      );
    });
  });

  describe("listBackups", () => {
    it("should list all backup files", async () => {
      const mockFiles = [
        "backup-2025-12-10T10-00-00.sql",
        "backup-2025-12-09T10-00-00.sql",
      ];

      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 1024 * 1024,
        mtime: new Date(),
      });

      const result = await BackupService.listBackups();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("filename");
      expect(result[0]).toHaveProperty("size");
      expect(result[0]).toHaveProperty("created");
    });

    it("should filter only .sql files", async () => {
      const mockFiles = [
        "backup-2025-12-10.sql",
        "readme.txt",
        "backup-2025-12-09.sql",
        "config.json",
      ];

      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 1024,
        mtime: new Date(),
      });

      const result = await BackupService.listBackups();

      expect(result).toHaveLength(2);
      expect(result.every((b) => b.filename.endsWith(".sql"))).toBe(true);
    });

    it("should handle empty backup directory", async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const result = await BackupService.listBackups();

      expect(result).toEqual([]);
    });

    it("should handle directory read errors", async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(
        new Error("Directory not found"),
      );

      const result = await BackupService.listBackups();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("restoreBackup", () => {
    it("should restore database from backup", async () => {
      const backupFilename = "backup-2025-12-10T10-00-00.sql";

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: "Restore completed", stderr: "" });
        return {} as any;
      });

      const result = await BackupService.restoreBackup(
        backupFilename,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        "Database restore completed successfully",
        expect.any(Object),
      );
    });

    it("should verify backup file exists before restore", async () => {
      const backupFilename = "nonexistent.sql";

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error("File not found"), { stdout: "", stderr: "" });
        return {} as any;
      });

      const result = await BackupService.restoreBackup(
        backupFilename,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should handle restore errors", async () => {
      const backupFilename = "backup-2025-12-10T10-00-00.sql";

      const mockExec = require("child_process").exec as jest.MockedFunction<
        typeof exec
      >;
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error("psql command failed"), {
          stdout: "",
          stderr: "error",
        });
        return {} as any;
      });

      const result = await BackupService.restoreBackup(
        backupFilename,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to restore database",
        expect.any(Object),
      );
    });
  });

  // Note: deleteBackup method is not implemented in BackupService
  // Backup deletion is handled through cleanupOldBackups

  describe("cleanupOldBackups", () => {
    it("should delete backups older than retention period", async () => {
      // cleanupOldBackups uses keepCount, not date-based retention
      // It keeps the last N backups and deletes the rest
      const mockBackups = [
        {
          filename: "backup-old.sql",
          path: "./backups/backup-old.sql",
          size: "1.00 MB",
          created: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
        {
          filename: "backup-recent.sql",
          path: "./backups/backup-recent.sql",
          size: "1.00 MB",
          created: new Date(),
        },
      ];

      // Mock listBackups to return 2 backups
      jest.spyOn(BackupService, "listBackups").mockResolvedValue(mockBackups);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      // keepCount = 1, so 1 backup should be deleted (keeping only the newest)
      const result = await BackupService.cleanupOldBackups(1);

      expect(result).toBe(1);
      expect(fs.unlink).toHaveBeenCalledTimes(1);
    });

    it("should use default retention period when not specified", async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      await BackupService.cleanupOldBackups();

      expect(fs.readdir).toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error("Read error"));

      const result = await BackupService.cleanupOldBackups(30);

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Note: getBackupSize method is not implemented in BackupService
  // Backup size information is available through listBackups()
});
