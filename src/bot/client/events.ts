import { Client, Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { getWhatsAppClient } from "./client";

/**
 * Setup WhatsApp client event handlers
 */
export function setupEventHandlers(client: Client): void {
  // Ready event - client is ready to use
  client.on("ready", () => {
    logger.info("WhatsApp client is ready", {
      wid: client.info?.wid.user,
      platform: client.info?.platform,
    });
  });

  // QR code event - display QR code for authentication
  client.on("qr", (qr) => {
    logger.info("QR code received, scan with WhatsApp mobile app");
    console.log("\n=== WhatsApp QR Code ===");
    console.log("Scan this QR code with your WhatsApp mobile app:");
    console.log(qr);
    console.log("========================\n");
  });

  // Authenticated event
  client.on("authenticated", () => {
    logger.info("WhatsApp client authenticated");
  });

  // Authentication failure event
  client.on("auth_failure", (msg) => {
    logger.error("WhatsApp authentication failed", { error: msg });
  });

  // Disconnect event with reconnection logic
  client.on("disconnected", (reason) => {
    logger.warn("WhatsApp client disconnected", { reason });
    void handleDisconnection(client, reason);
  });

  // Message event - handle incoming messages
  client.on("message", (message: Message) => {
    void (async () => {
      try {
        logger.debug("Message received", {
          from: message.from,
          body: message.body?.substring(0, 100) || "", // Log first 100 chars
          hasMedia: message.hasMedia,
          type: message.type,
        });

        // Route message to appropriate handler
        const { MessageHandler } = await import("../handlers/message");
        await MessageHandler.routeMessage(message);
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));
        logger.error("Error handling message", {
          error: errorObj.message,
          stack: errorObj.stack,
          messageId: message.id._serialized,
        });
      }
    })();
  });

  // Message create event - handle sent messages
  client.on("message_create", (message: Message) => {
    // Only log if message is from us
    if (message.fromMe) {
      logger.debug("Message sent", {
        to: message.to,
        body: message.body?.substring(0, 100),
      });
    }
  });

  // Error event
  client.on("error", (error: unknown) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("WhatsApp client error", {
      error: errorObj.message,
      stack: errorObj.stack,
    });
  });

  // Loading screen event
  client.on("loading_screen", (percent, message) => {
    logger.debug("WhatsApp loading screen", { percent, message });
  });

  logger.info("WhatsApp event handlers registered");
}

/**
 * Setup event handlers for the current client
 */
export function initializeEventHandlers(): void {
  const client = getWhatsAppClient();
  if (!client) {
    logger.warn("WhatsApp client not initialized, cannot setup event handlers");
    return;
  }

  setupEventHandlers(client);
}

/**
 * Message routing function (to be implemented in Phase 3)
 */
export function routeMessage(message: Message): void {
  // This will be implemented in Phase 3 with proper message routing
  logger.debug("Message routing not yet implemented", {
    from: message.from,
    body: message.body?.substring(0, 50),
  });
}

/**
 * Session state management
 */
interface SessionState {
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastDisconnectTime: Date | null;
  reconnectTimer: NodeJS.Timeout | null;
}

const sessionState: SessionState = {
  isReconnecting: false,
  reconnectAttempts: 0,
  lastDisconnectTime: null,
  reconnectTimer: null,
};

// Reconnection configuration
const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY_MS: 2000, // 2 seconds
  MAX_DELAY_MS: 60000, // 60 seconds
  BACKOFF_MULTIPLIER: 2,
};

/**
 * Handle WhatsApp disconnection with auto-reconnection
 */
