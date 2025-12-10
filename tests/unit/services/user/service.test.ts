/**
 * Unit tests for UserService
 * Tests user CRUD operations, statistics, role management, and session handling
 */

import { UserRole } from "@prisma/client";
import { AuditLogger } from "../../../../src/services/audit/logger";
import { redis } from "../../../../src/lib/redis";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Redis
jest.mock("../../../../src/lib/redis", () => ({
  redis: {
    del: jest.fn(),
  },
}));

// Mock Audit Logger
jest.mock("../../../../src/services/audit/logger");

// Mock Prisma client
jest.mock("@prisma/client", () => {
  const mockPrismaInstance = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
    },
    userSession: {
      deleteMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
    UserRole: {
      dev: "dev",
      boss: "boss",
      employee: "employee",
      investor: "investor",
    },
  };
});

// Import after mocks are set up
import { UserService } from "../../../../src/services/user/service";
import { PrismaClient } from "@prisma/client";

// Get the mocked Prisma instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = new PrismaClient();

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listUsers", () => {
    it("should list all users with statistics", async () => {
      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+6281234567890",
          name: "User 1",
          role: "employee",
          isActive: true,
          createdAt: new Date(),
          lastActive: new Date(),
          _count: { transactions: 10 },
          transactions: [{ timestamp: new Date() }],
        },
        {
          id: "user2",
          phoneNumber: "+6281234567891",
          name: "User 2",
          role: "boss",
          isActive: true,
          createdAt: new Date(),
          lastActive: new Date(),
          _count: { transactions: 5 },
          transactions: [],
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserService.listUsers();

      expect(result.totalUsers).toBe(2);
      expect(result.activeUsers).toBe(2);
      expect(result.inactiveUsers).toBe(0);
      expect(result.users).toHaveLength(2);
      expect(result.users[0].transactionCount).toBe(10);
      expect(result.usersByRole.employee).toBe(1);
      expect(result.usersByRole.boss).toBe(1);
    });

    it("should filter users by role", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await UserService.listUsers({ role: "employee" as UserRole });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: "employee" }),
        }),
      );
    });

    it("should filter users by active status", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await UserService.listUsers({ isActive: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe("getUserById", () => {
    it("should return user by ID", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+6281234567890",
        name: "Test User",
        role: "employee",
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.getUserById("user123");

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user123" },
      });
    });

    it("should return null if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await UserService.getUserById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getUserByPhoneNumber", () => {
    it("should return user by phone number", async () => {
      const mockUser = {
        id: "user123",
        phoneNumber: "+6281234567890",
        name: "Test User",
        role: "employee",
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.getUserByPhoneNumber("+6281234567890");

      expect(result).toEqual(mockUser);
    });
  });

  describe("createUser", () => {
    it("should create a new user", async () => {
      const userData = {
        phoneNumber: "+6281234567890",
        name: "New User",
        role: "employee" as UserRole,
      };

      const mockUser = {
        id: "user123",
        ...userData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await UserService.createUser(userData, "admin123");

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(AuditLogger.logUserCreated).toHaveBeenCalledWith(
        "admin123",
        "user123",
        expect.any(Object),
      );
    });

    it("should throw error if user already exists", async () => {
      const existingUser = {
        id: "existing123",
        phoneNumber: "+6281234567890",
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        UserService.createUser(
          {
            phoneNumber: "+6281234567890",
            name: "New User",
            role: "employee" as UserRole,
          },
          "admin123",
        ),
      ).rejects.toThrow("already exists");
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const existingUser = {
        id: "user123",
        phoneNumber: "+6281234567890",
        name: "Old Name",
        role: "employee",
        isActive: true,
      };

      const updatedUser = {
        ...existingUser,
        name: "New Name",
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await UserService.updateUser(
        "user123",
        { name: "New Name" },
        "admin123",
      );

      expect(result.name).toBe("New Name");
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("should log role change", async () => {
      const existingUser = {
        id: "user123",
        role: "employee",
      };

      const updatedUser = {
        ...existingUser,
        role: "boss",
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      await UserService.updateUser(
        "user123",
        { role: "boss" as UserRole },
        "admin123",
      );

      expect(AuditLogger.logUserRoleChanged).toHaveBeenCalledWith(
        "admin123",
        "user123",
        "employee",
        "boss",
      );
    });

    it("should throw error if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        UserService.updateUser("nonexistent", { name: "New Name" }, "admin123"),
      ).rejects.toThrow("not found");
    });
  });

  describe("deactivateUser", () => {
    it("should deactivate user and clear session", async () => {
      const mockUser = {
        id: "user123",
        isActive: false,
      };

      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await UserService.deactivateUser(
        "user123",
        "admin123",
        "violation",
      );

      expect(result.isActive).toBe(false);
      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user123" },
      });
      expect(redis.del).toHaveBeenCalledWith("session:user123");
      expect(AuditLogger.logUserDeactivated).toHaveBeenCalledWith(
        "admin123",
        "user123",
        "violation",
      );
    });
  });

  describe("activateUser", () => {
    it("should activate user", async () => {
      const mockUser = {
        id: "user123",
        isActive: true,
      };

      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await UserService.activateUser("user123", "admin123");

      expect(result.isActive).toBe(true);
      expect(AuditLogger.logUserActivated).toHaveBeenCalledWith(
        "admin123",
        "user123",
      );
    });
  });

  describe("changeUserRole", () => {
    it("should change user role", async () => {
      const existingUser = {
        id: "user123",
        role: "employee",
      };

      const updatedUser = {
        ...existingUser,
        role: "boss",
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await UserService.changeUserRole(
        "user123",
        "boss" as UserRole,
        "admin123",
      );

      expect(result.role).toBe("boss");
      expect(AuditLogger.logUserRoleChanged).toHaveBeenCalledWith(
        "admin123",
        "user123",
        "employee",
        "boss",
      );
    });
  });

  describe("resetUserSession", () => {
    it("should reset user session", async () => {
      mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      await UserService.resetUserSession("user123", "admin123");

      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user123" },
      });
      expect(redis.del).toHaveBeenCalledWith("session:user123");
      expect(AuditLogger.logSessionReset).toHaveBeenCalledWith(
        "admin123",
        "user123",
      );
    });
  });

  describe("getUserStatistics", () => {
    it("should return user statistics", async () => {
      const mockUser = {
        id: "user123",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        transactions: [
          {
            type: "income",
            amount: { toNumber: () => 100000 },
            timestamp: new Date(),
          },
          {
            type: "expense",
            amount: { toNumber: () => 50000 },
            timestamp: new Date(),
          },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.getUserStatistics("user123");

      expect(result.totalTransactions).toBe(2);
      expect(result.totalIncome).toBe(100000);
      expect(result.totalExpense).toBe(50000);
      expect(result.accountAge).toBe(30);
    });
  });

  describe("deleteUser", () => {
    it("should delete user with no transactions", async () => {
      mockPrisma.transaction.count.mockResolvedValue(0);
      mockPrisma.user.delete.mockResolvedValue({});

      await UserService.deleteUser("user123", "admin123");

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user123" },
      });
      expect(AuditLogger.log).toHaveBeenCalled();
    });

    it("should throw error if user has transactions", async () => {
      mockPrisma.transaction.count.mockResolvedValue(5);

      await expect(
        UserService.deleteUser("user123", "admin123"),
      ).rejects.toThrow("Cannot delete user with 5 transactions");

      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
