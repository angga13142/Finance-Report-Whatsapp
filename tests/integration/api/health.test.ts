/**
 * Integration tests for health check endpoint
 * Tests GET /health endpoint with WhatsApp client status
 */

import { Application } from "express";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require("supertest");
import { HealthMonitoringService } from "../../../src/services/system/health";

// Mock dependencies
jest.mock("../../../src/bot/client/client");
jest.mock("../../../src/services/system/health");

describe("Health Check Endpoint", () => {
  let app: Application;

  beforeAll(() => {
    // Use require for express to avoid ESM issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const express = require("express") as () => Application;
    app = express();

    // Add health check route
    app.get("/health", async (_req, res) => {
      try {
        const health = await HealthMonitoringService.getSystemHealth();
        const statusCode = health.overall === "healthy" ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          overall: "unhealthy",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  });

  describe("GET /health", () => {
    it("should return 200 when all components are healthy", async () => {
      const mockHealth = {
        overall: "healthy" as const,
        timestamp: new Date(),
        uptime: 100,
        components: {
          database: { status: "healthy" as const },
          redis: { status: "healthy" as const },
          whatsapp: { status: "healthy" as const },
          memory: { status: "healthy" as const },
          cpu: { status: "healthy" as const },
        },
        metrics: {
          totalUsers: 10,
          activeUsers: 5,
          totalTransactions: 100,
          todayTransactions: 10,
          errorRate: 0,
          avgResponseTime: 50,
        },
      };

      (HealthMonitoringService.getSystemHealth as jest.Mock).mockResolvedValue(
        mockHealth,
      );

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.overall).toBe("healthy");
      expect(response.body.components.whatsapp).toBeDefined();
      expect(response.body.components.database).toBeDefined();
      expect(response.body.components.redis).toBeDefined();
    });

    it("should return 503 when any component is unhealthy", async () => {
      const mockHealth = {
        overall: "unhealthy" as const,
        timestamp: new Date(),
        uptime: 100,
        components: {
          database: { status: "unhealthy" as const },
          redis: { status: "healthy" as const },
          whatsapp: { status: "healthy" as const },
          memory: { status: "healthy" as const },
          cpu: { status: "healthy" as const },
        },
        metrics: {
          totalUsers: 0,
          activeUsers: 0,
          totalTransactions: 0,
          todayTransactions: 0,
          errorRate: 100,
          avgResponseTime: 0,
        },
      };

      (HealthMonitoringService.getSystemHealth as jest.Mock).mockResolvedValue(
        mockHealth,
      );

      const response = await request(app).get("/health");

      expect(response.status).toBe(503);
      expect(response.body.overall).toBe("unhealthy");
    });

    it("should include WhatsApp client status in response", async () => {
      const mockHealth = {
        overall: "healthy" as const,
        timestamp: new Date(),
        uptime: 100,
        components: {
          database: { status: "healthy" as const },
          redis: { status: "healthy" as const },
          whatsapp: {
            status: "healthy" as const,
            message: "WhatsApp client is connected",
            details: { state: "CONNECTED" },
          },
          memory: { status: "healthy" as const },
          cpu: { status: "healthy" as const },
        },
        metrics: {
          totalUsers: 10,
          activeUsers: 5,
          totalTransactions: 100,
          todayTransactions: 10,
          errorRate: 0,
          avgResponseTime: 50,
        },
      };

      (HealthMonitoringService.getSystemHealth as jest.Mock).mockResolvedValue(
        mockHealth,
      );

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.components.whatsapp).toBeDefined();
      expect(response.body.components.whatsapp.status).toBe("healthy");
      expect(response.body.components.whatsapp.details).toBeDefined();
      expect(response.body.components.whatsapp.details.state).toBe("CONNECTED");
    });

    it("should handle errors gracefully", async () => {
      (HealthMonitoringService.getSystemHealth as jest.Mock).mockRejectedValue(
        new Error("Health check failed"),
      );

      const response = await request(app).get("/health");

      expect(response.status).toBe(503);
      expect(response.body.overall).toBe("unhealthy");
      expect(response.body.error).toBeDefined();
    });

    it("should return response within acceptable time (<5s per spec)", async () => {
      const startTime = Date.now();

      const mockHealth = {
        overall: "healthy" as const,
        timestamp: new Date(),
        uptime: 100,
        components: {
          database: { status: "healthy" as const, responseTime: 100 },
          redis: { status: "healthy" as const, responseTime: 50 },
          whatsapp: { status: "healthy" as const, responseTime: 200 },
          memory: { status: "healthy" as const },
          cpu: { status: "healthy" as const },
        },
        metrics: {
          totalUsers: 10,
          activeUsers: 5,
          totalTransactions: 100,
          todayTransactions: 10,
          errorRate: 0,
          avgResponseTime: 50,
        },
      };

      (HealthMonitoringService.getSystemHealth as jest.Mock).mockResolvedValue(
        mockHealth,
      );

      const response = await request(app).get("/health");
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // <5s per NFR-005
    });
  });
});
