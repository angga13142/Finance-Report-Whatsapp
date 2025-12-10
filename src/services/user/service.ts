import { PrismaClient, User, UserRole } from "@prisma/client";
import { logger } from "../../lib/logger";
import { AuditLogger } from "../audit/logger";
import { redis } from "../../lib/redis";

const prisma = new PrismaClient();

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

/**
 * User list with statistics
 */
export interface UserListResult {
  users: Array<
    User & {
      transactionCount: number;
      lastTransactionDate: Date | null;
    }
  >;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: Record<UserRole, number>;
}

/**
 * User management service
 * Handles user CRUD operations, role management, and user statistics
 */
export class UserService {
  /**
   * List all users with statistics
   */
  static async listUsers(filter?: {
    role?: UserRole;
    isActive?: boolean;
  }): Promise<UserListResult> {
    try {
      const where: {
        role?: UserRole;
        isActive?: boolean;
      } = {};

      if (filter?.role) {
        where.role = filter.role;
      }

      if (filter?.isActive !== undefined) {
        where.isActive = filter.isActive;
      }

      // Get users with transaction counts
      const users = await prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
          transactions: {
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
            select: {
              timestamp: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Transform data
      const enrichedUsers = users.map((user) => ({
        ...user,
        transactionCount: user._count.transactions,
        lastTransactionDate:
          user.transactions.length > 0 ? user.transactions[0].timestamp : null,
        _count: undefined,
        transactions: undefined,
      }));

      // Calculate statistics
      const totalUsers = users.length;
      const activeUsers = users.filter((u) => u.isActive).length;
      const inactiveUsers = totalUsers - activeUsers;

      const usersByRole: Record<UserRole, number> = {
        dev: 0,
        boss: 0,
        employee: 0,
        investor: 0,
      };

      users.forEach((user) => {
        usersByRole[user.role]++;
      });

      logger.info("Users listed", {
        totalUsers,
        activeUsers,
        inactiveUsers,
        filter,
      });

      return {
        users: enrichedUsers as Array<
          User & {
            transactionCount: number;
            lastTransactionDate: Date | null;
          }
        >,
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole,
      };
    } catch (error) {
      logger.error("Error listing users", { error, filter });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return user;
    } catch (error) {
      logger.error("Error getting user by ID", { error, userId });
      throw error;
    }
  }

  /**
   * Get user by phone number
   */
  static async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      return user;
    } catch (error) {
      logger.error("Error getting user by phone number", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserData,
    createdByUserId: string,
  ): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByPhoneNumber(data.phoneNumber);
      if (existingUser) {
        throw new Error(
          `User with phone number ${data.phoneNumber} already exists`,
        );
      }

      const user = await prisma.user.create({
        data: {
          phoneNumber: data.phoneNumber,
          name: data.name,
          role: data.role,
          isActive: true,
          createdAt: new Date(),
        },
      });

      // Log audit
      await AuditLogger.logUserCreated(createdByUserId, user.id, {
        phoneNumber: user.phoneNumber,
        name: user.name || undefined,
        role: user.role,
      });

      logger.info("User created", {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        createdBy: createdByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error creating user", { error, data });
      throw error;
    }
  }

  /**
   * Update user
   */
  static async updateUser(
    userId: string,
    data: UpdateUserData,
    updatedByUserId: string,
  ): Promise<User> {
    try {
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          role: data.role,
          isActive: data.isActive,
        },
      });

      // Log role change if applicable
      if (data.role && data.role !== existingUser.role) {
        await AuditLogger.logUserRoleChanged(
          updatedByUserId,
          userId,
          existingUser.role,
          data.role,
        );
      }

      // Log deactivation if applicable
      if (data.isActive === false && existingUser.isActive === true) {
        await AuditLogger.logUserDeactivated(updatedByUserId, userId);
      }

      // Log activation if applicable
      if (data.isActive === true && existingUser.isActive === false) {
        await AuditLogger.logUserActivated(updatedByUserId, userId);
      }

      logger.info("User updated", {
        userId,
        changes: data,
        updatedBy: updatedByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error updating user", { error, userId, data });
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(
    userId: string,
    deactivatedByUserId: string,
    reason?: string,
  ): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
        },
      });

