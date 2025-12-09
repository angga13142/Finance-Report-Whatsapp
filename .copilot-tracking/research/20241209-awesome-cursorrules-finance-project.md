<!-- markdownlint-disable-file -->

# Task Research Notes: Node.js+Express CursorRules for Finance WhatsApp Bot

## Research Executed

### External Research

- #githubRepo:"PatrickJS/awesome-cursorrules" Node.js backend stack investigation
  - Complete Node.js+Express+MongoDB+JWT rule specification retrieved
  - Supporting rules for testing (Jest, Cypress) and code quality identified
  - Code Guidelines and GitHub Instructions patterns documented

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/nodejs-mongodb-jwt-express-react-cursorrules-promp/.cursorrules"
  - Node.js with Express.js, MongoDB with Mongoose ODM, JWT authentication
  - RESTful API best practices, error handling, input validation standards
  - Strategic planning with pseudocode approach for feature development

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/nodejs-mongodb-cursorrules-prompt-file-tutorial/.cursorrules"
  - Identical stack configuration to JWT-based rule
  - Foundation for standard Node.js project structure

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/code-guidelines-cursorrules-prompt-file/.cursorrules"
  - Clean code principles: meaningful names, error handling, test coverage
  - Modular design, version compatibility, security-first approach

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/jest-unit-testing-cursorrules-prompt-file/.cursorrules"
  - Jest testing with TypeScript support auto-detection
  - Mock dependencies, edge case testing, descriptive naming patterns

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/cypress-api-testing-cursorrules-prompt-file/.cursorrules"
  - Cypress API testing for endpoint validation with schema verification
  - Test independence, authentication scenarios, error handling validation

- #fetch:"https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/github-cursorrules-prompt-file-instructions/.cursorrules"
  - Clean code philosophy, readable and maintainable code standards
  - Team collaboration best practices, code quality principles

## Key Discoveries

### Project Alignment

Finance WhatsApp Cashflow Bot matches Node.js+Express stack because:
- **whatsapp-web.js** library uses JavaScript/Node.js ecosystem natively
- **JWT authentication** required for secure financial transaction handling
- **MongoDB/Mongoose** provides flexible document structure for cash flow data
- **RESTful API** patterns essential for WhatsApp bot integration endpoints

### Node.js+Express Tech Stack Specification

**Core Backend:**
- Runtime: Node.js 18+ with Express.js
- Language: JavaScript/TypeScript
- Authentication: JWT (JSON Web Tokens)
- Version Control: Git
- Deployment: Docker

**Primary Database Layer:**
- PostgreSQL 15+ with TimescaleDB extension
- ORM: Prisma 5.x for type-safe database operations
- Alternative: MongoDB with Mongoose ODM (for flexibility)

**Caching & Real-time:**
- Redis 7.x for cache management
- Session storage for WhatsApp bot state
- Rate limiting implementation
- Real-time data synchronization

**Code Quality Standards:**
1. Secure, efficient code following RESTful API best practices
2. Proper error handling and input validation on all endpoints
3. Strategic planning with detailed pseudocode before feature coding
4. Meaningful variable/function names conveying purpose
5. Modular design encouraging reusability
6. Edge case handling (null values, undefined, unexpected types)
7. Consistent formatting and style throughout codebase

## Extended Tech Stack Details

### PostgreSQL 15+ with TimescaleDB

**Purpose:** Primary time-series database for cash flow tracking
- **TimescaleDB Extension:** Optimized for financial transaction history and time-series analytics
- **Advantages:** 
  - Hyper-compression for large datasets (90%+ reduction)
  - Fast aggregations and queries on time-series data
  - Native support for continuous aggregates
  - Multi-dimensional data retention policies

**Use Cases for Finance Bot:**
```sql
-- Transaction history with timestamp
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type VARCHAR(10) NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('transactions', 'time', if_not_exists => TRUE);

-- Daily cash flow aggregates
SELECT
  time_bucket('1 day', time) as day,
  user_id,
  SUM(amount) as daily_total
FROM transactions
GROUP BY day, user_id;
```

### Prisma 5.x ORM

**Purpose:** Type-safe database operations with full TypeScript support
- **Key Features:**
  - Auto-generated types from schema
  - Type-safe query builder
  - Built-in migrations with rollback
  - Native PostgreSQL support with advanced features
  - Relation querying and aggregations

**Schema Example for Finance Bot:**
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(cuid())
  whatsappId String  @unique
  name      String
  balance   Decimal  @default(0) @db.Decimal(12, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions Transaction[]
  sessions     Session[]
  @@map("users")
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  amount    Decimal  @db.Decimal(12, 2)
  type      String   // 'inflow' | 'outflow'
  category  String
  reference String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("transactions")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  state     Json     // Store WhatsApp conversation state
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("sessions")
}
```

**Prisma Usage Patterns:**
```typescript
// Type-safe transaction creation
const transaction = await prisma.transaction.create({
  data: {
    userId: 'user123',
    amount: new Decimal('1000.50'),
    type: 'inflow',
    category: 'salary',
  },
});

