import * as winston from "winston";
import { env } from "../config/env";

/**
 * Sensitive data patterns for masking
 */
const SENSITIVE_PATTERNS = {
  // Phone numbers: +62XXXXXXXXXX or 0XXXXXXXXXX
  phoneNumber: /(\+62|0)\d{8,12}/g,
  // Amounts in Rupiah (e.g., "Rp 500000" or "500000")
  amount: /(\d{1,3}(?:[.,]\d{3})*|\d+)(?:\s*(?:IDR|Rp))?/g,
  // Indonesian ID numbers (KTP)
  ktpNumber: /\d{16}/g,
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // JWT tokens
  jwtToken: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Database URLs and credentials
  databaseUrl: /(postgres|postgresql):\/\/[^\s]+/g,
  // API keys and secrets
  apiKey: /(?:api[_-]?key|secret|token)["\s:=]+([a-zA-Z0-9_-]+)/gi,
  // Credit card-like patterns
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
};

/**
 * Mask sensitive data in strings for logging
 * @param data - Data to mask
 * @returns Masked data
 */
function maskSensitiveData(data: unknown): unknown {
  if (typeof data === "string") {
    let masked = data;

    // Mask phone numbers
    masked = masked.replace(SENSITIVE_PATTERNS.phoneNumber, (match: string) => {
      const lastFour = match.slice(-4);
      return `+62 ****${lastFour}`;
    });

    // Mask amounts (keep only Rp prefix)
    masked = masked.replace(/Rp\s*[\d.,]+/g, "Rp ******.***");

    // Mask KTP numbers (Indonesian ID)
    masked = masked.replace(SENSITIVE_PATTERNS.ktpNumber, "****-****-****-****");

    // Mask email addresses
    masked = masked.replace(SENSITIVE_PATTERNS.email, (match) => {
      const [local, domain] = match.split("@");
      const maskedLocal = local.charAt(0) + "***" + local.charAt(local.length - 1);
      return `${maskedLocal}@${domain}`;
    });

    // Mask JWT tokens
    masked = masked.replace(SENSITIVE_PATTERNS.jwtToken, "eyJ***[REDACTED]***");

    // Mask database URLs
    masked = masked.replace(SENSITIVE_PATTERNS.databaseUrl, "postgres://***[REDACTED]***");

    // Mask API keys
    masked = masked.replace(
      /(["\s:=]+)([a-zA-Z0-9_-]{16,})/g,
      (match: string, prefix: string, key: string) => {
        const lastFour = key.slice(-4);
        return `${prefix}****${lastFour}`;
      },
    );

    // Mask credit card numbers
    masked = masked.replace(SENSITIVE_PATTERNS.creditCard, (match) => {
      const lastFour = match.replace(/[\s-]/g, "").slice(-4);
      return `****-****-****-${lastFour}`;
    });

    return masked;
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Check if key indicates sensitive data
      const keyLower = key.toLowerCase();
      if (
        keyLower.includes("phone") ||
        keyLower.includes("password") ||
        keyLower.includes("secret") ||
        keyLower.includes("token") ||
        keyLower.includes("api") ||
        keyLower.includes("key") ||
        keyLower.includes("amount") ||
        keyLower.includes("credit") ||
        keyLower.includes("card")
      ) {
        if (typeof value === "string") {
          // Mask the value
          if (keyLower.includes("phone")) {
            const lastFour = String(value).slice(-4);
            masked[key] = `+62 ****${lastFour}`;
          } else if (keyLower.includes("amount")) {
            masked[key] = "Rp ******.***";
          } else if (keyLower.includes("password") || keyLower.includes("secret")) {
            masked[key] = "***[REDACTED]***";
          } else {
            const lastFour = String(value).slice(-4);
            masked[key] = `***${lastFour}`;
          }
        } else {
          masked[key] = value;
        }
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  return data;
}

/**
 * Winston logger configuration with sensitive data masking
 * Outputs structured JSON logs for production, simple format for development
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format:
    env.LOG_FORMAT === "json"
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          // Custom format to mask sensitive data before JSON encoding
          winston.format.printf((info) => {
            const masked = maskSensitiveData(info);
            return JSON.stringify(masked);
          }),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf((info) => {
            const masked = maskSensitiveData(info);
            const { timestamp, level, message, ...meta } = masked as Record<string, unknown>;
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : "";
            const timestampStr = String(timestamp);
            const levelStr = String(level);
            const messageStr = String(message);
            return `${timestampStr} [${levelStr}]: ${messageStr} ${metaStr}`;
          }),
        ),
  defaultMeta: {
    service: "whatsapp-cashflow-bot",
    environment: env.NODE_ENV,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    // File transport for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Export masking utility for use in other modules
 */
export { maskSensitiveData };

// Create logs directory if it doesn't exist
import { mkdirSync } from "fs";
try {
  mkdirSync("logs", { recursive: true });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_error) {
  // Directory might already exist, ignore
}

export default logger;
