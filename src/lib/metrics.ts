import { Registry, Counter, Histogram, Gauge } from "prom-client";
import { logger } from "./logger";

/**
 * Prometheus metrics collection for monitoring system performance
 * Tracks response times, error rates, message throughput, and system health
 */

// Create a Registry to register the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from "prom-client";
collectDefaultMetrics({ register });

/**
 * Message Processing Metrics
 */

// Total messages received
export const messagesReceivedTotal = new Counter({
  name: "whatsapp_messages_received_total",
  help: "Total number of WhatsApp messages received",
  labelNames: ["type"], // text, button, list
  registers: [register],
});

// Total messages sent
export const messagesSentTotal = new Counter({
  name: "whatsapp_messages_sent_total",
  help: "Total number of WhatsApp messages sent",
  labelNames: ["type", "status"], // type: text/button/list, status: success/failed
  registers: [register],
});

// Message processing duration
export const messageProcessingDuration = new Histogram({
  name: "whatsapp_message_processing_duration_seconds",
  help: "Duration of message processing in seconds",
  labelNames: ["handler", "status"], // handler: transaction/report/admin, status: success/error
  buckets: [0.1, 0.5, 1, 2, 5, 10], // seconds
  registers: [register],
});

// Message processing errors
export const messageProcessingErrors = new Counter({
  name: "whatsapp_message_processing_errors_total",
  help: "Total number of message processing errors",
  labelNames: ["handler", "error_type"],
  registers: [register],
});

/**
 * Transaction Metrics
 */

// Transactions processed
export const transactionsProcessed = new Counter({
  name: "transactions_processed_total",
  help: "Total number of transactions processed",
  labelNames: ["type", "status"], // type: income/expense, status: success/failed/flagged
  registers: [register],
});

// Transaction amount
export const transactionAmount = new Histogram({
  name: "transaction_amount",
  help: "Transaction amounts in Rupiah",
  labelNames: ["type"], // income/expense
  buckets: [1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
  registers: [register],
});

// Transaction validation duration
export const transactionValidationDuration = new Histogram({
  name: "transaction_validation_duration_seconds",
  help: "Duration of transaction validation in seconds",
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Report Generation Metrics
 */

// Reports generated
export const reportsGenerated = new Counter({
  name: "reports_generated_total",
  help: "Total number of reports generated",
  labelNames: ["type", "role"], // type: daily/weekly/monthly, role: employee/boss/investor/dev
  registers: [register],
});

// Report generation duration
export const reportGenerationDuration = new Histogram({
  name: "report_generation_duration_seconds",
  help: "Duration of report generation in seconds",
  labelNames: ["type", "role"],
  buckets: [1, 5, 10, 30, 60, 120], // seconds
  registers: [register],
});

// Report delivery
export const reportDeliveryStatus = new Counter({
  name: "report_delivery_status_total",
  help: "Report delivery status",
  labelNames: ["status"], // success/failed
  registers: [register],
});

/**
 * Database Metrics
 */

// Database queries
export const databaseQueries = new Counter({
  name: "database_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"], // operation: select/insert/update/delete
  registers: [register],
});

// Database query duration
export const databaseQueryDuration = new Histogram({
  name: "database_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // seconds
  registers: [register],
});

// Database errors
export const databaseErrors = new Counter({
  name: "database_errors_total",
  help: "Total number of database errors",
  labelNames: ["operation", "error_type"],
  registers: [register],
});

/**
 * Redis Cache Metrics
 */

// Cache hits
export const cacheHits = new Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_key"],
  registers: [register],
});

// Cache misses
export const cacheMisses = new Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_key"],
  registers: [register],
});

