import * as winston from "winston";
import { env } from "../config/env";

/**
 * Winston logger configuration
 * Outputs structured JSON logs for production, simple format for development
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format:
    env.LOG_FORMAT === "json"
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...meta } = info;
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : "";
            // Type assertion untuk winston info object
            const timestampStr = String(timestamp as string);
            const levelStr = String(level);
            const messageStr = String(message as string);
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

// Create logs directory if it doesn't exist
import { mkdirSync } from "fs";
try {
  mkdirSync("logs", { recursive: true });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_error) {
  // Directory might already exist, ignore
}

export default logger;
