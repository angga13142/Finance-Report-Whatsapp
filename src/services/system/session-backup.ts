/**
 * Session Backup Service
 * Provides automatic session backups, cleanup, and restore functionality
 */

import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { detectSessionCorruption } from "../../bot/client/auth";

const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BACKUPS = 10;
const CLIENT_ID = "session-cashflow-bot";
const BACKUP_FILENAME_PREFIX = "session-backup";
const BACKUP_FILENAME_SUFFIX = ".tar.gz";

/**
 * Session backup result
 */
export interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Restore result
 */
export interface RestoreResult {
  success: boolean;
  restoredFrom?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Session Backup Service
 * Handles automatic backups, cleanup, and restore
 */
export class SessionBackupService {
  private static backupInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Get backup directory path
   */
  private static getBackupDirectory(): string {
    const sessionPath = env.WHATSAPP_SESSION_PATH;
    const fullSessionPath = join(sessionPath, CLIENT_ID);
    return join(fullSessionPath, ".backups");
  }

  /**
   * Get session directory path
   */
  private static getSessionDirectory(): string {
    const sessionPath = env.WHATSAPP_SESSION_PATH;
    return join(sessionPath, CLIENT_ID);
  }

  /**
   * Generate backup filename with timestamp
   */
  private static generateBackupFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${BACKUP_FILENAME_PREFIX}-${year}${month}${day}-${hours}${minutes}${seconds}${BACKUP_FILENAME_SUFFIX}`;
  }

  /**
   * Create a backup of the current session
   */
  static async createBackup(): Promise<BackupResult> {
    const timestamp = new Date();

    try {
      const sessionDir = this.getSessionDirectory();
      const backupDir = this.getBackupDirectory();

      // Check if session directory exists
      if (!existsSync(sessionDir)) {
        logger.warn("Session directory does not exist, skipping backup", {
          sessionDir,
        });
        return {
          success: false,
          error: "Session directory does not exist",
          timestamp,
        };
      }

      // Ensure backup directory exists
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
        logger.info("Created backup directory", { backupDir });
      }

      // Generate backup filename
      const backupFilename = this.generateBackupFilename();
      const backupPath = join(backupDir, backupFilename);

      // Create tar.gz backup
      try {
        // Use tar command to create compressed backup
        const tarCommand = `tar -czf "${backupPath}" -C "${env.WHATSAPP_SESSION_PATH}" "${CLIENT_ID}" 2>/dev/null || true`;
        execSync(tarCommand, { stdio: "ignore" });

        // Verify backup was created
        if (!existsSync(backupPath)) {
          throw new Error("Backup file was not created");
        }

        logger.info("Session backup created successfully", {
          backupPath,
          timestamp,
        });

        // Cleanup old backups
        await this.cleanupOldBackups();

        return {
          success: true,
          backupPath,
          timestamp,
        };
      } catch (error) {
        logger.error("Failed to create tar backup", {
          error,
          backupPath,
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Backup creation failed (tar command unavailable)",
          timestamp,
        };
      }
    } catch (error) {
      logger.error("Error creating session backup", {
        error,
        timestamp,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      };
    }
  }

  /**
   * Cleanup old backups, keeping only the last MAX_BACKUPS
   */
  static async cleanupOldBackups(): Promise<void> {
    try {
      const backupDir = this.getBackupDirectory();

      if (!existsSync(backupDir)) {
        return;
      }

      // Get all backup files
      const files = readdirSync(backupDir)
        .filter((file) => file.startsWith(BACKUP_FILENAME_PREFIX))
        .map((file) => {
          const filePath = join(backupDir, file);
          const stats = statSync(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime,
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Newest first

      // Remove backups beyond MAX_BACKUPS
      if (files.length > MAX_BACKUPS) {
        const toRemove = files.slice(MAX_BACKUPS);

        for (const file of toRemove) {
          try {
            rmSync(file.path, { recursive: true, force: true });
            logger.debug("Removed old backup", {
              backupPath: file.path,
              backupName: file.name,
            });
          } catch (error) {
            logger.warn("Failed to remove old backup", {
              error,
              backupPath: file.path,
            });
          }
        }

        logger.info("Cleaned up old backups", {
          removed: toRemove.length,
          kept: MAX_BACKUPS,
        });
      }
    } catch (error) {
      logger.error("Error cleaning up old backups", { error });
      // Don't throw - cleanup failures shouldn't break backup creation
    }
  }

  /**
   * Get list of available backups
   */
  static listBackups(): Array<{
    filename: string;
    path: string;
    size: number;
    created: Date;
  }> {
    try {
      const backupDir = this.getBackupDirectory();

      if (!existsSync(backupDir)) {
        return [];
      }

      const files = readdirSync(backupDir)
        .filter((file) => file.startsWith(BACKUP_FILENAME_PREFIX))
        .map((file) => {
          const filePath = join(backupDir, file);
          const stats = statSync(filePath);
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime()); // Newest first

      return files;
    } catch (error) {
      logger.error("Error listing backups", { error });
      return [];
    }
  }

  /**
   * Restore session from most recent backup
   */
  static async restoreFromBackup(backupPath?: string): Promise<RestoreResult> {
    const timestamp = new Date();

    try {
      const sessionDir = this.getSessionDirectory();

      // Determine which backup to restore
      let targetBackup: string | undefined = backupPath;

      if (!targetBackup) {
        // Get most recent backup
        const backups = this.listBackups();
        if (backups.length === 0) {
          return {
            success: false,
            error: "No backups available",
            timestamp,
          };
        }
        targetBackup = backups[0].path;
      }

      if (!existsSync(targetBackup)) {
        return {
          success: false,
          error: `Backup file not found: ${targetBackup}`,
          timestamp,
        };
      }

      // Remove existing session directory if it exists
      if (existsSync(sessionDir)) {
        logger.info("Removing existing session directory before restore", {
          sessionDir,
        });
        rmSync(sessionDir, { recursive: true, force: true });
      }

      // Restore from backup
      try {
        // Extract tar.gz backup
        const extractCommand = `tar -xzf "${targetBackup}" -C "${env.WHATSAPP_SESSION_PATH}"`;
        execSync(extractCommand, { stdio: "ignore" });

        logger.info("Session restored successfully from backup", {
          backupPath: targetBackup,
          sessionDir,
          timestamp,
        });

        return {
          success: true,
          restoredFrom: targetBackup,
          timestamp,
        };
      } catch (error) {
        logger.error("Failed to extract backup", {
          error,
          backupPath: targetBackup,
        });

        return {
          success: false,
          error: "Failed to extract backup (tar command unavailable)",
          timestamp,
        };
      }
    } catch (error) {
      logger.error("Error restoring session from backup", {
        error,
        timestamp,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      };
    }
  }

  /**
   * Start automatic backup service
   */
  static startAutomaticBackups(): void {
    if (this.isRunning) {
      logger.warn("Automatic backup service is already running");
      return;
    }

    logger.info("Starting automatic session backup service", {
      interval: `${BACKUP_INTERVAL_MS / 1000} seconds`,
    });

    // Create initial backup
    this.createBackup().catch((error: unknown) => {
      logger.error("Initial backup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Schedule periodic backups
    this.backupInterval = setInterval(() => {
      if (!this.isRunning) {
        this.isRunning = true;
        this.createBackup()
          .then((result) => {
            if (!result.success) {
              logger.warn("Automatic backup failed", {
                error: result.error,
              });
            }
          })
          .catch((error: unknown) => {
            logger.error("Automatic backup error", {
              error: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            this.isRunning = false;
          });
      }
    }, BACKUP_INTERVAL_MS);

    this.isRunning = false; // Reset flag after initial backup
  }

  /**
   * Stop automatic backup service
   */
  static stopAutomaticBackups(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      this.isRunning = false;
      logger.info("Stopped automatic session backup service");
    }
  }

  /**
   * Restore from most recent backup if session is corrupted
   */
  static async restoreIfCorrupted(): Promise<RestoreResult> {
    const sessionPath = env.WHATSAPP_SESSION_PATH;
    const isCorrupted = detectSessionCorruption(sessionPath);

    if (!isCorrupted) {
      logger.debug("Session is not corrupted, no restore needed");
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    logger.warn("Session corruption detected, attempting restore from backup");

    const restoreResult = await this.restoreFromBackup();

    if (restoreResult.success) {
      logger.info("Session restored successfully from backup", {
        restoredFrom: restoreResult.restoredFrom,
      });
    } else {
      logger.error("Failed to restore session from backup", {
        error: restoreResult.error,
      });
    }

    return restoreResult;
  }
}

export default SessionBackupService;
