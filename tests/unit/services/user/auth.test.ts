/**
 * Unit tests for AuthService
 * Tests JWT token generation, verification, and user authentication
 */

import { AuthService } from "../../../../src/services/user/auth";
import { UserModel } from "../../../../src/models/user";
import { AuditLogger } from "../../../../src/services/audit/logger";
import { normalizePhoneNumber } from "../../../../src/lib/validation";
import { User, UserRole } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import { env } from "../../../../src/config/env";

// Mock dependencies
jest.mock("../../../../src/models/user");
jest.mock("../../../../src/services/audit/logger");
jest.mock("../../../../src/lib/validation");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateToken", () => {
    it("should generate JWT token for user", () => {
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      };

      const token = AuthService.generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify token can be decoded
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      expect(decoded.userId).toBe("user123");
      expect(decoded.phoneNumber).toBe("+62812345678");
      expect(decoded.role).toBe("employee");
    });
  });

  describe("verifyToken", () => {
    it("should verify valid JWT token", () => {
      const payload = {
        userId: "user123",
        phoneNumber: "+62812345678",
        role: "employee" as UserRole,
      };

      const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: "24h",
      });

      const decoded = AuthService.verifyToken(token);

      expect(decoded.userId).toBe("user123");
      expect(decoded.phoneNumber).toBe("+62812345678");
      expect(decoded.role).toBe("employee");
    });

    it("should throw error for invalid token", () => {
      expect(() => AuthService.verifyToken("invalid-token")).toThrow(
        "Invalid or expired token",
      );
    });

    it("should throw error for expired token", () => {
      const payload = {
        userId: "user123",
        phoneNumber: "+62812345678",
        role: "employee" as UserRole,
      };

      const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: "-1h", // Expired
      });

      expect(() => AuthService.verifyToken(token)).toThrow(
        "Invalid or expired token",
      );
    });
  });

  describe("authenticateByPhoneNumber", () => {
    it("should authenticate active user", async () => {
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      };

      (normalizePhoneNumber as jest.Mock).mockReturnValue("+62812345678");
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.updateLastActive as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.logAuthSuccess as jest.Mock).mockResolvedValue(undefined);

      const result = await AuthService.authenticateByPhoneNumber("0812345678");

      expect(result).toEqual(mockUser);
      expect(UserModel.updateLastActive).toHaveBeenCalledWith("user123");
      expect(AuditLogger.logAuthSuccess).toHaveBeenCalled();
    });

    it("should return null for non-existent user", async () => {
      (normalizePhoneNumber as jest.Mock).mockReturnValue("+62812345678");
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (AuditLogger.logAuthFailed as jest.Mock).mockResolvedValue(undefined);

      const result = await AuthService.authenticateByPhoneNumber("0812345678");

      expect(result).toBeNull();
      expect(AuditLogger.logAuthFailed).toHaveBeenCalledWith(
        "+62812345678",
        "User not found",
      );
    });

    it("should return null for inactive user", async () => {
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: false,
        createdAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
      };

      (normalizePhoneNumber as jest.Mock).mockReturnValue("+62812345678");
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.logAuthFailed as jest.Mock).mockResolvedValue(undefined);

      const result = await AuthService.authenticateByPhoneNumber("0812345678");

      expect(result).toBeNull();
      expect(AuditLogger.logAuthFailed).toHaveBeenCalledWith(
        "+62812345678",
        "Account deactivated",
      );
    });

    it("should handle errors gracefully", async () => {
      // Mock normalizePhoneNumber to throw error
      (normalizePhoneNumber as jest.Mock).mockImplementation(() => {
        throw new Error("Validation error");
      });

      // The service throws error, not returns null
      await expect(
        AuthService.authenticateByPhoneNumber("invalid"),
      ).rejects.toThrow("Validation error");
    });
  });
});
