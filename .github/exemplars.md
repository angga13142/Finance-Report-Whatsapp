---
title: "Code Exemplars - WhatsApp Cashflow Bot"
description: "High-quality code examples demonstrating architectural patterns, best practices, and coding standards"
updated: "2025-12-10"
---

# Code Exemplars

This document identifies high-quality, representative code examples that demonstrate our coding standards and patterns. These exemplars serve as reference implementations for maintaining consistency across the codebase.

## Table of Contents

1. [Service Layer Patterns](#service-layer-patterns)
2. [Data Access & ORM Patterns](#data-access--orm-patterns)
3. [Handler & Workflow Patterns](#handler--workflow-patterns)
4. [Middleware & Session Management](#middleware--session-management)
5. [Configuration & Infrastructure](#configuration--infrastructure)
6. [Testing Patterns](#testing-patterns)
7. [Architecture & Design Patterns](#architecture--design-patterns)

---

## Service Layer Patterns

### ✅ Transaction Validator Service

**File**: `src/services/transaction/validator.ts`

**Why Exemplary**:
- Demonstrates class-based service with static methods
- Consistent return object shape: `{ valid: boolean; error?: string; parsed?: number }`
- Proper error handling with try-catch and logging
- Business rule validation with clear error messages
- Proper use of imported utilities (parseAmount, validateAmountRange)

**Key Patterns**:
- Static methods for stateless operations
- Structured error responses for validation
- Logging with context data
- Single responsibility per method
- JSDoc comments on public methods

**Implementation Highlights**:
```typescript
// Consistent validation return structure
static validateAmount(amount: string | number): {
  valid: boolean;
  error?: string;
  parsed?: number;
} {
  try {
    const parsed = parseAmount(String(amount));
    validateAmountRange(parsed, MIN_TRANSACTION_AMOUNT, MAX_TRANSACTION_AMOUNT);
    return { valid: true, parsed: parsed.toNumber() };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid amount format",
    };
  }
}
```

**Related Services**:
- `src/services/transaction/processor.ts` - Transaction recording orchestration
- `src/services/approval/analyzer.ts` - Approval decision logic
- `src/services/report/generator.ts` - Report data aggregation

---

## Data Access & ORM Patterns

### ✅ User Model with Query Optimization

**File**: `src/models/user.ts`

**Why Exemplary**:
- Demonstrates Prisma ORM best practices with TypeScript
- Proper error handling with logging
- Separation of concerns (authentication, lookup, creation)
- Consistent async/await pattern throughout
- Clear, single-responsibility methods

**Key Patterns**:
- Static methods only (stateless data layer)
- Validation before database operations
- Proper error handling with context logging
- Type-safe Prisma operations
- Transaction support for critical operations

**Implementation Highlights**:
```typescript
// Normalized phone number lookup
static async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);
    return await prisma.user.findUnique({
      where: { phoneNumber: normalized },
    });
  } catch (error) {
    logger.error("Error finding user by phone number", {
      error,
      phoneNumber,
    });
    throw error;
  }
}

// Create user with validation
static async create(data: {
  phoneNumber: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}): Promise<User> {
  try {
    validatePhoneNumber(data.phoneNumber);
    const normalized = normalizePhoneNumber(data.phoneNumber);
    
    // Check for duplicates
    const existing = await this.findByPhoneNumber(normalized);
    if (existing) {
      throw new Error("User with this phone number already exists");
    }
    
    return await prisma.user.create({
      data: {
        phoneNumber: normalized,
        name: data.name,
        role: data.role || "employee",
        isActive: data.isActive ?? true,
      },
    });
  } catch (error) {
    logger.error("Error creating user", { error, data });
    throw error;
  }
}
```

**Database Connection Pattern**:
- `src/lib/database.ts` - Connection pooling with Prisma
- Uses: `connection_limit_max: 50, statement_timeout: 30000`
- Proper logging of connection health

---

## Handler & Workflow Patterns

### ✅ Message Handler with State Machine Routing

**File**: `src/bot/handlers/message.ts`

**Why Exemplary**:
- Clear message routing logic using state machine pattern
- Proper authentication middleware integration
- Comprehensive error handling with logging
- Session-based workflow context
- Clean separation of concerns (button vs text vs command)

**Key Patterns**:
- Guard clauses for early returns
- Session state checking before routing
- Proper message type discrimination
- Recovery logic for incomplete workflows
- Clear logging at each routing point

**Implementation Highlights**:
```typescript
// Main message router with clear state machine
static async routeMessage(message: Message): Promise<void> {
  try {
    // 1. Ignore self messages
    if (message.fromMe) {
      return;
    }
    
    // 2. Handle media separately
    if (message.hasMedia) {
      await this.handleMediaMessage(message);
      return;
    }
    
    // 3. Authenticate user
    const authMessage = await AuthMiddleware.attachUser(message);
    if (!authMessage.user) {
      await this.handleUnauthorized(message);
      return;
    }
    
    const user = authMessage.user;
    const body = message.body?.trim().toLowerCase() || "";
    
    // 4. Route based on message type (button vs text vs command)
    if (this.isButtonResponse(message, user)) {
      await ButtonHandler.handleButton(message);
      return;
    }
    
    if (body.startsWith("/")) {
      await this.handleCommand(user, body, message);
      return;
    }
    
    // 5. Check for recovery context
    const hasRecoverable = await SessionManager.hasRecoverableContext(user.id);
    if (hasRecoverable) {
      const handled = await TransactionHandler.handleRecoveryDecision(
        user,
        body,
        message,
      );
      if (handled) {
        return;
      }
    }
    
    // 6. Route to appropriate handler based on session state
    const session = await SessionManager.getSession(user.id);
    
    if (session?.isEditing) {
      await TransactionHandler.handleEditInput(user, body, message);
      return;
    }
    
    if (session?.menu === MENU_STATES.AMOUNT) {
      await TransactionHandler.handleAmountInput(user, body, message);
      return;
    }
    
    // ... other state checks ...
    
    // Default: show main menu
    await this.handleWelcome(user, message);
  } catch (error) {
    logger.error("Error routing message", { error, messageId: message.id._serialized });
  }
}
```

**Related Handlers**:
- `src/bot/handlers/transaction.ts` - Multi-step transaction workflow
- `src/bot/handlers/button.ts` - Button callback handling with debouncing
- `src/bot/handlers/command.ts` - Command routing and execution

---

### ✅ Button Handler with Debouncing

**File**: `src/bot/handlers/button.ts`

**Why Exemplary**:
- Demonstrates middleware composition (auth + debounce)
- Proper button callback routing
- Error recovery with fallback messaging
- Clean delegation to specialized handlers
- Comprehensive state transitions

**Key Patterns**:
- Middleware chaining (authentication → debouncing)
- Button ID discrimination
- User feedback on interactions
- Proper session management
- Error messages with recovery options

**Implementation Highlights**:
```typescript
static async handleButton(message: Message): Promise<void> {
  try {
    const client = getWhatsAppClient();
    if (!client) {
      logger.error("WhatsApp client not initialized");
      return;
    }
    
    // 1. Authenticate user
    const authMessage = await AuthMiddleware.attachUser(message);
    if (!authMessage.user) {
      await client.sendMessage(
        message.from,
        "❌ Akun Anda tidak terdaftar atau tidak aktif. Hubungi admin.",
      );
      return;
    }
    
    const user = authMessage.user;
    
    // 2. Apply debounce middleware
    const debounceResult = await DebounceMiddleware.checkDebounce(
      user.id,
      message.id._serialized,
    );
    
    if (debounceResult.isDebounced) {
      // Silent ignore on debounce
      return;
    }
    
    // 3. Get button ID
    const buttonId = message.selectedButtonId || message.selectedListItem;
    if (!buttonId) {
      logger.warn("Button message without button ID", {
        from: message.from,
      });
      return;
    }
    
    // 4. Route to appropriate handler
    if (buttonId === "transaction") {
      await this.handleTransactionStart(user, message);
    } else if (buttonId === "transaction_income") {
      await this.handleTransactionType(user, "income", message);
    } else if (buttonId === "transaction_expense") {
      await this.handleTransactionType(user, "expense", message);
    } else if (buttonId.startsWith("category_")) {
      // ... category selection ...
    }
  } catch (error) {
    logger.error("Error handling button", { error });
    // Send user-friendly error message
    try {
      const client = getWhatsAppClient();
      if (client) {
        await client.sendMessage(
          message.from,
          "❌ Terjadi kesalahan. Silakan coba lagi dengan /mulai",
        );
      }
    } catch (e) {
      logger.error("Failed to send error message", { error: e });
    }
  }
}
```

---

## Middleware & Session Management

### ✅ Session Manager with Redis State

**File**: `src/bot/middleware/session.ts`

**Why Exemplary**:
- Redis-backed session state management with TTL
- Comprehensive session operations (get, set, update, clear)
- Recovery mechanism for incomplete workflows
- Context data isolation
- Proper error handling with fallbacks

**Key Patterns**:
- Key-based storage with consistent naming
- TTL-based auto-expiration
- Snapshot/recovery for interrupted operations
- Session context preservation
- Cleanup interval for expired sessions

**Implementation Highlights**:
```typescript
/**
 * Get user session state
 */
static async getSession(userId: string): Promise<SessionState | null> {
  try {
    const key = this.getSessionKey(userId);
    const sessionData = await redis.get(key);
    if (!sessionData) {
      return null;
    }
    return JSON.parse(sessionData) as SessionState;
  } catch (error) {
    logger.error("Error getting session", { error, userId });
    return null;
  }
}

/**
 * Set user session state
 */
static async setSession(userId: string, state: SessionState): Promise<void> {
  try {
    const key = this.getSessionKey(userId);
    // Add lastActivityAt timestamp
    const stateWithActivity = {
      ...state,
      lastActivityAt: Date.now(),
    };
    await redis.set(key, JSON.stringify(stateWithActivity), this.TTL_SECONDS);
  } catch (error) {
    logger.error("Error setting session", { error, userId, state });
    throw error;
  }
}

/**
 * Update session state (merge with existing)
 */
static async updateSession(
  userId: string,
  updates: Partial<SessionState>,
): Promise<SessionState> {
  try {
    const current = (await this.getSession(userId)) || {
      menu: MENU_STATES.MAIN,
    };
    const updated = { ...current, ...updates };
    await this.setSession(userId, updated);
    return updated;
  } catch (error) {
    logger.error("Error updating session", { error, userId, updates });
    throw error;
  }
}

/**
 * Start cleanup interval (removes expired sessions)
 */
static startCleanupInterval(): void {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
  }
  
  this.cleanupInterval = setInterval(async () => {
    try {
      // Redis automatically expires keys, but we can add custom cleanup if needed
      logger.debug("Session cleanup interval tick");
    } catch (error) {
      logger.error("Error in session cleanup", { error });
    }
  }, SESSION_TIMEOUT_MS);
}
```

**Related Middleware**:
- `src/bot/middleware/auth.ts` - User authentication middleware
- `src/bot/middleware/debounce.ts` - Button debouncing
- `src/bot/middleware/metrics.ts` - Performance tracking

---

## Configuration & Infrastructure

### ✅ Environment Configuration with Zod

**File**: `src/config/env.ts`

**Why Exemplary**:
- Runtime validation with Zod schema
- Type-safe environment variables
- Default values for optional config
- Transform and pipe for type conversions
- Fail-fast on startup with helpful errors

**Key Patterns**:
- Schema at module level
- SafeParse with error checking
- Transform for type conversion (string → number)
- Pipe for additional validation
- Type exports for TypeScript

**Implementation Highlights**:
```typescript
import { z } from "zod";
import * as dotenv from "dotenv";

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
});

// Validate and parse
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Environment validation failed:", _env.error.errors);
  process.exit(1);
}

export const env = _env.data;

export function validateEnv() {
  return env;
}

export type Env = typeof env;
```

**Related Files**:
- `src/config/constants.ts` - Application-wide constants
- `src/lib/logger.ts` - Winston logger configuration
- `src/lib/database.ts` - Database pool configuration

---

### ✅ Winston Logger with Structured Output

**File**: `src/lib/logger.ts`

**Why Exemplary**:
- Production-grade logging with Winston
- Structured JSON output for parsing
- Multiple transports (console, files)
- Error stack traces included
- Contextual metadata in all logs

**Key Patterns**:
- Format combination: timestamp, errors, JSON/text
- Default metadata for service context
- File rotation for log files
- Exception and rejection handlers
- Environment-aware formatting

**Implementation Highlights**:
```typescript
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
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          }),
        ),
  defaultMeta: {
    service: "whatsapp-cashflow-bot",
    environment: env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});
```

**Usage Examples**:
```typescript
// Structured logging with context
logger.info("User created", { userId: user.id, role: user.role });
logger.error("Failed to process transaction", { error, userId, amount });
logger.warn("Rate limit approaching", { userId, requests: count });
logger.debug("Processing transaction", { txnId, category, amount });
```

---

### ✅ Database Connection Pooling

**File**: `src/lib/database.ts`

**Why Exemplary**:
- Prisma client with connection pooling configuration
- Pool parameters optimized for concurrent transactions
- Connection health checks
- Proper connect/disconnect lifecycle
- Pool statistics for monitoring

**Key Patterns**:
- Connection pool limits (5-50 connections)
- Timeout configurations (10s connect, 30s statement)
- Health check query
- Singleton pattern for client instance
- Error handling with logging

**Implementation Highlights**:
```typescript
/**
 * Database connection pool configuration
 * Optimized for concurrent transactions (50 concurrent users)
 */
const DATABASE_POOL_CONFIG = {
  connection_limit_min: 5,
  connection_limit_max: 50,
  connect_timeout: 10,
  pool_timeout: 10,
  statement_timeout: 30000, // 30 seconds
};

/**
 * Get or create Prisma client with connection pool
 */
export function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }
  
  const connectionString = buildConnectionString();
  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  
  return prismaClient;
}

/**
 * Connect to database with health check
 */
export async function connectDatabase(): Promise<void> {
  const client = getPrismaClient();
  try {
    await client.$connect();
    logger.info("Database connection established");
    
    // Test query
    await client.$queryRaw`SELECT 1`;
    logger.info("Database health check passed");
  } catch (error) {
    logger.error("Failed to connect to database", { error });
    throw error;
  }
}
```

---

## Testing Patterns

### ✅ Unit Test with Currency Validation

**File**: `tests/unit/lib/currency.test.ts`

**Why Exemplary**:
- Clear test organization with `describe` and `it`
- Comprehensive test cases (happy path, edge cases, errors)
- Specific assertions (not just truthiness)
- Test names that describe scenarios
- Both input and output verification

**Key Patterns**:
- Arrange-Act-Assert structure (implicit)
- Edge case coverage (zero, negative, large amounts)
- Format variation testing (comma, dot, Rp prefix)
- Error case handling
- Meaningful assertion messages

**Implementation Highlights**:
```typescript
describe("Currency Utilities", () => {
  describe("formatCurrency", () => {
    it("should format Decimal to Indonesian Rupiah string", () => {
      const amount = new Decimal(500000);
      const result = formatCurrency(amount);
      expect(result).toContain("500.000");
      expect(result).toMatch(/^Rp\s500\.000$/);
    });

    it("should format number to Indonesian Rupiah string", () => {
      const result = formatCurrency(1500000);
      expect(result).toContain("1.500.000");
      expect(result).toMatch(/^Rp\s1\.500\.000$/);
    });

    it("should handle zero amount", () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/^Rp\s0$/);
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-100000);
      expect(result).toContain("100.000");
      expect(result).toContain("-");
    });

    it("should handle very large amounts", () => {
      const result = formatCurrency(1000000000);
      expect(result).toContain("1.000.000.000");
    });
  });

  describe("parseAmount", () => {
    it("should parse plain number string", () => {
      const result = parseAmount("500000");
      expect(result.toNumber()).toBe(500000);
    });

    it("should parse comma-separated thousands", () => {
      const result = parseAmount("500,000");
      expect(result.toNumber()).toBe(500000);
    });

    it("should parse dot-separated thousands", () => {
      const result = parseAmount("1.500.000");
      expect(result.toNumber()).toBe(1500000);
    });

    it("should parse amount with Rp prefix and comma separators", () => {
      const result = parseAmount("Rp 250,000");
      expect(result.toNumber()).toBe(250000);
    });
  });
});
```

**Related Test Files**:
- `tests/integration/database/user.test.ts` - Database operation tests
- `tests/e2e/workflows/transaction-workflow.spec.ts` - End-to-end workflow tests

---

## Architecture & Design Patterns

### ✅ Layered Architecture in Practice

**Exemplary Pattern**: Bot → Service → Model → Database

**Layer Interactions**:

1. **Bot Layer** (`src/bot/handlers/transaction.ts`)
   ```typescript
   // Thin handler - delegates to service
   static async handleAmountInput(user: User, input: string, message: Message) {
     const validation = TransactionValidator.validateAmount(input);
     if (!validation.valid) {
       // Send error to user
       return;
     }
     // Delegate to service
     const result = await TransactionProcessor.processAmount(
       user.id,
       validation.parsed!,
     );
   }
   ```

2. **Service Layer** (`src/services/transaction/processor.ts`)
   ```typescript
   // Business logic - orchestrates models and validations
   static async processAmount(userId: string, amount: number) {
     // Validate business rules
     const session = await SessionManager.getSession(userId);
     // Use model to persist
     const transaction = await TransactionModel.create({
       userId,
       amount,
       // ...
     });
     return transaction;
   }
   ```

3. **Model Layer** (`src/models/transaction.ts`)
   ```typescript
   // Data access - delegates to Prisma
   static async create(data: CreateTransactionData): Promise<Transaction> {
     return await prisma.transaction.create({
       data: {
         userId: data.userId,
         amount: new Decimal(data.amount),
         // ...
       },
     });
   }
   ```

4. **Infrastructure Layer** (`src/lib/database.ts`)
   ```typescript
   // Connection management - Prisma handles actual DB operations
   const prismaClient = getPrismaClient();
   ```

**Key Principles**:
- Clear dependency direction (Bot → Service → Model → Lib)
- No circular dependencies
- Each layer has single responsibility
- Bot layer is thin (mostly delegation)
- Service layer contains business logic
- Model layer handles data operations
- Infrastructure isolated from business logic

### ✅ Domain-Driven Service Organization

**Pattern**: Services organized by business domain, not technical layer

```
src/services/
├── transaction/        # Transaction recording, validation, approval
│   ├── processor.ts   # Orchestration
│   ├── validator.ts   # Input validation
│   ├── approval.ts    # Approval logic
│   └── editor.ts      # Editing operations
│
├── approval/          # Approval workflow (separate domain)
│   ├── analyzer.ts    # Decision logic
│   ├── processor.ts   # Workflow orchestration
│   └── notifier.ts    # Notifications
│
├── report/            # Report generation
│   ├── generator.ts   # Data aggregation
│   ├── formatter.ts   # Output formatting
│   └── scheduler.ts   # Cron scheduling
│
└── user/              # User management & RBAC
    ├── service.ts     # User operations
    ├── auth.ts        # Authentication
    └── rbac.ts        # Authorization
```

**Benefits**:
- Features grouped by business capability
- Clear module boundaries
- Easy to locate feature-related code
- Natural separation of concerns

---

## Consistency Observations

### Naming Conventions

**Classes**: PascalCase
- `UserModel`, `TransactionValidator`, `MessageHandler`

**Functions**: camelCase
- `validateAmount()`, `processTransaction()`, `findUser()`

**Constants**: UPPER_SNAKE_CASE
- `MAX_TRANSACTION_AMOUNT`, `MENU_STATES`, `SESSION_TIMEOUT_MS`

**Files**: camelCase.ts
- `user.ts`, `transaction.ts`, `buttons.ts`

### Error Handling Pattern

```typescript
// Consistent across codebase
try {
  // Operation
  return result;
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("Operation failed", { error, context });
  return { success: false, error: message };
  // OR throw error for handlers
}
```

### Service Response Pattern

```typescript
// Validation responses
{ valid: boolean; error?: string; parsed?: T }

// Operation responses
{ success: boolean; data?: T; error?: string }

// List responses
{ items: T[]; total: number; page: number }
```

### Logging Pattern

```typescript
// Info: Important state transitions
logger.info("User created", { userId, role });

// Warn: Recoverable issues
logger.warn("Rate limit approaching", { userId, count });

// Error: Failures with context
logger.error("Failed to process", { error, userId, amount });

// Debug: Development-level details
logger.debug("Processing transaction", { txnId, category });
```

---

## Recommendations for Maintaining Quality

### Code Review Checklist

- [ ] Follows layered architecture (no cross-layer imports)
- [ ] Proper error handling with logging
- [ ] Consistent naming conventions
- [ ] Single responsibility per function/method
- [ ] Type-safe (no implicit `any`)
- [ ] Async operations properly awaited
- [ ] Session/state management correct
- [ ] Tests included for new functionality

### When Adding New Features

1. **Create Service First**: `src/services/<domain>/<operation>.ts`
   - Define business logic
   - Include validation
   - Add error handling

2. **Create Model Second**: `src/models/<entity>.ts` (if needed)
   - Data access operations
   - Query optimization
   - Type safety

3. **Create Handler Last**: `src/bot/handlers/<feature>.ts`
   - Keep thin, delegate to services
   - Focus on user interaction

4. **Write Tests Simultaneously**:
   - Unit tests for services
   - Integration tests for workflows
   - E2E tests for critical paths

### Performance Considerations

- Database queries < 100ms (with indexes)
- API responses < 500ms (p95)
- Session operations < 50ms (Redis)
- Message processing < 1s

### Security Standards

- All inputs validated (Zod schemas)
- No SQL concatenation (use Prisma)
- No hardcoded secrets (use env vars)
- Proper RBAC checks in services
- Audit logging for critical operations

---

## References

- **Architecture Guide**: `.github/copilot-instructions.md`
- **Technology Stack**: `docs/TECHNOLOGY_STACK_BLUEPRINT.md`
- **Folder Structure**: `docs/PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md`
- **Workflow Documentation**: `docs/WORKFLOW_DOCUMENTATION.md`
- **Testing Guide**: `docs/TESTING_GUIDE.md`

---

**Last Updated**: December 10, 2025  
**Maintained By**: Development Team  
**Review Frequency**: Quarterly or as architectural changes occur
