import { UserRole } from "@prisma/client";
import { USER_ROLES } from "../../config/constants";

/**
 * Role-Based Access Control (RBAC) service
 */
export class RBACService {
  /**
   * Check if user role has permission for action
   */
  static hasPermission(role: UserRole, action: string): boolean {
    const permissions = this.getPermissions(role);
    return permissions.includes(action) || permissions.includes("*");
  }

  /**
   * Get all permissions for a role
   */
  static getPermissions(role: UserRole): string[] {
    const permissionMap: Record<UserRole, string[]> = {
      [USER_ROLES.DEV]: [
        "*", // All permissions
      ],
      [USER_ROLES.BOSS]: [
        "transaction:create",
        "transaction:read",
        "transaction:update",
        "transaction:delete",
        "transaction:approve",
        "report:read",
        "report:generate",
        "user:read",
        "user:create",
        "user:update",
        "user:deactivate",
        "category:read",
        "category:create",
        "category:update",
        "recommendation:read",
        "audit:read",
      ],
      [USER_ROLES.EMPLOYEE]: [
        "transaction:create",
        "transaction:read:own",
        "transaction:update:own",
        "report:read:own",
        "category:read",
      ],
      [USER_ROLES.INVESTOR]: ["report:read:aggregated", "recommendation:read"],
    };

    return permissionMap[role] || [];
  }

  /**
   * Check if user can create transactions
   */
  static canCreateTransaction(role: UserRole): boolean {
    return this.hasPermission(role, "transaction:create");
  }

  /**
   * Check if user can view transactions
   */
  static canViewTransactions(
    role: UserRole,
    ownOnly: boolean = false,
  ): boolean {
    if (ownOnly) {
      return this.hasPermission(role, "transaction:read:own");
    }
    return (
      this.hasPermission(role, "transaction:read") ||
      this.hasPermission(role, "transaction:read:own")
    );
  }

  /**
   * Check if user can view reports
   */
  static canViewReports(
    role: UserRole,
    aggregatedOnly: boolean = false,
  ): boolean {
    if (aggregatedOnly) {
      return this.hasPermission(role, "report:read:aggregated");
    }
    return (
      this.hasPermission(role, "report:read") ||
      this.hasPermission(role, "report:read:own") ||
      this.hasPermission(role, "report:read:aggregated")
    );
  }

  /**
   * Check if user can manage users
   */
  static canManageUsers(role: UserRole): boolean {
    return (
      this.hasPermission(role, "user:create") ||
      this.hasPermission(role, "user:update") ||
      this.hasPermission(role, "user:deactivate")
    );
  }

  /**
   * Check if user can approve transactions
   */
  static canApproveTransactions(role: UserRole): boolean {
    return this.hasPermission(role, "transaction:approve");
  }

  /**
   * Check if user can view audit logs
   */
  static canViewAuditLogs(role: UserRole): boolean {
    return this.hasPermission(role, "audit:read");
  }

  /**
   * Check if user can manage categories
   */
  static canManageCategories(role: UserRole): boolean {
    return (
      this.hasPermission(role, "category:create") ||
      this.hasPermission(role, "category:update")
    );
  }

  /**
   * Validate role is valid
   */
  static isValidRole(role: string): role is UserRole {
    return Object.values(USER_ROLES).includes(role as UserRole);
  }

  /**
   * Get role hierarchy (for permission inheritance)
   */
  static getRoleHierarchy(role: UserRole): UserRole[] {
    const hierarchy: Record<UserRole, UserRole[]> = {
      [USER_ROLES.DEV]: [
        USER_ROLES.DEV,
        USER_ROLES.BOSS,
        USER_ROLES.EMPLOYEE,
        USER_ROLES.INVESTOR,
      ],
      [USER_ROLES.BOSS]: [
        USER_ROLES.BOSS,
        USER_ROLES.EMPLOYEE,
        USER_ROLES.INVESTOR,
      ],
      [USER_ROLES.EMPLOYEE]: [USER_ROLES.EMPLOYEE],
      [USER_ROLES.INVESTOR]: [USER_ROLES.INVESTOR],
    };

    return hierarchy[role] || [role];
  }
}

export default RBACService;
