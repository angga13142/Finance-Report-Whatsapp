# Technology Stack Blueprint - WhatsApp Cashflow Bot

**Document Date:** December 10, 2025  
**Project:** WhatsApp Cashflow Reporting Chatbot  
**Analysis Depth:** Implementation-Ready  
**Output Format:** Markdown  
**Categorization:** Technology Type & Layer

---

## Executive Summary

This document provides a comprehensive technology stack blueprint for the WhatsApp Cashflow Bot, a Node.js/TypeScript application for financial transaction recording, approval workflows, and reporting via WhatsApp. The stack emphasizes type safety, real-time communication, high-performance data access, and operational visibility.

**Key Characteristics:**
- **Runtime:** Node.js 20 LTS (ES2022, CommonJS modules)
- **Language:** TypeScript 5.x (strict mode)
- **Architecture:** Layered (Handlers → Services → Models → Database)
- **Primary Database:** PostgreSQL 15+ with TimescaleDB
- **Session/Cache:** Redis 7.x
- **Messaging:** WhatsApp Web.js (browser-based)
- **Monitoring:** Prometheus + Grafana
- **Container:** Docker multi-stage builds

---

## 1. Core Framework & Runtime

### Node.js 20 LTS

**Version:** >=20.0.0  
**Purpose:** JavaScript runtime for backend application  
**Features Used:**
- ES2022 features (async/await, modules, destructuring)
- CommonJS modules (for compatibility)
- Built-in modules: `http`, `path`, `events`, `stream`
- Process management for graceful shutdown

```typescript
// src/index.ts - Demonstrates Node.js core features
import { validateEnv } from "./config/env";
import { logger } from "./lib/logger";
import { connectRedis } from "./lib/redis";
import { database } from "./lib/database";
import { initializeWhatsAppClient } from "./bot/client/client";

async function main(): Promise<void> {
  try {
    // Signal handling for graceful shutdown
    GracefulShutdown.initialize();
    
    // Environment validation
    const env = validateEnv();
    
    // Resource initialization (order matters)
    await connectRedis();
    await database.connect();
    await initializeWhatsAppClient();
    
    logger.info("Application started successfully");
  } catch (error) {
    logger.error("Application startup failed", { error });
    process.exit(1);
  }
}

main();
```

---

## 2. Language & Type System

### TypeScript 5.x

**Version:** ^5.0.0  
**Target:** ES2022  
**Module System:** CommonJS (with ESM interop enabled)

**Compiler Configuration:**
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node", "jest"]
  }
}
```

**Key Settings & Rationale:**
- `strict: true` - Enforces type safety (no implicit `any`, null checks)
- `noUnusedLocals/Parameters` - Prevents dead code
- `declaration: true` - Generates `.d.ts` files for library usage
- `sourceMap: true` - Stack traces reference original TypeScript
- `esModuleInterop` - Handles CommonJS/ESM interoperability

**Typing Patterns Used:**

```typescript
// 1. Strict null checks
interface User {
  id: string;
  name?: string;  // Optional property
  email: string;  // Required
}

// 2. Discriminated unions for type safety
type ApprovalDecision = 
  | { status: "approved"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "pending"; confidenceScore: number };

// 3. Generics for reusable code
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

// 4. Type guards
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// 5. Utility types
type Partial<T> = { [K in keyof T]?: T[K] };
type Record<K extends string, T> = { [P in K]: T };
```

---

## 3. Configuration & Environment Management

### Zod Runtime Validation

**Version:** ^3.22.4  
**Purpose:** Runtime schema validation for environment variables and configuration

**Usage Pattern:**

```typescript
// src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  REDIS_PASSWORD: z.string().optional(),
  
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
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default("3000"),
  TZ: z.string().default("Asia/Makassar"),
  
  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["json", "simple"]).default("json"),
});

