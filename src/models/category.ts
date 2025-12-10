import { PrismaClient, Category, TransactionType } from "@prisma/client";
import { logger } from "../lib/logger";
import { validateStringLength } from "../lib/validation";

const prisma = new PrismaClient();

/**
 * Category model operations
 */
export class CategoryModel {
  /**
   * Find category by ID
   */
  static async findById(id: string): Promise<Category | null> {
    try {
      return await prisma.category.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Error finding category by ID", { error, id });
      throw error;
    }
  }

  /**
   * Find category by name
   */
  static async findByName(name: string): Promise<Category | null> {
    try {
      return await prisma.category.findUnique({
        where: { name },
      });
    } catch (error) {
      logger.error("Error finding category by name", { error, name });
      throw error;
    }
  }

  /**
   * Find all active categories
   */
  static async findActiveCategories(): Promise<Category[]> {
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      logger.error("Error finding active categories", { error });
      throw error;
    }
  }

  /**
   * Find categories by type
   */
  static async findByType(
    type: TransactionType,
    activeOnly: boolean = true,
  ): Promise<Category[]> {
    try {
      return await prisma.category.findMany({
        where: {
          type,
          ...(activeOnly && { isActive: true }),
        },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      logger.error("Error finding categories by type", { error, type });
      throw error;
    }
  }

  /**
   * Create new category
   */
  static async create(data: {
    name: string;
    type: TransactionType;
    icon?: string;
    createdByUserId?: string;
    isActive?: boolean;
  }): Promise<Category> {
    try {
      validateStringLength(data.name, 1, 100, "Category name");

      if (data.icon) {
        validateStringLength(data.icon, 1, 10, "Category icon");
      }

      // Check if category already exists
      const existing = await this.findByName(data.name);
      if (existing) {
        throw new Error("Category with this name already exists");
      }

      return await prisma.category.create({
        data: {
          name: data.name,
          type: data.type,
          icon: data.icon,
          createdByUserId: data.createdByUserId,
          isActive: data.isActive ?? true,
        },
      });
    } catch (error) {
      logger.error("Error creating category", { error, data });
      throw error;
    }
  }

  /**
   * Update category
   */
  static async update(
    id: string,
    data: Partial<{
      name: string;
      icon: string;
      isActive: boolean;
    }>,
  ): Promise<Category> {
    try {
      if (data.name) {
        validateStringLength(data.name, 1, 100, "Category name");
      }
      if (data.icon) {
        validateStringLength(data.icon, 1, 10, "Category icon");
      }

      return await prisma.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error("Error updating category", { error, id, data });
      throw error;
    }
  }

  /**
   * Deactivate category
   */
  static async deactivate(id: string): Promise<Category> {
    try {
      return await prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error("Error deactivating category", { error, id });
      throw error;
    }
  }

  /**
   * Activate category
   */
  static async activate(id: string): Promise<Category> {
    try {
      return await prisma.category.update({
        where: { id },
        data: { isActive: true },
      });
    } catch (error) {
      logger.error("Error activating category", { error, id });
      throw error;
    }
  }

  /**
   * Delete category (soft delete by deactivating)
   */
  static async delete(id: string): Promise<Category> {
    return this.deactivate(id);
  }
}

export default CategoryModel;
