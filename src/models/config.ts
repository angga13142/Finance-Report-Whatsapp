import { PrismaClient, SystemConfig } from "@prisma/client";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

/**
 * SystemConfig model operations
 * Provides CRUD operations for system configuration values
 */
export class SystemConfigModel {
  /**
   * Find configuration by key
   */
  static async findByKey(key: string): Promise<SystemConfig | null> {
    try {
      return await prisma.systemConfig.findUnique({
        where: { key },
      });
    } catch (error) {
      logger.error("Error finding system config by key", { error, key });
      throw error;
    }
  }

  /**
   * Create new configuration entry
   */
  static async create(data: {
    key: string;
    value: string;
    description?: string;
    updatedBy?: string;
  }): Promise<SystemConfig> {
    try {
      // Validate key pattern: ^[A-Z_][A-Z0-9_]*$
      const keyPattern = /^[A-Z_][A-Z0-9_]*$/;
      if (!keyPattern.test(data.key)) {
        throw new Error(
          "Configuration key must match pattern: ^[A-Z_][A-Z0-9_]*$",
        );
      }

      // Check if key already exists
      const existing = await this.findByKey(data.key);
      if (existing) {
        throw new Error(`Configuration key '${data.key}' already exists`);
      }

      return await prisma.systemConfig.create({
        data: {
          key: data.key,
          value: data.value,
          description: data.description,
          updatedBy: data.updatedBy,
        },
      });
    } catch (error) {
      logger.error("Error creating system config", { error, data });
      throw error;
    }
  }

  /**
   * Update configuration value
   */
  static async update(
    key: string,
    data: {
      value: string;
      description?: string;
      updatedBy?: string;
    },
  ): Promise<SystemConfig> {
    try {
      const existing = await this.findByKey(key);
      if (!existing) {
        throw new Error(`Configuration key '${key}' not found`);
      }

      return await prisma.systemConfig.update({
        where: { key },
        data: {
          value: data.value,
          description: data.description,
          updatedBy: data.updatedBy,
        },
      });
    } catch (error) {
      logger.error("Error updating system config", { error, key, data });
      throw error;
    }
  }

  /**
   * Delete configuration entry
   */
  static async delete(key: string): Promise<SystemConfig> {
    try {
      const existing = await this.findByKey(key);
      if (!existing) {
        throw new Error(`Configuration key '${key}' not found`);
      }

      return await prisma.systemConfig.delete({
        where: { key },
      });
    } catch (error) {
      logger.error("Error deleting system config", { error, key });
      throw error;
    }
  }

  /**
   * List all configurations
   */
  static async list(): Promise<SystemConfig[]> {
    try {
      return await prisma.systemConfig.findMany({
        orderBy: { key: "asc" },
      });
    } catch (error) {
      logger.error("Error listing system configs", { error });
      throw error;
    }
  }
}

export default SystemConfigModel;
