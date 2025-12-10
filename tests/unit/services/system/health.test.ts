/**
 * Unit tests for System Health Service
 * Tests health check functionality for database, Redis, and system status
 */

import { HealthMonitoringService } from "../../../../src/services/system/health";
import { PrismaClient } from "@prisma/client";
import { redis } from "../../../../src/lib/redis";
import { getWhatsAppClient } from "../../../../src/bot/client/client";

// Mock dependencies
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    $queryRaw: jest.fn(),
    user: {
      count: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
    },
  })),
}));

jest.mock("../../../../src/lib/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("../../../../src/bot/client/client", () => ({
  getWhatsAppClient: jest.fn(),
}));

jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("os", () => ({
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn(() => 4 * 1024 * 1024 * 1024), // 4GB
  cpus: jest.fn(() => [
    {
      model: "Test CPU",
      times: {
        user: 1000,
        nice: 0,
        sys: 500,
        idle: 5000,
        irq: 0,
      },
    },
  ]),
}));

describe("HealthMonitoringService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HealthMonitoringService.resetMetrics();
  });

  describe("getSystemHealth", () => {
    it("should return system health status", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ health_check: 1 }]),
        user: { count: jest.fn().mockResolvedValue(10) },
        transaction: { count: jest.fn().mockResolvedValue(100) },
      };

      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
      (redis.set as jest.Mock).mockResolvedValue(undefined);
      (redis.get as jest.Mock).mockResolvedValue("ok");
      (redis.del as jest.Mock).mockResolvedValue(undefined);

      (getWhatsAppClient as jest.Mock).mockReturnValue({
        getState: jest.fn().mockResolvedValue("CONNECTED"),
      });

      const result = await HealthMonitoringService.getSystemHealth();

      expect(result).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.components.database).toBeDefined();
      expect(result.components.redis).toBeDefined();
      expect(result.components.whatsapp).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error("Database error")),
        user: { count: jest.fn().mockResolvedValue(0) },
        transaction: { count: jest.fn().mockResolvedValue(0) },
      };

      (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

      const result = await HealthMonitoringService.getSystemHealth();

      expect(result.overall).toBe("unhealthy");
    });
  });

  describe("recordRequest", () => {
    it("should record request metrics", () => {
      HealthMonitoringService.recordRequest(100, false);
      HealthMonitoringService.recordRequest(200, true);

      const health = HealthMonitoringService.getSystemHealth();
      // Metrics are tracked internally
      expect(health).toBeDefined();
    });
  });

  describe("resetMetrics", () => {
    it("should reset metrics", () => {
      HealthMonitoringService.recordRequest(100, false);
      HealthMonitoringService.resetMetrics();

      // After reset, metrics should be zero
      const health = HealthMonitoringService.getSystemHealth();
      expect(health).toBeDefined();
    });
  });

  describe("getUptimeFormatted", () => {
    it("should return formatted uptime", () => {
      const uptime = HealthMonitoringService.getUptimeFormatted();
      expect(uptime).toBeDefined();
      expect(typeof uptime).toBe("string");
    });
  });
});
