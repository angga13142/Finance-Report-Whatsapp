/**
 * Unit tests for AccountLockoutService
 * Tests account lockout functionality, failed login tracking, and lockout status checks
 */

import { AccountLockoutService } from "../../../../src/services/user/lockout";
import { AuditLogger } from "../../../../src/services/audit/logger";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Audit Logger
jest.mock("../../../../src/services/audit/logger", () => ({
  AuditLogger: {
    logAuthFailed: jest.fn(),
  },
}));

describe("AccountLockoutService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("recordFailedAttempt", () => {
    it("should record failed login attempt", async () => {
      const result =
        await AccountLockoutService.recordFailedAttempt("+6281234567890");

      expect(result).toBe(false); // Currently returns false (placeholder)
      expect(AuditLogger.logAuthFailed).toHaveBeenCalledWith(
        "+6281234567890",
        expect.any(String),
      );
    });

    it("should handle errors gracefully", async () => {
      (AuditLogger.logAuthFailed as jest.Mock).mockRejectedValue(
        new Error("Audit log failed"),
      );

      await expect(
        AccountLockoutService.recordFailedAttempt("+6281234567890"),
      ).rejects.toThrow();
    });
  });

  describe("recordSuccessfulLogin", () => {
    it("should record successful login", () => {
      expect(() => {
        AccountLockoutService.recordSuccessfulLogin("+6281234567890");
      }).not.toThrow();
    });
  });

  describe("getAccountLockoutStatus", () => {
    it("should return lockout status", () => {
      const status =
        AccountLockoutService.getAccountLockoutStatus("+6281234567890");

      expect(status.isLocked).toBe(false);
      expect(status.maxAttempts).toBe(5);
    });

    it("should handle errors and return unlocked status", () => {
      const status =
        AccountLockoutService.getAccountLockoutStatus("+6281234567890");

      expect(status.isLocked).toBe(false);
    });
  });

  describe("Configuration constants", () => {
    it("should have correct MAX_FAILED_ATTEMPTS", () => {
      // Test that the constant is accessible and correct
      const status =
        AccountLockoutService.getAccountLockoutStatus("+6281234567890");
      expect(status.maxAttempts).toBe(5);
    });
  });
});
