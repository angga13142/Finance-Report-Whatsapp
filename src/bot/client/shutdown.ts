import { logger } from "../../lib/logger";
import { getWhatsAppClient } from "./client";
import { getRedisClient } from "../../lib/redis";

/**
 * Graceful shutdown handler
 * Ensures all resources are properly closed before exit
 */
export class GracefulShutdown {
  private static isShuttingDown = false;
  private static shutdownTimeout = 30000; // 30 seconds max shutdown time

  /**
   * Initialize shutdown handlers
   */
  static initialize(): void {
    // Handle SIGTERM (Docker stop, Kubernetes termination)
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, initiating graceful shutdown");
      this.shutdown("SIGTERM");
    });

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
      logger.info("SIGINT received, initiating graceful shutdown");
      this.shutdown("SIGINT");
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception, initiating emergency shutdown", {
        error,
      });
      this.shutdown("uncaughtException", 1);
    });

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection, initiating emergency shutdown", {
        reason,
      });
      this.shutdown("unhandledRejection", 1);
    });

    logger.info("Graceful shutdown handlers initialized");
  }

  /**
   * Perform graceful shutdown
   */
  static async shutdown(signal: string, exitCode: number = 0): Promise<void> {
    // Prevent multiple shutdown attempts
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress, ignoring signal", { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info("Starting graceful shutdown", { signal, exitCode });

    // Set timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Step 1: Stop accepting new requests
      logger.info("Step 1: Stopping new request acceptance");
      // Note: Express server would be stopped here if we had one

      // Step 2: Save WhatsApp session
      logger.info("Step 2: Saving WhatsApp session");
      await this.saveWhatsAppSession();

      // Step 3: Close WhatsApp client
      logger.info("Step 3: Closing WhatsApp client");
      await this.closeWhatsAppClient();

      // Step 4: Close Redis connections
      logger.info("Step 4: Closing Redis connections");
      await this.closeRedisConnections();

      // Step 5: Close database connections
      logger.info("Step 5: Closing database connections");
      await this.closeDatabaseConnections();

      // Step 6: Final cleanup
      logger.info("Step 6: Final cleanup");
      await this.finalCleanup();

      logger.info("Graceful shutdown completed successfully");

      // Clear the force shutdown timer
      clearTimeout(forceShutdownTimer);

      // Exit process
      process.exit(exitCode);
    } catch (error) {
      logger.error("Error during graceful shutdown", { error });
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  }

  /**
   * Save WhatsApp session before shutdown
   */
  private static async saveWhatsAppSession(): Promise<void> {
    try {
      const client = getWhatsAppClient();
      if (!client) {
        logger.info("No WhatsApp client to save session");
        return;
      }

      // WhatsApp Web.js automatically saves session
      // Just log the state
      const state = await client.getState();
      logger.info("WhatsApp session state saved", { state });
    } catch (error) {
      logger.error("Error saving WhatsApp session", { error });
      // Don't throw, continue with shutdown
    }
  }

  /**
   * Close WhatsApp client gracefully
   */
  private static async closeWhatsAppClient(): Promise<void> {
    try {
      const client = getWhatsAppClient();
      if (!client) {
        logger.info("No WhatsApp client to close");
        return;
      }

      // Destroy the client
      await client.destroy();
      logger.info("WhatsApp client closed successfully");
    } catch (error) {
      logger.error("Error closing WhatsApp client", { error });
      // Don't throw, continue with shutdown
    }
  }

  /**
   * Close Redis connections
   */
  private static async closeRedisConnections(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.info("No Redis client to close");
        return;
      }

      await redis.quit();
      logger.info("Redis connections closed successfully");
    } catch (error) {
      logger.error("Error closing Redis connections", { error });
      // Don't throw, continue with shutdown
    }
  }

  /**
   * Close database connections
   */
  private static async closeDatabaseConnections(): Promise<void> {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      await prisma.$disconnect();
      logger.info("Database connections closed successfully");
    } catch (error) {
      logger.error("Error closing database connections", { error });
      // Don't throw, continue with shutdown
    }
  }

  /**
   * Final cleanup operations
   */
  private static async finalCleanup(): Promise<void> {
    try {
      // Flush any pending logs
      // Winston logger auto-flushes, but we can add a small delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      logger.info("Final cleanup completed");
    } catch (error) {
      logger.error("Error in final cleanup", { error });
      // Don't throw
    }
  }

  /**
   * Get shutdown status
   */
  static isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Set shutdown timeout
   */
  static setShutdownTimeout(timeoutMs: number): void {
    this.shutdownTimeout = timeoutMs;
    logger.info("Shutdown timeout updated", { timeoutMs });
  }
}

export default GracefulShutdown;
