/**
 * Integration tests for cross-story interactions
 * Tests user management + admin commands interactions
 */

import { Message } from "whatsapp-web.js";
import { UserManagementHandler } from "../../../src/bot/handlers/user-management";
import { AdminHandler } from "../../../src/bot/handlers/admin";
import { UserManagerService } from "../../../src/services/user/manager";
import { RBACService } from "../../../src/services/user/rbac";
import { UserRole } from "@prisma/client";

// Mock dependencies
jest.mock("../../../src/services/user/manager");
jest.mock("../../../src/services/user/rbac");
jest.mock("../../../src/lib/logger", () => ({
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

describe("Cross-Story Integration: User Management + Admin Commands", () => {
  let mockMessage: jest.Mocked<Message>;
  const devUserId = "dev-user-123";
  const bossUserId = "boss-user-123";
  const devRole = "dev" as UserRole;
  const bossRole = "boss" as UserRole;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessage = {
      reply: jest.fn().mockResolvedValue(undefined),
      from: "+6281234567890",
      body: "",
    } as unknown as jest.Mocked<Message>;
  });

  describe("User Management + Role Management", () => {
    it("should allow creating user then granting role", async () => {
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
      (RBACService.grantRole as jest.Mock).mockResolvedValue(undefined);

      // Create user via user management
      await UserManagementHandler.handleAddUser(
        mockMessage,
        bossUserId,
        bossRole,
        "+6281234567890",
        "John Doe",
        "employee",
      );

      expect(UserManagerService.createUser).toHaveBeenCalled();

      // Grant role via admin command
      await AdminHandler.handleRoleGrant(
        mockMessage,
        devUserId,
        devRole,
        "+6281234567890",
        "boss",
      );

      expect(RBACService.grantRole).toHaveBeenCalledWith(
        "+6281234567890",
        "boss",
        devUserId,
      );
    });

    it("should allow listing users then viewing system status", async () => {
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

      // List users
      await UserManagementHandler.handleListUsers(
        mockMessage,
        devUserId,
        devRole,
      );

      expect(UserManagerService.listUsers).toHaveBeenCalled();

      // View system status
      await AdminHandler.handleSystemStatus(mockMessage, devUserId, devRole);

      expect(mockMessage.reply).toHaveBeenCalledTimes(2);
    });
  });

  describe("User Management + Configuration", () => {
    it("should allow managing users then viewing configuration", async () => {
      // List users
      (UserManagerService.listUsers as jest.Mock).mockResolvedValue({
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
      });

      await UserManagementHandler.handleListUsers(
        mockMessage,
        devUserId,
        devRole,
      );

      // View configuration
      await AdminHandler.handleConfigView(
        mockMessage,
        devUserId,
        devRole,
        "REPORT_DELIVERY_TIME",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });

  describe("RBAC Enforcement Across Commands", () => {
    it("should enforce boss/dev role for user management", async () => {
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

    it("should enforce dev role for admin commands", async () => {
      await AdminHandler.handleAdminMenu(
        mockMessage,
        "boss-1",
        "boss" as UserRole,
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining("AKSES DITOLAK"),
      );
    });
  });
});
