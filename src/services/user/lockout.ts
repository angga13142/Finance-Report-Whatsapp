import { logger } from "../../lib/logger";
import { AuditLogger } from "../audit/logger";
import { getPrismaClient } from "../../lib/database";

/**
 * Account lockout configuration
 */
const LOCKOUT_CONFIG = {
  // Number of failed attempts before lockout
  MAX_FAILED_ATTEMPTS: 5,
  // Lockout duration in minutes
  LOCKOUT_DURATION_MINUTES: 15,
  // Time window for failed attempts (in minutes)
  ATTEMPT_WINDOW_MINUTES: 15,
};

/**
 * Account lockout service
 * Implements brute-force protection by locking accounts after failed login attempts
 */
export class AccountLockoutService {
  /**
   * Record a failed login attempt for a user
   * @param phoneNumber - User's phone number
   * @returns true if user should be locked out, false otherwise
   */
  static async recordFailedAttempt(phoneNumber: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber },
        select: {
          id: true,
          phoneNumber: true,
          failedLoginAttempts: true,
          lastFailedLoginAt: true,
          lockedUntil: true,
        },
      });

      if (!user) {
        logger.warn("Failed login attempt for non-existent user", {
          phoneNumber,
        });
        return false;
      }

      // Check if user is currently locked out
      if (user.lockedUntil !== null && user.lockedUntil > now) {
        logger.warn("Login attempt for locked account", {
          userId: user.id,
          phoneNumber,
          lockedUntil: user.lockedUntil,
        });
        return true;
      }

      // Check if last failed attempt was within the window
      const isWithinWindow =
        user.lastFailedLoginAt !== null &&
        now.getTime() - user.lastFailedLoginAt.getTime() <
          LOCKOUT_CONFIG.ATTEMPT_WINDOW_MINUTES * 60 * 1000;

      // Reset counter if outside the window
      const newFailedAttempts = isWithinWindow
        ? user.failedLoginAttempts + 1
        : 1;

      // Determine if user should be locked out
      const shouldLockOut =
        newFailedAttempts >= LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS;

      // Calculate lock duration
      const lockedUntil = shouldLockOut
        ? new Date(
            now.getTime() +
              LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000,
          )
        : null;

      // Update user record
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lastFailedLoginAt: now,
          lockedUntil,
        },
      });

      // Log the failed attempt
      await AuditLogger.logAuthFailed(
        phoneNumber,
        `Failed login attempt (${newFailedAttempts}/${LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS})`,
      );

      if (shouldLockOut) {
        logger.warn("Account locked due to multiple failed attempts", {
          userId: user.id,
          phoneNumber,
          attempts: newFailedAttempts,
          lockedUntil,
        });

        // Notify administrators
        await this.notifyAccountLocked(user.id, phoneNumber, newFailedAttempts);
      }

      return shouldLockOut;
    } catch (error) {
      logger.error("Error recording failed login attempt", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Record a successful login and reset failed attempts
   * @param phoneNumber - User's phone number
   */
  static async recordSuccessfulLogin(phoneNumber: string): Promise<void> {
    const prisma = getPrismaClient();

    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!user) {
        return;
      }

      // Reset failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lockedUntil: null,
        },
      });

      logger.debug("Failed login attempts reset for user", {
        userId: user.id,
        phoneNumber,
      });
    } catch (error) {
      logger.error("Error resetting failed login attempts", {
        error,
        phoneNumber,
      });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Check if a user account is currently locked out
   * @param phoneNumber - User's phone number
   * @returns Lockout status with details
   */
  static async getAccountLockoutStatus(
    phoneNumber: string,
  ): Promise<{
    isLocked: boolean;
    remainingMinutes?: number;
    failedAttempts?: number;
    maxAttempts: number;
  }> {
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!user) {
        return {
          isLocked: false,
          maxAttempts: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
        };
      }

      // Check if lockout period has expired
      const isLocked = user.lockedUntil !== null && user.lockedUntil > now;

      // Auto-unlock if lock period has expired
      if (user.lockedUntil !== null && user.lockedUntil <= now) {
        await this.unlockAccount(phoneNumber);
        return {
          isLocked: false,
          maxAttempts: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
        };
      }

      if (!isLocked) {
        return {
          isLocked: false,
          failedAttempts: user.failedLoginAttempts,
          maxAttempts: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
        };
      }

      const remainingSeconds =
        user.lockedUntil !== null
          ? (user.lockedUntil.getTime() - now.getTime()) / 1000
          : 0;
      const remainingMinutes = Math.ceil(remainingSeconds / 60);

      return {
        isLocked: true,
        remainingMinutes,
        failedAttempts: user.failedLoginAttempts,
        maxAttempts: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
      };
    } catch (error) {
      logger.error("Error checking account lockout status", {
        error,
        phoneNumber,
      });
      return {
        isLocked: false,
        maxAttempts: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
      };
    }
  }

  /**
   * Manually unlock an account (admin operation)
   * @param phoneNumber - User's phone number
   */
  static async unlockAccount(phoneNumber: string): Promise<void> {
    const prisma = getPrismaClient();

    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!user) {
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lockedUntil: null,
        },
      });

      logger.info("Account unlocked manually", {
        userId: user.id,
        phoneNumber,
      });

      // Log admin action
      await AuditLogger.logAuthFailed(phoneNumber, "Manual unlock by admin");
    } catch (error) {
      logger.error("Error unlocking account", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Get accounts currently locked out (admin function)
   * @returns List of locked accounts
   */
  static async getLockedAccounts(): Promise<
    Array<{
      userId: string;
      phoneNumber: string;
      failedAttempts: number;
      lockedUntil: Date;
    }>
  > {
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const lockedUsers = await prisma.user.findMany({
        where: {
          lockedUntil: {
            gt: now,
          },
        },
        select: {
          id: true,
          phoneNumber: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      });

      return lockedUsers.map((user) => ({
        userId: user.id,
        phoneNumber: user.phoneNumber,
        failedAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil ?? new Date(),
      }));
    } catch (error) {
      logger.error("Error getting locked accounts", { error });
      return [];
    }
  }

  /**
   * Clean up expired lockouts (should be run periodically)
   * @returns Number of accounts unlocked
   */
  static async cleanupExpiredLockouts(): Promise<number> {
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const result = await prisma.user.updateMany({
        where: {
          lockedUntil: {
            lte: now,
          },
        },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lockedUntil: null,
        },
      });

      if (result.count > 0) {
        logger.info("Cleaned up expired account lockouts", {
          count: result.count,
        });
      }

      return result.count;
    } catch (error) {
      logger.error("Error cleaning up expired lockouts", { error });
      return 0;
    }
  }

  /**
   * Notify administrators about account lockout
   * @param userId - User ID that was locked
   * @param phoneNumber - User's phone number
   * @param failedAttempts - Number of failed attempts
   */
  private static async notifyAccountLocked(
    userId: string,
    phoneNumber: string,
    failedAttempts: number,
  ): Promise<void> {
    try {
      // This would integrate with notification service (WhatsApp, email, etc.)
      // For now, just log it
      logger.warn("Account lockout notification sent", {
        userId,
        phoneNumber,
        failedAttempts,
        lockoutDurationMinutes: LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES,
      });

      // Future: Send WhatsApp notification to admins
      // await notificationService.notifyAdmins({
      //   type: 'ACCOUNT_LOCKED',
      //   userId,
      //   phoneNumber,
      //   failedAttempts
      // });
    } catch (error) {
      logger.error("Error sending account lockout notification", {
        error,
        userId,
      });
    }
  }
}

export default AccountLockoutService;
