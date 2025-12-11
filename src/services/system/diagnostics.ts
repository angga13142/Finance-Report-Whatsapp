/**
 * Diagnostics Service
 * Provides system health checks for database, Redis, and WhatsApp client
 * with timeout handling (2s DB, 1s Redis)
 */

import { getPrismaClient } from "../../lib/database";
import { redis } from "../../lib/redis";
import { getWhatsAppClient } from "../../bot/client/client";

/**
 * Component health status
 */
export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Full system diagnostics result
 */
export interface SystemDiagnostics {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  database: ComponentHealth;
  redis: ComponentHealth;
  whatsapp: ComponentHealth;
}

/**
 * Diagnostics Service
 * Provides health checks for system components
 */
export class DiagnosticsService {
  /**
   * Check database health with 2s timeout
   */
  static async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const timeout = 2000; // 2 seconds

    try {
      const prisma = getPrismaClient();

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), timeout),
      );

      // Race between health check and timeout
      await Promise.race([
        prisma.$queryRaw`SELECT 1 as health_check`,
        timeoutPromise,
      ]);

      const responseTime = Date.now() - startTime;

      if (responseTime > 1000) {
        return {
          status: "degraded",
          message: "Database response time is slow",
          responseTime,
        };
      }

      return {
        status: "healthy",
        message: "Database connection is healthy",
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        status: "unhealthy",
        message: `Database check failed: ${errorMessage}`,
        responseTime,
      };
    }
  }

  /**
   * Check Redis health with 1s timeout
   */
  static async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const timeout = 1000; // 1 second

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), timeout),
      );

      // Test Redis with PING
      const testKey = `diagnostics:check:${Date.now()}`;
      const healthCheckPromise = (async () => {
        const pingResult = await redis.ping();
        if (pingResult !== "PONG") {
          throw new Error("Redis ping failed");
        }
        await redis.set(testKey, "ok", 10);
        const result = await redis.get(testKey);
        await redis.del(testKey);
        return result;
      })();

      // Race between health check and timeout
      await Promise.race([healthCheckPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      if (responseTime > 500) {
        return {
          status: "degraded",
          message: "Redis response time is slow",
          responseTime,
        };
      }

      return {
        status: "healthy",
        message: "Redis connection is healthy",
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        status: "unhealthy",
        message: `Redis check failed: ${errorMessage}`,
        responseTime,
      };
    }
  }

  /**
   * Check WhatsApp client health
   */
  static async checkWhatsApp(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const client = getWhatsAppClient();

      if (!client) {
        return {
          status: "unhealthy",
          message: "WhatsApp client not initialized",
          responseTime: Date.now() - startTime,
        };
      }

      const state = await client.getState();
      const responseTime = Date.now() - startTime;

      if (String(state) !== "CONNECTED") {
        return {
          status: "unhealthy",
          message: `WhatsApp client state: ${String(state)}`,
          responseTime,
          details: { state: String(state) },
        };
      }

      return {
        status: "healthy",
        message: "WhatsApp client is connected",
        responseTime,
        details: {
          state: String(state),
          wid: client.info?.wid?.user || "unknown",
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        status: "unhealthy",
        message: `WhatsApp check failed: ${errorMessage}`,
        responseTime,
      };
    }
  }

  /**
   * Run full system diagnostics
   */
  static async runFullDiagnostics(): Promise<SystemDiagnostics> {
    const [database, redis, whatsapp] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkWhatsApp(),
    ]);

    // Determine overall status
    const statuses = [database.status, redis.status, whatsapp.status];
    let overall: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (statuses.includes("unhealthy")) {
      overall = "unhealthy";
    } else if (statuses.includes("degraded")) {
      overall = "degraded";
    }

    return {
      overall,
      timestamp: new Date(),
      database,
      redis,
      whatsapp,
    };
  }
}

export default DiagnosticsService;
