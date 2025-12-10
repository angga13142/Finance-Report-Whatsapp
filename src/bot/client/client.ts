import { Client } from "whatsapp-web.js";
import { createLocalAuth } from "./auth";
import { logger } from "../../lib/logger";
import { RateLimitMiddleware } from "../middleware/rate-limit";

let whatsappClient: Client | null = null;

/**
 * Initialize WhatsApp client
 */
export function createWhatsAppClient(): Client {
  if (whatsappClient) {
    return whatsappClient;
  }

  const auth = createLocalAuth();

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
  });

  logger.info("WhatsApp client created");

  return whatsappClient;
}

/**
 * Get WhatsApp client instance
 */
export function getWhatsAppClient(): Client | null {
  return whatsappClient;
}

/**
 * Initialize and start WhatsApp client
 */
export async function initializeWhatsAppClient(): Promise<Client> {
  const client = createWhatsAppClient();

  if (client.info) {
    logger.info("WhatsApp client already initialized", {
      wid: client.info.wid.user,
    });
    return client;
  }

  await client.initialize();
  logger.info("WhatsApp client initialized");

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
