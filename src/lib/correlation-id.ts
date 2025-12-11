import { randomUUID } from "crypto";

/**
 * Correlation ID utility for tracking requests across services
 * Generates UUID v4 correlation IDs for request tracing
 */

/**
 * Generate a new correlation ID using UUID v4
 * @returns UUID v4 string
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Get or generate correlation ID from context
 * If correlationId exists in context, returns it; otherwise generates a new one
 * @param context - Context object that may contain correlationId
 * @returns Correlation ID string
 */
export function getOrGenerateCorrelationId(context?: {
  correlationId?: string;
}): string {
  if (context?.correlationId) {
    return context.correlationId;
  }
  return generateCorrelationId();
}

/**
 * Correlation ID storage for request context
 * Uses AsyncLocalStorage for request-scoped correlation IDs
 */
import { AsyncLocalStorage } from "async_hooks";

const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Run a function with a correlation ID in context
 * @param correlationId - Correlation ID to set in context
 * @param fn - Function to run with correlation ID in context
 * @returns Result of the function
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

/**
 * Get correlation ID from current context
 * @returns Correlation ID if available, undefined otherwise
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Set correlation ID in current context
 * @param correlationId - Correlation ID to set
 */
export function setCorrelationId(correlationId: string): void {
  correlationIdStorage.enterWith(correlationId);
}

export default {
  generateCorrelationId,
  getOrGenerateCorrelationId,
  runWithCorrelationId,
  getCorrelationId,
  setCorrelationId,
};
