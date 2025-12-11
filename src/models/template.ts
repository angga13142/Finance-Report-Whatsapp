import { PrismaClient, MessageTemplate } from "@prisma/client";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

/**
 * MessageTemplate model operations
 * Provides CRUD operations for message templates
 */
export class MessageTemplateModel {
  /**
   * Find template by name
   */
  static async findByName(name: string): Promise<MessageTemplate | null> {
    try {
      return await prisma.messageTemplate.findUnique({
        where: { name },
      });
    } catch (error) {
      logger.error("Error finding message template by name", { error, name });
      throw error;
    }
  }

  /**
   * List all templates
   */
  static async list(): Promise<MessageTemplate[]> {
    try {
      return await prisma.messageTemplate.findMany({
        orderBy: { name: "asc" },
      });
    } catch (error) {
      logger.error("Error listing message templates", { error });
      throw error;
    }
  }

  /**
   * Create new template
   */
  static async create(data: {
    name: string;
    content: string;
    description?: string;
    updatedBy?: string;
  }): Promise<MessageTemplate> {
    try {
      // Validate name pattern: ^[a-z_][a-z0-9_]*$
      const namePattern = /^[a-z_][a-z0-9_]*$/;
      if (!namePattern.test(data.name)) {
        throw new Error(
          "Template name must match pattern: ^[a-z_][a-z0-9_]*$ (lowercase with underscores)",
        );
      }

      // Validate content length (max 5000 chars per spec)
      if (data.content.length > 5000) {
        throw new Error("Template content must not exceed 5000 characters");
      }

      // Check if name already exists
      const existing = await this.findByName(data.name);
      if (existing) {
        throw new Error(`Template name '${data.name}' already exists`);
      }

      return await prisma.messageTemplate.create({
        data: {
          name: data.name,
          content: data.content,
          description: data.description,
          updatedBy: data.updatedBy,
        },
      });
    } catch (error) {
      logger.error("Error creating message template", { error, data });
      throw error;
    }
  }

  /**
   * Update template content
   */
  static async update(
    name: string,
    data: {
      content: string;
      description?: string;
      updatedBy?: string;
    },
  ): Promise<MessageTemplate> {
    try {
      // Validate content length
      if (data.content.length > 5000) {
        throw new Error("Template content must not exceed 5000 characters");
      }

      const existing = await this.findByName(name);
      if (!existing) {
        throw new Error(`Template name '${name}' not found`);
      }

      return await prisma.messageTemplate.update({
        where: { name },
        data: {
          content: data.content,
          description: data.description,
          updatedBy: data.updatedBy,
        },
      });
    } catch (error) {
      logger.error("Error updating message template", { error, name, data });
      throw error;
    }
  }

  /**
   * Delete template
   */
  static async delete(name: string): Promise<MessageTemplate> {
    try {
      const existing = await this.findByName(name);
      if (!existing) {
        throw new Error(`Template name '${name}' not found`);
      }

      return await prisma.messageTemplate.delete({
        where: { name },
      });
    } catch (error) {
      logger.error("Error deleting message template", { error, name });
      throw error;
    }
  }
}

export default MessageTemplateModel;
