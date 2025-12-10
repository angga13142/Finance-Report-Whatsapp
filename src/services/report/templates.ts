import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Report template service
 * Allows Boss to save and reuse custom report configurations
 */

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  userId: string;
  dateRange: {
    type: "daily" | "weekly" | "monthly" | "custom" | "ytd";
    customStart?: Date;
    customEnd?: Date;
  };
  filters: {
    categories?: string[];
    transactionTypes?: ("income" | "expense")[];
    employees?: string[];
    minAmount?: number;
    maxAmount?: number;
  };
  format: {
    includeCharts: boolean;
    includeTrends: boolean;
    includeComparison: boolean;
    groupBy?: "category" | "employee" | "date" | "none";
    sortBy?: "amount" | "date" | "category";
    sortOrder?: "asc" | "desc";
  };
  deliverySchedule?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  createdAt: Date;
  updatedAt: Date;
}

export class ReportTemplateService {
  private static instance: ReportTemplateService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): ReportTemplateService {
    if (!ReportTemplateService.instance) {
      ReportTemplateService.instance = new ReportTemplateService();
    }
    return ReportTemplateService.instance;
  }

  /**
   * Create a new report template
   */
  async createTemplate(
    userId: string,
    template: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt">,
  ): Promise<ReportTemplate> {
    try {
      const templateData = {
        name: template.name,
        description: template.description,
        user_id: userId,
        date_range: JSON.stringify(template.dateRange),
        filters: JSON.stringify(template.filters),
        format: JSON.stringify(template.format),
        delivery_schedule: template.deliverySchedule
          ? JSON.stringify(template.deliverySchedule)
          : null,
      };

      const result = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          user_id: string;
          date_range: string;
          filters: string;
          format: string;
          delivery_schedule: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        INSERT INTO report_templates 
        (id, name, description, user_id, date_range, filters, format, delivery_schedule, created_at, updated_at)
        VALUES (
          gen_random_uuid()::text,
          ${templateData.name},
          ${templateData.description || null},
          ${templateData.user_id},
          ${templateData.date_range},
          ${templateData.filters},
          ${templateData.format},
          ${templateData.delivery_schedule},
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      logger.info("Report template created", {
        templateId: result[0].id,
        userId,
        name: template.name,
      });

      return this.mapToTemplate(result[0]);
    } catch (error) {
      logger.error("Failed to create report template", { error, userId });
      throw error;
    }
  }

  /**
   * Get all templates for a user
   */
  async getUserTemplates(userId: string): Promise<ReportTemplate[]> {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          user_id: string;
          date_range: string;
          filters: string;
          format: string;
          delivery_schedule: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT * FROM report_templates
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
      `;

      return results.map((r) => this.mapToTemplate(r));
    } catch (error) {
      logger.error("Failed to fetch user templates", { error, userId });
      return [];
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(
    templateId: string,
    userId: string,
  ): Promise<ReportTemplate | null> {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          user_id: string;
          date_range: string;
          filters: string;
          format: string;
          delivery_schedule: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT * FROM report_templates
        WHERE id = ${templateId} AND user_id = ${userId}
        LIMIT 1
      `;

      if (results.length === 0) {
        return null;
      }

      return this.mapToTemplate(results[0]);
    } catch (error) {
      logger.error("Failed to fetch template", { error, templateId, userId });
      return null;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    updates: Partial<Omit<ReportTemplate, "id" | "userId" | "createdAt">>,
  ): Promise<ReportTemplate | null> {
    try {
      const setParts: string[] = [];
      const values: Array<string | number | boolean | object> = [];

      if (updates.name) {
        setParts.push(`name = $${values.length + 1}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setParts.push(`description = $${values.length + 1}`);
        values.push(updates.description);
      }
      if (updates.dateRange) {
        setParts.push(`date_range = $${values.length + 1}`);
        values.push(JSON.stringify(updates.dateRange));
      }
      if (updates.filters) {
        setParts.push(`filters = $${values.length + 1}`);
        values.push(JSON.stringify(updates.filters));
      }
      if (updates.format) {
        setParts.push(`format = $${values.length + 1}`);
        values.push(JSON.stringify(updates.format));
      }
      if (updates.deliverySchedule !== undefined) {
        setParts.push(`delivery_schedule = $${values.length + 1}`);
        const scheduleValue = updates.deliverySchedule
          ? JSON.stringify(updates.deliverySchedule)
          : "null";
        values.push(scheduleValue);
      }

      setParts.push(`updated_at = NOW()`);

      if (setParts.length === 1) {
        // Only updated_at, nothing to update
        return await this.getTemplateById(templateId, userId);
      }

      await this.prisma.$executeRaw`
        UPDATE report_templates
        SET ${setParts.join(", ")}
        WHERE id = ${templateId} AND user_id = ${userId}
      `;

      logger.info("Report template updated", { templateId, userId });

      return await this.getTemplateById(templateId, userId);
    } catch (error) {
      logger.error("Failed to update template", { error, templateId, userId });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM report_templates
        WHERE id = ${templateId} AND user_id = ${userId}
      `;

      logger.info("Report template deleted", { templateId, userId });
      return true;
    } catch (error) {
      logger.error("Failed to delete template", { error, templateId, userId });
      return false;
    }
  }

  /**
   * Get templates with active delivery schedules
   */
  async getScheduledTemplates(): Promise<ReportTemplate[]> {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          user_id: string;
          date_range: string;
          filters: string;
          format: string;
          delivery_schedule: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT * FROM report_templates
        WHERE delivery_schedule IS NOT NULL
        AND delivery_schedule::jsonb->>'enabled' = 'true'
        ORDER BY updated_at DESC
      `;

      return results.map((r) => this.mapToTemplate(r));
    } catch (error) {
      logger.error("Failed to fetch scheduled templates", { error });
      return [];
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(
    templateId: string,
    userId: string,
    newName: string,
  ): Promise<ReportTemplate | null> {
    try {
      const original = await this.getTemplateById(templateId, userId);
      if (!original) {
        return null;
      }

      const duplicate = await this.createTemplate(userId, {
        name: newName,
        description: original.description
          ? `Copy of ${original.description}`
          : undefined,
        userId,
        dateRange: original.dateRange,
        filters: original.filters,
        format: original.format,
        deliverySchedule: original.deliverySchedule
          ? { ...original.deliverySchedule, enabled: false }
          : undefined,
      });

      logger.info("Report template duplicated", {
        originalId: templateId,
        duplicateId: duplicate.id,
        userId,
      });

      return duplicate;
    } catch (error) {
      logger.error("Failed to duplicate template", {
        error,
        templateId,
        userId,
      });
      return null;
    }
  }

  /**
   * Get default templates (predefined)
   */
  getDefaultTemplates(): Omit<
    ReportTemplate,
    "id" | "userId" | "createdAt" | "updatedAt"
  >[] {
    return [
      {
        name: "Daily Summary",
        description: "Daily income and expense summary",
        dateRange: { type: "daily" },
        filters: {},
        format: {
          includeCharts: true,
          includeTrends: true,
          includeComparison: true,
          groupBy: "category",
        },
      },
      {
        name: "Weekly Performance",
        description: "Weekly business performance report",
        dateRange: { type: "weekly" },
        filters: {},
        format: {
          includeCharts: true,
          includeTrends: true,
          includeComparison: true,
          groupBy: "date",
        },
      },
      {
        name: "Monthly Overview",
        description: "Comprehensive monthly financial report",
        dateRange: { type: "monthly" },
        filters: {},
        format: {
          includeCharts: true,
          includeTrends: true,
          includeComparison: true,
          groupBy: "category",
        },
      },
      {
        name: "Employee Performance",
        description: "Track individual employee transaction activity",
        dateRange: { type: "weekly" },
        filters: {},
        format: {
          includeCharts: false,
          includeTrends: true,
          includeComparison: true,
          groupBy: "employee",
          sortBy: "amount",
          sortOrder: "desc",
        },
      },
    ];
  }

  /**
   * Map database result to ReportTemplate
   */
  private mapToTemplate(row: {
    id: string;
    name: string;
    description: string | null;
    user_id: string;
    date_range: string;
    filters: string;
    format: string;
    delivery_schedule: string | null;
    created_at: Date;
    updated_at: Date;
  }): ReportTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      userId: row.user_id,
      dateRange: JSON.parse(row.date_range) as ReportTemplate["dateRange"],
      filters: JSON.parse(row.filters) as ReportTemplate["filters"],
      format: JSON.parse(row.format) as ReportTemplate["format"],
      deliverySchedule: row.delivery_schedule
        ? (JSON.parse(
            row.delivery_schedule,
          ) as ReportTemplate["deliverySchedule"])
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const reportTemplateService = ReportTemplateService.getInstance();
