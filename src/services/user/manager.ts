/**
 * User Manager Service
 * Handles user management operations (create, list, update, delete, activate, deactivate)
 * with RBAC enforcement, phone validation, and audit logging
 */

import { UserRole } from "@prisma/client";
import { UserModel } from "../../models/user";
import { UserService, type UserListResult } from "./service";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
} from "../../lib/validation";
import { logger } from "../../lib/logger";
import { AuditLogger } from "../audit/logger";
import { redis } from "../../lib/redis";

/**
 * User creation data
 */
export interface CreateUserData {
  phoneNumber: string;
  name?: string;
  role: UserRole;
}

/**
 * User update data
 */
export interface UpdateUserData {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// Re-export UserListResult from UserService
export type { UserListResult };

/**
 * User Manager Service
 * Provides user management operations with RBAC enforcement
 */
export class UserManagerService {
  /**
   * Check if user role has permission to manage users
   */
  private static checkPermission(userRole: UserRole): void {
    if (userRole !== "boss" && userRole !== "dev") {
      throw new Error(
        "Permission denied. Only boss and dev roles can manage users",
      );
    }
  }

  /**
   * Validate role enum value
   */
  private static validateRole(role: string): role is UserRole {
    const validRoles: UserRole[] = ["dev", "boss", "employee", "investor"];
    return validRoles.includes(role as UserRole);
  }

  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserData,
    createdByUserId: string,
    createdByRole: UserRole,
  ) {
    try {
      // RBAC check
      this.checkPermission(createdByRole);

      // Validate role
      if (!this.validateRole(data.role)) {
        throw new Error(`Invalid role. Must be: dev, boss, employee, investor`);
      }

      // Normalize and validate phone number
      const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
      validatePhoneNumber(normalizedPhone);

      // Check for duplicate phone number
      const existingUser = await UserModel.findByPhoneNumber(normalizedPhone);
      if (existingUser) {
        throw new Error("User with this phone number already exists");
      }

      // Create user
      const user = await UserService.createUser(
        {
          phoneNumber: normalizedPhone,
          name: data.name,
          role: data.role,
        },
        createdByUserId,
      );

      // Log audit
      await AuditLogger.log(
        "user.create",
        {
          phoneNumber: normalizedPhone,
          name: data.name || undefined,
          role: data.role,
        },
        createdByUserId,
        user.id,
        "User",
      );

      logger.info("User created via UserManagerService", {
        userId: user.id,
        phoneNumber: normalizedPhone,
        role: data.role,
        createdBy: createdByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error creating user via UserManagerService", {
        error,
        data,
        createdBy: createdByUserId,
      });
      throw error;
    }
  }

