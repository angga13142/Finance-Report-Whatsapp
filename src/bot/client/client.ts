import { Client } from "whatsapp-web.js";
import {
  createLocalAuth,
  detectSessionCorruption,
  recoverFromSessionCorruption,
} from "./auth";
import { logger } from "../../lib/logger";
import { RateLimitMiddleware } from "../middleware/rate-limit";
import { setupPairingCodeHandler } from "./pairing";
import { setCorrelationId } from "../../lib/correlation";
import { env } from "../../config/env";

let whatsappClient: Client | null = null;

/**
 * Initialize WhatsApp client
 */
export function createWhatsAppClient(): Client {
  if (whatsappClient) {
    return whatsappClient;
  }

  const auth = createLocalAuth();

  // Get pairing phone number from environment (optional)
  const pairingPhoneNumber = process.env.WHATSAPP_PAIRING_PHONE_NUMBER;

  whatsappClient = new Client({
    authStrategy: auth,
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html",
    },
    // Enable pairing code authentication if phone number is provided
    ...(pairingPhoneNumber
      ? {
          pairWithPhoneNumber: {
            phoneNumber: pairingPhoneNumber.replace(/\D/g, ""), // Remove non-digits
            showNotification: true,
            intervalMs: 180000, // 3 minutes
          },
        }
      : {}),
  });

  // Setup pairing code handler if using pairing authentication
  if (pairingPhoneNumber) {
    setupPairingCodeHandler(whatsappClient);
    logger.info("WhatsApp client created with pairing code authentication", {
      phoneNumber:
        pairingPhoneNumber.slice(0, 2) + " ****" + pairingPhoneNumber.slice(-4),
    });
  } else {
    logger.info("WhatsApp client created with QR code authentication");
  }

  return whatsappClient;
}

/**
 * Get WhatsApp client instance
 */
export function getWhatsAppClient(): Client | null {
  return whatsappClient;
}

/**
 * Initialize and start WhatsApp client with session restoration retry logic
 * Attempts to restore session on container startup with retry (3 attempts, 5-second delays)
 * If all restoration attempts fail, triggers QR code authentication flow
 */
export async function initializeWhatsAppClient(): Promise<Client> {
  const correlationId = setCorrelationId("client-init");
  const client = createWhatsAppClient();

  // Check if client is already initialized
  if (client.info) {
    logger.info("WhatsApp client already initialized", {
      correlationId,
      wid: client.info.wid.user,
    });
    return client;
  }

  // Check for session corruption before initialization
  const isCorrupted = detectSessionCorruption(env.WHATSAPP_SESSION_PATH);
  if (isCorrupted) {
    logger.warn("Session corruption detected, attempting restore from backup", {
      correlationId,
      sessionPath: env.WHATSAPP_SESSION_PATH,
    });

    // Try to restore from backup first
    const { SessionBackupService } =
      await import("../../services/system/session-backup");
    const restoreResult = await SessionBackupService.restoreIfCorrupted();

    if (!restoreResult.success) {
      // If restore failed, delete corrupted session and trigger QR auth
      logger.warn("Backup restore failed, deleting corrupted session", {
        correlationId,
        error: restoreResult.error,
      });
      recoverFromSessionCorruption(env.WHATSAPP_SESSION_PATH);
    } else {
      logger.info("Session restored from backup successfully", {
        correlationId,
        restoredFrom: restoreResult.restoredFrom,
      });
    }
  }

  // Attempt session restoration with retry logic (3 attempts, 5-second delays)
  const maxRetries = 3;
  const retryDelay = 5000; // 5 seconds
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info("Attempting WhatsApp client initialization", {
        correlationId,
        attempt,
        maxRetries,
        sessionPath: env.WHATSAPP_SESSION_PATH,
      });

      await client.initialize();

      // Wait a bit to check if session was restored
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const state = await client.getState();
      if (String(state) === "CONNECTED") {
        logger.info(
          "WhatsApp client initialized successfully - session restored",
          {
            correlationId,
            attempt,
            state: String(state),
          },
        );
        return client;
      }

      logger.warn("WhatsApp client initialized but not connected", {
        correlationId,
        attempt,
        state,
      });

      // If not connected after initialization, might need QR code
      if (attempt < maxRetries) {
        logger.info("Retrying session restoration", {
          correlationId,
          attempt,
          nextAttempt: attempt + 1,
          delay: retryDelay,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn("WhatsApp client initialization attempt failed", {
        correlationId,
        attempt,
        maxRetries,
        error: lastError.message,
      });

      if (attempt < maxRetries) {
        logger.info("Retrying session restoration after error", {
          correlationId,
          attempt,
          nextAttempt: attempt + 1,
          delay: retryDelay,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retry attempts failed - log and continue (QR code will be triggered)
  logger.error(
    "All session restoration attempts failed, QR code authentication will be triggered",
    {
      correlationId,
      attempts: maxRetries,
      lastError: lastError?.message,
      sessionPath: env.WHATSAPP_SESSION_PATH,
    },
  );

  // Initialize client anyway - it will trigger QR code authentication
  try {
    await client.initialize();
    logger.info(
      "WhatsApp client initialized - QR code authentication required",
      {
        correlationId,
      },
    );
  } catch (error) {
    logger.error("Failed to initialize WhatsApp client after all retries", {
      correlationId,
      error,
    });
    throw error;
  }

  return client;
}

/**
 * Destroy WhatsApp client
 */
export async function destroyWhatsAppClient(): Promise<void> {
  if (whatsappClient) {
    await whatsappClient.destroy();
    whatsappClient = null;
    logger.info("WhatsApp client destroyed");
  }
}

/**
 * Send message with rate limiting
 * Automatically handles WhatsApp rate limits (15-20 msg/min per chat)
 */
export async function sendMessageWithRateLimit(
  chatId: string,
  content: string,
  options?: { maxRetries?: number },
): Promise<boolean> {
  const client = getWhatsAppClient();
  if (!client) {
    logger.error("WhatsApp client not initialized");
    return false;
  }

  const maxRetries = options?.maxRetries ?? 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    try {
      // Check rate limit
      const rateLimitResult = await RateLimitMiddleware.checkRateLimit(chatId);

      if (!rateLimitResult.allowed) {
        logger.warn("Rate limit exceeded, waiting for reset", {
          chatId,
          retryAfter: rateLimitResult.retryAfter,
          attempt,
          maxRetries,
        });

        if (attempt < maxRetries && rateLimitResult.retryAfter) {
          // Wait for rate limit reset
          await new Promise((resolve) =>
            setTimeout(resolve, rateLimitResult.retryAfter! * 1000),
          );
          continue;
        } else {
          logger.error("Failed to send message: rate limit exceeded", {
            chatId,
            attempts: attempt,
          });
          return false;
        }
      }

      // Send message
      await client.sendMessage(chatId, content);
      logger.debug("Message sent successfully", {
        chatId,
        remaining: rateLimitResult.remaining,
      });
      return true;
    } catch (error) {
      logger.error("Error sending message", { error, chatId, attempt });

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        return false;
      }
    }
  }

  return false;
}

export default createWhatsAppClient;
