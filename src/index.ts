import { validateEnv } from "./config/env";
import { logger } from "./lib/logger";
import { connectRedis, disconnectRedis } from "./lib/redis";
import {
  initializeWhatsAppClient,
  destroyWhatsAppClient,
} from "./bot/client/client";
import { initializeEventHandlers } from "./bot/client/events";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma Client
const prisma = new PrismaClient();

async function main(): Promise<void> {
  try {
    // Validate environment variables
    const env = validateEnv();
    logger.info("Environment variables validated", { env: env.NODE_ENV });

    // Initialize Redis connection
    await connectRedis();
    logger.info("Redis connection established");

    // Test database connection
    await prisma.$connect();
    logger.info("Database connection established");

    // Initialize WhatsApp client
    await initializeWhatsAppClient();
    initializeEventHandlers();
    logger.info("WhatsApp client initialized");

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
    await destroyWhatsAppClient();
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  })();
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  void (async () => {
    await destroyWhatsAppClient();
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  })();
});

void main();
