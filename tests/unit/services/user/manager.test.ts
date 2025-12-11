/**
 * Unit tests for UserManagerService
 * Tests user management operations (create, list, update, delete, activate, deactivate)
 */

import { UserManagerService } from "../../../../src/services/user/manager";
import { UserModel } from "../../../../src/models/user";
import { UserService } from "../../../../src/services/user/service";
import { redis } from "../../../../src/lib/redis";
import { AuditLogger } from "../../../../src/services/audit/logger";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
} from "../../../../src/lib/validation";
import { UserRole } from "@prisma/client";

// Mock dependencies
jest.mock("../../../../src/models/user");
jest.mock("../../../../src/services/user/service");
jest.mock("../../../../src/services/user/rbac");
jest.mock("../../../../src/lib/redis");
jest.mock("../../../../src/services/audit/logger");
jest.mock("../../../../src/lib/validation");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("UserManagerService", () => {
  const mockPhoneNumber = "+62123456789";
  const mockNormalizedPhone = "+62123456789";
  const mockBossUserId = "boss-1";
  const mockDevUserId = "dev-1";

  beforeEach(() => {
    jest.clearAllMocks();
    (normalizePhoneNumber as jest.Mock).mockImplementation(
      (phone: string): string => {
        // Remove @c.us suffix and spaces
        let cleaned = phone.replace(/@c\.us/g, "").replace(/[\s\-()]/g, "");

        // Convert 0 prefix to +62
        if (cleaned.startsWith("0")) {
          cleaned = "+62" + cleaned.substring(1);
        } else if (cleaned.startsWith("62") && !cleaned.startsWith("+62")) {
          cleaned = "+" + cleaned;
        } else if (!cleaned.startsWith("+62")) {
          throw new Error("Phone number must start with +62, 62, or 0");
        }

        return cleaned;
      },
    );
    (validatePhoneNumber as jest.Mock).mockReturnValue(true);
  });

  describe("createUser", () => {
    it("should create user successfully with valid data", async () => {
      const mockUser = {
        id: "new-user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      const result = await UserManagerService.createUser(
        {
          phoneNumber: mockPhoneNumber,
          name: "John Doe",
          role: "employee",
        },
        mockBossUserId,
        "boss",
      );

      expect(result).toEqual(mockUser);
      expect(normalizePhoneNumber).toHaveBeenCalledWith(mockPhoneNumber);
      expect(validatePhoneNumber).toHaveBeenCalledWith(mockNormalizedPhone);
      expect(UserModel.findByPhoneNumber).toHaveBeenCalledWith(
        mockNormalizedPhone,
      );
      expect(UserService.createUser).toHaveBeenCalledWith(
        {
          phoneNumber: mockNormalizedPhone,
          name: "John Doe",
          role: "employee",
        },
        mockBossUserId,
      );
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "user.create",
        expect.objectContaining({
          phoneNumber: mockNormalizedPhone,
          name: "John Doe",
          role: "employee",
        }),
        mockBossUserId,
        mockUser.id,
        "User",
      );
    });

    it("should throw error if phone number is invalid", async () => {
      (normalizePhoneNumber as jest.Mock).mockImplementation(() => {
        throw new Error("Phone number must start with +62, 62, or 0");
      });

      await expect(
        UserManagerService.createUser(
          {
            phoneNumber: "invalid",
            name: "John Doe",
            role: "employee",
          },
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("Phone number must start with +62, 62, or 0");
    });

    it("should throw error if user already exists", async () => {
      const existingUser = {
        id: "existing-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(
        existingUser,
      );

      await expect(
        UserManagerService.createUser(
          {
            phoneNumber: mockPhoneNumber,
            name: "John Doe",
            role: "employee",
          },
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("User with this phone number already exists");
    });

    it("should throw error if role is invalid", async () => {
      await expect(
        UserManagerService.createUser(
          {
            phoneNumber: mockPhoneNumber,
            name: "John Doe",
            role: "invalid" as UserRole,
          },
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow();
    });
  });

  describe("listUsers", () => {
    it("should list all users when no filter provided", async () => {
      const mockUsers = [
        {
          id: "user-1",
          phoneNumber: "+62123456789",
          name: "User 1",
          role: "employee" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          transactionCount: 5,
          lastTransactionDate: new Date(),
        },
        {
          id: "user-2",
          phoneNumber: "+62123456790",
          name: "User 2",
          role: "boss" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          transactionCount: 10,
          lastTransactionDate: new Date(),
        },
      ];

      (UserService.listUsers as jest.Mock).mockResolvedValue({
        users: mockUsers,
        totalUsers: 2,
        activeUsers: 2,
        inactiveUsers: 0,
        usersByRole: {
          dev: 0,
          boss: 1,
          employee: 1,
          investor: 0,
        },
      });

      const result = await UserManagerService.listUsers(
        undefined,
        mockBossUserId,
      );

      expect(result.users).toHaveLength(2);
      expect(result.totalUsers).toBe(2);
      expect(UserService.listUsers).toHaveBeenCalledWith(undefined);
    });

    it("should filter users by role when filter provided", async () => {
      const mockUsers = [
        {
          id: "user-1",
          phoneNumber: "+62123456789",
          name: "User 1",
          role: "employee" as UserRole,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          transactionCount: 5,
          lastTransactionDate: new Date(),
        },
      ];

      (UserService.listUsers as jest.Mock).mockResolvedValue({
        users: mockUsers,
        totalUsers: 1,
        activeUsers: 1,
        inactiveUsers: 0,
        usersByRole: {
          dev: 0,
          boss: 0,
          employee: 1,
          investor: 0,
        },
      });

      const result = await UserManagerService.listUsers(
        { role: "employee" },
        mockBossUserId,
      );

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe("employee");
      expect(UserService.listUsers).toHaveBeenCalledWith({ role: "employee" });
    });
  });

  describe("updateUser", () => {
    it("should update user name successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Smith",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue({
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "employee" as UserRole,
      });
      (UserService.updateUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      const result = await UserManagerService.updateUser(
        mockPhoneNumber,
        { name: "John Smith" },
        mockBossUserId,
        "boss",
      );

      expect(result).toEqual(mockUser);
      expect(UserService.updateUser).toHaveBeenCalledWith(
        "user-1",
        { name: "John Smith" },
        mockBossUserId,
      );
    });

    it("should update user role successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "boss" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue({
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "employee" as UserRole,
      });
      (UserService.updateUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      const result = await UserManagerService.updateUser(
        mockPhoneNumber,
        { role: "boss" },
        mockBossUserId,
        "boss",
      );

      expect(result).toEqual(mockUser);
      expect(UserService.updateUser).toHaveBeenCalledWith(
        "user-1",
        { role: "boss" },
        mockBossUserId,
      );
    });

    it("should throw error if user not found", async () => {
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);

      await expect(
        UserManagerService.updateUser(
          mockPhoneNumber,
          { name: "John Smith" },
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("User not found");
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(mockUser);
      (UserService.deleteUser as jest.Mock).mockResolvedValue(undefined);
      (redis.del as jest.Mock).mockResolvedValue(1);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      await UserManagerService.deleteUser(
        mockPhoneNumber,
        mockBossUserId,
        "boss",
      );

      expect(UserService.deleteUser).toHaveBeenCalledWith(
        mockUser.id,
        mockBossUserId,
      );
      expect(redis.del).toHaveBeenCalledWith(`session:${mockUser.id}`);
    });

    it("should throw error if user not found", async () => {
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);

      await expect(
        UserManagerService.deleteUser(mockPhoneNumber, mockBossUserId, "boss"),
      ).rejects.toThrow("User not found");
    });

    it("should throw error if trying to delete dev user", async () => {
      const mockUser = {
        id: "dev-1",
        phoneNumber: mockNormalizedPhone,
        role: "dev" as UserRole,
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        UserManagerService.deleteUser(mockPhoneNumber, mockBossUserId, "boss"),
      ).rejects.toThrow("Cannot delete dev role user");
    });
  });

  describe("activateUser", () => {
    it("should activate user successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue({
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
        isActive: false,
      });
      (UserService.activateUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      const result = await UserManagerService.activateUser(
        mockPhoneNumber,
        mockBossUserId,
        "boss",
      );

      expect(result).toEqual(mockUser);
      expect(UserService.activateUser).toHaveBeenCalledWith(
        "user-1",
        mockBossUserId,
      );
    });

    it("should throw error if user not found", async () => {
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);

      await expect(
        UserManagerService.activateUser(
          mockPhoneNumber,
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("User not found");
    });
  });

  describe("deactivateUser", () => {
    it("should deactivate user successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue({
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        role: "employee" as UserRole,
        isActive: true,
      });
      (UserService.deactivateUser as jest.Mock).mockResolvedValue(mockUser);
      (redis.del as jest.Mock).mockResolvedValue(1);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      const result = await UserManagerService.deactivateUser(
        mockPhoneNumber,
        mockBossUserId,
        "boss",
      );

      expect(result).toEqual(mockUser);
      expect(UserService.deactivateUser).toHaveBeenCalledWith(
        "user-1",
        mockBossUserId,
      );
      expect(redis.del).toHaveBeenCalledWith(`session:${mockUser.id}`);
    });

    it("should throw error if user not found", async () => {
      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);

      await expect(
        UserManagerService.deactivateUser(
          mockPhoneNumber,
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("User not found");
    });

    it("should throw error if trying to deactivate dev user", async () => {
      const mockUser = {
        id: "dev-1",
        phoneNumber: mockNormalizedPhone,
        role: "dev" as UserRole,
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        UserManagerService.deactivateUser(
          mockPhoneNumber,
          mockBossUserId,
          "boss",
        ),
      ).rejects.toThrow("Cannot deactivate dev role user");
    });
  });

  describe("RBAC enforcement", () => {
    it("should allow boss role to manage users", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      await UserManagerService.createUser(
        {
          phoneNumber: mockPhoneNumber,
          name: "John Doe",
          role: "employee",
        },
        mockBossUserId,
        "boss",
      );

      expect(UserService.createUser).toHaveBeenCalled();
    });

    it("should allow dev role to manage users", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: mockNormalizedPhone,
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      await UserManagerService.createUser(
        {
          phoneNumber: mockPhoneNumber,
          name: "John Doe",
          role: "employee",
        },
        mockDevUserId,
        "dev",
      );

      expect(UserService.createUser).toHaveBeenCalled();
    });

    it("should reject employee role from managing users", async () => {
      await expect(
        UserManagerService.createUser(
          {
            phoneNumber: mockPhoneNumber,
            name: "John Doe",
            role: "employee",
          },
          "employee-1",
          "employee",
        ),
      ).rejects.toThrow("Permission denied");
    });

    it("should reject investor role from managing users", async () => {
      await expect(
        UserManagerService.createUser(
          {
            phoneNumber: mockPhoneNumber,
            name: "John Doe",
            role: "employee",
          },
          "investor-1",
          "investor",
        ),
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("phone number validation and normalization", () => {
    it("should normalize phone number with 0 prefix", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: "+62123456789",
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      await UserManagerService.createUser(
        {
          phoneNumber: "08123456789",
          name: "John Doe",
          role: "employee",
        },
        mockBossUserId,
        "boss",
      );

      expect(normalizePhoneNumber).toHaveBeenCalledWith("08123456789");
      expect(UserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+628123456789",
        }),
        mockBossUserId,
      );
    });

    it("should normalize phone number with 62 prefix", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: "+62123456789",
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserModel.findByPhoneNumber as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuditLogger.log as jest.Mock).mockResolvedValue(undefined);

      await UserManagerService.createUser(
        {
          phoneNumber: "62123456789",
          name: "John Doe",
          role: "employee",
        },
        mockBossUserId,
        "boss",
      );

      expect(normalizePhoneNumber).toHaveBeenCalledWith("62123456789");
      expect(UserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+62123456789",
        }),
        mockBossUserId,
      );
    });
  });
});