// Cache operations duration
export const cacheOperationDuration = new Histogram({
  name: "cache_operation_duration_seconds",
  help: "Duration of cache operations in seconds",
  labelNames: ["operation"], // get/set/delete
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

/**
 * System Health Metrics
 */

// Active users
export const activeUsers = new Gauge({
  name: "active_users",
  help: "Number of active users",
  labelNames: ["role"],
  registers: [register],
});

// WhatsApp session status
export const whatsappSessionStatus = new Gauge({
  name: "whatsapp_session_status",
  help: "WhatsApp session status (1 = connected, 0 = disconnected)",
  registers: [register],
});

// Pending transactions
export const pendingTransactions = new Gauge({
  name: "pending_transactions",
  help: "Number of pending transactions awaiting approval",
  registers: [register],
});

// Recommendation alerts sent
export const recommendationAlerts = new Counter({
  name: "recommendation_alerts_total",
  help: "Total number of recommendation alerts sent",
  labelNames: ["priority", "type"], // priority: low/medium/high/critical, type: expense_spike/revenue_decline/etc
  registers: [register],
});

/**
 * API/Command Metrics
 */

// Command executions
export const commandExecutions = new Counter({
  name: "command_executions_total",
  help: "Total number of command executions",
  labelNames: ["command", "status"], // command: /start, /help, etc, status: success/error
  registers: [register],
});

// Command execution duration
export const commandExecutionDuration = new Histogram({
  name: "command_execution_duration_seconds",
  help: "Duration of command execution in seconds",
  labelNames: ["command"],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Error Tracking
 */

// Application errors
export const applicationErrors = new Counter({
  name: "application_errors_total",
  help: "Total number of application errors",
  labelNames: ["error_type", "severity"], // severity: warning/error/critical
  registers: [register],
});

/**
 * Utility Functions
 */

/**
 * Record message received
 */
export function recordMessageReceived(type: "text" | "button" | "list"): void {
  messagesReceivedTotal.inc({ type });
}

/**
 * Record message sent
 */
export function recordMessageSent(
  type: "text" | "button" | "list",
  status: "success" | "failed",
): void {
  messagesSentTotal.inc({ type, status });
}

/**
 * Start timer for message processing
 */
export function startMessageProcessingTimer(handler: string): () => void {
  const end = messageProcessingDuration.startTimer({ handler });
  return () => end({ status: "success" });
}

/**
 * Record message processing error
 */
export function recordMessageProcessingError(
  handler: string,
  errorType: string,
): void {
  messageProcessingErrors.inc({ handler, error_type: errorType });
  messageProcessingDuration.observe({ handler, status: "error" }, 0);
}

/**
 * Record transaction processed
 */
export function recordTransactionProcessed(
  type: "income" | "expense",
  status: "success" | "failed" | "flagged",
  amount?: number,
): void {
  transactionsProcessed.inc({ type, status });

  if (status === "success" && amount) {
    transactionAmount.observe({ type }, amount);
  }
}

/**
 * Start timer for transaction validation
 */
export function startTransactionValidationTimer(): () => void {
  return transactionValidationDuration.startTimer();
}

/**
 * Record report generated
 */
export function recordReportGenerated(
  type: "daily" | "weekly" | "monthly",
  role: string,
  duration: number,
): void {
  reportsGenerated.inc({ type, role });
  reportGenerationDuration.observe({ type, role }, duration);
}

/**
 * Record report delivery
 */
export function recordReportDelivery(status: "success" | "failed"): void {
  reportDeliveryStatus.inc({ status });
}

/**
 * Record database query
 */
export function recordDatabaseQuery(
  operation: "select" | "insert" | "update" | "delete",
  table: string,
  duration: number,
): void {
  databaseQueries.inc({ operation, table });
  databaseQueryDuration.observe({ operation, table }, duration);
}

/**
 * Record database error
 */
export function recordDatabaseError(
  operation: string,
  errorType: string,
): void {
  databaseErrors.inc({ operation, error_type: errorType });
}

/**
 * Record cache hit
 */
export function recordCacheHit(cacheKey: string): void {
  cacheHits.inc({ cache_key: cacheKey });
}

/**
 * Record cache miss
 */
export function recordCacheMiss(cacheKey: string): void {
  cacheMisses.inc({ cache_key: cacheKey });
}

/**
 * Record cache operation duration
 */
export function recordCacheOperation(
  operation: "get" | "set" | "delete",
  duration: number,
): void {
  cacheOperationDuration.observe({ operation }, duration);
}

/**
 * Update active users count
 */
export function updateActiveUsers(role: string, count: number): void {
  activeUsers.set({ role }, count);
}

/**
 * Update WhatsApp session status
 */
export function updateWhatsAppSessionStatus(connected: boolean): void {
  whatsappSessionStatus.set(connected ? 1 : 0);
}

/**
 * Update pending transactions count
 */
export function updatePendingTransactions(count: number): void {
  pendingTransactions.set(count);
}

/**
 * Record recommendation alert
 */
export function recordRecommendationAlert(
  priority: "low" | "medium" | "high" | "critical",
  type: string,
): void {
  recommendationAlerts.inc({ priority, type });
}

/**
 * Record command execution
 */
export function recordCommandExecution(
  command: string,
  status: "success" | "error",
  duration: number,
): void {
  commandExecutions.inc({ command, status });
  commandExecutionDuration.observe({ command }, duration);
}

/**
 * Record application error
 */
export function recordApplicationError(
  errorType: string,
  severity: "warning" | "error" | "critical",
): void {
  applicationErrors.inc({ error_type: errorType, severity });
}

/**
 * Get metrics for Prometheus scraping
 */
export async function getMetrics(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error) {
    logger.error("Error getting metrics", { error });
    return "";
  }
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

logger.info("Prometheus metrics initialized", {
  metricsCount: register.getMetricsAsArray().length,
});

export default {
  register,
  getMetrics,
  resetMetrics,
  recordMessageReceived,
  recordMessageSent,
  startMessageProcessingTimer,
  recordMessageProcessingError,
  recordTransactionProcessed,
  startTransactionValidationTimer,
  recordReportGenerated,
  recordReportDelivery,
  recordDatabaseQuery,
  recordDatabaseError,
  recordCacheHit,
  recordCacheMiss,
  recordCacheOperation,
  updateActiveUsers,
  updateWhatsAppSessionStatus,
  updatePendingTransactions,
  recordRecommendationAlert,
  recordCommandExecution,
  recordApplicationError,
};
