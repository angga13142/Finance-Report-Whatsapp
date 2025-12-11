/**
 * Integration tests for admin commands via WhatsApp
 * Tests template, role, system diagnostics, configuration, and cache commands
 */

import { Message } from "whatsapp-web.js";
import { AdminHandler } from "../../../../src/bot/handlers/admin";
import { ConfigService } from "../../../../src/services/system/config";
import { DiagnosticsService } from "../../../../src/services/system/diagnostics";
import { TemplateService } from "../../../../src/services/system/template";
import { CacheService } from "../../../../src/services/system/cache";
import { AuditLogger } from "../../../../src/services/audit/logger";

// Mock dependencies
jest.mock("../../../../src/services/system/config");
jest.mock("../../../../src/services/system/diagnostics");
jest.mock("../../../../src/services/system/template");
jest.mock("../../../../src/services/system/cache");
jest.mock("../../../../src/services/audit/logger");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Admin Commands Integration", () => {
  let mockMessage: jest.Mocked<Message>;
  const devUserId = "dev-user-123";
  const devRole = "dev" as const;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessage = {
      reply: jest.fn().mockResolvedValue(undefined),
      from: "+6281234567890",
    } as unknown as jest.Mocked<Message>;
  });

  describe("Template Commands", () => {
    it("should handle /template list command", async () => {
      const mockTemplates = [
        {
          id: "1",
          name: "welcome_message",
          content: "Hello {{name}}",
          description: "Welcome message",
          updatedAt: new Date(),
          updatedBy: "dev1",
        },
      ];

      (TemplateService.prototype.list as jest.Mock).mockResolvedValue(
        mockTemplates,
      );

      await AdminHandler.handleTemplateList(mockMessage, devUserId, devRole);

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(TemplateService.prototype.list).toHaveBeenCalled();
    });

    it("should handle /template preview command", async () => {
      const mockTemplate = {
        id: "1",
        name: "welcome_message",
        content: "Hello {{name}}",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (TemplateService.prototype.preview as jest.Mock).mockResolvedValue(
        mockTemplate,
      );

      await AdminHandler.handleTemplatePreview(
        mockMessage,
        devUserId,
        devRole,
        "welcome_message",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(TemplateService.prototype.preview).toHaveBeenCalledWith(
        "welcome_message",
      );
    });

    it("should handle /template edit command", async () => {
      const mockTemplate = {
        id: "1",
        name: "welcome_message",
        content: "Hello {{name}}, welcome!",
        updatedAt: new Date(),
        updatedBy: devUserId,
      };

      (TemplateService.prototype.edit as jest.Mock).mockResolvedValue(
        mockTemplate,
      );

      await AdminHandler.handleTemplateEdit(
        mockMessage,
        devUserId,
        devRole,
        "welcome_message",
        "Hello {{name}}, welcome!",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(TemplateService.prototype.edit).toHaveBeenCalled();
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "template.edit",
        expect.any(Object),
        devUserId,
      );
    });
  });

  describe("Role Management Commands", () => {
    it("should handle /role grant command", async () => {
      await AdminHandler.handleRoleGrant(
        mockMessage,
        devUserId,
        devRole,
        "+6281234567890",
        "boss",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "role.grant",
        expect.any(Object),
        devUserId,
      );
    });

    it("should handle /role revoke command", async () => {
      await AdminHandler.handleRoleRevoke(
        mockMessage,
        devUserId,
        devRole,
        "+6281234567890",
        "boss",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "role.revoke",
        expect.any(Object),
        devUserId,
      );
    });
  });

  describe("System Diagnostics Commands", () => {
    it("should handle /system status command", async () => {
      const mockDiagnostics = {
        overall: "healthy" as const,
        database: { status: "healthy" as const, responseTime: 50 },
        redis: { status: "healthy" as const, responseTime: 20 },
        whatsapp: { status: "healthy" as const, responseTime: 100 },
      };

      (DiagnosticsService.runFullDiagnostics as jest.Mock).mockResolvedValue(
        mockDiagnostics,
      );

      await AdminHandler.handleSystemStatus(mockMessage, devUserId, devRole);

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(DiagnosticsService.runFullDiagnostics).toHaveBeenCalled();
    });

    it("should handle /system logs command", async () => {
      await AdminHandler.handleSystemLogs(mockMessage, devUserId, devRole, 50);

      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });

  describe("Configuration Commands", () => {
    it("should handle /config view command", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        description: "Report delivery time",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (ConfigService.prototype.view as jest.Mock).mockResolvedValue(mockConfig);

      await AdminHandler.handleConfigView(
        mockMessage,
        devUserId,
        devRole,
        "REPORT_DELIVERY_TIME",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(ConfigService.prototype.view).toHaveBeenCalledWith(
        "REPORT_DELIVERY_TIME",
      );
    });

    it("should handle /config set command", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "23:00",
        updatedAt: new Date(),
        updatedBy: devUserId,
      };

      (ConfigService.prototype.set as jest.Mock).mockResolvedValue(mockConfig);

      await AdminHandler.handleConfigSet(
        mockMessage,
        devUserId,
        devRole,
        "REPORT_DELIVERY_TIME",
        "23:00",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(ConfigService.prototype.set).toHaveBeenCalledWith(
        "REPORT_DELIVERY_TIME",
        "23:00",
        devUserId,
      );
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "config.set",
        expect.any(Object),
        devUserId,
      );
    });
  });

  describe("Cache Commands", () => {
    it("should handle /cache clear command without pattern", async () => {
      (CacheService.prototype.clearAll as jest.Mock).mockResolvedValue({
        deleted: 10,
        failed: 0,
      });

      await AdminHandler.handleCacheClear(mockMessage, devUserId, devRole);

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(CacheService.prototype.clearAll).toHaveBeenCalled();
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "cache.clear",
        expect.any(Object),
        devUserId,
      );
    });

    it("should handle /cache clear command with pattern", async () => {
      (CacheService.prototype.clear as jest.Mock).mockResolvedValue({
        deleted: 5,
        failed: 0,
      });

      await AdminHandler.handleCacheClear(
        mockMessage,
        devUserId,
        devRole,
        "user:*",
      );

      expect(mockMessage.reply).toHaveBeenCalled();
      expect(CacheService.prototype.clear).toHaveBeenCalledWith("user:*");
      expect(AuditLogger.log).toHaveBeenCalledWith(
        "cache.clear",
        expect.any(Object),
        devUserId,
      );
    });
  });

  describe("RBAC Checks", () => {
    it("should reject admin commands from non-dev users", async () => {
      await AdminHandler.handleConfigView(
        mockMessage,
        "user-123",
        "employee",
        "REPORT_DELIVERY_TIME",
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining("Akses ditolak"),
      );
    });
  });
});
