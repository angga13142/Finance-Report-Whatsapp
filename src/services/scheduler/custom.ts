import * as cron from "node-cron";
import { logger } from "../../lib/logger";
import { reportTemplateService, ReportTemplate } from "../report/templates";
import { PrismaClient } from "@prisma/client";

/**
 * Custom report scheduling service
 * Allows Boss/Dev to schedule reports at custom times beyond the default 24:00
 */

interface ScheduledJob {
  templateId: string;
  cronExpression: string;
  task: cron.ScheduledTask;
  userId: string;
  nextRun: Date;
}

export class CustomSchedulerService {
  private static instance: CustomSchedulerService;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): CustomSchedulerService {
    if (!CustomSchedulerService.instance) {
      CustomSchedulerService.instance = new CustomSchedulerService();
    }
    return CustomSchedulerService.instance;
  }

  /**
   * Initialize custom scheduler - load all scheduled templates
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing custom report scheduler");

      const scheduledTemplates =
        await reportTemplateService.getScheduledTemplates();

      for (const template of scheduledTemplates) {
        await this.scheduleTemplate(template);
      }

      logger.info("Custom report scheduler initialized", {
        scheduledCount: scheduledTemplates.length,
      });
    } catch (error) {
      logger.error("Failed to initialize custom scheduler", { error });
      throw error;
    }
  }

  /**
   * Schedule a report template
   */
  scheduleTemplate(template: ReportTemplate): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (!template.deliverySchedule || !template.deliverySchedule.enabled) {
          logger.warn("Template has no active delivery schedule", {
            templateId: template.id,
          });
          resolve(false);
          return;
        }

        const cronExpression = this.buildCronExpression(
          template.deliverySchedule,
        );

        if (!cron.validate(cronExpression)) {
          logger.error("Invalid cron expression", { cronExpression, template });
          resolve(false);
          return;
        }

        // Cancel existing job if any
        this.cancelScheduledTemplate(template.id);

        // Create new scheduled task
        const task = cron.schedule(
          cronExpression,
          () => {
            void this.executeScheduledReport(template);
          },
          {
            timezone: "Asia/Makassar", // WITA timezone
          },
        );

        const nextRun = this.calculateNextRun(cronExpression);

        this.scheduledJobs.set(template.id, {
          templateId: template.id,
          cronExpression,
          task,
          userId: template.userId,
          nextRun,
        });

        logger.info("Report template scheduled", {
          templateId: template.id,
          userId: template.userId,
          cronExpression,
          nextRun,
        });

        resolve(true);
      } catch (error) {
        logger.error("Failed to schedule template", {
          error,
          templateId: template.id,
        });
        resolve(false);
      }
    });
  }

  /**
   * Cancel scheduled template
   */
  cancelScheduledTemplate(templateId: string): boolean {
    const job = this.scheduledJobs.get(templateId);

    if (job) {
      job.task.stop();
      this.scheduledJobs.delete(templateId);

      logger.info("Scheduled template cancelled", { templateId });
      return true;
    }

    return false;
  }

  /**
   * Reschedule a template (update existing schedule)
   */
  async rescheduleTemplate(template: ReportTemplate): Promise<boolean> {
    this.cancelScheduledTemplate(template.id);
    return await this.scheduleTemplate(template);
  }

  /**
   * Execute scheduled report generation and delivery
   */
  private async executeScheduledReport(
    template: ReportTemplate,
  ): Promise<void> {
    try {
      logger.info("Executing scheduled report", {
        templateId: template.id,
        userId: template.userId,
      });

      // Calculate date range based on template configuration
      const dateRange = this.calculateDateRange(template.dateRange);

      // Generate report (placeholder - would use actual report generation)
      logger.info("Generating scheduled report", {
        templateId: template.id,
        userId: template.userId,
        dateRange,
      });

      // In production, this would call the report generator and delivery service
      // For now, we'll log the scheduled execution
      logger.info("Scheduled report would be generated and delivered", {
        templateId: template.id,
        userId: template.userId,
        templateName: template.name,
        scheduled: true,
      });

      // Log execution
      await this.logExecution(template.id, "success");

      logger.info("Scheduled report executed successfully", {
        templateId: template.id,
        userId: template.userId,
      });
    } catch (error) {
      logger.error("Failed to execute scheduled report", {
        error,
        templateId: template.id,
      });

      await this.logExecution(template.id, "failed", String(error));
    }
  }

  /**
   * Build cron expression from delivery schedule
   */
  private buildCronExpression(
    schedule: NonNullable<ReportTemplate["deliverySchedule"]>,
  ): string {
    const [hour, minute] = (schedule.time || "00:00").split(":").map(Number);

    switch (schedule.frequency) {
      case "daily": {
        // Every day at specified time
        return `${minute} ${hour} * * *`;
      }

      case "weekly": {
        // Every week on specified day at specified time
        const dayOfWeek = schedule.dayOfWeek ?? 0; // Default to Sunday
        return `${minute} ${hour} * * ${dayOfWeek}`;
      }

      case "monthly": {
        // Every month on specified day at specified time
        const dayOfMonth = schedule.dayOfMonth ?? 1; // Default to 1st day
        return `${minute} ${hour} ${dayOfMonth} * *`;
      }

      default:
        throw new Error(`Unsupported frequency: ${String(schedule.frequency)}`);
    }
  }

  /**
   * Calculate date range based on template configuration
   */
  private calculateDateRange(dateRangeConfig: ReportTemplate["dateRange"]): {
    start: Date;
    end: Date;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRangeConfig.type) {
      case "daily": {
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      }

      case "weekly": {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { start: weekStart, end: weekEnd };
      }

      case "monthly": {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: monthStart, end: monthEnd };
      }

      case "ytd": {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return { start: yearStart, end: today };
      }

      case "custom": {
        if (!dateRangeConfig.customStart || !dateRangeConfig.customEnd) {
          throw new Error(
            "Custom date range requires customStart and customEnd",
          );
        }
        return {
          start: dateRangeConfig.customStart,
          end: dateRangeConfig.customEnd,
        };
      }

      default:
        return { start: today, end: today };
    }
  }

  /**
   * Calculate next run time for cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    // Simple implementation - in production use a cron parser library
    const now = new Date();
    const [minute, hour] = cronExpression.split(" ");

    const next = new Date(now);

    if (hour !== "*") {
      next.setHours(parseInt(hour));
    }
    if (minute !== "*") {
      next.setMinutes(parseInt(minute));
    }
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the time has passed today, move to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Log schedule execution
   */
  private async logExecution(
    templateId: string,
    status: "success" | "failed",
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO schedule_execution_log 
        (id, template_id, executed_at, status, error_message)
        VALUES (
          gen_random_uuid()::text,
          ${templateId},
          NOW(),
          ${status},
          ${error || null}
        )
      `;
    } catch (logError) {
      logger.error("Failed to log schedule execution", {
        logError,
        templateId,
      });
    }
  }

  /**
   * Get all active scheduled jobs
   */
  getActiveJobs(): Array<{
    templateId: string;
    userId: string;
    cronExpression: string;
    nextRun: Date;
  }> {
    return Array.from(this.scheduledJobs.values()).map((job) => ({
      templateId: job.templateId,
      userId: job.userId,
      cronExpression: job.cronExpression,
      nextRun: job.nextRun,
    }));
  }

  /**
   * Get execution history for a template
   */
  async getExecutionHistory(
    templateId: string,
    limit: number = 20,
  ): Promise<
    Array<{
      executedAt: Date;
      status: string;
      errorMessage?: string;
    }>
  > {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          executed_at: Date;
          status: string;
          error_message: string | null;
        }>
      >`
        SELECT executed_at, status, error_message
        FROM schedule_execution_log
        WHERE template_id = ${templateId}
        ORDER BY executed_at DESC
        LIMIT ${limit}
      `;

      return results.map((r) => ({
        executedAt: r.executed_at,
        status: r.status,
        errorMessage: r.error_message || undefined,
      }));
    } catch (error) {
      logger.error("Failed to fetch execution history", { error, templateId });
      return [];
    }
  }

  /**
   * Manually trigger a scheduled report
   */
  async triggerManually(templateId: string, userId: string): Promise<boolean> {
    try {
      const template = await reportTemplateService.getTemplateById(
        templateId,
        userId,
      );

      if (!template) {
        logger.error("Template not found", { templateId, userId });
        return false;
      }

      await this.executeScheduledReport(template);
      return true;
    } catch (error) {
      logger.error("Failed to manually trigger report", { error, templateId });
      return false;
    }
  }

  /**
   * Shutdown scheduler (stop all jobs)
   */
  shutdown(): void {
    logger.info("Shutting down custom scheduler", {
      activeJobs: this.scheduledJobs.size,
    });

    this.scheduledJobs.forEach((job, templateId) => {
      job.task.stop();
      logger.debug("Stopped scheduled job", { templateId });
    });

    this.scheduledJobs.clear();
  }
}

export const customScheduler = CustomSchedulerService.getInstance();
