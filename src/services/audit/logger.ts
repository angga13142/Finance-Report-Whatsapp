import { AuditLogModel, CreateAuditLogData } from "../../models/audit";
import { logger } from "../../lib/logger";

/**
 * Audit action types
 */
export enum AuditAction {
  // User management
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DEACTIVATED = "user.deactivated",
  USER_ACTIVATED = "user.activated",
  USER_ROLE_CHANGED = "user.role_changed",
  USER_LOGIN = "user.login",
  USER_LOGOUT = "user.logout",

  // Transaction management
  TRANSACTION_CREATED = "transaction.created",
  TRANSACTION_UPDATED = "transaction.updated",
  TRANSACTION_DELETED = "transaction.deleted",
  TRANSACTION_APPROVED = "transaction.approved",
  TRANSACTION_REJECTED = "transaction.rejected",

  // Report generation
  REPORT_GENERATED = "report.generated",
  REPORT_EXPORTED = "report.exported",
  REPORT_SENT = "report.sent",

  // System operations
  SYSTEM_HEALTH_CHECK = "system.health_check",
  SYSTEM_CONFIG_UPDATED = "system.config_updated",
  SYSTEM_RESTART = "system.restart",
  SESSION_RESET = "session.reset",

  // Security events
  AUTH_FAILED = "auth.failed",
  AUTH_SUCCESS = "auth.success",
  PERMISSION_DENIED = "permission.denied",
  SUSPICIOUS_ACTIVITY = "security.suspicious_activity",
}

/**
 * Audit logging service
 * Centralized service for logging all user and system actions
 */
