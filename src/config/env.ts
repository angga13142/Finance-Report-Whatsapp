import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .default("0"),

  // Authentication
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("24h"),

  // WhatsApp
  WHATSAPP_SESSION_PATH: z.string().default(".wwebjs_auth"),
  WHATSAPP_QR_CODE_TIMEOUT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("60000"),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("3000"),
  TZ: z.string().default("Asia/Makassar"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["json", "simple"]).default("json"),

  // Report Configuration
  REPORT_DELIVERY_TIME: z.string().default("24:00"),
  REPORT_TIMEZONE: z.string().default("Asia/Makassar"),
  REPORT_RETRY_ATTEMPTS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .default("3"),
  REPORT_RETRY_INTERVAL: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("300000"),

  // Rate Limiting
  RATE_LIMIT_MESSAGES_PER_MINUTE: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("15"),
  RATE_LIMIT_BUTTON_DEBOUNCE_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("3000"),

  // Security
  SESSION_TIMEOUT_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("600000"),
  MAX_LOGIN_ATTEMPTS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("5"),
  LOGIN_LOCKOUT_DURATION_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("900000"),

  // Monitoring
  PROMETHEUS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("9090"),
  HEALTH_CHECK_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("3000"),

  // File Storage
  REPORTS_DIR: z.string().default("./reports"),
  MAX_PDF_SIZE_MB: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("16"),

  // Button Deprecation Feature Flag
  ENABLE_LEGACY_BUTTONS: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default("true"),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("\n");
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

// Export validated env for convenience
export const env = validateEnv();
