import { randomUUID } from "crypto";

/**
 * Correlation ID storage for active message flows
 * Maps message ID to correlation ID for distributed tracing
 */
const correlationStore = new Map<
  string,
  { correlationId: string; timestamp: number }
>();

/**
 * TTL for correlation IDs (5 minutes in milliseconds)
 */
const CORRELATION_TTL = 5 * 60 * 1000;

/**
 * Cleanup interval (runs every minute)
 */
const CLEANUP_INTERVAL = 60 * 1000;

/**
 * Generate a new correlation ID (UUID v4)
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Store correlation ID for a message ID
 * @param messageId - WhatsApp message ID
 * @param correlationId - Optional correlation ID (generates new one if not provided)
 * @returns The correlation ID
 */
export function setCorrelationId(
  messageId: string,
  correlationId?: string,
): string {
  const id = correlationId || generateCorrelationId();
  correlationStore.set(messageId, {
    correlationId: id,
    timestamp: Date.now(),
  });
  return id;
}

/**
 * Get correlation ID for a message ID
 * @param messageId - WhatsApp message ID
 * @returns Correlation ID or undefined if not found
 */
export function getCorrelationId(messageId: string): string | undefined {
  const entry = correlationStore.get(messageId);
  if (!entry) {
    return undefined;
  }

  // Check if expired
  if (Date.now() - entry.timestamp > CORRELATION_TTL) {
    correlationStore.delete(messageId);
    return undefined;
  }

  return entry.correlationId;
}

/**
 * Remove correlation ID for a message ID (cleanup after processing)
 * @param messageId - WhatsApp message ID
 */
export function clearCorrelationId(messageId: string): void {
  correlationStore.delete(messageId);
}

/**
 * Cleanup expired correlation IDs
 * Automatically runs on interval
 */
function cleanupExpiredCorrelations(): void {
  const now = Date.now();
  const expired: string[] = [];

  correlationStore.forEach((entry, messageId) => {
    if (now - entry.timestamp > CORRELATION_TTL) {
      expired.push(messageId);
    }
  });

  expired.forEach((messageId) => correlationStore.delete(messageId));

  if (expired.length > 0) {
    // Log cleanup for monitoring (optional)
    // logger.debug("Cleaned up expired correlation IDs", { count: expired.length });
  }
}

// Start cleanup interval (skip in test environment)
if (
  typeof setInterval !== "undefined" &&
  process.env.NODE_ENV !== "test" &&
  typeof jest === "undefined"
) {
  setInterval(cleanupExpiredCorrelations, CLEANUP_INTERVAL);
}

/**
 * Get all active correlation IDs (for debugging/monitoring)
 */
export function getAllCorrelationIds(): Map<string, string> {
  const result = new Map<string, string>();
  const now = Date.now();

  correlationStore.forEach((entry, messageId) => {
    if (now - entry.timestamp <= CORRELATION_TTL) {
      result.set(messageId, entry.correlationId);
    }
  });

  return result;
}

/**
 * Clear all correlation IDs (for testing)
 */
export function clearAllCorrelationIds(): void {
  correlationStore.clear();
}
