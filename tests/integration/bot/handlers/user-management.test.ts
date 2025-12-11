/**
 * Integration tests for user management commands via WhatsApp
 * Tests /user add, /user list, /user update, /user delete, /user activate, /user deactivate
 */

import { Message } from "whatsapp-web.js";
import { UserManagementHandler } from "../../../../src/bot/handlers/user-management";
import { UserManagerService } from "../../../../src/services/user/manager";
import { UserRole } from "@prisma/client";

// Mock dependencies
jest.mock("../../../../src/services/user/manager");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  maskSensitiveData: jest.fn((data: unknown): string => {
    if (typeof data === "string" && data.length > 8) {
      return data.substring(0, 4) + "****" + data.substring(data.length - 4);
    }
    return String(data);
  }),
}));

describe("User Management Commands Integration", () => {
  let mockMessage: jest.Mocked<Message>;
  const bossUserId = "boss-user-123";
  const bossRole = "boss" as UserRole;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessage = {
      reply: jest.fn().mockResolvedValue(undefined),
      from: "+6281234567890",
      body: "",
    } as unknown as jest.Mocked<Message>;
  });

  describe("/user add command", () => {
    it("should handle /user add command successfully", async () => {
      const mockUser = {
        id: "new-user-1",
        phoneNumber: "+6281234567890",
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserManagerService.createUser as jest.Mock).mockResolvedValue(mockUser);

      await UserManagementHandler.handleAddUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
        "John Doe",
        "employee",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.createUser).toHaveBeenCalledWith(
        {
          phoneNumber: "+6281234567890",
          name: "John Doe",
          role: "employee",
        },
        bossUserId,
        bossRole,
      );
    });

    it("should handle permission denied error", async () => {
      (UserManagerService.createUser as jest.Mock).mockRejectedValue(
        new Error(
          "Permission denied. Only boss and dev roles can manage users",
        ),
      );

      await UserManagementHandler.handleAddUser(
        mockMessage,
        "employee-1",
        "employee" as UserRole,
        "+6281234567890",
        "John Doe",
        "employee",
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining("Permission denied"),
      );
    });
  });

  describe("/user list command", () => {
    it("should handle /user list command successfully", async () => {
      const mockResult = {
        users: [
          {
            id: "user-1",
            phoneNumber: "+6281234567890",
            name: "John Doe",
            role: "employee" as UserRole,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActive: new Date(),
            transactionCount: 5,
            lastTransactionDate: new Date(),
          },
        ],
        totalUsers: 1,
        activeUsers: 1,
        inactiveUsers: 0,
        usersByRole: {
          dev: 0,
          boss: 0,
          employee: 1,
          investor: 0,
        },
      };

      (UserManagerService.listUsers as jest.Mock).mockResolvedValue(mockResult);

      await UserManagementHandler.handleListUsers(
        mockMessage,
        bossUserId,
        bossRole,
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.listUsers).toHaveBeenCalledWith(
        undefined,
        bossUserId,
      );
    });

    it("should handle /user list with role filter", async () => {
      const mockResult = {
        users: [],
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        usersByRole: {
          dev: 0,
          boss: 0,
          employee: 0,
          investor: 0,
        },
      };

      (UserManagerService.listUsers as jest.Mock).mockResolvedValue(mockResult);

      await UserManagementHandler.handleListUsers(
        mockMessage,
        bossUserId,
        bossRole,
        "employee",
      );

      expect(UserManagerService.listUsers).toHaveBeenCalledWith(
        { role: "employee" },
        bossUserId,
      );
    });
  });

  describe("/user update command", () => {
    it("should handle /user update command successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: "+6281234567890",
        name: "John Smith",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserManagerService.updateUser as jest.Mock).mockResolvedValue(mockUser);

      await UserManagementHandler.handleUpdateUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
        "name",
        "John Smith",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.updateUser).toHaveBeenCalledWith(
        "+6281234567890",
        { name: "John Smith" },
        bossUserId,
        bossRole,
      );
    });
  });

  describe("/user delete command", () => {
    it("should handle /user delete command successfully", async () => {
      (UserManagerService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      await UserManagementHandler.handleDeleteUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.deleteUser).toHaveBeenCalledWith(
        "+6281234567890",
        bossUserId,
        bossRole,
      );
    });
  });

  describe("/user activate command", () => {
    it("should handle /user activate command successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: "+6281234567890",
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserManagerService.activateUser as jest.Mock).mockResolvedValue(
        mockUser,
      );

      await UserManagementHandler.handleActivateUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.activateUser).toHaveBeenCalledWith(
        "+6281234567890",
        bossUserId,
        bossRole,
      );
    });
  });

  describe("/user deactivate command", () => {
    it("should handle /user deactivate command successfully", async () => {
      const mockUser = {
        id: "user-1",
        phoneNumber: "+6281234567890",
        name: "John Doe",
        role: "employee" as UserRole,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      (UserManagerService.deactivateUser as jest.Mock).mockResolvedValue(
        mockUser,
      );

      await UserManagementHandler.handleDeactivateUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(UserManagerService.deactivateUser).toHaveBeenCalledWith(
        "+6281234567890",
        bossUserId,
        bossRole,
      );
    });
  });
});