export class AuditLogger {
  /**
   * Log a user action
   */
  static async log(
    action: AuditAction | string,
    details: Record<string, unknown> = {},
    userId?: string,
    affectedEntityId?: string,
    affectedEntityType?: string,
  ): Promise<void> {
    try {
      const auditData: CreateAuditLogData = {
        userId,
        action,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
        },
        affectedEntityId,
        affectedEntityType,
      };

      await AuditLogModel.create(auditData);

      logger.info("Audit log recorded", {
        action,
        userId,
        affectedEntityType,
      });
    } catch (error) {
      logger.error("Failed to record audit log", {
        error,
        action,
        userId,
      });
      // Don't throw - audit logging failures should not break the main operation
    }
  }

  /**
   * Log user creation
   */
  static async logUserCreated(
    creatorUserId: string,
    newUserId: string,
    details: {
      phoneNumber: string;
      name?: string;
      role: string;
    },
  ): Promise<void> {
    await this.log(
      AuditAction.USER_CREATED,
      {
        phoneNumber: details.phoneNumber,
        name: details.name,
        role: details.role,
      },
      creatorUserId,
      newUserId,
      "User",
    );
  }

  /**
   * Log user role change
   */
  static async logUserRoleChanged(
    changerUserId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
  ): Promise<void> {
    await this.log(
      AuditAction.USER_ROLE_CHANGED,
      {
        oldRole,
        newRole,
      },
      changerUserId,
      targetUserId,
      "User",
    );
  }

  /**
   * Log user deactivation
   */
  static async logUserDeactivated(
    deactivatorUserId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.log(
      AuditAction.USER_DEACTIVATED,
      {
        reason,
      },
      deactivatorUserId,
      targetUserId,
      "User",
    );
  }

  /**
   * Log user activation
   */
  static async logUserActivated(
    activatorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.log(
      AuditAction.USER_ACTIVATED,
      {},
      activatorUserId,
      targetUserId,
      "User",
    );
  }

  /**
   * Log transaction creation
   */
  static async logTransactionCreated(
    userId: string,
    transactionId: string,
    details: {
      type: string;
      category: string;
      amount: number;
      description?: string;
    },
  ): Promise<void> {
    await this.log(
      AuditAction.TRANSACTION_CREATED,
      {
        type: details.type,
        category: details.category,
        amount: details.amount,
        description: details.description,
      },
      userId,
      transactionId,
      "Transaction",
    );
  }

  /**
   * Log transaction update
   */
  static async logTransactionUpdated(
    userId: string,
    transactionId: string,
    changes: Record<string, { old: unknown; new: unknown }>,
  ): Promise<void> {
    await this.log(
      AuditAction.TRANSACTION_UPDATED,
      {
        changes,
      },
      userId,
      transactionId,
      "Transaction",
    );
  }

  /**
   * Log transaction deletion
   */
  static async logTransactionDeleted(
    userId: string,
    transactionId: string,
    details: {
      type: string;
      category: string;
      amount: number;
    },
  ): Promise<void> {
    await this.log(
      AuditAction.TRANSACTION_DELETED,
      {
        type: details.type,
        category: details.category,
        amount: details.amount,
      },
      userId,
      transactionId,
      "Transaction",
    );
  }

  /**
   * Log transaction approval
   */
  static async logTransactionApproved(
    approverUserId: string,
    transactionId: string,
    submitterId: string,
  ): Promise<void> {
    await this.log(
      AuditAction.TRANSACTION_APPROVED,
      {
        submitterId,
      },
      approverUserId,
      transactionId,
      "Transaction",
    );
  }

  /**
   * Log transaction rejection
   */
  static async logTransactionRejected(
    rejectorUserId: string,
    transactionId: string,
    reason?: string,
  ): Promise<void> {
    await this.log(
      AuditAction.TRANSACTION_REJECTED,
      {
        reason,
      },
      rejectorUserId,
      transactionId,
      "Transaction",
    );
  }

  /**
   * Log report generation
   */
  static async logReportGenerated(
    userId: string,
    reportType: string,
    reportDate: Date,
  ): Promise<void> {
    await this.log(
      AuditAction.REPORT_GENERATED,
      {
        reportType,
        reportDate: reportDate.toISOString(),
      },
      userId,
      undefined,
      "Report",
    );
  }

  /**
   * Log report export
   */
  static async logReportExported(
    userId: string,
    reportType: string,
    format: string,
  ): Promise<void> {
    await this.log(
      AuditAction.REPORT_EXPORTED,
      {
        reportType,
        format,
      },
      userId,
      undefined,
      "Report",
    );
  }

  /**
   * Log system health check
   */
  static async logHealthCheck(
    userId: string,
    healthStatus: Record<string, unknown>,
  ): Promise<void> {
    await this.log(
      AuditAction.SYSTEM_HEALTH_CHECK,
      {
        healthStatus,
      },
      userId,
      undefined,
      "System",
    );
  }

  /**
   * Log system configuration update
   */
  static async logConfigUpdated(
    userId: string,
    configKey: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await this.log(
      AuditAction.SYSTEM_CONFIG_UPDATED,
      {
        configKey,
        oldValue,
        newValue,
      },
      userId,
      undefined,
      "System",
    );
  }

  /**
   * Log session reset
   */
  static async logSessionReset(
    adminUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.log(
      AuditAction.SESSION_RESET,
      {},
      adminUserId,
      targetUserId,
      "UserSession",
    );
  }

  /**
   * Log authentication failure
   */
  static async logAuthFailed(
    phoneNumber: string,
    reason: string,
  ): Promise<void> {
    await this.log(
      AuditAction.AUTH_FAILED,
      {
        phoneNumber,
        reason,
      },
      undefined,
      undefined,
      "Auth",
    );
  }

  /**
   * Log authentication success
   */
  static async logAuthSuccess(
    userId: string,
    phoneNumber: string,
  ): Promise<void> {
    await this.log(
      AuditAction.AUTH_SUCCESS,
      {
        phoneNumber,
      },
      userId,
      undefined,
      "Auth",
    );
  }

  /**
   * Log permission denied
   */
  static async logPermissionDenied(
    userId: string,
    action: string,
    resource: string,
  ): Promise<void> {
    await this.log(
      AuditAction.PERMISSION_DENIED,
      {
        action,
        resource,
      },
      userId,
      undefined,
      "Security",
    );
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    userId: string | undefined,
    activityType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.log(
      AuditAction.SUSPICIOUS_ACTIVITY,
      {
        activityType,
        ...details,
      },
      userId,
      undefined,
      "Security",
    );
  }
}

export default AuditLogger;