export const env = envSchema.parse(process.env);
```

**Benefits:**
- Type-safe environment variables
- Runtime validation with helpful error messages
- Default values for optional config
- Fails fast on startup if config is invalid

---

## 4. Database Layer

### Prisma ORM

**Version:** ^5.0.0  
**Database:** PostgreSQL 15+  
**Purpose:** Type-safe database access with automatic migrations

**Schema Architecture:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums for type safety
enum UserRole {
  dev
  boss
  employee
  investor
}

enum TransactionType {
  income
  expense
}

enum ApprovalStatus {
  approved
  pending
  rejected
}

// Entity definitions
model User {
  id            String    @id @default(uuid()) @db.Uuid
  phoneNumber   String    @unique @db.VarChar(20)
  name          String?   @db.VarChar(255)
  role          UserRole  @default(employee)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  lastActive    DateTime? @map("last_active") @db.Timestamptz(6)
  isActive      Boolean   @default(true) @map("is_active")

  // Relations
  transactions         Transaction[]
  sessions             UserSession[]
  auditLogs            AuditLog[]
  approvedTransactions Transaction[] @relation("TransactionApprover")

  @@index([role])
  @@index([isActive])
  @@map("users")
}

model Transaction {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @map("user_id") @db.Uuid
  type            TransactionType
  category        String          @db.VarChar(100)
  amount          Decimal         @db.Decimal(15, 2)
  description     String?         @db.VarChar(255)
  approvalStatus  ApprovalStatus  @default(approved) @map("approval_status")
  timestamp       DateTime        @default(now()) @db.Timestamptz(6)

  // Relations
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  approver        User?           @relation("TransactionApprover", fields: [approvalBy], references: [id])

  @@index([userId])
  @@index([userId, timestamp])
  @@index([approvalStatus])
  @@map("transactions")
}
```

**Connection Pooling Configuration:**

```typescript
// src/lib/database.ts
const DATABASE_POOL_CONFIG = {
  connection_limit_min: 5,
  connection_limit_max: 50,
  connect_timeout: 10,
  pool_timeout: 10,
  statement_timeout: 30000, // 30 seconds
};

export function getPrismaClient(): PrismaClient {
  const connectionString = buildConnectionString();
  
  const prismaClient = new PrismaClient({
    datasources: {
      db: { url: connectionString },
    },
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Query performance monitoring
  prismaClient.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();

    logger.debug("Database query executed", {
      model: params.model,
      action: params.action,
      duration: after - before,
    });

    return result;
  });

  return prismaClient;
}
```

**Query Optimization Patterns:**

```typescript
// Model layer - optimized queries
export class TransactionModel {
  // Eager loading to prevent N+1
  static async findById(id: string): Promise<Transaction | null> {
    return await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: true,
        approver: true,
      },
    });
  }

  // Pagination for large result sets
  static async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Transaction[]> {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  // Range queries with indexes
  static async findTodayTransactions(userId?: string): Promise<Transaction[]> {
    const { start, end } = getDayRangeWITA();
    
    return await prisma.transaction.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "desc" },
    });
  }
}
```

---

## 5. Cache & Session Management

### Redis 7.x

**Version:** ^4.6.0 (Node.js client)  
**Server Version:** 7.x (Alpine)  
**Purpose:** Session storage, caching, rate limiting

**Client Configuration:**

```typescript
// src/lib/redis.ts
import { createClient } from "redis";

export function getRedisClient(): ReturnType<typeof createClient> {
  const client = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      reconnectStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay; // Exponential backoff
      },
    },
    password: env.REDIS_PASSWORD || undefined,
    database: env.REDIS_DB,
  });

  // Event handlers for reliability
  client.on("error", (err) => {
    logger.error("Redis client error", { error: err.message });
  });

  client.on("connect", () => {
    logger.info("Redis client connected");
  });

  return client;
}
```

**Usage Patterns:**

```typescript
// Session management
export const redis = {
  // Store user session
  async setSession(userId: string, data: SessionData): Promise<void> {
    await redisClient.setEx(
      `session:${userId}`,
      SESSION_TIMEOUT_MINUTES * 60,
      JSON.stringify(data),
    );
  },

  // Retrieve session
  async getSession(userId: string): Promise<SessionData | null> {
    const data = await redisClient.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  },

  // Rate limiting
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    return count;
  },

  // Caching
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 3600,
  ): Promise<T> {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const value = await fn();
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    return value;
  },
};
```

