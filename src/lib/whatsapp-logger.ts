/**
 * WhatsApp Event Logger
 * Structured logging wrapper around Winston with correlation IDs and sensitive data masking
 */

import { logger, maskSensitiveData } from "./logger";
import {
  generateCorrelationId,
  setCorrelationId,
  getCorrelationId,
} from "./correlation";

/**
 * WhatsApp event types
 */
export type WhatsAppEventType =
  | "qr"
  | "authenticated"
  | "auth_failure"
  | "disconnected"
  | "message_received"
  | "message_sent"
  | "message_send_failure"
  | "ready"
  | "error"
  | "loading_screen"
  | "message_create";

/**
 * Log level mapping for WhatsApp events
 */
const EVENT_LOG_LEVELS: Record<
  WhatsAppEventType,
  "error" | "warn" | "info" | "debug"
> = {
  qr: "info",
  authenticated: "info",
  auth_failure: "error",
  disconnected: "warn",
  message_received: "info",
  message_sent: "info",
  message_send_failure: "error",
  ready: "info",
  error: "error",
  loading_screen: "debug",
  message_create: "debug",
};

/**
 * Async log write queue with retry mechanism
 */
interface LogQueueItem {
  level: string;
  message: string;
  meta: Record<string, unknown>;
  retries: number;
  timestamp: number;
}

class LogWriteQueue {
  private queue: LogQueueItem[] = [];
  private processing = false;
  private readonly maxRetries = 3;
  private readonly baseDelay = 100; // 100ms base delay for exponential backoff

  /**
   * Add log entry to queue
   */
  enqueue(level: string, message: string, meta: Record<string, unknown>): void {
    this.queue.push({
      level,
      message,
      meta,
      retries: 0,
      timestamp: Date.now(),
    });

    if (!this.processing) {
      void this.processQueue();
    }
  }

  /**
   * Process queue with retry mechanism
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) {
        continue;
      }

      try {
        // Write log using Winston logger
        logger.log(item.level, item.message, item.meta);
      } catch (error) {
        // Retry with exponential backoff
        if (item.retries < this.maxRetries) {
          item.retries++;
          const delay = this.baseDelay * Math.pow(2, item.retries - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          this.queue.unshift(item); // Re-add to front of queue
        } else {
          // Max retries exceeded, log error to console as fallback
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Failed to write log after max retries", {
            level: item.level,
            message: item.message,
            error: errorMessage,
          });
        }
      }
    }

    this.processing = false;
  }
}

const logQueue = new LogWriteQueue();

/**
 * WhatsApp Event Logger
 * Provides structured logging for WhatsApp events with correlation IDs
 */
export class WhatsAppEventLogger {
  /**
   * Log WhatsApp event with correlation ID and sensitive data masking
   * @param eventType - Type of WhatsApp event
   * @param data - Event data (will be masked)
   * @returns Correlation ID for this event flow
   */
  logEvent(
    eventType: WhatsAppEventType,
    data: Record<string, unknown> & {
      messageId?: string;
      correlationId?: string;
    },
  ): string {
    // Get or generate correlation ID
    let correlationId: string;
    if (data.correlationId) {
      correlationId = data.correlationId;
    } else if (data.messageId) {
      const existing = getCorrelationId(data.messageId);
      if (existing) {
        correlationId = existing;
      } else {
        correlationId = generateCorrelationId();
        setCorrelationId(data.messageId, correlationId);
      }
    } else {
      correlationId = generateCorrelationId();
    }

    // Mask sensitive data
    const maskedData = this.maskSensitiveData(data);

    // Get log level for this event type
    const logLevel = EVENT_LOG_LEVELS[eventType];

    // Prepare log metadata
    const maskedDataObj =
      typeof maskedData === "object" &&
      maskedData !== null &&
      !Array.isArray(maskedData)
        ? (maskedData as Record<string, unknown>)
        : { data: maskedData };

    const meta: Record<string, unknown> = {
      eventType,
      correlationId,
      ...maskedDataObj,
      timestamp: new Date().toISOString(),
    };

    // Queue log write (async with retry)
    logQueue.enqueue(logLevel, `WhatsApp ${eventType}`, meta);

    return correlationId;
  }

  /**
   * Mask sensitive data in log entries
   * Uses existing SENSITIVE_PATTERNS from logger.ts
   */
  maskSensitiveData(data: unknown): unknown {
    return maskSensitiveData(data);
  }

  /**
   * Get correlation ID for a message
   */
  getCorrelationId(messageId: string): string | undefined {
    return getCorrelationId(messageId);
  }

  /**
   * Set correlation ID for a message
   */
  setCorrelationId(messageId: string, correlationId?: string): string {
    return setCorrelationId(messageId, correlationId);
  }
}

/**
 * Export singleton instance
 */
export const whatsappLogger = new WhatsAppEventLogger();

export default whatsappLogger;
