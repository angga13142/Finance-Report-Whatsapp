/**
 * Integration tests for database backup service
 * Tests backup creation, restoration, verification, and cleanup
 */

import { BackupService } from "../../../src/services/system/backup";
import * as fs from "fs/promises";
import * as path from "path";
import { getPrismaClient } from "../../../src/lib/database";

describe("BackupService Integration Tests", () => {
  const TEST_BACKUP_DIR = path.join(__dirname, "../../../test-backups");
  const originalBackupDir = process.env.BACKUP_DIR;
  const testUserId = "test-backup-user";
  const prisma = getPrismaClient();

  beforeAll(async () => {
    // Set test backup directory
    process.env.BACKUP_DIR = TEST_BACKUP_DIR;

    // Ensure test backup directory exists
    await fs.mkdir(TEST_BACKUP_DIR, { recursive: true });

    // Create test data in database
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        phoneNumber: "+6281234567890",
        name: "Test Backup User",
        role: "employee",
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Restore original backup directory
    if (originalBackupDir) {
      process.env.BACKUP_DIR = originalBackupDir;
    } else {
      delete process.env.BACKUP_DIR;
    }

    // Clean up test data
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
      // User may not exist
    });

    // Clean up test backup directory
    try {
      const files = await fs.readdir(TEST_BACKUP_DIR);
      await Promise.all(
        files.map((file) => fs.unlink(path.join(TEST_BACKUP_DIR, file)))
      );
      await fs.rmdir(TEST_BACKUP_DIR);
    } catch {
      // Directory may not exist
    }

    await prisma.$disconnect();
  });

  describe("createBackup", () => {
    it("should create a database backup successfully", async () => {
      const result = await BackupService.createBackup(testUserId);

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify backup file exists
      if (result.path) {
        const exists = await fs
          .access(result.path)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it("should generate unique filenames for multiple backups", async () => {
      const result1 = await BackupService.createBackup(testUserId);
      const result2 = await BackupService.createBackup(testUserId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.filename).not.toBe(result2.filename);
    });

    it("should create backup with non-zero size", async () => {
      const result = await BackupService.createBackup(testUserId);

      expect(result.success).toBe(true);

      if (result.path) {
        const stats = await fs.stat(result.path);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe("listBackups", () => {
    beforeAll(async () => {
      // Create multiple test backups
      await BackupService.createBackup(testUserId);
      await BackupService.createBackup(testUserId);
      await BackupService.createBackup(testUserId);
    });

    it("should list all available backups", async () => {
      const backups = await BackupService.listBackups();

      expect(Array.isArray(backups)).toBe(true);
      expect(backups.length).toBeGreaterThanOrEqual(3);

      // Verify backup structure
      backups.forEach((backup) => {
        expect(backup.filename).toBeDefined();
        expect(backup.path).toBeDefined();
        expect(backup.size).toBeDefined();
        expect(backup.created).toBeInstanceOf(Date);
      });
    });

    it("should return backups sorted by creation date (newest first)", async () => {
      const backups = await BackupService.listBackups();

      for (let i = 0; i < backups.length - 1; i++) {
        expect(backups[i].created.getTime()).toBeGreaterThanOrEqual(
          backups[i + 1].created.getTime()
        );
      }
    });
  });

  describe("verifyBackup", () => {
    let testBackupFilename: string;

    beforeAll(async () => {
      const result = await BackupService.createBackup(testUserId);
      testBackupFilename = result.filename!;
    });

    it("should verify a valid backup successfully", async () => {
      const isValid = await BackupService.verifyBackup(testBackupFilename);
      expect(isValid).toBe(true);
    });

    it("should reject non-existent backup file", async () => {
      const isValid = await BackupService.verifyBackup(
        "non-existent-backup.sql"
      );
      expect(isValid).toBe(false);
    });

    it("should reject empty backup file", async () => {
      const emptyBackupPath = path.join(TEST_BACKUP_DIR, "empty-backup.sql");
      await fs.writeFile(emptyBackupPath, "");

      const isValid = await BackupService.verifyBackup("empty-backup.sql");
      expect(isValid).toBe(false);

      // Cleanup
      await fs.unlink(emptyBackupPath);
    });
  });

  describe("restoreBackup", () => {
    let backupFilename: string;

    beforeAll(async () => {
      // Create a backup to restore from
      const result = await BackupService.createBackup(testUserId);
      backupFilename = result.filename!;
    });

    it("should restore database from backup successfully", async () => {
      const result = await BackupService.restoreBackup(
        backupFilename,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should fail to restore from non-existent backup", async () => {
      const result = await BackupService.restoreBackup(
        "non-existent-backup.sql",
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("cleanupOldBackups", () => {
    beforeAll(async () => {
      // Create multiple backups
      for (let i = 0; i < 5; i++) {
        await BackupService.createBackup(testUserId);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("should delete old backups based on retention count", async () => {
      const backupsBeforeCleanup = await BackupService.listBackups();
      const initialCount = backupsBeforeCleanup.length;

      const deletedCount = await BackupService.cleanupOldBackups(2);

      const backupsAfterCleanup = await BackupService.listBackups();
      const finalCount = backupsAfterCleanup.length;

      expect(deletedCount).toBeGreaterThan(0);
      expect(finalCount).toBeLessThan(initialCount);
      expect(finalCount).toBeLessThanOrEqual(2);
    });

    it("should keep most recent backups", async () => {
      const backupsBeforeCleanup = await BackupService.listBackups();

      // Get the two most recent backup filenames
      const recentBackups = backupsBeforeCleanup
        .slice(0, 2)
        .map((b) => b.filename);

      await BackupService.cleanupOldBackups(2);

      const backupsAfterCleanup = await BackupService.listBackups();
      const remainingFilenames = backupsAfterCleanup.map((b) => b.filename);

      // Verify recent backups are still present
      recentBackups.forEach((filename) => {
        expect(remainingFilenames).toContain(filename);
      });
    });
  });

  describe("scheduleAutomaticBackup", () => {
    it("should execute automatic backup successfully", async () => {
      await BackupService.scheduleAutomaticBackup();

      const backupsAfterSchedule = await BackupService.listBackups();
      const finalCount = backupsAfterSchedule.length;

      // New backup should be created (unless all were cleaned up)
      // At minimum, the function should execute without throwing
      expect(finalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Backup Integrity", () => {
    it("should maintain data consistency after backup and restore", async () => {
      // Create test category first
      const testCategory = await prisma.category.create({
        data: {
          id: "test-category-backup",
          name: "Test Backup Category",
          type: "income",
          isActive: true,
        },
      });

      // Create test transaction
      const testTransaction = await prisma.transaction.create({
        data: {
          userId: testUserId,
          categoryId: testCategory.id,
          category: testCategory.name,
          amount: 100000,
          type: "income",
          timestamp: new Date(),
          approvalStatus: "approved",
        },
      });

      // Create backup
      const backupResult = await BackupService.createBackup(testUserId);
      expect(backupResult.success).toBe(true);

      // Verify transaction exists before restore
      const transactionBefore = await prisma.transaction.findUnique({
        where: { id: testTransaction.id },
      });
      expect(transactionBefore).not.toBeNull();

      // Restore backup (this would overwrite database)
      const restoreResult = await BackupService.restoreBackup(
        backupResult.filename!,
        testUserId
      );
      expect(restoreResult.success).toBe(true);

      // Verify transaction still exists after restore
      const transactionAfter = await prisma.transaction.findUnique({
        where: { id: testTransaction.id },
      });
      expect(transactionAfter).not.toBeNull();
      expect(transactionAfter?.amount).toEqual(testTransaction.amount);

      // Cleanup
      await prisma.transaction.delete({ where: { id: testTransaction.id } });
      await prisma.category.delete({ where: { id: testCategory.id } });
    }, 30000); // 30 second timeout for restore operation

    it("should verify backup file size is reasonable", async () => {
      const result = await BackupService.createBackup(testUserId);
      expect(result.success).toBe(true);

      if (result.path) {
        const stats = await fs.stat(result.path);
        // Backup should be at least 1KB and less than 100MB for test database
        expect(stats.size).toBeGreaterThan(1024);
        expect(stats.size).toBeLessThan(100 * 1024 * 1024);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle missing DATABASE_URL gracefully", async () => {
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      const result = await BackupService.createBackup(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore DATABASE_URL
      process.env.DATABASE_URL = originalDbUrl;
    });

    it("should handle invalid backup directory gracefully", async () => {
      const originalBackupDir = process.env.BACKUP_DIR;
      process.env.BACKUP_DIR = "/invalid/readonly/path";

      const result = await BackupService.createBackup(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore backup directory
      process.env.BACKUP_DIR = originalBackupDir;
    });
  });
});