---

## 6. Logging & Observability

### Winston

**Version:** ^3.11.0  
**Purpose:** Structured logging with multiple transports

**Configuration:**

```typescript
// src/lib/logger.ts
import * as winston from "winston";

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
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...meta } = info;
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : "";
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          }),
        ),
  defaultMeta: {
    service: "whatsapp-cashflow-bot",
    environment: env.NODE_ENV,
  },
  transports: [
    // Console (all levels)
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    // File for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});
```

**Usage Patterns:**

```typescript
// Structured logging
logger.info("Transaction created", {
  transactionId: transaction.id,
  userId: transaction.userId,
  type: transaction.type,
  amount: transaction.amount.toString(),
  approvalStatus: transaction.approvalStatus,
});

logger.error("Transaction processing failed", {
  error: error instanceof Error ? error.message : String(error),
  data: { userId, category, amount },
});

logger.debug("Database query executed", {
  model: "Transaction",
  action: "create",
  duration: 45, // milliseconds
});

logger.warn("Rate limit exceeded", {
  userId,
  requestsPerMinute: 25,
  limit: 15,
});
```

### Prometheus Metrics

**Version:** ^15.1.3  
**Purpose:** Application metrics collection for monitoring

**Metrics Collected:**

```typescript
// src/lib/metrics.ts
import { Counter, Histogram, Gauge, Registry } from "prom-client";

export const register = new Registry();

// Message processing metrics
export const messagesReceivedTotal = new Counter({
  name: "whatsapp_messages_received_total",
  help: "Total number of WhatsApp messages received",
  labelNames: ["type"],
  registers: [register],
});

export const messageProcessingDuration = new Histogram({
  name: "whatsapp_message_processing_duration_seconds",
  help: "Duration of message processing in seconds",
  labelNames: ["handler", "status"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Transaction metrics
export const transactionsProcessed = new Counter({
  name: "transactions_processed_total",
  help: "Total number of transactions processed",
  labelNames: ["type", "status"],
  registers: [register],
});

// Approval metrics
export const approvalsProcessed = new Counter({
  name: "approvals_processed_total",
  help: "Total number of approvals processed",
  labelNames: ["status"],
  registers: [register],
});

// System health
export const whatsappSessionStatus = new Gauge({
  name: "whatsapp_session_active",
  help: "WhatsApp session connection status (1=connected, 0=disconnected)",
  registers: [register],
});

export const databaseConnectionPoolSize = new Gauge({
  name: "database_connection_pool_size",
  help: "Current number of open database connections",
  registers: [register],
});
```

---

## 7. WhatsApp Integration

### WhatsApp Web.js

**Version:** ^1.23.0  
**Purpose:** WhatsApp message client library using browser automation

**Client Implementation:**

```typescript
// src/bot/client/client.ts
import { Client } from "whatsapp-web.js";
import { createLocalAuth } from "./auth";
import { logger } from "../../lib/logger";

let whatsappClient: Client | null = null;

export function createWhatsAppClient(): Client {
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

  return whatsappClient;
}

export async function initializeWhatsAppClient(): Promise<Client> {
  const client = createWhatsAppClient();
  
  if (!client.info) {
    await client.initialize();
  }
  
  return client;
}
```

**Message Event Handling:**

```typescript
// src/bot/client/events.ts
export function initializeEventHandlers(): void {
  const client = getWhatsAppClient();
  if (!client) return;

  // Message received
  client.on("message", async (message: Message) => {
    try {
      await MessageHandler.routeMessage(message);
    } catch (error) {
      logger.error("Error handling message", { error, from: message.from });
    }
  });

  // Connection state changes
  client.on("change_state", (state) => {
    logger.info("WhatsApp connection state changed", { state });
    updateWhatsAppSessionStatus(state === "CONNECTED" ? 1 : 0);
  });

  // QR code for authentication
  client.on("qr", (qr: string) => {
    logger.info("WhatsApp QR code generated");
    // Display QR code to user for scanning
  });

  // Authentication ready
  client.on("authenticated", () => {
    logger.info("WhatsApp client authenticated");
  });

  // Authentication failure
  client.on("auth_failure", (msg) => {
    logger.error("WhatsApp authentication failed", { message: msg });
  });
}
```

