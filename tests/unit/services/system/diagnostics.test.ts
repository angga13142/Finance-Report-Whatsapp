/**
 * Unit tests for DiagnosticsService
 * Tests database, Redis, and WhatsApp client health checks with timeouts
 */

import { DiagnosticsService } from "../../../../src/services/system/diagnostics";
import { getPrismaClient } from "../../../../src/lib/database";
import { redis } from "../../../../src/lib/redis";
import { getWhatsAppClient } from "../../../../src/bot/client/client";

// Mock dependencies
jest.mock("../../../../src/lib/database");
jest.mock("../../../../src/lib/redis");
jest.mock("../../../../src/bot/client/client");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("DiagnosticsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Database Health Check", () => {
    it("should check database health successfully", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ health_check: 1 }]),
      };

      (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

      const result = await DiagnosticsService.checkDatabase();

      expect(result.status).toBe("healthy");
      expect(result.responseTime).toBeLessThan(2000); // 2s timeout
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it("should timeout database check after 2 seconds", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve([{ health_check: 1 }]), 3000);
            }),
        ),
      };

      (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

      const result = await DiagnosticsService.checkDatabase();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("timeout");
    });

    it("should handle database connection errors", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error("Connection failed")),
      };

      (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

      const result = await DiagnosticsService.checkDatabase();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("Connection failed");
    });
  });

  describe("Redis Health Check", () => {
    it("should check Redis health successfully", async () => {
      (redis.ping as jest.Mock).mockResolvedValue("PONG");
      (redis.get as jest.Mock).mockResolvedValue("ok");
      (redis.set as jest.Mock).mockResolvedValue("OK");

      const result = await DiagnosticsService.checkRedis();

      expect(result.status).toBe("healthy");
      expect(result.responseTime).toBeLessThan(1000); // 1s timeout
    });

    it("should timeout Redis check after 1 second", async () => {
      (redis.ping as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("PONG"), 2000);
          }),
      );

      const result = await DiagnosticsService.checkRedis();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("timeout");
    });

    it("should handle Redis connection errors", async () => {
      (redis.ping as jest.Mock).mockRejectedValue(
        new Error("Redis connection failed"),
      );

      const result = await DiagnosticsService.checkRedis();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("Redis connection failed");
    });
  });

  describe("WhatsApp Client Health Check", () => {
    it("should check WhatsApp client health when connected", async () => {
      const mockClient = {
        getState: jest.fn().mockResolvedValue("CONNECTED"),
        info: {
          wid: { user: "6281234567890" },
          platform: "android",
        },
      };

      (getWhatsAppClient as jest.Mock).mockReturnValue(mockClient);

      const result = await DiagnosticsService.checkWhatsApp();

      expect(result.status).toBe("healthy");
      expect(result.details?.state).toBe("CONNECTED");
    });

    it("should detect disconnected WhatsApp client", async () => {
      const mockClient = {
        getState: jest.fn().mockResolvedValue("DISCONNECTED"),
      };

      (getWhatsAppClient as jest.Mock).mockReturnValue(mockClient);

      const result = await DiagnosticsService.checkWhatsApp();

      expect(result.status).toBe("unhealthy");
      expect(result.details?.state).toBe("DISCONNECTED");
    });

    it("should handle missing WhatsApp client", async () => {
      (getWhatsAppClient as jest.Mock).mockReturnValue(null);

      const result = await DiagnosticsService.checkWhatsApp();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("not initialized");
    });

    it("should handle WhatsApp client errors", async () => {
      const mockClient = {
        getState: jest.fn().mockRejectedValue(new Error("Client error")),
      };

      (getWhatsAppClient as jest.Mock).mockReturnValue(mockClient);

      const result = await DiagnosticsService.checkWhatsApp();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("Client error");
    });
  });

  describe("Full System Diagnostics", () => {
    it("should run all health checks", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ health_check: 1 }]),
      };
      (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const mockClient = {
        getState: jest.fn().mockResolvedValue("CONNECTED"),
        info: { wid: { user: "6281234567890" } },
      };
      (getWhatsAppClient as jest.Mock).mockReturnValue(mockClient);

      const result = await DiagnosticsService.runFullDiagnostics();

      expect(result.database.status).toBe("healthy");
      expect(result.redis.status).toBe("healthy");
      expect(result.whatsapp.status).toBe("healthy");
      expect(result.overall).toBe("healthy");
    });

    it("should report degraded when one component is unhealthy", async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ health_check: 1 }]),
      };
      (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

      (redis.ping as jest.Mock).mockRejectedValue(new Error("Redis error"));

      const mockClient = {
        getState: jest.fn().mockResolvedValue("CONNECTED"),
      };
      (getWhatsAppClient as jest.Mock).mockReturnValue(mockClient);

      const result = await DiagnosticsService.runFullDiagnostics();

      expect(result.database.status).toBe("healthy");
      expect(result.redis.status).toBe("unhealthy");
      expect(result.whatsapp.status).toBe("healthy");
      expect(result.overall).toBe("degraded");
    });
  });
});
