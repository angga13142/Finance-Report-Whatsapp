import { validateEnv } from "./config/env";
import { logger } from "./lib/logger";
import { connectRedis, disconnectRedis } from "./lib/redis";
import { database } from "./lib/database";
import {
  initializeWhatsAppClient,
  destroyWhatsAppClient,
} from "./bot/client/client";
import { initializeEventHandlers } from "./bot/client/events";
import { SessionManager } from "./bot/middleware/session";

async function main(): Promise<void> {
  try {
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

    // TODO: Start cron jobs (Phase 4)
    // TODO: Start HTTP server for health checks (Phase 11)

    logger.info("WhatsApp Cashflow Bot started successfully");
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  void (async () => {
    SessionManager.stopCleanupInterval();
    await destroyWhatsAppClient();
    await disconnectRedis();
    await database.disconnect();
    process.exit(0);
  })();
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  void (async () => {
    SessionManager.stopCleanupInterval();
    await destroyWhatsAppClient();
    await disconnectRedis();
    await database.disconnect();
    process.exit(0);
  })();
});

void main();
