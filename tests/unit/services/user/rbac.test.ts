/**
 * Unit tests for RBACService
 * Tests role-based access control logic, permission checking, and role hierarchies
 */

import { RBACService } from "../../../../src/services/user/rbac";
import { UserRole } from "@prisma/client";

describe("RBACService", () => {
  describe("hasPermission", () => {
    it("should grant all permissions to Dev role", () => {
      expect(
        RBACService.hasPermission("dev" as UserRole, "transaction:create"),
      ).toBe(true);
      expect(RBACService.hasPermission("dev" as UserRole, "user:delete")).toBe(
        true,
      );
      expect(
        RBACService.hasPermission("dev" as UserRole, "any:permission"),
      ).toBe(true);
    });

    it("should grant Boss permissions correctly", () => {
      expect(
        RBACService.hasPermission("boss" as UserRole, "transaction:create"),
      ).toBe(true);
      expect(
        RBACService.hasPermission("boss" as UserRole, "transaction:approve"),
      ).toBe(true);
      expect(RBACService.hasPermission("boss" as UserRole, "user:create")).toBe(
        true,
      );
      expect(
        RBACService.hasPermission("boss" as UserRole, "report:generate"),
      ).toBe(true);
    });

    it("should grant Employee limited permissions", () => {
      expect(
        RBACService.hasPermission("employee" as UserRole, "transaction:create"),
      ).toBe(true);
      expect(
        RBACService.hasPermission(
          "employee" as UserRole,
          "transaction:read:own",
        ),
      ).toBe(true);
      expect(
        RBACService.hasPermission("employee" as UserRole, "category:read"),
      ).toBe(true);
    });

    it("should deny Employee from Boss-level permissions", () => {
      expect(
        RBACService.hasPermission(
          "employee" as UserRole,
          "transaction:approve",
        ),
      ).toBe(false);
      expect(
        RBACService.hasPermission("employee" as UserRole, "user:create"),
      ).toBe(false);
      expect(
        RBACService.hasPermission("employee" as UserRole, "report:generate"),
      ).toBe(false);
    });

    it("should grant Investor read-only access", () => {
      expect(
        RBACService.hasPermission(
          "investor" as UserRole,
          "report:read:aggregated",
        ),
      ).toBe(true);
      expect(
        RBACService.hasPermission(
          "investor" as UserRole,
          "recommendation:read",
        ),
      ).toBe(true);
    });

    it("should deny Investor from write operations", () => {
      expect(
        RBACService.hasPermission("investor" as UserRole, "transaction:create"),
      ).toBe(false);
      expect(
        RBACService.hasPermission("investor" as UserRole, "user:create"),
      ).toBe(false);
    });
  });

  describe("getPermissions", () => {
    it("should return all permissions for Dev", () => {
      const permissions = RBACService.getPermissions("dev" as UserRole);
      expect(permissions).toContain("*");
    });

    it("should return Boss permissions", () => {
      const permissions = RBACService.getPermissions("boss" as UserRole);
      expect(permissions).toContain("transaction:create");
      expect(permissions).toContain("transaction:approve");
      expect(permissions).toContain("user:create");
      expect(permissions).toContain("report:generate");
    });

    it("should return Employee permissions", () => {
      const permissions = RBACService.getPermissions("employee" as UserRole);
      expect(permissions).toContain("transaction:create");
      expect(permissions).toContain("transaction:read:own");
      expect(permissions).toContain("category:read");
      expect(permissions).not.toContain("transaction:approve");
    });

    it("should return Investor permissions", () => {
      const permissions = RBACService.getPermissions("investor" as UserRole);
      expect(permissions).toContain("report:read:aggregated");
      expect(permissions).toContain("recommendation:read");
      expect(permissions).not.toContain("transaction:create");
    });
  });

  describe("canCreateTransaction", () => {
    it("should allow Dev to create transactions", () => {
      expect(RBACService.canCreateTransaction("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to create transactions", () => {
      expect(RBACService.canCreateTransaction("boss" as UserRole)).toBe(true);
    });

    it("should allow Employee to create transactions", () => {
      expect(RBACService.canCreateTransaction("employee" as UserRole)).toBe(
        true,
      );
    });

    it("should deny Investor from creating transactions", () => {
      expect(RBACService.canCreateTransaction("investor" as UserRole)).toBe(
        false,
      );
    });
  });

  describe("canViewTransactions", () => {
    it("should allow Dev to view all transactions", () => {
      expect(RBACService.canViewTransactions("dev" as UserRole)).toBe(true);
      expect(RBACService.canViewTransactions("dev" as UserRole, false)).toBe(
        true,
      );
    });

    it("should allow Boss to view all transactions", () => {
      expect(RBACService.canViewTransactions("boss" as UserRole)).toBe(true);
    });

    it("should allow Employee to view own transactions", () => {
      expect(
        RBACService.canViewTransactions("employee" as UserRole, true),
      ).toBe(true);
    });

    it("should deny Investor from viewing transactions", () => {
      expect(RBACService.canViewTransactions("investor" as UserRole)).toBe(
        false,
      );
    });
  });

  describe("canViewReports", () => {
    it("should allow Dev to view all reports", () => {
      expect(RBACService.canViewReports("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to view reports", () => {
      expect(RBACService.canViewReports("boss" as UserRole)).toBe(true);
    });

    it("should allow Employee to view own reports", () => {
      expect(RBACService.canViewReports("employee" as UserRole, false)).toBe(
        true,
      );
    });

    it("should allow Investor to view aggregated reports", () => {
      expect(RBACService.canViewReports("investor" as UserRole, true)).toBe(
        true,
      );
    });
  });

  describe("canManageUsers", () => {
    it("should allow Dev to manage users", () => {
      expect(RBACService.canManageUsers("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to manage users", () => {
      expect(RBACService.canManageUsers("boss" as UserRole)).toBe(true);
    });

    it("should deny Employee from managing users", () => {
      expect(RBACService.canManageUsers("employee" as UserRole)).toBe(false);
    });

    it("should deny Investor from managing users", () => {
      expect(RBACService.canManageUsers("investor" as UserRole)).toBe(false);
    });
  });

  describe("canApproveTransactions", () => {
    it("should allow Dev to approve transactions", () => {
      expect(RBACService.canApproveTransactions("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to approve transactions", () => {
      expect(RBACService.canApproveTransactions("boss" as UserRole)).toBe(true);
    });

    it("should deny Employee from approving transactions", () => {
      expect(RBACService.canApproveTransactions("employee" as UserRole)).toBe(
        false,
      );
    });

    it("should deny Investor from approving transactions", () => {
      expect(RBACService.canApproveTransactions("investor" as UserRole)).toBe(
        false,
      );
    });
  });

  describe("canManageCategories", () => {
    it("should allow Dev to manage categories", () => {
      expect(RBACService.canManageCategories("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to manage categories", () => {
      expect(RBACService.canManageCategories("boss" as UserRole)).toBe(true);
    });

    it("should deny Employee from managing categories", () => {
      expect(RBACService.canManageCategories("employee" as UserRole)).toBe(
        false,
      );
    });

    it("should deny Investor from managing categories", () => {
      expect(RBACService.canManageCategories("investor" as UserRole)).toBe(
        false,
      );
    });
  });

  describe("canViewAuditLogs", () => {
    it("should allow Dev to view audit logs", () => {
      expect(RBACService.canViewAuditLogs("dev" as UserRole)).toBe(true);
    });

    it("should allow Boss to view audit logs", () => {
      expect(RBACService.canViewAuditLogs("boss" as UserRole)).toBe(true);
    });

    it("should deny Employee from viewing audit logs", () => {
      expect(RBACService.canViewAuditLogs("employee" as UserRole)).toBe(false);
    });

    it("should deny Investor from viewing audit logs", () => {
      expect(RBACService.canViewAuditLogs("investor" as UserRole)).toBe(false);
    });
  });
});