function handleDisconnection(client: Client, reason: string): void {
  logger.warn("Handling WhatsApp disconnection", {
    reason,
    isReconnecting: sessionState.isReconnecting,
    attempts: sessionState.reconnectAttempts,
  });

  // Mark disconnection time
  sessionState.lastDisconnectTime = new Date();

  // Clear any existing reconnect timer
  if (sessionState.reconnectTimer) {
    clearTimeout(sessionState.reconnectTimer);
    sessionState.reconnectTimer = null;
  }

  // If already reconnecting, don't start another attempt
  if (sessionState.isReconnecting) {
    logger.info("Reconnection already in progress, skipping");
    return;
  }

  // Check if we've exceeded max attempts
  if (sessionState.reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
    logger.error("Max reconnection attempts reached", {
      attempts: sessionState.reconnectAttempts,
      maxAttempts: RECONNECT_CONFIG.MAX_ATTEMPTS,
    });
    sessionState.isReconnecting = false;
    sessionState.reconnectAttempts = 0;
    return;
  }

  // Start reconnection process
  sessionState.isReconnecting = true;
  sessionState.reconnectAttempts++;

  // Calculate delay with exponential backoff
  const delay = Math.min(
    RECONNECT_CONFIG.INITIAL_DELAY_MS *
      Math.pow(
        RECONNECT_CONFIG.BACKOFF_MULTIPLIER,
        sessionState.reconnectAttempts - 1,
      ),
    RECONNECT_CONFIG.MAX_DELAY_MS,
  );

  logger.info("Scheduling reconnection attempt", {
    attempt: sessionState.reconnectAttempts,
    maxAttempts: RECONNECT_CONFIG.MAX_ATTEMPTS,
    delayMs: delay,
  });

  // Schedule reconnection
  sessionState.reconnectTimer = setTimeout(() => {
    void attemptReconnection(client);
  }, delay);
}

/**
 * Attempt to reconnect to WhatsApp
 */
async function attemptReconnection(client: Client): Promise<void> {
  logger.info("Attempting WhatsApp reconnection", {
    attempt: sessionState.reconnectAttempts,
  });

  try {
    // Check if client is already connected
    const state = await client.getState();

    if (state && String(state) === "CONNECTED") {
      logger.info("WhatsApp already connected, reset reconnection state");
      resetReconnectionState();
      return;
    }

    // Try to initialize the client
    await client.initialize();

    logger.info("WhatsApp reconnection successful", {
      attempts: sessionState.reconnectAttempts,
    });

    // Reset reconnection state on success
    resetReconnectionState();
  } catch (error) {
    logger.error("Reconnection attempt failed", {
      attempt: sessionState.reconnectAttempts,
      error,
    });

    // Reset isReconnecting flag to allow next attempt
    sessionState.isReconnecting = false;

    // If we haven't exceeded max attempts, schedule another try
    if (sessionState.reconnectAttempts < RECONNECT_CONFIG.MAX_ATTEMPTS) {
      const client = getWhatsAppClient();
      if (client) {
        handleDisconnection(client, "reconnection_failed");
      }
    } else {
      logger.error("Max reconnection attempts exhausted");
      resetReconnectionState();
    }
  }
}

/**
 * Reset reconnection state after successful connection
 */
function resetReconnectionState(): void {
  sessionState.isReconnecting = false;
  sessionState.reconnectAttempts = 0;
  sessionState.lastDisconnectTime = null;

  if (sessionState.reconnectTimer) {
    clearTimeout(sessionState.reconnectTimer);
    sessionState.reconnectTimer = null;
  }

  logger.info("Reconnection state reset");
}

/**
 * Get current session status
 */
export function getSessionStatus(): {
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastDisconnectTime: Date | null;
} {
  return {
    isReconnecting: sessionState.isReconnecting,
    reconnectAttempts: sessionState.reconnectAttempts,
    lastDisconnectTime: sessionState.lastDisconnectTime,
  };
}

/**
 * Manually trigger reconnection
 */
export async function manualReconnect(): Promise<void> {
  logger.info("Manual reconnection triggered");

  const client = getWhatsAppClient();
  if (!client) {
    logger.error("Cannot reconnect: client not initialized");
    throw new Error("WhatsApp client not initialized");
  }

  // Reset state before attempting
  resetReconnectionState();

  // Attempt reconnection
  await attemptReconnection(client);
}

export default setupEventHandlers;
