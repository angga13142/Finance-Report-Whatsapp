import { Message } from "whatsapp-web.js";
import { User } from "@prisma/client";
import { logger } from "../../lib/logger";
import {
  recordMessageReceived,
  recordMessageSent,
  startMessageProcessingTimer,
  recordMessageProcessingError,
  recordCommandExecution,
} from "../../lib/metrics";

/**
 * Performance monitoring middleware
 * Tracks message processing times, errors, and command execution metrics
 */
export class PerformanceMiddleware {
  /**
   * Track incoming message
   */
  static trackIncomingMessage(
    message: Message,
    type: "text" | "button" | "list",
  ): void {
    recordMessageReceived(type);

    logger.debug("Message received", {
      type,
      from: message.from,
      hasQuotedMsg: !!message.hasQuotedMsg,
    });
  }

  /**
   * Track outgoing message
   */
  static trackOutgoingMessage(
    type: "text" | "button" | "list",
    success: boolean,
  ): void {
    const status = success ? "success" : "failed";
    recordMessageSent(type, status);

    logger.debug("Message sent", {
      type,
      status,
    });
  }

  /**
   * Track message processing with timing
   */
  static async trackMessageProcessing<T>(
    handler: string,
    userId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const endTimer = startMessageProcessingTimer(handler);

    try {
      const result = await fn();
      endTimer();

      const duration = Date.now() - startTime;
      logger.debug("Message processing completed", {
        handler,
        userId,
        duration,
      });

      return result;
    } catch (error) {
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";
      recordMessageProcessingError(handler, errorType);

      const duration = Date.now() - startTime;
      logger.error("Message processing failed", {
        handler,
        userId,
        duration,
        error,
      });

      throw error;
    }
  }

  /**
   * Track command execution
   */
  static async trackCommandExecution<T>(
    command: string,
    userId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = (Date.now() - startTime) / 1000;

      recordCommandExecution(command, "success", duration);

      logger.debug("Command executed successfully", {
        command,
        userId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      recordCommandExecution(command, "error", duration);

      logger.error("Command execution failed", {
        command,
        userId,
        duration,
        error,
      });

      throw error;
    }
  }

  /**
   * Track transaction handler performance
   */
  static async trackTransactionHandler<T>(
    user: User,
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackMessageProcessing(`transaction:${action}`, user.id, fn);
  }

  /**
   * Track report handler performance
   */
  static async trackReportHandler<T>(
    user: User,
    reportType: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackMessageProcessing(`report:${reportType}`, user.id, fn);
  }

  /**
   * Track admin handler performance
   */
  static async trackAdminHandler<T>(
    user: User,
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackMessageProcessing(`admin:${action}`, user.id, fn);
  }

  /**
   * Track approval handler performance
   */
  static async trackApprovalHandler<T>(
    user: User,
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackMessageProcessing(`approval:${action}`, user.id, fn);
  }

  /**
   * Track recommendation handler performance
   */
  static async trackRecommendationHandler<T>(
    user: User,
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackMessageProcessing(`recommendation:${action}`, user.id, fn);
  }

  /**
   * Create a performance tracking wrapper for any handler
   */
  static createPerformanceWrapper<T extends unknown[], R>(
    handlerName: string,
    handler: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      const endTimer = startMessageProcessingTimer(handlerName);

      try {
        const result = await handler(...args);
        endTimer();

        const duration = Date.now() - startTime;
        logger.debug("Handler executed", {
          handler: handlerName,
          duration,
        });

        return result;
      } catch (error) {
        const errorType =
          error instanceof Error ? error.constructor.name : "UnknownError";
        recordMessageProcessingError(handlerName, errorType);

        const duration = Date.now() - startTime;
        logger.error("Handler failed", {
          handler: handlerName,
          duration,
          error,
        });

        throw error;
      }
    };
  }

  /**
   * Log slow operations (>1000ms)
   */
  static async trackSlowOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    slowThreshold = 1000,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      if (duration > slowThreshold) {
        logger.warn("Slow operation detected", {
          operation: operationName,
          duration,
          threshold: slowThreshold,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Operation failed", {
        operation: operationName,
        duration,
        error,
      });

      throw error;
    }
  }

  /**
   * Batch operation tracking
   */
  static async trackBatchOperation<T>(
    operationName: string,
    batchSize: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const avgDuration = duration / batchSize;

      logger.info("Batch operation completed", {
        operation: operationName,
        batchSize,
        totalDuration: duration,
        avgDuration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Batch operation failed", {
        operation: operationName,
        batchSize,
        duration,
        error,
      });

      throw error;
    }
  }
}

export default PerformanceMiddleware;
