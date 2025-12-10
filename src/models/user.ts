import { PrismaClient, User, UserRole } from "@prisma/client";
import { logger } from "../lib/logger";
import { normalizePhoneNumber, validatePhoneNumber } from "../lib/validation";

const prisma = new PrismaClient();

/**
 * User model operations
 */
export class UserModel {
  /**
   * Find user by phone number
   */
  static async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      return await prisma.user.findUnique({
        where: { phoneNumber: normalized },
      });
    } catch (error) {
      logger.error("Error finding user by phone number", {
        error,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Error finding user by ID", { error, id });
      throw error;
    }
  }

  /**
   * Create new user
   */
  static async create(data: {
    phoneNumber: string;
    name?: string;
    role?: UserRole;
    isActive?: boolean;
  }): Promise<User> {
    try {
      validatePhoneNumber(data.phoneNumber);
      const normalized = normalizePhoneNumber(data.phoneNumber);

      // Check if user already exists
      const existing = await this.findByPhoneNumber(normalized);
      if (existing) {
        throw new Error("User with this phone number already exists");
      }

      return await prisma.user.create({
        data: {
          phoneNumber: normalized,
          name: data.name,
          role: data.role || "employee",
          isActive: data.isActive ?? true,
        },
      });
    } catch (error) {
      logger.error("Error creating user", { error, data });
      throw error;
    }
  }

  /**
   * Update user
   */
  static async update(
    id: string,
    data: Partial<{
      name: string;
      role: UserRole;
      isActive: boolean;
      lastActive: Date;
      authTokenHash: string;
    }>,
  ): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error("Error updating user", { error, id, data });
      throw error;
    }
  }

  /**
   * Update last active timestamp
   */
  static async updateLastActive(id: string): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { lastActive: new Date() },
      });
    } catch (error) {
      logger.error("Error updating last active", { error, id });
      throw error;
    }
  }

  /**
   * Find all active users
   */
  static async findActiveUsers(): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error finding active users", { error });
      throw error;
    }
  }

  /**
   * Find users by role
   */
  static async findByRole(role: UserRole): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: { role, isActive: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error finding users by role", { error, role });
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  static async deactivate(id: string): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error("Error deactivating user", { error, id });
      throw error;
    }
  }

  /**
   * Activate user
   */
  static async activate(id: string): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data: { isActive: true },
      });
    } catch (error) {
      logger.error("Error activating user", { error, id });
      throw error;
    }
  }
}

export default UserModel;
