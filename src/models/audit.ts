import { PrismaClient, AuditLog, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  userId?: string;
  action?: string;
  affectedEntityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log creation data
 */
export interface CreateAuditLogData {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  affectedEntityId?: string;
  affectedEntityType?: string;
}

/**
 * Audit log model operations
 * Provides CRUD operations for audit logs
 */
export class AuditLogModel {
  /**
   * Create a new audit log entry
   */
  static async create(data: CreateAuditLogData): Promise<AuditLog> {
    try {
      const auditLog = await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          details: data.details as Prisma.InputJsonValue,
          ipAddress: data.ipAddress,
          affectedEntityId: data.affectedEntityId,
          affectedEntityType: data.affectedEntityType,
          timestamp: new Date(),
        },
      });

      logger.debug("Audit log created", {
        id: auditLog.id,
        action: auditLog.action,
        userId: auditLog.userId,
      });

      return auditLog;
    } catch (error) {
      logger.error("Error creating audit log", { error, data });
      throw error;
    }
  }

  /**
   * Find audit logs with filters
   */
  static async findMany(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      // Apply filters
      if (filter.userId) {
        where.userId = filter.userId;
      }

      if (filter.action) {
        where.action = filter.action;
      }

      if (filter.affectedEntityType) {
        where.affectedEntityType = filter.affectedEntityType;
      }

      if (filter.startDate || filter.endDate) {
        where.timestamp = {};
        if (filter.startDate) {
          where.timestamp.gte = filter.startDate;
        }
        if (filter.endDate) {
          where.timestamp.lte = filter.endDate;
        }
      }

      const auditLogs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: filter.limit || 100,
        skip: filter.offset || 0,
      });

      logger.debug("Audit logs retrieved", {
        count: auditLogs.length,
        filter,
      });

      return auditLogs;
    } catch (error) {
      logger.error("Error finding audit logs", { error, filter });
      throw error;
    }
  }

  /**
   * Find audit log by ID
   */
  static async findById(id: string): Promise<AuditLog | null> {
    try {
      const auditLog = await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      return auditLog;
    } catch (error) {
      logger.error("Error finding audit log by ID", { error, id });
      throw error;
    }
  }

  /**
   * Find recent audit logs for a user
   */
  static async findByUser(
    userId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      return auditLogs;
    } catch (error) {
      logger.error("Error finding audit logs by user", { error, userId });
      throw error;
    }
  }

  /**
   * Find audit logs by action type
   */
  static async findByAction(
    action: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: { action },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      return auditLogs;
    } catch (error) {
      logger.error("Error finding audit logs by action", { error, action });
      throw error;
    }
  }

  /**
   * Find audit logs by affected entity
   */
  static async findByAffectedEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          affectedEntityType: entityType,
          affectedEntityId: entityId,
        },
        orderBy: {
          timestamp: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      return auditLogs;
    } catch (error) {
      logger.error("Error finding audit logs by affected entity", {
        error,
        entityType,
        entityId,
      });
      throw error;
    }
  }

  /**
   * Count audit logs with filters
   */
  static async count(filter: AuditLogFilter = {}): Promise<number> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      // Apply filters
      if (filter.userId) {
        where.userId = filter.userId;
      }

      if (filter.action) {
        where.action = filter.action;
      }

      if (filter.affectedEntityType) {
        where.affectedEntityType = filter.affectedEntityType;
      }

      if (filter.startDate || filter.endDate) {
        where.timestamp = {};
        if (filter.startDate) {
          where.timestamp.gte = filter.startDate;
        }
        if (filter.endDate) {
          where.timestamp.lte = filter.endDate;
        }
      }

      const count = await prisma.auditLog.count({ where });

      return count;
    } catch (error) {
      logger.error("Error counting audit logs", { error, filter });
      throw error;
    }
  }

  /**
   * Delete old audit logs (data retention policy)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info("Old audit logs deleted", {
        count: result.count,
        cutoffDate,
      });

      return result.count;
    } catch (error) {
      logger.error("Error deleting old audit logs", { error, days });
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  static async getStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByUser: Record<string, number>;
    logsByEntityType: Record<string, number>;
  }> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = startDate;
        }
        if (endDate) {
          where.timestamp.lte = endDate;
        }
      }

      // Get total count
      const totalLogs = await prisma.auditLog.count({ where });

      // Get logs grouped by action
      const actionGroups = await prisma.auditLog.groupBy({
        by: ["action"],
        where,
        _count: {
          id: true,
        },
      });

      const logsByAction: Record<string, number> = {};
      actionGroups.forEach((group) => {
        logsByAction[group.action] = group._count.id;
      });

      // Get logs grouped by user
      const userGroups = await prisma.auditLog.groupBy({
        by: ["userId"],
        where: {
          ...where,
          userId: { not: null },
        },
        _count: {
          id: true,
        },
      });

      const logsByUser: Record<string, number> = {};
      userGroups.forEach((group) => {
        if (group.userId) {
          logsByUser[group.userId] = group._count.id;
        }
      });

      // Get logs grouped by entity type
      const entityGroups = await prisma.auditLog.groupBy({
        by: ["affectedEntityType"],
        where: {
          ...where,
          affectedEntityType: { not: null },
        },
        _count: {
          id: true,
        },
      });

      const logsByEntityType: Record<string, number> = {};
      entityGroups.forEach((group) => {
        if (group.affectedEntityType) {
          logsByEntityType[group.affectedEntityType] = group._count.id;
        }
      });

      return {
        totalLogs,
        logsByAction,
        logsByUser,
        logsByEntityType,
      };
    } catch (error) {
      logger.error("Error getting audit log statistics", {
        error,
        startDate,
        endDate,
      });
      throw error;
    }
  }
}

export default AuditLogModel;
