/**
 * RBAC Service
 * Provides role grant/revoke operations with immediate session permission updates
 */

import { UserRole } from "@prisma/client";
import { UserService } from "./service";
import { UserModel } from "../../models/user";
import { logger } from "../../lib/logger";
import { redis } from "../../lib/redis";
import { AuditLogger } from "../audit/logger";

/**
 * RBAC Service
 * Handles role management with session updates
 */
export class RBACService {
  /**
   * Grant role to user with immediate session permission update
   */
  static async grantRole(
    phoneNumber: string,
    role: UserRole,
    grantedBy: string,
  ): Promise<void> {
    try {
      // Get user
      const user = await UserModel.findByPhoneNumber(phoneNumber);
      if (!user) {
        throw new Error(`User with phone number ${phoneNumber} not found`);
      }

      // Prevent changing dev role
      if (user.role === "dev" && role !== "dev") {
        throw new Error("Cannot change dev role");
      }

      // Prevent granting dev role (security restriction)
      if (role === "dev") {
        throw new Error("Cannot grant dev role via command");
      }

      // Update user role
      await UserService.changeUserRole(user.id, role, grantedBy);

      // Clear user session cache to force permission refresh
      await this.clearUserSessionCache(user.id);

      // Log audit
      await AuditLogger.log(
        "role.grant",
        {
          targetUserId: user.id,
          targetPhoneNumber: phoneNumber,
          newRole: role,
          previousRole: user.role,
        },
        grantedBy,
      );

      logger.info("Role granted", {
        userId: user.id,
        phoneNumber,
        role,
        grantedBy,
      });
    } catch (error) {
      logger.error("Error granting role", { error, phoneNumber, role });
      throw error;
    }
  }

  /**
   * Revoke role from user (downgrade to employee) with immediate session update
   */
  static async revokeRole(
    phoneNumber: string,
    role: UserRole,
    revokedBy: string,
  ): Promise<void> {
    try {
      // Get user
      const user = await UserModel.findByPhoneNumber(phoneNumber);
      if (!user) {
        throw new Error(`User with phone number ${phoneNumber} not found`);
      }

      // Prevent revoking dev role
      if (user.role === "dev") {
        throw new Error("Cannot revoke dev role");
      }

      // Verify user has the role to revoke
      if (user.role !== role) {
        throw new Error(`User does not have role ${role}`);
      }

      // Downgrade to employee
      await UserService.changeUserRole(user.id, "employee", revokedBy);

      // Clear user session cache to force permission refresh
      await this.clearUserSessionCache(user.id);

      // Log audit
      await AuditLogger.log(
        "role.revoke",
        {
          targetUserId: user.id,
          targetPhoneNumber: phoneNumber,
          revokedRole: role,
          newRole: "employee",
        },
        revokedBy,
      );

      logger.info("Role revoked", {
        userId: user.id,
        phoneNumber,
        role,
        revokedBy,
      });
    } catch (error) {
      logger.error("Error revoking role", { error, phoneNumber, role });
      throw error;
    }
  }

  /**
   * Clear user session cache to force permission refresh
   */
  private static async clearUserSessionCache(userId: string): Promise<void> {
    try {
      // Clear all session-related cache keys for this user
      const sessionKeys = [
        `session:${userId}`,
        `user:${userId}:role`,
        `user:${userId}:permissions`,
        `context:${userId}:*`,
      ];

      for (const keyPattern of sessionKeys) {
        try {
          await redis.del(keyPattern.replace("*", ""));
          // Also clear pattern-matched keys
          const keys = await redis.keys(keyPattern);
          if (keys.length > 0) {
            for (const key of keys) {
              await redis.del(key);
            }
          }
        } catch (error) {
          logger.warn("Failed to clear session cache key", {
            error,
            keyPattern,
            userId,
          });
        }
      }

      logger.debug("User session cache cleared", { userId });
    } catch (error) {
      logger.warn("Error clearing user session cache", { error, userId });
      // Don't throw - cache clearing is best effort
    }
  }
}

export default RBACService;
