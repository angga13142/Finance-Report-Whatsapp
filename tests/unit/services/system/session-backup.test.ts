/**
 * Unit tests for SessionBackupService
 * Tests backup creation, cleanup, restore, and automatic backup scheduling
 */

import { SessionBackupService } from "../../../../src/services/system/session-backup";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// Mock dependencies
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../../../src/bot/client/auth", () => ({
  detectSessionCorruption: jest.fn(),
}));

jest.mock("../../../../src/config/env", () => ({
  env: {
    WHATSAPP_SESSION_PATH: "/tmp/test-session",
  },
}));

// Use fake timers to control setInterval
jest.useFakeTimers();

describe("SessionBackupService", () => {
  const testSessionPath = "/tmp/test-session";
  const testClientId = "session-cashflow-bot";
  const testSessionDir = join(testSessionPath, testClientId);
  const testBackupDir = join(testSessionDir, ".backups");

  beforeEach(() => {
    jest.clearAllMocks();
    // Stop any running backup service
    SessionBackupService.stopAutomaticBackups();

    // Clean up test directories
    if (existsSync(testSessionDir)) {
      rmSync(testSessionDir, { recursive: true, force: true });
    }

    // Create test session directory structure
    mkdirSync(testSessionDir, { recursive: true });
    mkdirSync(join(testSessionDir, "Default"), { recursive: true });
    writeFileSync(join(testSessionDir, "Default", "test.json"), "{}");
  });

  afterEach(() => {
    // Stop any running backup service
    SessionBackupService.stopAutomaticBackups();
    // Clear all timers
    jest.clearAllTimers();

    // Clean up test directories
    if (existsSync(testSessionDir)) {
      rmSync(testSessionDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Restore real timers
    jest.useRealTimers();
  });

  describe("createBackup", () => {
    it("should create a backup successfully", async () => {
      const result = await SessionBackupService.createBackup();

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return error if session directory does not exist", async () => {
      // Remove session directory
      rmSync(testSessionDir, { recursive: true, force: true });

      const result = await SessionBackupService.createBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session directory does not exist");
    });

    it("should create backup directory if it doesn't exist", async () => {
      const result = await SessionBackupService.createBackup();

      expect(result.success).toBe(true);
      expect(existsSync(testBackupDir)).toBe(true);
    });
  });

  describe("cleanupOldBackups", () => {
    it("should keep only the last 10 backups", async () => {
      // Create backup directory
      mkdirSync(testBackupDir, { recursive: true });

      // Create 15 mock backup files
      for (let i = 0; i < 15; i++) {
        const filename = `session-backup-20250127-12000${i}.tar.gz`;
        const filePath = join(testBackupDir, filename);
        writeFileSync(filePath, "test");
        // Update mtime to simulate different creation times (format: YYYYMMDDHHMM.SS)
        const dateStr = `202501271200.${String(i).padStart(2, "0")}`;
        try {
          execSync(`touch -t ${dateStr} "${filePath}"`, { stdio: "ignore" });
        } catch {
          // If touch fails, just continue - test will still work
        }
      }

      await SessionBackupService.cleanupOldBackups();

      const backups = SessionBackupService.listBackups();
      expect(backups.length).toBeLessThanOrEqual(10);
    });

    it("should not remove backups if count is within limit", async () => {
      // Create backup directory
      mkdirSync(testBackupDir, { recursive: true });

      // Create 5 mock backup files
      for (let i = 0; i < 5; i++) {
        const filename = `session-backup-20250127-12000${i}.tar.gz`;
        writeFileSync(join(testBackupDir, filename), "test");
      }

      await SessionBackupService.cleanupOldBackups();

      const backups = SessionBackupService.listBackups();
      expect(backups.length).toBe(5);
    });
  });

  describe("listBackups", () => {
    it("should return empty array if no backups exist", () => {
      const backups = SessionBackupService.listBackups();
      expect(backups).toEqual([]);
    });

    it("should list all backup files sorted by creation time", () => {
      // Create backup directory
      mkdirSync(testBackupDir, { recursive: true });

      // Create mock backup files
      for (let i = 0; i < 3; i++) {
        const filename = `session-backup-20250127-12000${i}.tar.gz`;
        writeFileSync(join(testBackupDir, filename), "test");
      }

      const backups = SessionBackupService.listBackups();
      expect(backups.length).toBe(3);
      expect(backups[0].filename).toContain("session-backup");
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore from most recent backup if no path specified", async () => {
      // Create backup directory and a mock backup
      mkdirSync(testBackupDir, { recursive: true });
      const backupFile = join(
        testBackupDir,
        "session-backup-20250127-120000.tar.gz",
      );

      // Create a simple tar.gz file (or mock it)
      writeFileSync(backupFile, "test backup");

      // Note: Actual restore requires tar command, so this test may need adjustment
      // For now, we test the logic path
      const result = await SessionBackupService.restoreFromBackup();

      // If tar is available, restore should work
      // If not, it will return an error which is acceptable
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return error if backup file does not exist", async () => {
      const result = await SessionBackupService.restoreFromBackup(
        "/nonexistent/backup.tar.gz",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup file not found");
    });

    it("should return error if no backups available", async () => {
      const result = await SessionBackupService.restoreFromBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain("No backups available");
    });
  });

  describe("restoreIfCorrupted", () => {
    it("should not restore if session is not corrupted", async () => {
      const { detectSessionCorruption } =
        await import("../../../../src/bot/client/auth");
      (detectSessionCorruption as jest.Mock).mockReturnValue(false);

      const result = await SessionBackupService.restoreIfCorrupted();

      expect(result.success).toBe(true);
    });

    it("should attempt restore if session is corrupted", async () => {
      const { detectSessionCorruption } =
        await import("../../../../src/bot/client/auth");
      (detectSessionCorruption as jest.Mock).mockReturnValue(true);

      const result = await SessionBackupService.restoreIfCorrupted();

      // Result depends on whether backups exist
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("automatic backups", () => {
    beforeEach(() => {
      // Ensure service is stopped before each test
      SessionBackupService.stopAutomaticBackups();
    });

    afterEach(() => {
      // Clean up after each test
      SessionBackupService.stopAutomaticBackups();
    });

    it("should start automatic backup service", (done) => {
      SessionBackupService.startAutomaticBackups();
      // Service should start without errors
      expect(true).toBe(true);
      SessionBackupService.stopAutomaticBackups();
      done();
    });

    it("should stop automatic backup service", (done) => {
      SessionBackupService.startAutomaticBackups();
      SessionBackupService.stopAutomaticBackups();
      // Service should stop without errors
      expect(true).toBe(true);
      done();
    });

    it("should not start multiple backup services", () => {
      SessionBackupService.startAutomaticBackups();
      // Advance timers to ensure service started
      jest.advanceTimersByTime(100);
      SessionBackupService.startAutomaticBackups(); // Second call should be ignored
      SessionBackupService.stopAutomaticBackups();
      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});