**Puppeteer Configuration:**
- Headless mode for performance
- Sandbox disabled for Docker compatibility
- Single process for resource efficiency
- GPU disabled for minimal overhead

---

## 8. Web Framework & API

### Express

**Version:** ^5.2.1  
**Purpose:** HTTP server for health checks and metrics endpoints

**Basic Setup:**

```typescript
// src/index.ts
const express = require("express") as () => Application;

const app = express();
const healthPort = parseInt(process.env.HEALTH_CHECK_PORT || "3000", 10);

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check Redis
    const redisHealthy = await redis.ping() === "PONG";
    
    // Check database
    const dbHealthy = await prisma.$queryRaw`SELECT 1`;
    
    // Check WhatsApp
    const whatsappHealthy = getWhatsAppClient()?.info !== null;

    if (!redisHealthy || !dbHealthy || !whatsappHealthy) {
      return res.status(503).json({
        status: "unhealthy",
        checks: {
          redis: redisHealthy ? "ok" : "down",
          database: dbHealthy ? "ok" : "down",
          whatsapp: whatsappHealthy ? "ok" : "down",
        },
      });
    }

    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check failed", { error });
    return res.status(503).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Metrics endpoint
app.get("/metrics", (_req: Request, res: Response) => {
  res.set("Content-Type", register.contentType);
  res.end(register.metrics());
});

app.listen(healthPort, () => {
  logger.info(`Health check server listening on port ${healthPort}`);
});
```

---

## 9. Testing Infrastructure

### Jest (Unit & Integration Tests)

**Version:** ^29.0.0  
**Preset:** ts-jest  
**Environment:** Node  
**Purpose:** TypeScript unit and integration testing

**Configuration:**

```javascript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: true,
};
```

**Testing Patterns:**

```typescript
// tests/unit/services/transaction/validator.test.ts
import { TransactionValidator } from "@/services/transaction/validator";

describe("TransactionValidator", () => {
  describe("validateAmount", () => {
    test("validates correct amount format", () => {
      const result = TransactionValidator.validateAmount("500000");
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(500000);
    });

    test("rejects invalid format", () => {
      const result = TransactionValidator.validateAmount("abc");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("rejects amount exceeding maximum", () => {
      const result = TransactionValidator.validateAmount("999999999999");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateCategory", () => {
    test("validates existing category", async () => {
      // Mock CategoryModel
      jest.spyOn(CategoryModel, "findByName").mockResolvedValue({
        id: "cat-1",
        name: "Sales",
        type: "income",
        isActive: true,
      } as Category);

      const result = await TransactionValidator.validateCategory(
        "Sales",
        "income",
      );
      expect(result.valid).toBe(true);
    });

    test("rejects non-existent category", async () => {
      jest.spyOn(CategoryModel, "findByName").mockResolvedValue(null);

      const result = await TransactionValidator.validateCategory(
        "Invalid",
        "income",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak ditemukan");
    });
  });
});
```

### Playwright (E2E Tests)

**Version:** ^1.40.0  
**Purpose:** End-to-end testing with browser automation

**Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    baseURL: process.env.BASE_URL || "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 10. Code Quality & Formatting

### ESLint

**Version:** ^8.50.0  
**Parser:** @typescript-eslint/parser ^8.49.0  
**Plugin:** @typescript-eslint/eslint-plugin ^8.49.0  
**Configuration:** TypeScript strict checking

**Common Rules:**
```javascript
{
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-types": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error",
  },
}
```

### Prettier

**Version:** ^3.0.0  
**Purpose:** Code formatting consistency

**Configuration:**
```javascript
{
  semi: true,
  trailingComma: "es5",
  singleQuote: false,
  printWidth: 80,
  useTabs: false,
  tabWidth: 2,
  arrowParens: "always",
}
```

### Pre-commit Hooks (Husky)