// Efficient relation queries
const userWithTransactions = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    transactions: {
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    },
  },
});

// Aggregations
const monthlyStats = await prisma.transaction.groupBy({
  by: ['type'],
  where: { createdAt: { gte: monthStart } },
  _sum: { amount: true },
  _count: true,
});
```

### Redis 7.x Caching Layer

**Purpose:** High-performance caching and session management
- **Key Features:**
  - In-memory data structure store
  - Atomic operations for rate limiting
  - Pub/Sub for real-time updates
  - Automatic expiration (TTL)
  - Data persistence with RDB/AOF

**Use Cases for WhatsApp Bot:**
```typescript
// Session state management
await redis.setex(
  `session:${userId}`,
  3600, // 1 hour TTL
  JSON.stringify(conversationState)
);

// Rate limiting (token bucket)
const rateLimitKey = `ratelimit:${userId}:${new Date().getHours()}`;
const requestCount = await redis.incr(rateLimitKey);
if (requestCount === 1) {
  await redis.expire(rateLimitKey, 3600);
}

// User balance cache
await redis.setex(
  `balance:${userId}`,
  300, // 5 minute cache
  user.balance.toString()
);

// Pub/Sub for balance updates
await redis.publish(`user:${userId}:balance-changed`, JSON.stringify({
  userId,
  newBalance: updatedUser.balance,
  timestamp: new Date(),
}));
```

**Configuration Pattern:**
```typescript
// lib/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));
```

### Integration Architecture

**Data Flow:**
1. **Express API** → Receives WhatsApp message via webhook
2. **Prisma ORM** → Queries/updates PostgreSQL with type-safety
3. **TimescaleDB** → Stores time-series transaction data
4. **Redis Cache** → Sessions, rate limits, balance cache
5. **Response** → Send WhatsApp reply with current state

**Example Endpoint:**
```typescript
// routes/transactions.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

