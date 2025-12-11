import { validateEnv } from "./config/env";
import { logger } from "./lib/logger";
import { connectRedis } from "./lib/redis";
import { database } from "./lib/database";
import { initializeWhatsAppClient } from "./bot/client/client";
import { initializeEventHandlers } from "./bot/client/events";
import { SessionManager } from "./bot/middleware/session";
import { GracefulShutdown } from "./bot/client/shutdown";
import { getMetrics, updateWhatsAppSessionStatus } from "./lib/metrics";
import HealthMonitoringService from "./services/system/health";
import { SessionBackupService } from "./services/system/session-backup";
import type { Request, Response, Application } from "express";

// Use require for express to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const express = require("express") as () => Application;

async function main(): Promise<void> {
  try {
    // Initialize graceful shutdown handlers
    GracefulShutdown.initialize();
    logger.info("Graceful shutdown handlers initialized");

    // Validate environment variables
    const env = validateEnv();
    logger.info("Environment variables validated", { env: env.NODE_ENV });

    // Initialize Redis connection
    await connectRedis();
    logger.info("Redis connection established");

    // Initialize database with connection pool (Phase 6)
    await database.connect();
    logger.info("Database connection pool established");

    // Initialize WhatsApp client
    await initializeWhatsAppClient();
    initializeEventHandlers();
    logger.info("WhatsApp client initialized");

    // Start session cleanup interval (Phase 5)
    SessionManager.startCleanupInterval();
    logger.info("Session cleanup interval started");

    // Start automatic session backups (Phase 8)
    SessionBackupService.startAutomaticBackups();
    logger.info("Automatic session backup service started");

    // Start HTTP server for health checks and metrics (Phase 11)
    const app = express();
    const healthPort = parseInt(process.env.HEALTH_CHECK_PORT || "3000", 10);

    // Health check endpoint
    app.get("/health", async (_req: Request, res: Response) => {
      try {
        const health = await HealthMonitoringService.getSystemHealth();
        const statusCode = health.overall === "healthy" ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error("Health check failed", { error });
        res.status(503).json({
          overall: "unhealthy",
          error: "Health check failed",
        });
      }
    });

    // Liveness probe - simpler check for K8s
    app.get("/healthz", (_req: Request, res: Response) => {
      res.status(200).send("OK");
    });

    // Readiness probe - checks if app is ready to serve traffic
    app.get("/ready", async (_req: Request, res: Response) => {
      try {
        const health = await HealthMonitoringService.getSystemHealth();
        if (health.overall === "healthy") {
          res.status(200).send("READY");
        } else {
          res.status(503).send("NOT READY");
        }
      } catch {
        res.status(503).send("NOT READY");
      }
    });

    // Metrics endpoint for Prometheus
    app.get("/metrics", async (_req: Request, res: Response) => {
      try {
        res.set("Content-Type", "text/plain");
        const metrics = await getMetrics();
        res.send(metrics);
      } catch (error) {
        logger.error("Metrics endpoint failed", { error });
        res.status(500).send("Metrics unavailable");
      }
    });

    // Start HTTP server
    app.listen(healthPort, () => {
      logger.info(`Health check server listening on port ${healthPort}`);
    });

    // Update WhatsApp session status metric
    updateWhatsAppSessionStatus(true);

    // TODO: Start cron jobs (Phase 4)

    logger.info("WhatsApp Cashflow Bot started successfully", {
      healthCheckPort: healthPort,
    });
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
}

void main();
