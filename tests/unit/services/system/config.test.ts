/**
 * Unit tests for ConfigService
 * Tests view, set operations, Zod validation, persistence, and env override
 */

import { ConfigService } from "../../../../src/services/system/config";
import { SystemConfigModel } from "../../../../src/models/config";

// Mock dependencies
jest.mock("../../../../src/models/config");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("ConfigService - Phase 7 Enhancements", () => {
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = ConfigService.getInstance();
  });

  describe("View Operations", () => {
    it("should view all configurations", async () => {
      const mockConfigs = [
        {
          id: "1",
          key: "REPORT_DELIVERY_TIME",
          value: "24:00",
          description: "Report delivery time",
          updatedAt: new Date(),
          updatedBy: "dev1",
        },
        {
          id: "2",
          key: "MAX_TRANSACTION_AMOUNT",
          value: "500000000",
          description: "Maximum transaction amount",
          updatedAt: new Date(),
          updatedBy: "dev1",
        },
      ];

      (SystemConfigModel.list as jest.Mock).mockResolvedValue(mockConfigs);

      const result = await configService.viewAll();

      expect(result).toEqual(mockConfigs);
      expect(SystemConfigModel.list).toHaveBeenCalled();
    });

    it("should view configuration by key", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        description: "Report delivery time",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(mockConfig);

      const result = await configService.view("REPORT_DELIVERY_TIME");

      expect(result).toEqual(mockConfig);
      expect(SystemConfigModel.findByKey).toHaveBeenCalledWith(
        "REPORT_DELIVERY_TIME",
      );
    });

    it("should return null when configuration not found", async () => {
      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(null);

      const result = await configService.view("NON_EXISTENT_KEY");

      expect(result).toBeNull();
    });
  });

  describe("Set Operations", () => {
    it("should set configuration value with validation", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "23:00",
        description: "Report delivery time",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(null);
      (SystemConfigModel.create as jest.Mock).mockResolvedValue(mockConfig);

      const result = await configService.set(
        "REPORT_DELIVERY_TIME",
        "23:00",
        "dev1",
      );

      expect(result).toEqual(mockConfig);
      expect(SystemConfigModel.create).toHaveBeenCalledWith({
        key: "REPORT_DELIVERY_TIME",
        value: "23:00",
        updatedBy: "dev1",
      });
    });

    it("should update existing configuration", async () => {
      const existingConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        description: "Report delivery time",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      const updatedConfig = {
        ...existingConfig,
        value: "23:00",
        updatedBy: "dev2",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(
        existingConfig,
      );
      (SystemConfigModel.update as jest.Mock).mockResolvedValue(updatedConfig);

      const result = await configService.set(
        "REPORT_DELIVERY_TIME",
        "23:00",
        "dev2",
      );

      expect(result).toEqual(updatedConfig);
      expect(SystemConfigModel.update).toHaveBeenCalledWith(
        "REPORT_DELIVERY_TIME",
        {
          value: "23:00",
          updatedBy: "dev2",
        },
      );
    });

    it("should validate key pattern before setting", async () => {
      await expect(
        configService.set("invalid-key", "value", "dev1"),
      ).rejects.toThrow("Configuration key must match pattern");
    });

    it("should validate value with Zod schema", async () => {
      // Test with invalid time format
      await expect(
        configService.set("REPORT_DELIVERY_TIME", "25:00", "dev1"),
      ).rejects.toThrow();
    });
  });

  describe("Zod Schema Validation", () => {
    it("should validate REPORT_DELIVERY_TIME format", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(null);
      (SystemConfigModel.create as jest.Mock).mockResolvedValue(mockConfig);

      await configService.set("REPORT_DELIVERY_TIME", "24:00", "dev1");

      expect(SystemConfigModel.create).toHaveBeenCalled();
    });

    it("should reject invalid time format", async () => {
      await expect(
        configService.set("REPORT_DELIVERY_TIME", "25:00", "dev1"),
      ).rejects.toThrow();
    });

    it("should validate numeric values", async () => {
      const mockConfig = {
        id: "1",
        key: "MAX_TRANSACTION_AMOUNT",
        value: "500000000",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(null);
      (SystemConfigModel.create as jest.Mock).mockResolvedValue(mockConfig);

      await configService.set("MAX_TRANSACTION_AMOUNT", "500000000", "dev1");

      expect(SystemConfigModel.create).toHaveBeenCalled();
    });

    it("should reject non-numeric values for numeric configs", async () => {
      await expect(
        configService.set("MAX_TRANSACTION_AMOUNT", "invalid", "dev1"),
      ).rejects.toThrow();
    });
  });

  describe("Database Persistence", () => {
    it("should persist configuration to database", async () => {
      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(null);
      (SystemConfigModel.create as jest.Mock).mockResolvedValue(mockConfig);

      await configService.set("REPORT_DELIVERY_TIME", "24:00", "dev1");

      expect(SystemConfigModel.create).toHaveBeenCalledWith({
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        updatedBy: "dev1",
      });
    });

    it("should update existing configuration in database", async () => {
      const existingConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      const updatedConfig = {
        ...existingConfig,
        value: "23:00",
        updatedBy: "dev2",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(
        existingConfig,
      );
      (SystemConfigModel.update as jest.Mock).mockResolvedValue(updatedConfig);

      await configService.set("REPORT_DELIVERY_TIME", "23:00", "dev2");

      expect(SystemConfigModel.update).toHaveBeenCalled();
    });
  });

  describe("Environment Variable Override", () => {
    it("should prioritize environment variable over database value", async () => {
      // Set env var
      process.env.REPORT_DELIVERY_TIME = "22:00";

      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00", // Database value
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(mockConfig);

      const result = await configService.view("REPORT_DELIVERY_TIME");

      // Should return env override value, not database value
      expect(result?.value).toBe("22:00");

      // Cleanup
      delete process.env.REPORT_DELIVERY_TIME;
    });

    it("should fall back to database value when env var not set", async () => {
      delete process.env.REPORT_DELIVERY_TIME;

      const mockConfig = {
        id: "1",
        key: "REPORT_DELIVERY_TIME",
        value: "24:00",
        updatedAt: new Date(),
        updatedBy: "dev1",
      };

      (SystemConfigModel.findByKey as jest.Mock).mockResolvedValue(mockConfig);

      const result = await configService.view("REPORT_DELIVERY_TIME");

      expect(result?.value).toBe("24:00");
    });
  });
});