router.post('/api/transactions', async (req, res) => {
  try {
    const { userId, amount, type, category } = req.body;

    // Validate and create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: new Decimal(amount),
        type,
        category,
      },
    });

    // Update and cache user balance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: type === 'inflow' ? amount : -amount,
        },
      },
    });

    // Invalidate cache
    await redis.del(`balance:${userId}`);
    
    // Publish real-time update
    await redis.publish(`user:${userId}:balance-changed`, JSON.stringify({
      newBalance: updatedUser.balance,
      transaction: transaction,
    }));

    res.json({ success: true, transaction, balance: updatedUser.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### Testing Strategy

**Jest Unit Testing (Critical Functionality):**
```javascript
// Mock dependencies before imports
jest.mock('../database/models');

// Test business logic with valid/invalid/edge case scenarios
describe('TransactionService', () => {
  it('should process cash flow transaction correctly', () => {
    // Arrange: Setup test data
    const transaction = { 
      amount: 1000, 
      type: 'inflow', 
      userId: 'user123' 
    };
    
    // Act: Execute function
    const result = processTransaction(transaction);
    
    // Assert: Verify expected behavior
    expect(result.status).toBe('completed');
    expect(result.balance).toBe(1000);
  });

  it('should reject invalid transaction amounts', () => {
    expect(() => processTransaction({ amount: -500 }))
      .toThrow('Amount must be positive');
  });

  it('should handle missing required fields', () => {
    expect(() => processTransaction({ type: 'inflow' }))
      .toThrow('Missing required fields');
  });
});
```

**Cypress API Testing (Endpoint Validation):**
- Validate critical API endpoints with schema verification
- Test authenticated and unauthenticated requests
- Verify status codes for success and error scenarios
- Validate error messages for invalid requests
- Ensure test independence and deterministic behavior

### Code Guidelines Integration

**Clean Code Principles:**
- Use named constants instead of hard-coded values (discount rates, limits, thresholds)
- Meaningful variable names with context (isApproved, hasPermission, userBalance)
- Short, focused functions with single responsibility
- Clear comments only where intent is non-obvious
- Consistent formatting and naming conventions

**Security Requirements (Critical for Financial Operations):**
- Input validation on all endpoints
- Secure JWT token handling and verification
- Error handling without exposing sensitive information
- Rate limiting for transaction endpoints
- Audit logging for financial operations

### GitHub Workflow Standards

**Repository Best Practices:**
- Clean code focused on readability and maintainability
- Team collaboration through consistent conventions
- Code review processes for quality assurance
- Debugging efficiency through clear structure
- Reduced bug introduction through established patterns

## Recommended Implementation

### Combined CursorRules Approach

Create unified `.cursorrules` file combining:

1. **Primary Foundation:** Node.js+Express+MongoDB+JWT
2. **Code Quality Layer:** Clean code guidelines and best practices
3. **Testing Standards:** Jest unit testing and Cypress API testing
4. **Repository Standards:** GitHub collaboration patterns

### Core Cursor Rule Components

**1. Tech Stack Declaration:**
- Backend: Node.js 18+ + Express.js
- Database: PostgreSQL 15+ with TimescaleDB
- ORM: Prisma 5.x (type-safe database operations)
- Cache/Session: Redis 7.x
- Authentication: JWT
- Alternative Database: MongoDB + Mongoose (for flexibility)
- Testing: Jest, Cypress

**2. Prisma ORM Directives:**
- Use Prisma 5.x as primary database layer
- Auto-generate types from schema for type-safety
- Implement migrations for schema changes
- Use decimal types for financial amounts (no float)
- Index frequently queried fields (userId, timestamps)
- Prefer relation queries over raw SQL
- Implement soft deletes where applicable

**3. PostgreSQL + TimescaleDB Standards:**
- TimescaleDB hypertables for time-series transaction data
- Proper constraint design (NOT NULL, UNIQUE, FOREIGN KEY)
- Indexing strategy for performance (B-tree for ranges, Hash for equality)
- Continuous aggregates for financial analytics
- Retention policies for historical data
- Full ACID compliance for financial transactions

**4. Redis Caching Patterns:**
- Session state with TTL (1 hour default)
- User balance caching (5 minute invalidation)
- Rate limiting using token bucket algorithm
- Pub/Sub for real-time balance updates
- Graceful degradation if Redis is unavailable
- Key naming convention: `{resource}:{id}:{operation}`

**5. Code Quality Directives:**
- RESTful API best practices
- Error handling on all operations
- Input validation requirements
- Meaningful naming conventions
- Modular architecture
- Decimal arithmetic for financial values

**6. Testing Requirements:**
- Unit tests for business logic (Jest)
- API endpoint tests with schema validation (Cypress)
- Mock external dependencies (Prisma, Redis)
- Edge case coverage (null amounts, invalid users)
- Descriptive test names

**7. Security Standards:**
- JWT token verification on protected routes
- Input sanitization (SQL injection prevention via Prisma)
- Error handling without exposing sensitive information
- Rate limiting implementation via Redis
- Audit logging for all financial transactions
- Transaction rollback on errors

## Implementation Guidance

### Docker Compose Configuration

**Complete Stack Setup:**
```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL with TimescaleDB
  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: finance_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: finance_bot
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U finance_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Express API
  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://finance_user:${DB_PASSWORD}@postgres:5432/finance_bot
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      WHATSAPP_API_KEY: ${WHATSAPP_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Run Prisma migrations
RUN npx prisma migrate deploy

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Objectives

1. Create unified `.cursorrules` file for Node.js+Express WhatsApp bot
2. Establish Prisma 5.x ORM patterns for PostgreSQL type-safety
3. Implement PostgreSQL 15+ with TimescaleDB for time-series transactions
4. Configure Redis 7.x for caching and session management
5. Define comprehensive security and financial transaction standards
6. Document team coding standards and quality practices

### Key Tasks

1. **Analyze Project Structure** - Examine existing Finance project setup
2. **Configure Database Layer** - Prisma schema with PostgreSQL/TimescaleDB
3. **Setup Caching** - Redis connection and session management
4. **Fetch Component Rules** - Download Node.js and testing rules
5. **Customize for Project** - Adapt rules to Finance bot specifications
6. **Create Unified `.cursorrules`** - Merge components into single config file
7. **Docker Compose Setup** - Containerize complete development stack
8. **Validate Configuration** - Ensure Cursor IDE recognizes all standards
9. **Team Documentation** - Share with development team

### Dependencies

- Cursor AI editor with `.cursorrules` support
- Node.js 18+ and npm/yarn package manager
- PostgreSQL 15+ with TimescaleDB extension
- Redis 7.x instance
- Prisma 5.x package
- Docker & Docker Compose
- Project specifications from `/specs/004-whatsapp-cashflow-bot/`
- Team agreement on coding standards

### Success Criteria

- Unified `.cursorrules` file created in project root
- Prisma schema defined for PostgreSQL with type-safe operations
- Redis caching layer configured for sessions and rate limiting
- TimescaleDB hypertables set up for transaction analytics
- Docker Compose runs full development stack
- Cursor AI applies rules to generated Express endpoints
- All code follows security and input validation patterns
- Jest tests auto-generate for business logic
- Cypress tests validate API contracts
- Team consistently applies standards across pull requests