**Version:** ^9.1.7  
**Staged:** lint-staged ^16.2.7  
**Purpose:** Enforce quality before commits

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ],
    "prisma/**/*.prisma": [
      "prettier --write"
    ]
  }
}
```

---

## 11. Build & Deployment

### TypeScript Compiler

**Configuration:** See section 2 (Language & Type System)

**Build Process:**
```bash
npm run build          # Compiles src/ to dist/ with source maps
npm run type-check     # Type check without emitting
```

**Output Structure:**
```
dist/
├── index.js
├── bot/
│   ├── client/
│   ├── handlers/
│   └── middleware/
├── services/
├── models/
├── lib/
├── config/
├── index.d.ts         # Declaration file
└── index.d.ts.map     # Declaration source map
```

### Docker Build

**Multi-stage Production Build:**

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

**Benefits:**
- Small image size (multi-stage)
- Security (non-root user)
- Health checks
- Proper signal handling (dumb-init)
- Database migrations included

---

## 12. Containerization & Orchestration

### Docker Compose

**Version:** 3.8  
**Services:**

```yaml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: cashflow_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: cashflow_bot
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cashflow_user -d cashflow_bot"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    depends_on:
      - bot

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

  bot:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    environment:
      DATABASE_URL: postgresql://cashflow_user:${DB_PASSWORD}@postgres:5432/cashflow_bot
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      TZ: Asia/Makassar
    ports:
      - "3000:3000"
    volumes:
      - ../wwebjs_auth:/app/.wwebjs_auth
      - ../reports:/app/reports
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## 13. Naming Conventions

### Type & Interface Naming

```typescript
// 1. User-facing models
interface User { }
interface Transaction { }
interface Category { }

// 2. Request/Response DTOs
interface CreateTransactionRequest { }
interface TransactionResponse { }
interface CreateUserData { }

// 3. Internal decision types
interface ApprovalDecision { }
interface ValidationResult { }

// 4. Enums
enum UserRole { }
enum TransactionType { }
enum ApprovalStatus { }
```

### Class & Service Naming

```typescript
// Models (data access layer)
class UserModel { }
class TransactionModel { }

// Services (business logic)
class TransactionProcessor { }
class ApprovalService { }
class ReportGenerator { }

// Validators
class TransactionValidator { }

// Handlers (message/event processing)
class MessageHandler { }
class TransactionHandler { }
class ApprovalHandler { }

// Formatters
class MessageFormatter { }
class ReportFormatter { }
```

### Method Naming

```typescript
// Queries
async findById()
async findByUserId()
async findByDateRange()

// Mutations
async create()
async update()
async delete()

// Analysis/Processing
async validate()
async analyze()
async process()

// Formatting
formatCurrency()
formatDateWITA()
formatConfirmationMessage()

// Event handlers
async handleMessage()
async handleButton()
async handleApproval()
```

### File Organization

```
src/
├── index.ts                     # Application entry point
├── bot/
│   ├── client/                  # WhatsApp client
│   │   ├── client.ts            # Main client
│   │   ├── auth.ts              # Authentication
│   │   ├── events.ts            # Event handlers
│   │   └── shutdown.ts          # Graceful shutdown
│   ├── handlers/                # Message handlers
│   │   ├── message.ts           # Message router
│   │   ├── transaction.ts       # Transaction workflow
│   │   ├── approval.ts          # Approval workflow
│   │   ├── report.ts            # Report generation
│   │   └── ...
│   ├── middleware/              # Middleware
│   │   ├── auth.ts              # Authentication
│   │   ├── session.ts           # Session management
│   │   └── rate-limit.ts        # Rate limiting
│   └── ui/                      # UI components
│       ├── buttons.ts           # Button menus
│       ├── lists.ts             # List menus
│       └── messages.ts          # Message formatting
├── services/                    # Business logic
│   ├── transaction/
│   │   ├── processor.ts         # Transaction processing
│   │   ├── validator.ts         # Validation
│   │   ├── approval.ts          # Approval analysis
│   │   └── editor.ts            # Transaction editing
│   ├── report/
│   │   ├── generator.ts         # Report generation
│   │   ├── formatter.ts         # Report formatting
│   │   └── pdf.ts               # PDF generation
│   ├── user/
│   ├── audit/
│   └── ...
├── models/                      # Data access layer
│   ├── user.ts
│   ├── transaction.ts
│   ├── category.ts
│   └── ...
├── lib/                         # Utilities & helpers
│   ├── logger.ts
│   ├── database.ts
│   ├── redis.ts
│   ├── metrics.ts
│   ├── validation.ts
│   ├── currency.ts
│   ├── date.ts
│   └── i18n.ts
└── config/                      # Configuration
    ├── env.ts
    └── constants.ts
```