      // Log audit
      await AuditLogger.logUserDeactivated(deactivatedByUserId, userId, reason);

      // Clear user session
      await this.resetUserSession(userId, deactivatedByUserId);

      logger.info("User deactivated", {
        userId,
        reason,
        deactivatedBy: deactivatedByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error deactivating user", { error, userId });
      throw error;
    }
  }

  /**
   * Activate user
   */
  static async activateUser(
    userId: string,
    activatedByUserId: string,
  ): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: true,
        },
      });

      // Log audit
      await AuditLogger.logUserActivated(activatedByUserId, userId);

      logger.info("User activated", {
        userId,
        activatedBy: activatedByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error activating user", { error, userId });
      throw error;
    }
  }

  /**
   * Change user role
   */
  static async changeUserRole(
    userId: string,
    newRole: UserRole,
    changedByUserId: string,
  ): Promise<User> {
    try {
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          role: newRole,
        },
      });

      // Log audit
      await AuditLogger.logUserRoleChanged(
        changedByUserId,
        userId,
        existingUser.role,
        newRole,
      );

      logger.info("User role changed", {
        userId,
        oldRole: existingUser.role,
        newRole,
        changedBy: changedByUserId,
      });

      return user;
    } catch (error) {
      logger.error("Error changing user role", { error, userId, newRole });
      throw error;
    }
  }

  /**
   * Reset user session
   */
  static async resetUserSession(
    userId: string,
    resetByUserId: string,
  ): Promise<void> {
    try {
      // Delete all user sessions from database
      await prisma.userSession.deleteMany({
        where: { userId },
      });

      // Clear Redis session
      const sessionKey = `session:${userId}`;
      await redis.del(sessionKey);

      // Log audit
      await AuditLogger.logSessionReset(resetByUserId, userId);

      logger.info("User session reset", {
        userId,
        resetBy: resetByUserId,
      });
    } catch (error) {
      logger.error("Error resetting user session", { error, userId });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStatistics(userId: string): Promise<{
    totalTransactions: number;
    totalIncome: number;
    totalExpense: number;
    lastTransactionDate: Date | null;
    accountAge: number;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          transactions: {
            select: {
              type: true,
              amount: true,
              timestamp: true,
            },
            orderBy: {
              timestamp: "desc",
            },
          },
        },
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      let totalIncome = 0;
      let totalExpense = 0;

      user.transactions.forEach((txn) => {
        if (txn.type === "income") {
          totalIncome += txn.amount.toNumber();
        } else {
          totalExpense += txn.amount.toNumber();
        }
      });

      const lastTransactionDate =
        user.transactions.length > 0 ? user.transactions[0].timestamp : null;

      const accountAge = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        totalTransactions: user.transactions.length,
        totalIncome,
        totalExpense,
        lastTransactionDate,
        accountAge,
      };
    } catch (error) {
      logger.error("Error getting user statistics", { error, userId });
      throw error;
    }
  }

  /**
   * Delete user (hard delete - use with caution)
   */
  static async deleteUser(
    userId: string,
    deletedByUserId: string,
  ): Promise<void> {
    try {
      // Check if user has transactions
      const transactionCount = await prisma.transaction.count({
        where: { userId },
      });

      if (transactionCount > 0) {
        throw new Error(
          `Cannot delete user with ${transactionCount} transactions. Deactivate instead.`,
        );
      }

      // Delete user
      await prisma.user.delete({
        where: { id: userId },
      });

      // Log audit (note: userId will be null as user is deleted)
      await AuditLogger.log(
        "user.deleted",
        {
          deletedUserId: userId,
        },
        deletedByUserId,
        userId,
        "User",
      );

      logger.info("User deleted", {
        userId,
        deletedBy: deletedByUserId,
      });
    } catch (error) {
      logger.error("Error deleting user", { error, userId });
      throw error;
    }
  }
}

export default UserService;
