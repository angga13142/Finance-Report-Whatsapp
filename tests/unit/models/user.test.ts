/**
 * Unit tests for UserModel
 * Tests user CRUD operations, phone number normalization, role management, etc.
 */

import { UserModel } from "../../../src/models/user";
import type { UserRole } from "@prisma/client";

// Mock Prisma - use var to avoid TDZ issues with jest.mock hoisting
let mockPrismaInstance: {
  user: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

jest.mock("@prisma/client", () => {
  // Create mock instance inside factory
  const mockInstance = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  // Assign to outer scope variable
  mockPrismaInstance = mockInstance;

  return {
    PrismaClient: jest.fn(() => mockInstance),
    UserRole: {
      DEV: "dev",
      BOSS: "boss",
      EMPLOYEE: "employee",
      INVESTOR: "investor",
    },
  };
});

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock validation
jest.mock("../../../src/lib/validation");

describe("UserModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup validation mocks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const validation = require("../../../src/lib/validation");
    validation.validatePhoneNumber.mockReturnValue(true);
    validation.normalizePhoneNumber.mockImplementation((phone: string) => {
      if (!phone) return phone;
      if (phone.startsWith("0")) {
        return "+62" + phone.substring(1);
      }
      return phone.startsWith("+62") ? phone : "+62" + phone;
    });
  });

  describe("findByPhoneNumber", () => {
    it("should find user by phone number", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserModel.findByPhoneNumber("0812345678");

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.findUnique).toHaveBeenCalledWith({
        where: { phoneNumber: "+62812345678" },
      });
    });

    it("should return null when user not found", async () => {
      mockPrismaInstance.user.findUnique.mockResolvedValue(null);

      const result = await UserModel.findByPhoneNumber("0812345678");

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserModel.findById("user123");

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user123" },
      });
    });

    it("should return null when user not found", async () => {
      mockPrismaInstance.user.findUnique.mockResolvedValue(null);

      const result = await UserModel.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create new user", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.findUnique.mockResolvedValue(null); // User doesn't exist
      mockPrismaInstance.user.create.mockResolvedValue(mockUser);

      const result = await UserModel.create({
        phoneNumber: "0812345678",
        name: "Test User",
        role: "employee",
      });

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: "+62812345678",
          name: "Test User",
          role: "employee",
          isActive: true,
        }),
      });
    });

    it("should throw error when user already exists", async () => {
      const existingUser = {
        id: "user123",
        phoneNumber: "+62812345678",
      };

      mockPrismaInstance.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        UserModel.create({
          phoneNumber: "0812345678",
          name: "Test User",
        }),
      ).rejects.toThrow("User with this phone number already exists");
    });

    it("should default role to employee", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.findUnique.mockResolvedValue(null);
      mockPrismaInstance.user.create.mockResolvedValue(mockUser);

      await UserModel.create({
        phoneNumber: "0812345678",
        name: "Test User",
      });

      expect(mockPrismaInstance.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "employee",
        }),
      });
    });
  });

  describe("update", () => {
    it("should update user", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Updated Name",
        role: "boss" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.update.mockResolvedValue(mockUser);

      const result = await UserModel.update("user123", {
        name: "Updated Name",
        role: "boss",
      });

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: {
          name: "Updated Name",
          role: "boss",
        },
      });
    });
  });

  describe("updateLastActive", () => {
    it("should update last active timestamp", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        lastActive: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.update.mockResolvedValue(mockUser);

      const result = await UserModel.updateLastActive("user123");

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: { lastActive: expect.any(Date) },
      });
    });
  });

  describe("findActiveUsers", () => {
    it("should find all active users", async () => {
      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          name: "User 1",
          role: "employee" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          authTokenHash: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        {
          id: "user2",
          phoneNumber: "+62812345679",
          name: "User 2",
          role: "employee" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          authTokenHash: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      ];

      mockPrismaInstance.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserModel.findActiveUsers();

      expect(result).toEqual(mockUsers);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findByRole", () => {
    it("should find users by role", async () => {
      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          name: "Boss 1",
          role: "boss" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          authTokenHash: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      ];

      mockPrismaInstance.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserModel.findByRole("boss");

      expect(result).toEqual(mockUsers);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        where: { role: "boss", isActive: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("deactivate", () => {
    it("should deactivate user", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.update.mockResolvedValue(mockUser);

      const result = await UserModel.deactivate("user123");

      expect(result).toEqual(mockUser);
      expect(result.isActive).toBe(false);
      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: { isActive: false },
      });
    });
  });

  describe("activate", () => {
    it("should activate user", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaInstance.user.update.mockResolvedValue(mockUser);

      const result = await UserModel.activate("user123");

      expect(result).toEqual(mockUser);
      expect(result.isActive).toBe(true);
      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: { isActive: true },
      });
    });
  });
});