---

## 14. Common Implementation Patterns

### Service Layer Pattern

```typescript
// Business logic organized in services
export class TransactionProcessor {
  /**
   * Orchestrates entire transaction workflow
   * - Validates input
   * - Analyzes for approval
   * - Persists to database
   * - Logs audit trail
   */
  static async processTransaction(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: string | number;
    description?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    // 1. Validate
    const validation = await TransactionValidator.validateTransaction(data);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    // 2. Analyze
    const amount = parseAmount(String(data.amount));
    const approvalDecision = await ApprovalService.analyzeTransaction(
      data.userId,
      data.type,
      amount,
      data.category,
      data.description,
    );

    // 3. Persist
    const transaction = await TransactionModel.create({
      userId: data.userId,
      type: data.type,
      category: data.category,
      amount,
      description: data.description,
      approvalStatus: approvalDecision.status,
    });

    // 4. Audit
    await AuditLogger.logTransactionCreated(data.userId, transaction.id, {
      type: data.type,
      category: data.category,
      amount: transaction.amount.toNumber(),
    });

    return { success: true, transaction };
  }
}
```

### Error Handling Pattern

```typescript
// Three-level error handling
try {
  // Business logic
  const transaction = await TransactionModel.create(data);
  
  return {
    success: true,
    transaction,
  };
} catch (error) {
  // 1. Log with context
  logger.error("Error processing transaction", {
    error: error instanceof Error ? error.message : String(error),
    data,
    userId: data.userId,
  });

  // 2. Return structured error
  return {
    success: false,
    error:
      error instanceof Error
        ? error.message
        : "Failed to process transaction",
  };
}
```

### Validation Pattern

```typescript
// Three-level validation
static async validateTransaction(data: {
  userId: string;
  type: TransactionType;
  category: string;
  amount: string | number;
  description?: string;
}): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Input validation (format, type)
  const amountValidation = this.validateAmount(data.amount);
  if (!amountValidation.valid) {
    errors.push(amountValidation.error || "Invalid amount");
  }

  // 2. Business logic validation (category match, type)
  const categoryValidation = await this.validateCategory(
    data.category,
    data.type,
  );
  if (!categoryValidation.valid) {
    errors.push(categoryValidation.error || "Invalid category");
  }

  // 3. Additional validation
  const descriptionValidation = this.validateDescription(data.description);
  if (!descriptionValidation.valid) {
    errors.push(descriptionValidation.error || "Invalid description");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 15. Performance Optimization Techniques

### Database Optimization

```typescript
// 1. Connection pooling (already configured in database.ts)
// Min: 5, Max: 50 connections
// Statement timeout: 30 seconds

// 2. Query optimization with indexes
model Transaction {
  @@index([userId])
  @@index([userId, timestamp])
  @@index([approvalStatus])
}

// 3. Eager loading to prevent N+1 queries
const transaction = await prisma.transaction.findUnique({
  where: { id },
  include: {
    user: true,      // Load related user
    approver: true,  // Load approver
  },
});

// 4. Pagination for large results
const transactions = await prisma.transaction.findMany({
  where: { userId },
  take: 10,    // Limit to 10 results
  skip: offset, // Pagination offset
});
```

### Caching Strategy

```typescript
// Cache frequently accessed data
const categories = await redis.getOrSet(
  "categories:active",
  async () => {
    return await CategoryModel.findActive();
  },
  3600, // 1 hour TTL
);
```

### Rate Limiting

```typescript
// Prevent abuse with rate limiting
const messageLimit = await redis.incrementRateLimit(
  `rate-limit:${userId}:messages`,
  60, // 60 second window
);

