import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { redis } from "../../lib/redis";
import { getWhatsAppClient } from "../../bot/client/client";
import * as os from "os";

const prisma = new PrismaClient();

/**
 * Health status for individual components
 */
export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall system health status
 */
export interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    whatsapp: ComponentHealth;
    memory: ComponentHealth;
    cpu: ComponentHealth;
  };
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    todayTransactions: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

/**
 * System health monitoring service
 * Provides health checks for all system components
 */
export class HealthMonitoringService {
  private static startTime: number = Date.now();
  private static errorCount: number = 0;
  private static requestCount: number = 0;
  private static totalResponseTime: number = 0;

  /**
   * Get comprehensive system health status
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    try {
      const startTime = Date.now();

      // Run health checks
      const databaseHealth = await this.checkDatabaseHealth();
      const redisHealth = await this.checkRedisHealth();
      const whatsappHealth = await this.checkWhatsAppHealth();
      const memoryHealth = this.checkMemoryHealth();
      const cpuHealth = this.checkCPUHealth();
      const metrics = await this.getSystemMetrics();

      const components = {
        database: databaseHealth,
        redis: redisHealth,
        whatsapp: whatsappHealth,
        memory: memoryHealth,
        cpu: cpuHealth,
      };

      // Determine overall health
      const overall = this.determineOverallHealth(components);

      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      const health: SystemHealth = {
        overall,
        timestamp: new Date(),
        uptime,
        components,
        metrics,
      };

      logger.info("System health checked", {
        overall,
        checkDuration: Date.now() - startTime,
      });

      return health;
    } catch (error) {
      logger.error("Error checking system health", { error });

      // Return degraded status if health check itself fails
      return {
        overall: "unhealthy",
        timestamp: new Date(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        components: {
          database: { status: "unhealthy", message: "Health check failed" },
          redis: { status: "unhealthy", message: "Health check failed" },
          whatsapp: { status: "unhealthy", message: "Health check failed" },
          memory: { status: "unhealthy", message: "Health check failed" },
          cpu: { status: "unhealthy", message: "Health check failed" },
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
    }
  }

  /**
   * Check database health with timeout (2s per FR-025)
   */
  private static async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const timeout = 2000; // 2 seconds per FR-025

    try {
      // Test database connection with timeout
      const healthCheckPromise = prisma.$queryRaw`SELECT 1 as health_check`;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), timeout),
      );

      await Promise.race([healthCheckPromise, timeoutPromise]);

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

      // Mask sensitive error details per FR-025
      const maskedError =
        errorMessage.includes("password") || errorMessage.includes("connection")
          ? "Database connection failed"
          : errorMessage;

      return {
        status: "unhealthy",
        message: `Database connection failed: ${maskedError}`,
        responseTime,
      };
    }
  }

  /**
   * Check Redis health with timeout (1s per FR-025)
   */
  private static async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const timeout = 1000; // 1 second per FR-025

    try {
      // Test Redis connection with timeout
      const testKey = `health:check:${Date.now()}`;
      const healthCheckPromise = (async () => {
        await redis.set(testKey, "ok", 10);
        const result = await redis.get(testKey);
        await redis.del(testKey);
        return result;
      })();

      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), timeout),
      );

      const result = await Promise.race([healthCheckPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      if (result !== "ok") {
        return {
          status: "degraded",
          message: "Redis read/write test failed",
          responseTime,
        };
      }

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

      // Mask sensitive error details per FR-025
      const maskedError =
        errorMessage.includes("password") || errorMessage.includes("connection")
          ? "Redis connection failed"
          : errorMessage;

      return {
        status: "unhealthy",
        message: `Redis connection failed: ${maskedError}`,
        responseTime,
      };
    }
  }

  /**
   * Check WhatsApp client health
   */
  private static async checkWhatsAppHealth(): Promise<ComponentHealth> {
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

      // Check client state
      const state = await client.getState();

      const responseTime = Date.now() - startTime;

      if (String(state) !== "CONNECTED") {
        return {
          status: "degraded",
          message: `WhatsApp client state: ${String(state)}`,
          responseTime,
          details: { state },
        };
      }

      return {
        status: "healthy",
        message: "WhatsApp client is connected",
        responseTime,
        details: { state },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `WhatsApp client check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check memory health
   */
  private static checkMemoryHealth(): ComponentHealth {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const details = {
        totalMemory: Math.round(totalMemory / 1024 / 1024), // MB
        freeMemory: Math.round(freeMemory / 1024 / 1024), // MB
        usedMemory: Math.round(usedMemory / 1024 / 1024), // MB
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
      };

      if (memoryUsagePercent > 90) {
        return {
          status: "unhealthy",
          message: "Memory usage critically high",
          details,
        };
      }

      if (memoryUsagePercent > 75) {
        return {
          status: "degraded",
          message: "Memory usage is high",
          details,
        };
      }

      return {
        status: "healthy",
        message: "Memory usage is normal",
        details,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Memory check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check CPU health
   */
  private static checkCPUHealth(): ComponentHealth {
    try {
      const cpus = os.cpus();
      const cpuCount = cpus.length;

      // Calculate average CPU usage
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpuCount;
      const total = totalTick / cpuCount;
      const usage = 100 - (100 * idle) / total;

      const details = {
        cpuCount,
        usage: Math.round(usage * 100) / 100,
        model: cpus[0]?.model || "Unknown",
      };

      if (usage > 90) {
        return {
          status: "unhealthy",
          message: "CPU usage critically high",
          details,
        };
      }

      if (usage > 75) {
        return {
          status: "degraded",
          message: "CPU usage is high",
          details,
        };
      }

      return {
        status: "healthy",
        message: "CPU usage is normal",
        details,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `CPU check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get system metrics
   */
  private static async getSystemMetrics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    todayTransactions: number;
    errorRate: number;
    avgResponseTime: number;
  }> {
    try {
      // Get user counts
      const [totalUsers, activeUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
      ]);

      // Get transaction counts
      const totalTransactions = await prisma.transaction.count();

      // Get today's transactions
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayTransactions = await prisma.transaction.count({
        where: {
          timestamp: {
            gte: startOfDay,
          },
        },
      });

      // Calculate error rate
      const errorRate =
        this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

      // Calculate average response time
      const avgResponseTime =
        this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;

      return {
        totalUsers,
        activeUsers,
        totalTransactions,
        todayTransactions,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
      };
    } catch (error) {
      logger.error("Error getting system metrics", { error });
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalTransactions: 0,
        todayTransactions: 0,
        errorRate: 100,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Determine overall health based on component statuses
   */
  private static determineOverallHealth(components: {
    [key: string]: ComponentHealth;
  }): "healthy" | "degraded" | "unhealthy" {
    const statuses = Object.values(components).map((c) => c.status);

    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    }

    if (statuses.includes("degraded")) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Record request metrics (to be called from middleware)
   */
  static recordRequest(responseTime: number, hasError: boolean = false): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;

    if (hasError) {
      this.errorCount++;
    }
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  static resetMetrics(): void {
    this.errorCount = 0;
    this.requestCount = 0;
    this.totalResponseTime = 0;
  }

  /**
   * Get uptime in human-readable format
   */
  static getUptimeFormatted(): string {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const parts: string[] = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
  }
}

export default HealthMonitoringService;
