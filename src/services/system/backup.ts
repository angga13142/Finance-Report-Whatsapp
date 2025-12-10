import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../lib/logger";

const execAsync = promisify(exec);

/**
 * Database backup and restore service
 * Handles PostgreSQL database backup/restore operations
 */

export interface BackupResult {
  success: boolean;
  filename?: string;
  path?: string;
  size?: string;
  error?: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: string;
  created: Date;
}

export class BackupService {
  private static readonly BACKUP_DIR = process.env.BACKUP_DIR || "./backups";
  private static readonly DB_URL = process.env.DATABASE_URL || "";

  /**
   * Create database backup
   */
  static async createBackup(userId: string): Promise<BackupResult> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup-${timestamp}.sql`;
      const backupPath = path.join(this.BACKUP_DIR, filename);

      // Extract database connection details from DATABASE_URL
      const dbUrl = new URL(this.DB_URL);
      const dbName = dbUrl.pathname.slice(1);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port || "5432";
      const dbUser = dbUrl.username;
      const dbPassword = dbUrl.password;

      // Create pg_dump command
      const dumpCommand = `PGPASSWORD='${dbPassword}' pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p -f ${backupPath}`;

      logger.info("Starting database backup", { filename, userId });

      // Execute pg_dump
      await execAsync(dumpCommand);

      // Get file size
      const stats = await fs.stat(backupPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      logger.info("Database backup created successfully", {
        filename,
        size: `${sizeInMB} MB`,
        userId,
      });

      return {
        success: true,
        filename,
        path: backupPath,
        size: `${sizeInMB} MB`,
      };
    } catch (error) {
      logger.error("Failed to create database backup", { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Restore database from backup
   */
  static async restoreBackup(
    backupFilename: string,
    userId: string,
  ): Promise<BackupResult> {
    try {
      const backupPath = path.join(this.BACKUP_DIR, backupFilename);

      // Verify backup file exists
      try {
        await fs.access(backupPath);
      } catch {
        return {
          success: false,
          error: "Backup file not found",
        };
      }

      // Extract database connection details
      const dbUrl = new URL(this.DB_URL);
      const dbName = dbUrl.pathname.slice(1);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port || "5432";
      const dbUser = dbUrl.username;
      const dbPassword = dbUrl.password;

      logger.warn(
        "Starting database restore - THIS WILL OVERWRITE CURRENT DATA",
        {
          backupFilename,
          userId,
        },
      );

      // Create psql restore command
      const restoreCommand = `PGPASSWORD='${dbPassword}' psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f ${backupPath}`;

      // Execute restore
      await execAsync(restoreCommand);

      logger.info("Database restore completed successfully", {
        backupFilename,
        userId,
      });

      return {
        success: true,
        filename: backupFilename,
      };
    } catch (error) {
      logger.error("Failed to restore database", {
        error,
        backupFilename,
        userId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List all available backups
   */
  static async listBackups(): Promise<BackupInfo[]> {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });

      const files = await fs.readdir(this.BACKUP_DIR);
      const backupFiles = files.filter((f) => f.endsWith(".sql"));

      const backups: BackupInfo[] = [];

      for (const file of backupFiles) {
        const filePath = path.join(this.BACKUP_DIR, file);
        const stats = await fs.stat(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        backups.push({
          filename: file,
          path: filePath,
          size: `${sizeInMB} MB`,
          created: stats.mtime,
        });
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created.getTime() - a.created.getTime());

      return backups;
    } catch (error) {
      logger.error("Failed to list backups", { error });
      return [];
    }
  }

  /**
   * Delete old backups (keep last N backups)
   */
  static async cleanupOldBackups(keepCount: number = 10): Promise<number> {
    try {
      const backups = await this.listBackups();

      if (backups.length <= keepCount) {
        return 0;
      }

      const toDelete = backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path);
          deletedCount++;
          logger.info("Old backup deleted", { filename: backup.filename });
        } catch (error) {
          logger.warn("Failed to delete old backup", {
            error,
            filename: backup.filename,
          });
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup old backups", { error });
      return 0;
    }
  }

  /**
   * Schedule automatic backups (called by cron job)
   */
  static async scheduleAutomaticBackup(): Promise<void> {
    try {
      logger.info("Starting scheduled automatic backup");

      const result = await this.createBackup("system");

      if (result.success) {
        // Cleanup old backups
        const deletedCount = await this.cleanupOldBackups(30); // Keep last 30 backups

        logger.info("Scheduled backup completed", {
          filename: result.filename,
          deletedOldBackups: deletedCount,
        });
      } else {
        logger.error("Scheduled backup failed", { error: result.error });
      }
    } catch (error) {
      logger.error("Error in scheduled backup", { error });
    }
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackup(backupFilename: string): Promise<boolean> {
    try {
      const backupPath = path.join(this.BACKUP_DIR, backupFilename);

      // Check if file exists and is readable
      await fs.access(backupPath, fs.constants.R_OK);

      // Check file size (should be > 0)
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        logger.warn("Backup file is empty", { backupFilename });
        return false;
      }

      // Additional integrity checks could be added here
      // (e.g., checking SQL syntax, verifying headers, etc.)

      return true;
    } catch (error) {
      logger.error("Backup verification failed", { error, backupFilename });
      return false;
    }
  }
}