if (messageLimit > MAX_MESSAGES_PER_MINUTE) {
  await client.sendMessage(
    message.from,
    "⚠️ Anda mengirim terlalu banyak pesan. Silakan tunggu sebentar.",
  );
  return;
}
```

### Session Management

```typescript
// Session cleanup to prevent memory bloat
SessionManager.startCleanupInterval(); // Runs every 5 minutes
// Sessions older than SESSION_TIMEOUT_MS are automatically deleted
```

---

## 16. Security Implementation

### Input Validation

```typescript
// Use Zod for runtime validation
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),
});

const env = envSchema.parse(process.env); // Fails if invalid
```

### Authentication

```typescript
// JWT-based authentication
import jwt from "jsonwebtoken";

const token = jwt.sign(
  { userId: user.id, role: user.role },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN },
);

const decoded = jwt.verify(token, env.JWT_SECRET);
```

### Authorization (RBAC)

```typescript
// Role-based access control
export class ApprovalHandler {
  static async handlePendingApprovals(
    user: User,
    message: Message,
  ): Promise<void> {
    // Only Boss/Dev can approve transactions
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        "❌ Anda tidak memiliki izin untuk operasi ini.",
      );
      return;
    }

    // ... proceed with approval logic
  }
}
```

### Audit Logging

```typescript
// Log all state-changing operations
await AuditLogger.logTransactionCreated(userId, transactionId, {
  type: "income",
  category: "Sales",
  amount: 500000,
  approvalStatus: "approved",
  timestamp: new Date(),
});
```

---

## 17. Testing Implementation Examples

### Unit Test Pattern

```typescript
// tests/unit/services/transaction/validator.test.ts
describe("TransactionValidator", () => {
  describe("validateAmount", () => {
    test("should parse valid amount", () => {
      const result = TransactionValidator.validateAmount("500000");
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(500000);
    });

    test("should reject invalid format", () => {
      const result = TransactionValidator.validateAmount("abc");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateCategory", () => {
    test("should validate matching category", async () => {
      jest.spyOn(CategoryModel, "findByName").mockResolvedValue({
        id: "1",
        name: "Sales",
        type: "income",
        isActive: true,
      } as Category);

      const result = await TransactionValidator.validateCategory(
        "Sales",
        "income",
      );

      expect(result.valid).toBe(true);
    });

    test("should reject non-existent category", async () => {
      jest.spyOn(CategoryModel, "findByName").mockResolvedValue(null);

      const result = await TransactionValidator.validateCategory(
        "Invalid",
        "income",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak ditemukan");
    });
  });
});
```

### Integration Test Pattern

```typescript
// tests/integration/services/transaction/processor.test.ts
describe("TransactionProcessor", () => {
  beforeEach(async () => {
    // Setup test database
    await prisma.$executeRaw`TRUNCATE TABLE transactions CASCADE`;
  });

  test("should process valid transaction end-to-end", async () => {
    const user = await prisma.user.create({
      data: { phoneNumber: "+6212345678", role: "employee" },
    });

    const result = await TransactionProcessor.processTransaction({
      userId: user.id,
      type: "income",
      category: "Sales",
      amount: "500000",
    });

    expect(result.success).toBe(true);
    expect(result.transaction).toBeDefined();
    expect(result.transaction?.approvalStatus).toBe("approved");

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "transaction_created" },
    });
    expect(auditLog).toBeDefined();
  });

  test("should flag suspicious transactions for approval", async () => {
    const user = await prisma.user.create({
      data: { phoneNumber: "+6212345678" },
    });

    const result = await TransactionProcessor.processTransaction({
      userId: user.id,
      type: "income",
      category: "Sales",
      amount: "150000000", // 150 million - suspicious
    });

    expect(result.transaction?.approvalStatus).toBe("pending");
  });
});
```

---

## 18. Technology Stack Summary Table

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | >=20.0.0 | JavaScript runtime |
| **Language** | TypeScript | ^5.0.0 | Type safety |
| **Configuration** | Zod | ^3.22.4 | Schema validation |
| **Database** | PostgreSQL | 15+ | Main data store |
| **ORM** | Prisma | ^5.0.0 | Database access |
| **Cache** | Redis | ^4.6.0 | Sessions, caching |
| **Messaging** | WhatsApp Web.js | ^1.23.0 | WhatsApp integration |
| **Web Framework** | Express | ^5.2.1 | HTTP server |
| **Logging** | Winston | ^3.11.0 | Structured logging |
| **Monitoring** | Prometheus | ^15.1.3 | Metrics collection |
| **Testing** | Jest | ^29.0.0 | Unit/integration tests |
| **E2E Testing** | Playwright | ^1.40.0 | Browser testing |
| **Linting** | ESLint | ^8.50.0 | Code quality |
| **Formatting** | Prettier | ^3.0.0 | Code formatting |
| **Build** | TypeScript | ^5.0.0 | Compilation |
| **Container** | Docker | Latest | Containerization |
| **Orchestration** | Docker Compose | 3.8 | Multi-service orchestration |

---

## 19. Technology Decision Context

### Why These Choices

**Node.js + TypeScript:**
- Strong ecosystem for real-time applications
- Type safety prevents runtime errors
- Performance suitable for WhatsApp message processing
- Node 20 LTS ensures long-term support

**PostgreSQL + Prisma:**
- ACID transactions for financial data consistency
- Prisma provides type-safe ORM with migrations
- Connection pooling handles concurrent users
- TimescaleDB extension enables time-series optimization

**Redis:**
- Fast session storage for user workflows
- Rate limiting without database overhead
- Cache layer for frequently accessed data

**WhatsApp Web.js:**
- Only viable open-source WhatsApp integration
- Browser-based approach avoids API rate limits
- Suitable for small-to-medium deployments

**Prometheus + Grafana:**
- Industry standard monitoring stack
- Observable system performance and errors
- Enables proactive alerting

**Docker + Docker Compose:**
- Development/production parity
- Easy local setup and CI/CD integration
- Infrastructure as code

### Constraints & Trade-offs

**WhatsApp Web.js Limitations:**
- Browser automation overhead (CPU/memory)
- Potential for account bans if misused
- No official WhatsApp API compatibility
- Single account per instance

**Connection Pooling:**
- 50 max connections balances performance vs. resource usage
- Statement timeout prevents long-running queries
- May need adjustment based on actual load

**Language Choice:**
- Node.js single-threaded, CPU-intensive tasks may bottleneck
- Financial accuracy relies on Decimal type, not IEEE float

---

## 20. Development Workflow

### Local Setup

```bash
# Install dependencies
npm install

