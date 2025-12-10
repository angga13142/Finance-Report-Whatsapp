/**
 * Unit tests for AuditLogger
 * Tests audit logging functionality, action types, and error handling
 */

import {
  AuditLogger,
  AuditAction,
} from "../../../../src/services/audit/logger";
import { AuditLogModel } from "../../../../src/models/audit";
import { logger } from "../../../../src/lib/logger";

// Mock dependencies
jest.mock("../../../../src/models/audit");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("AuditLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("log", () => {
    it("should log audit action with all parameters", async () => {
      (AuditLogModel.create as jest.Mock).mockResolvedValue({
        id: "audit123",
        action: AuditAction.USER_CREATED,
      });

      await AuditLogger.log(
        AuditAction.USER_CREATED,
        { email: "test@example.com", role: "employee" },
        "user123",
        "newuser456",
        "User",
      );

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user123",
          action: AuditAction.USER_CREATED,
          details: expect.objectContaining({
            email: "test@example.com",
            role: "employee",
            timestamp: expect.any(String),
          }),
          affectedEntityId: "newuser456",
          affectedEntityType: "User",
        }),
      );

      expect(logger.info).toHaveBeenCalledWith(
        "Audit log recorded",
        expect.objectContaining({
          action: AuditAction.USER_CREATED,
          userId: "user123",
          affectedEntityType: "User",
        }),
      );
    });

    it("should log audit action with minimal parameters", async () => {
      (AuditLogModel.create as jest.Mock).mockResolvedValue({
        id: "audit124",
      });

      await AuditLogger.log(AuditAction.USER_LOGIN);

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          action: AuditAction.USER_LOGIN,
          details: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        }),
      );
    });

    it("should log custom action string", async () => {
      (AuditLogModel.create as jest.Mock).mockResolvedValue({
        id: "audit125",
      });

      await AuditLogger.log("custom.action", { customField: "value" });

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "custom.action",
          details: expect.objectContaining({
            customField: "value",
          }),
        }),
      );
    });

    it("should handle logging errors gracefully", async () => {
      const error = new Error("Database error");
      (AuditLogModel.create as jest.Mock).mockRejectedValue(error);

      await expect(
        AuditLogger.log(AuditAction.TRANSACTION_CREATED, {}, "user123"),
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to record audit log",
        expect.objectContaining({
          error,
          action: AuditAction.TRANSACTION_CREATED,
          userId: "user123",
        }),
      );
    });
  });

  describe("logUserCreated", () => {
    it("should log user creation", async () => {
      (AuditLogModel.create as jest.Mock).mockResolvedValue({
        id: "audit126",
      });

      await AuditLogger.logUserCreated("admin123", "newuser456", {
        phoneNumber: "+6281234567890",
        name: "John Doe",
        role: "employee",
      });

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin123",
          action: AuditAction.USER_CREATED,
          affectedEntityId: "newuser456",
          affectedEntityType: "User",
        }),
      );
    });
  });

  describe("logTransactionCreated", () => {
    it("should log transaction creation", async () => {
      (AuditLogModel.create as jest.Mock).mockResolvedValue({
        id: "audit127",
      });

      await AuditLogger.logTransactionCreated("user123", "txn789", {
        type: "expense",
        category: "Food",
        amount: 50000,
        description: "Lunch",
      });

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user123",
          action: AuditAction.TRANSACTION_CREATED,
          affectedEntityId: "txn789",
          affectedEntityType: "Transaction",
        }),
      );
    });
  });

  describe("AuditAction enum", () => {
    it("should contain all required action types", () => {
      expect(AuditAction.USER_CREATED).toBe("user.created");
      expect(AuditAction.TRANSACTION_APPROVED).toBe("transaction.approved");
      expect(AuditAction.AUTH_FAILED).toBe("auth.failed");
      expect(AuditAction.SYSTEM_HEALTH_CHECK).toBe("system.health_check");
    });
  });
});