  /**
   * List users with optional filter
   */
  static async listUsers(
    filter?: { role?: UserRole; isActive?: boolean },
    requestedByUserId?: string,
  ): Promise<UserListResult> {
    try {
      const result = await UserService.listUsers(filter);

      logger.info("Users listed via UserManagerService", {
        totalUsers: result.totalUsers,
        filter,
        requestedBy: requestedByUserId,
      });

      return result;
    } catch (error) {
      logger.error("Error listing users via UserManagerService", {
        error,
        filter,
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  static async updateUser(
    phoneNumber: string,
    data: UpdateUserData,
    updatedByUserId: string,
    updatedByRole: UserRole,
  ) {
    try {
      // RBAC check
      this.checkPermission(updatedByRole);

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      validatePhoneNumber(normalizedPhone);

      // Find user
      const user = await UserModel.findByPhoneNumber(normalizedPhone);
      if (!user) {
        throw new Error("User not found");
      }

      // Validate role if provided
      if (data.role && !this.validateRole(data.role)) {
        throw new Error(`Invalid role. Must be: dev, boss, employee, investor`);
      }

      // Update user
      const updatedUser = await UserService.updateUser(
        user.id,
        data,
        updatedByUserId,
      );

      // Log audit (UserService.updateUser already logs, but we add manager-level audit)
      await AuditLogger.log(
        "user.update",
        {
          phoneNumber: normalizedPhone,
          changes: data,
          previousRole: user.role,
          newRole: data.role || user.role,
        },
        updatedByUserId,
        user.id,
        "User",
      );

      // Invalidate session if role or isActive changed
      if (data.role || data.isActive !== undefined) {
        await this.invalidateUserSession(user.id);
      }

      logger.info("User updated via UserManagerService", {
        userId: user.id,
        phoneNumber: normalizedPhone,
        changes: data,
        updatedBy: updatedByUserId,
      });

      return updatedUser;
    } catch (error) {
      logger.error("Error updating user via UserManagerService", {
        error,
        phoneNumber,
        data,
      });
      throw error;
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(
    phoneNumber: string,
    deletedByUserId: string,
    deletedByRole: UserRole,
  ): Promise<void> {
    try {
      // RBAC check
      this.checkPermission(deletedByRole);

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      validatePhoneNumber(normalizedPhone);

      // Find user
      const user = await UserModel.findByPhoneNumber(normalizedPhone);
      if (!user) {
        throw new Error("User not found");
      }

      // Prevent deletion of dev role users
      if (user.role === "dev") {
        throw new Error("Cannot delete dev role user");
      }

      // Invalidate session before deletion
      await this.invalidateUserSession(user.id);

      // Delete user
      await UserService.deleteUser(user.id, deletedByUserId);

      logger.info("User deleted via UserManagerService", {
        userId: user.id,
        phoneNumber: normalizedPhone,
        deletedBy: deletedByUserId,
      });
    } catch (error) {
      logger.error("Error deleting user via UserManagerService", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Activate user
   */
  static async activateUser(
    phoneNumber: string,
    activatedByUserId: string,
    activatedByRole: UserRole,
  ) {
    try {
      // RBAC check
      this.checkPermission(activatedByRole);

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      validatePhoneNumber(normalizedPhone);

      // Find user
      const user = await UserModel.findByPhoneNumber(normalizedPhone);
      if (!user) {
        throw new Error("User not found");
      }

      // Activate user
      const activatedUser = await UserService.activateUser(
        user.id,
        activatedByUserId,
      );

      logger.info("User activated via UserManagerService", {
        userId: user.id,
        phoneNumber: normalizedPhone,
        activatedBy: activatedByUserId,
      });

      return activatedUser;
    } catch (error) {
      logger.error("Error activating user via UserManagerService", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(
    phoneNumber: string,
    deactivatedByUserId: string,
    deactivatedByRole: UserRole,
  ) {
    try {
      // RBAC check
      this.checkPermission(deactivatedByRole);

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      validatePhoneNumber(normalizedPhone);

      // Find user
      const user = await UserModel.findByPhoneNumber(normalizedPhone);
      if (!user) {
        throw new Error("User not found");
      }

      // Prevent deactivation of dev role users
      if (user.role === "dev") {
        throw new Error("Cannot deactivate dev role user");
      }

      // Deactivate user
      const deactivatedUser = await UserService.deactivateUser(
        user.id,
        deactivatedByUserId,
      );

      // Invalidate session
      await this.invalidateUserSession(user.id);

      logger.info("User deactivated via UserManagerService", {
        userId: user.id,
        phoneNumber: normalizedPhone,
        deactivatedBy: deactivatedByUserId,
      });

      return deactivatedUser;
    } catch (error) {
      logger.error("Error deactivating user via UserManagerService", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Invalidate user session in Redis
   */
  private static async invalidateUserSession(userId: string): Promise<void> {
    try {
      const sessionKey = `session:${userId}`;
      await redis.del(sessionKey);

      logger.debug("User session invalidated", { userId });
    } catch (error) {
      logger.warn("Error invalidating user session", { error, userId });
      // Don't throw - session invalidation is best effort
    }
  }
}

export default UserManagerService;