# Start services
docker-compose -f docker/docker-compose.dev.yml up

# Initialize database
npm run prisma:migrate

# Seed data
npm run prisma:seed

# Start development
npm run dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e
```

### Pre-commit Checks

```bash
# Type checking
npm run type-check

# Linting
npm run lint:fix

# Formatting
npm run format

# Tests (automated by husky)
npm test
```

### Production Deployment

```bash
# Build image
docker build -f docker/Dockerfile -t whatsapp-cashflow-bot:latest .

# Run container
docker run -d \
  -e DATABASE_URL=postgres://... \
  -e REDIS_HOST=redis.example.com \
  -e JWT_SECRET=... \
  -p 3000:3000 \
  whatsapp-cashflow-bot:latest
```

---

## Conclusion

This technology stack blueprint provides a foundation for implementing financial applications with WhatsApp integration. The chosen technologies prioritize:

1. **Type Safety** - TypeScript strict mode prevents entire classes of bugs
2. **Performance** - Connection pooling, caching, and index optimization
3. **Reliability** - ACID transactions, proper error handling, audit trails
4. **Operability** - Comprehensive logging, metrics, and health checks
5. **Security** - Input validation, role-based access control, encrypted secrets

When implementing new features, follow the established patterns, conventions, and testing strategies documented here to maintain consistency and code quality.
