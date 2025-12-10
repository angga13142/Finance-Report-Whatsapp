import { validateEnv } from "./config/env";
import { logger } from "./lib/logger";
import { connectRedis } from "./lib/redis";
import { database } from "./lib/database";
import { initializeWhatsAppClient } from "./bot/client/client";
import { initializeEventHandlers } from "./bot/client/events";
import { SessionManager } from "./bot/middleware/session";
import { GracefulShutdown } from "./bot/client/shutdown";

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

    // TODO: Start cron jobs (Phase 4)
    // TODO: Start HTTP server for health checks (Phase 11)

    logger.info("WhatsApp Cashflow Bot started successfully");
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
}

void main();
