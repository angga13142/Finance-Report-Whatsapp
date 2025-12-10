# Project Folder Structure Blueprint

**Project:** WhatsApp Cashflow Reporting Chatbot  
**Analysis Date:** December 10, 2025  
**Project Type:** Node.js/TypeScript (Monolithic Backend)  
**Architecture:** Layered (Handlers → Services → Models → Database)

---

## 1. Structural Overview

The WhatsApp Cashflow Bot is a **Node.js/TypeScript monolithic backend application** organized using a **layered architecture** combined with **feature-based organization** at the services level.

**Key Architectural Principles:**

1. **Layered Architecture:**
   - **Bot Layer** (handlers/middleware/UI) - WhatsApp message handling and routing
   - **Service Layer** (services/*) - Business logic and domain-specific operations
   - **Model Layer** (models/*) - Data access and domain entity definitions
   - **Infrastructure Layer** (lib/*) - Cross-cutting concerns (logging, caching, database, validation)

2. **Feature-Based Organization:**
   - Services are organized by business domain (transaction, approval, report, user, etc.)
   - Each domain typically contains processor/validator/service implementations
   - Related business logic is co-located for ease of discovery

3. **Separation of Concerns:**
   - Configuration is centralized (config/)
   - Utilities and helpers are in lib/
   - Model classes encapsulate data access patterns
   - Services contain pure business logic
   - Handlers manage WhatsApp message routing and flow

4. **Technology Decisions:**
   - Single-process Node.js application (WhatsApp Web.js requires single instance)
   - TypeScript for type safety throughout
   - Express for minimal HTTP endpoints (health/metrics)
   - Prisma for ORM with PostgreSQL
   - Redis for session/cache management

---

## 2. Directory Visualization

```
Finance/                              # Root project directory
├── .github/                           # GitHub configuration and documentation
│   ├── copilot-instructions.md       # Global Copilot configuration
│   ├── instructions/                 # Detailed coding/deployment instructions
│   ├── prompts/                      # Custom Copilot prompts
│   ├── agents/                       # Copilot agent definitions
│   ├── collections/                  # Copilot collection configurations
│   └── workflows/                    # GitHub Actions workflow definitions
│
├── docker/                            # Container and orchestration
│   ├── Dockerfile                    # Multi-stage production build
│   ├── docker-compose.yml            # Production services
│   ├── docker-compose.dev.yml        # Development services
│   └── prometheus.yml                # Prometheus monitoring config
│
├── docs/                              # Project documentation
│   ├── WORKFLOW_DOCUMENTATION.md     # Feature workflow definitions
│   ├── TECHNOLOGY_STACK_BLUEPRINT.md # Technology stack reference
│   ├── api/                          # API documentation
│   └── HUSKY_SETUP.md               # Git hooks documentation
│
├── infra/                             # Infrastructure as Code
│   ├── bicep/                        # Azure bicep templates (optional)
│   └── grafana/                      # Grafana dashboard definitions
│       └── system-overview-dashboard.json
│
├── prisma/                            # Database ORM configuration
│   ├── schema.prisma                 # Database schema definition
│   ├── seed.ts                       # Database seeding script
│   ├── migrations/                   # Database migration history
│   │   ├── migration_lock.toml
│   │   └── 20251209233846_init/      # Initial migration
│   │       ├── migration.sql
│   │       └── timescaledb_setup.sql
│
├── scripts/                           # Utility and build scripts
│   └── preflight/                    # Pre-build checks
│       ├── check-node-version.js
│       ├── check-build-prerequisites.js
│       ├── check-start-prerequisites.js
│       ├── check-publish-prerequisites.js
│       └── utils.js
│
├── specs/                             # Specification and requirements
│   └── 004-whatsapp-cashflow-bot/    # Feature specification
│       ├── spec.md                   # Detailed specification
│       ├── plan.md                   # Implementation plan
│       ├── quickstart.md             # Quick start guide
│       ├── data-model.md             # Data model specification
│       ├── research.md               # Research and analysis
│       ├── tasks.md                  # Task breakdown
│       ├── APPROVAL_WORKFLOW_VERIFICATION.md
│       ├── checklists/               # Verification checklists
│       │   ├── api-contracts.md
│       │   ├── data-model.md
│       │   ├── deployment-operations.md
│       │   ├── functional-requirements.md
│       │   ├── non-functional-requirements.md
│       │   ├── requirements.md
│       │   ├── security-authentication.md
│       │   └── testing-requirements.md
│       └── contracts/                # API contracts
│           ├── internal-api-contracts.yaml
│           └── whatsapp-message-contracts.yaml
│
├── src/                               # Source code
│   ├── index.ts                      # Application entry point
│   │
│   ├── bot/                          # WhatsApp bot integration layer
│   │   ├── client/                   # WhatsApp client management
│   │   │   ├── client.ts             # Client initialization and management
│   │   │   ├── auth.ts               # Authentication strategy
│   │   │   ├── events.ts             # Event handler registration
│   │   │   └── shutdown.ts           # Graceful shutdown handling
│   │   │
│   │   ├── handlers/                 # Message handlers and routers
│   │   │   ├── message.ts            # Main message router (dispatcher)
│   │   │   ├── command.ts            # Command parsing and routing
│   │   │   ├── button.ts             # Button interaction handler
│   │   │   ├── transaction.ts        # Transaction workflow handler
│   │   │   ├── approval.ts           # Approval workflow handler
│   │   │   ├── report.ts             # Report request handler
│   │   │   ├── admin.ts              # Admin command handler
│   │   │   ├── investor.ts           # Investor-specific handler
│   │   │   ├── profile.ts            # User profile handler
│   │   │   └── recommendation.ts     # Recommendation handler
│   │   │
│   │   ├── middleware/               # Message processing middleware
│   │   │   ├── auth.ts               # User authentication/session
│   │   │   ├── rate-limit.ts         # Rate limiting middleware
│   │   │   ├── session.ts            # Session management
│   │   │   └── ...                   # Other middleware
│   │   │
│   │   └── ui/                       # UI message components
│   │       ├── buttons.ts            # Interactive button menus
│   │       ├── lists.ts              # List selection menus
│   │       ├── messages.ts           # Message templates
│   │       └── formatters.ts         # UI formatting helpers
│   │
│   ├── services/                     # Business logic layer (domain-based)
│   │   ├── transaction/              # Transaction processing domain
│   │   │   ├── processor.ts          # Transaction orchestration
│   │   │   ├── validator.ts          # Input validation logic
│   │   │   ├── approval.ts           # Approval decision logic
│   │   │   └── editor.ts             # Transaction editing logic
│   │   │
│   │   ├── user/                     # User management domain
│   │   │   ├── service.ts            # User service operations
│   │   │   ├── auth.ts               # Authentication logic
│   │   │   └── rbac.ts               # Role-based access control
│   │   │
│   │   ├── approval/                 # Approval workflow domain
│   │   │   ├── analyzer.ts           # Approval analysis logic
│   │   │   ├── notifier.ts           # Approval notification
│   │   │   └── processor.ts          # Approval processing
│   │   │
│   │   ├── report/                   # Report generation domain
│   │   │   ├── generator.ts          # Report data aggregation
│   │   │   ├── formatter.ts          # Report formatting (text, PDF, Excel)
│   │   │   ├── pdf.ts                # PDF generation
│   │   │   └── scheduler.ts          # Scheduled report delivery
│   │   │
│   │   ├── notification/             # Notification domain
│   │   │   ├── service.ts            # Notification orchestration
│   │   │   └── templates.ts          # Notification message templates
│   │   │
│   │   ├── recommendation/           # Recommendation analysis domain
│   │   │   ├── analyzer.ts           # Recommendation algorithms
│   │   │   ├── evaluator.ts          # Recommendation evaluation
│   │   │   └── detector.ts           # Anomaly/pattern detection
│   │   │
│   │   ├── audit/                    # Audit logging domain
│   │   │   ├── logger.ts             # Audit trail recording
│   │   │   └── query.ts              # Audit log querying
│   │   │
│   │   ├── data/                     # Data processing/transformation
│   │   │   ├── aggregator.ts         # Data aggregation
│   │   │   ├── transformer.ts        # Data transformation
│   │   │   └── validator.ts          # Business rule validation
│   │   │
│   │   ├── scheduler/                # Job scheduling domain
│   │   │   ├── manager.ts            # Cron job management
│   │   │   ├── tasks.ts              # Scheduled task definitions
│   │   │   └── executor.ts           # Task execution
│   │   │
│   │   └── system/                   # System-level services
│   │       ├── health.ts             # Health check logic
│   │       ├── metrics.ts            # Metrics collection
│   │       └── maintenance.ts        # System maintenance tasks
│   │
│   ├── models/                       # Data access layer (ORM models)
│   │   ├── user.ts                   # User data access
│   │   ├── transaction.ts            # Transaction data access
│   │   ├── category.ts               # Category data access
│   │   ├── report.ts                 # Report data access
│   │   ├── recommendation.ts         # Recommendation data access
│   │   ├── audit.ts                  # Audit log data access
│   │   └── ...                       # Other entity models
│   │
│   ├── lib/                          # Infrastructure and utilities
│   │   ├── logger.ts                 # Winston logging configuration
│   │   ├── database.ts               # Prisma client and connection pooling
│   │   ├── redis.ts                  # Redis client and helper functions
│   │   ├── metrics.ts                # Prometheus metrics definitions
│   │   ├── cache.ts                  # Caching utilities
│   │   ├── currency.ts               # Currency parsing and formatting
│   │   ├── date.ts                   # Date/time utilities (WITA timezone)
│   │   ├── validation.ts             # Input validation helpers
│   │   ├── query-optimization.ts     # Database query optimization
│   │   ├── i18n.ts                   # Internationalization (Indonesian)
│   │   └── constants.ts              # Application constants
│   │
│   └── config/                       # Configuration
│       ├── env.ts                    # Environment variable schema (Zod)
│       └── constants.ts              # Application constants and defaults
│
├── tests/                             # Test suites
│   ├── README.md                     # Testing guide
│   ├── setup.ts                      # Jest setup and fixtures
│   │
│   ├── unit/                         # Unit tests (isolated component tests)
│   │   ├── lib/                      # Library/utility tests
│   │   │   ├── logger.test.ts
│   │   │   ├── currency.test.ts
│   │   │   ├── date.test.ts
│   │   │   └── validation.test.ts
│   │   │
│   │   ├── models/                   # Model layer tests
│   │   │   ├── transaction.test.ts
│   │   │   ├── user.test.ts
│   │   │   └── category.test.ts
│   │   │
│   │   └── services/                 # Service layer tests
│   │       ├── transaction/
│   │       │   ├── validator.test.ts
│   │       │   ├── processor.test.ts
│   │       │   └── approval.test.ts
│   │       └── ...
│   │
│   ├── integration/                  # Integration tests
│   │   ├── database/                 # Database integration tests
│   │   │   ├── transaction.test.ts
│   │   │   └── migrations.test.ts
│   │   │
│   │   ├── redis/                    # Redis integration tests
│   │   │   └── session.test.ts
│   │   │
│   │   ├── wwebjs/                   # WhatsApp Web.js integration
│   │   │   └── client.test.ts
│   │   │
│   │   ├── scheduler/                # Scheduler integration
│   │   │   └── tasks.test.ts
│   │   │
│   │   ├── system/                   # System-wide integration
│   │   │   └── health-check.test.ts
│   │   │
│   │   ├── load/                     # Load testing
│   │   │   └── message-processing.test.ts
│   │   │
│   │   └── success-criteria/         # Acceptance criteria tests
│   │       └── workflows.test.ts
│   │
│   └── e2e/                          # End-to-end tests (Playwright)
│       ├── workflows/                # Complete workflow scenarios
│       │   ├── transaction-workflow.spec.ts
│       │   ├── approval-workflow.spec.ts
│       │   └── report-workflow.spec.ts
│       │
│       ├── roles/                    # Role-based access tests
│       │   ├── employee.spec.ts
│       │   ├── boss.spec.ts
│       │   ├── investor.spec.ts
│       │   └── dev.spec.ts
│       │
│       └── success-criteria/         # User acceptance tests
│           └── requirements.spec.ts
│
├── logs/                              # Runtime logs (generated)
│   ├── error.log
│   ├── combined.log
│   └── ...
│
├── dist/                              # Compiled output (generated)
│   ├── index.js
│   ├── bot/
│   ├── services/
│   ├── models/
│   ├── lib/
│   ├── config/
│   └── ...
│
├── node_modules/                      # Dependencies (generated)
│   └── ...
│
├── .github/                           # (See above)
│
├── .husky/                            # Git hooks
│   ├── pre-commit              # Runs lint-staged
│   └── commit-msg
│
├── .vscode/                           # VS Code configuration
│   └── settings.json
│
├── .env.example                       # Environment variables template
├── .env                               # Environment variables (local, git-ignored)
├── .eslintrc.js                       # ESLint configuration
├── .eslintignore                      # ESLint ignore patterns
├── .lintstagedrc.js                   # Lint-staged configuration
├── .gitignore                         # Git ignore patterns
├── .cursorrules                       # Cursor/Claude rules
│
├── jest.config.js                     # Jest testing configuration
├── playwright.config.ts               # Playwright E2E configuration
├── tsconfig.json                      # TypeScript configuration
├── tsconfig.test.json                 # TypeScript test configuration
├── package.json                       # Project dependencies and scripts
├── package-lock.json                  # Dependency lock file
│
├── README.md                          # Project README
├── CURSORRULES_DEPLOYMENT_GUIDE.md    # Deployment guide
└── site.md                            # Site/documentation
```

---

## 3. Key Directory Analysis

### Bot Layer (`src/bot/`)

**Purpose:** WhatsApp integration and message handling orchestration

**Organization:**
- **client/** - WhatsApp Web.js client initialization and lifecycle management
  - Single client instance shared application-wide
  - Handles authentication, initialization, and graceful shutdown
  - Manages Puppeteer browser automation

- **handlers/** - Message routing and workflow dispatch
  - `message.ts` - Central message router dispatches to appropriate handlers
  - Feature-specific handlers (transaction, approval, report, etc.)
  - Each handler manages its specific workflow state machine
  - Implements RBAC (role-based access control) checks

- **middleware/** - Pre-processing and cross-cutting concerns
  - Session management - retrieves/stores user context in Redis
  - Authentication - validates user identity and permissions
  - Rate limiting - prevents abuse and DoS attacks
  - Can be chained for multiple concerns

- **ui/** - WhatsApp interactive UI components
  - Button menus for user choices
  - List selections for categorization
  - Message templates with formatting
  - Consistent UI patterns across features

### Services Layer (`src/services/`)

**Purpose:** Business logic organized by domain

**Organization Pattern:** Feature-based (domain-driven)
- Each subdirectory represents a business domain
- Domains contain related processors, validators, and analyzers
- Services are stateless and can be tested in isolation

**Key Domains:**

| Domain | Purpose | Key Files |
|--------|---------|-----------|
| transaction | Transaction recording, validation, approval analysis | processor.ts, validator.ts, approval.ts, editor.ts |
| user | User management, authentication, RBAC | service.ts, auth.ts, rbac.ts |
| approval | Approval workflow logic and notifications | analyzer.ts, notifier.ts, processor.ts |
| report | Report generation, formatting, scheduling | generator.ts, formatter.ts, pdf.ts, scheduler.ts |
| recommendation | Anomaly detection, pattern recognition | analyzer.ts, evaluator.ts, detector.ts |
| notification | Message/notification delivery orchestration | service.ts, templates.ts |
| audit | Audit trail recording and querying | logger.ts, query.ts |
| data | Data transformation and aggregation | aggregator.ts, transformer.ts, validator.ts |
| scheduler | Cron job management and execution | manager.ts, tasks.ts, executor.ts |
| system | System health and maintenance | health.ts, metrics.ts, maintenance.ts |

**Naming Pattern:** `<domain>/<operation>.<ts>`
- Operations: processor, validator, analyzer, formatter, service, manager
- Examples: `transaction/validator.ts`, `report/generator.ts`, `user/rbac.ts`

### Models Layer (`src/models/`)

**Purpose:** Data access and ORM integration

**Each Model File Contains:**
- Data access methods (CRUD operations)
- Query optimization with Prisma
- Entity-specific database operations
- Type-safe Prisma client usage

**File Organization:**
- One file per major entity (user, transaction, category, etc.)
- Class-based models with static methods for data access
- Methods organized by operation type (create, find, update, delete, query)

**Example (TransactionModel):**
```
- findById() - Get single transaction with relations
- findByUserId() - Get user's transactions (paginated)
- findTodayTransactions() - Query by date range
- create() - Insert new transaction
- update() - Modify existing transaction
- delete() - Remove transaction
```

### Infrastructure Layer (`src/lib/`)

**Purpose:** Cross-cutting concerns and utilities

| File | Purpose | Key Exports |
|------|---------|------------|
| logger.ts | Winston logging | logger instance |
| database.ts | Prisma ORM client | getPrismaClient(), connection pooling |
| redis.ts | Redis client & helpers | getRedisClient(), redis utility functions |
| metrics.ts | Prometheus metrics | Counter, Histogram, Gauge instances |
| cache.ts | Caching utilities | getOrSet(), invalidate() |
| currency.ts | Currency parsing | parseAmount(), formatCurrency() |
| date.ts | Date/time utilities | formatDateWITA(), getDayRange() |
| validation.ts | Input validation | validatePhoneNumber(), normalizeInput() |
| query-optimization.ts | Database optimization | Query optimization patterns |
| i18n.ts | Internationalization | Indonesian message templates |
| constants.ts | Application constants | REGEX patterns, defaults, limits |

### Configuration (`src/config/`)

**Purpose:** Environment and application configuration

**Files:**
- `env.ts` - Zod schema for environment variable validation
  - Validates on application startup
  - Provides typed access throughout application
  - Includes sensible defaults

- `constants.ts` - Application constants
  - Regex patterns (phone, amount)
  - Default values
  - System limits (rate limiting, timeouts)
  - Category definitions

---

## 4. File Placement Patterns

### Configuration Files

```
Location Patterns:
- Environment variables: src/config/env.ts (Zod schema)
- Constants: src/config/constants.ts
- Database config: prisma/schema.prisma
- Build config: tsconfig.json, jest.config.js, playwright.config.ts
- Git hooks: .husky/
- Linting: .eslintrc.js, .lintstagedrc.js
- Container: docker/Dockerfile, docker/docker-compose.yml
```

### Model/Entity Definitions

```
Location Pattern: src/models/<entity>.ts
Examples:
- User entity: src/models/user.ts
- Transaction entity: src/models/transaction.ts
- Category entity: src/models/category.ts

Database schema: prisma/schema.prisma
- All entity definitions in single file
- Relationships defined with @relation directives
- Indexes and constraints defined in schema
```

### Business Logic

```
Location Pattern: src/services/<domain>/<operation>.ts
Examples:
- Transaction validation: src/services/transaction/validator.ts
- Transaction processing: src/services/transaction/processor.ts
- Approval analysis: src/services/approval/analyzer.ts
- Report generation: src/services/report/generator.ts

Guidelines:
- Each service contains domain-specific logic
- Services are stateless and testable
- Complex operations orchestrated in processor/manager files
```

### Interface Definitions

```
Location Patterns:
- Database models: Prisma schema (prisma/schema.prisma)
- TypeScript interfaces: Inlined in model or service files
- API contracts: specs/*/contracts/*.yaml
- Type definitions: Exported from their respective files
```

### Test Files

```
Location Patterns:
- Unit tests: tests/unit/[matching-src-structure]/<file>.test.ts
- Integration tests: tests/integration/<domain>/[feature].test.ts
- E2E tests: tests/e2e/<workflow>/[scenario].spec.ts

Example Mappings:
- src/lib/validation.ts → tests/unit/lib/validation.test.ts
- src/services/transaction/validator.ts → tests/unit/services/transaction/validator.test.ts
- Database operations → tests/integration/database/transaction.test.ts
- Complete workflow → tests/e2e/workflows/transaction-workflow.spec.ts
```

### Documentation Files

```
Location Patterns:
- README files: docs/README.md, tests/README.md
- API docs: docs/api/[endpoint].md
- Architecture decisions: docs/ARCHITECTURE.md
- Setup guides: docs/SETUP.md, docs/HUSKY_SETUP.md
- Workflow docs: docs/WORKFLOW_DOCUMENTATION.md
- Tech stack: docs/TECHNOLOGY_STACK_BLUEPRINT.md
```

### Script Files

```
Location Pattern: scripts/[category]/[script].js
Examples:
- Node version check: scripts/preflight/check-node-version.js
- Build prerequisites: scripts/preflight/check-build-prerequisites.js
- Shared utilities: scripts/preflight/utils.js
```

---

## 5. Naming and Organization Conventions

### File Naming Patterns

#### TypeScript Source Files
- **Classes/Models:** `<entity>.ts`
  - Examples: `user.ts`, `transaction.ts`, `category.ts`
  - PascalCase for exported classes: `UserModel`, `TransactionModel`

- **Services/Logic:** `<operation>.ts`
  - Examples: `validator.ts`, `processor.ts`, `analyzer.ts`, `formatter.ts`
  - camelCase for exported functions/services: `processTransaction()`, `validateAmount()`

- **Configuration:** `<purpose>.ts`
  - Examples: `env.ts`, `constants.ts`

- **Utilities/Helpers:** `<category>.ts`
  - Examples: `logger.ts`, `database.ts`, `redis.ts`, `cache.ts`

#### Test Files
- **Unit tests:** `<source>.test.ts`
  - Example: `validation.test.ts` for `validation.ts`

- **Integration tests:** `<feature>.test.ts`
  - Example: `transaction.test.ts` for transaction integration

- **E2E tests:** `<workflow>.spec.ts`
  - Example: `transaction-workflow.spec.ts`

#### Configuration Files
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest testing configuration
- `playwright.config.ts` - Playwright E2E configuration
- `.eslintrc.js` - ESLint configuration
- `.lintstagedrc.js` - Lint-staged configuration

### Folder Naming Patterns

#### Standard Conventions
- **Domain folders:** lowercase singular
  - Examples: `transaction`, `user`, `approval`, `report`

- **Feature/Feature folders:** lowercase with hyphens if multi-word
  - Examples: `rate-limit`, `session`, `ui`

- **Test folders:** match source structure
  - `tests/unit/`, `tests/integration/`, `tests/e2e/`

- **Generated folders:** included in .gitignore
  - `dist/` - Compiled output
  - `node_modules/` - Dependencies
  - `logs/` - Runtime logs

#### Special Folders
- `.github/` - GitHub-specific configuration
- `.husky/` - Git hooks
- `.vscode/` - VS Code settings
- `prisma/` - Database ORM
- `docker/` - Container configuration
- `infra/` - Infrastructure as Code
- `specs/` - Specifications and requirements
- `docs/` - Documentation

### Namespace/Module Patterns

#### Import Patterns
```typescript
// Library utilities
import { logger } from "@/lib/logger";
import { parseAmount } from "@/lib/currency";
import { validatePhoneNumber } from "@/lib/validation";

// Models (data access)
import UserModel from "@/models/user";
import TransactionModel from "@/models/transaction";

// Services (business logic)
import { TransactionProcessor } from "@/services/transaction/processor";
import { TransactionValidator } from "@/services/transaction/validator";
import { ApprovalAnalyzer } from "@/services/approval/analyzer";

// Configuration
import { env } from "@/config/env";
import { CONSTANTS } from "@/config/constants";

// Bot components
import { MessageHandler } from "@/bot/handlers/message";
import { MessageFormatter } from "@/bot/ui/messages";
```

#### Export Patterns
```typescript
// Named exports for utilities and functions
export function validatePhoneNumber(phone: string): boolean { }
export const logger = winston.createLogger({ });

// Default export for classes and main modules
export default class UserModel { }
export default class TransactionProcessor { }

// Interfaces exported near usage
export interface CreateTransactionData { }
export interface ValidationResult { }
```

### Organizational Patterns

#### Code Co-location Strategy
- **Related functionality grouped together:** Transaction validator, processor, approval analyzer all in transaction domain
- **Cross-domain dependencies minimized:** Services depend on models, not other services
- **Shared utilities extracted to lib/:** Prevents duplication across domains

#### Feature Encapsulation
- **Self-contained domains:** Each service domain has all necessary logic
- **Domain boundaries respected:** Clear input/output contracts between domains
- **Single responsibility:** Each file has focused purpose

#### Cross-cutting Concern Organization
- **Logging:** Centralized in lib/logger.ts, used throughout
- **Database access:** Prisma client in lib/database.ts, models extend functionality
- **Metrics:** Prometheus definitions in lib/metrics.ts, used in services
- **Caching:** Redis helpers in lib/redis.ts, used as needed

---

## 6. Navigation and Development Workflow

### Entry Points

**Application Entry:**
- `src/index.ts` - Main application entry point
  - Initializes services in order
  - Sets up error handling
  - Starts WhatsApp client

**Configuration Entry:**
- `src/config/env.ts` - Environment variable validation
  - Validates on import
  - Provides typed config throughout app

**Message Processing Entry:**
- `src/bot/handlers/message.ts` - Main message router
  - Dispatches messages to appropriate handlers
  - Implements RBAC and rate limiting

### Common Development Tasks

#### Adding a New Feature/Domain

1. **Create domain directory:**
   ```
   src/services/<new-domain>/
   ```

2. **Implement core files:**
   ```
   processor.ts - Orchestration
   validator.ts - Input validation
   analyzer.ts - Business logic (if needed)
   formatter.ts - Output formatting (if needed)
   ```

3. **Add handler in bot layer:**
   ```
   src/bot/handlers/<new-domain>.ts
   ```

4. **Create model if needed:**
   ```
   src/models/<entity>.ts
   ```

5. **Update database schema:**
   ```
   prisma/schema.prisma
   ```

6. **Write tests:**
   ```
   tests/unit/services/<new-domain>/
   tests/integration/<new-domain>/
   tests/e2e/workflows/<feature>.spec.ts
   ```

#### Extending Existing Functionality

1. **Locate domain:** Find in `src/services/<domain>/`
2. **Add logic:** Extend appropriate file (processor, validator, etc.)
3. **Update models:** Extend `src/models/<entity>.ts` if needed
4. **Update tests:** Add to matching test structure
5. **Update database:** Modify `prisma/schema.prisma` if needed

#### Modifying Database Schema

1. **Update schema:** Edit `prisma/schema.prisma`
2. **Create migration:** `npm run prisma:migrate`
3. **Update models:** Modify `src/models/<entity>.ts` if structure changed
4. **Update types:** Update interfaces in service files
5. **Write migration tests:** `tests/integration/database/`

#### Adding Configuration

1. **Add environment variable:** Update `src/config/env.ts` Zod schema
2. **Use in code:** Import from `src/config/env.ts`
3. **Document:** Add to `.env.example`

#### Writing Tests

- **Unit tests:** Mirror source structure in `tests/unit/`
- **Integration tests:** Group by domain in `tests/integration/`
- **E2E tests:** Organize by workflow in `tests/e2e/`

### Dependency Patterns

#### Dependency Flow Direction (Proper)
```
Handlers → Services → Models → Database (Prisma)
              ↓
            lib/ (utilities)
              ↓
            config/
```

#### Import/Reference Patterns
```typescript
// Handlers import services
import { TransactionProcessor } from "@/services/transaction/processor";

// Services import models
import TransactionModel from "@/models/transaction";

// Services use utilities
import { parseAmount } from "@/lib/currency";
import { logger } from "@/lib/logger";

// Models use ORM
import { getPrismaClient } from "@/lib/database";
```

#### Dependency Injection Registration
- Services are instantiated in handlers as needed
- No formal DI container (lightweight approach)
- Singletons (logger, db, redis) retrieved via helper functions
- Models are stateless utility classes

### Navigating by Feature

**Finding transaction-related code:**
```
Bot layer: src/bot/handlers/transaction.ts
Service layer: src/services/transaction/ (processor, validator, approval, editor)
Model layer: src/models/transaction.ts
Database: prisma/schema.prisma (Transaction model)
Tests: tests/unit/services/transaction/, tests/integration/database/transaction.test.ts
```

**Finding approval-related code:**
```
Bot layer: src/bot/handlers/approval.ts
Service layer: src/services/approval/ (analyzer, processor, notifier)
Service layer: src/services/notification/ (for sending)
Tests: tests/e2e/workflows/approval-workflow.spec.ts
```

---

## 7. Build and Output Organization

### Build Configuration

**TypeScript Compilation:**
- Configuration: `tsconfig.json`
- Dev watch mode: `npm run dev` (uses tsx)
- Production build: `npm run build` (compiles to dist/)
- Type checking: `npm run type-check`

**Build Output:**
```
dist/
├── index.js              # Entry point
├── bot/
│   ├── client/
│   ├── handlers/
│   ├── middleware/
│   └── ui/
├── services/             # Business logic
├── models/               # Data access
├── lib/                  # Utilities
├── config/               # Configuration
├── index.d.ts            # Declaration file
└── index.d.ts.map        # Source map
```

### Build Process

1. **Pre-build checks:** `scripts/preflight/check-build-prerequisites.js`
2. **TypeScript compilation:** `tsc`
3. **Output to dist/:** Maintains source structure
4. **Source maps:** For debugging compiled code

### Output Organization by Environment

**Development:**
- Source TypeScript files in src/
- Hot reload via tsx watch
- Console output with colors
- Detailed logging

**Production:**
- Compiled JavaScript in dist/
- Source maps for error tracking
- JSON structured logs
- Container deployment

---

## 8. Technology-Specific Organization

### Node.js/TypeScript Project Structure

**Module Organization:**
- CommonJS modules (module: "commonjs" in tsconfig)
- ESM interop enabled for compatibility
- Single entry point (src/index.ts)
- Path aliases configured (@ points to src/)

**Script Organization:**
```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "type-check": "tsc --noEmit",
  "lint": "eslint src --ext .ts",
  "lint:fix": "eslint src tests --ext .ts --fix",
  "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\""
}
```

### Prisma ORM Organization

**Schema Structure:**
```prisma
// Enums for type safety
enum UserRole { dev, boss, employee, investor }
enum TransactionType { income, expense }
enum ApprovalStatus { approved, pending, rejected }

// Entity models
model User { ... }
model Transaction { ... }
model Category { ... }
model AuditLog { ... }
```

**Migration Organization:**
```
prisma/migrations/
├── migration_lock.toml
└── 20251209233846_init/
    ├── migration.sql
    └── timescaledb_setup.sql
```

### Configuration Management

**Environment Variables:**
- Defined in `.env` (local development)
- Validated in `src/config/env.ts` with Zod
- Template in `.env.example`
- Typed access throughout application

**Constants:**
- Application constants in `src/config/constants.ts`
- Regex patterns, limits, defaults
- Category definitions
- System configuration

---

## 9. Extension and Evolution

### Adding New Features

**Feature Expansion Pattern:**
1. Create service domain: `src/services/<new-feature>/`
2. Add model: `src/models/<entity>.ts`
3. Add handler: `src/bot/handlers/<feature>.ts`
4. Update database: `prisma/schema.prisma`
5. Write tests in matching structure

**Example: Adding Budget Tracking Feature**
```
src/
├── services/budget/
│   ├── tracker.ts
│   ├── analyzer.ts
│   └── alerter.ts
├── models/budget.ts
└── bot/handlers/budget.ts

tests/
├── unit/services/budget/
├── integration/budget/
└── e2e/workflows/budget-workflow.spec.ts

prisma/
└── schema.prisma (add Budget model)
```

### Scalability Patterns

**Horizontal Scaling Limitations:**
- WhatsApp Web.js requires single instance per session
- Redis provides shared state across instances if needed
- Consider separate bot instances for different WhatsApp accounts

**Code Growth Management:**
- Services already organize by domain
- Large domains can be split into sub-domains
- Handlers can be split by feature as they grow
- Models remain one per entity

**Breaking Down Large Modules:**
```
// If transaction service becomes too large:
src/services/transaction/
├── recording/          # Recording sub-domain
│   ├── processor.ts
│   └── validator.ts
├── editing/            # Editing sub-domain
│   ├── processor.ts
│   └── validator.ts
└── approval/           # Approval sub-domain
    ├── analyzer.ts
    └── processor.ts
```

### Refactoring Patterns

**Common Refactoring Approaches:**
1. **Extract to utility:** Move shared logic to `lib/`
2. **Extract to service:** Create new domain service if logic spans domains
3. **Extract to model:** Move data access patterns to models
4. **Extract to middleware:** Implement as WhatsApp middleware if cross-cutting
5. **Rename for clarity:** Follow established naming conventions

**Structural Changes:**
- Database schema changes via Prisma migrations
- Service reorganization within domain-based structure
- Handler refactoring to split large routers
- Test reorganization to match source changes

---

## 10. Structure Templates

### Template: New Feature Implementation

**Directory Structure:**
```
src/services/feature-name/
├── processor.ts         # Main orchestration
├── validator.ts         # Input validation
├── analyzer.ts          # Analysis/decisions
├── formatter.ts         # Output formatting
└── notifier.ts          # Notifications (if needed)

src/bot/handlers/
└── feature-name.ts      # Message handling

src/models/
└── feature-entity.ts    # Data access

tests/
├── unit/services/feature-name/
│   ├── validator.test.ts
│   ├── processor.test.ts
│   └── analyzer.test.ts
├── integration/feature-name/
│   └── workflow.test.ts
└── e2e/workflows/
    └── feature-workflow.spec.ts

prisma/schema.prisma    # Add entity model
```

### Template: New Service File

```typescript
// src/services/<domain>/<operation>.ts

/**
 * Purpose: [Clear description of what this service does]
 */

import { logger } from "@/lib/logger";
import Model from "@/models/<entity>";

export class <OperationName>Service {
  /**
   * Main operation documentation
   */
  static async execute(data: {
    userId: string;
    // ... other params
  }): Promise<Result> {
    try {
      // Validation
      // Business logic
      // Persistence
      // Logging
      return { success: true, data };
    } catch (error) {
      logger.error("<Operation> failed", { error, data });
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export default <OperationName>Service;
```

### Template: New Handler File

```typescript
// src/bot/handlers/<feature>.ts

import { Message } from "whatsapp-web.js";
import { User } from "@prisma/client";
import { getWhatsAppClient } from "../client/client";
import { logger } from "@/lib/logger";

export class <FeatureName>Handler {
  static async handle(message: Message, user: User): Promise<void> {
    try {
      // RBAC check
      if (user.role !== "allowed_role") {
        await getWhatsAppClient()?.sendMessage(
          message.from,
          "❌ You don't have permission for this operation."
        );
        return;
      }

      // Validate input
      // Call service
      // Format response
      // Send message
      
      logger.info("<Feature> handled", { userId: user.id });
    } catch (error) {
      logger.error("<Feature> error", { error, userId: user.id });
      await getWhatsAppClient()?.sendMessage(
        message.from,
        "❌ An error occurred. Please try again."
      );
    }
  }
}

export default <FeatureName>Handler;
```

### Template: New Test File

```typescript
// tests/unit/services/<domain>/<operation>.test.ts

import <Operation>Service from "@/services/<domain>/<operation>";
import <Model> from "@/models/<entity>";

describe("<Domain>/<Operation>Service", () => {
  beforeEach(() => {
    // Setup mocks
  });

  describe("execute", () => {
    test("should execute successfully with valid input", async () => {
      // Arrange
      const input = { /* valid data */ };
      jest.spyOn(<Model>, "create").mockResolvedValue({ /* mocked result */ });

      // Act
      const result = await <Operation>Service.execute(input);

      // Assert
      expect(result.success).toBe(true);
      expect(<Model>.create).toHaveBeenCalledWith(expect.any(Object));
    });

    test("should fail with invalid input", async () => {
      // Arrange
      const input = { /* invalid data */ };

      // Act
      const result = await <Operation>Service.execute(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

---

## 11. Structure Enforcement

### Structure Validation

**ESLint Rules:**
- Enforces import patterns
- Prevents circular dependencies
- Validates naming conventions
- Checks file organization

**.eslintrc.js Configuration:**
```javascript
module.exports = {
  rules: {
    // Enforce consistent naming
    "@typescript-eslint/class-name-casing": "error",
    // Prevent circular dependencies
    "no-restricted-imports": "error",
  }
};
```

**Build-Time Checks:**
- TypeScript strict mode (`strict: true`)
- No unused variables/imports
- Explicit return types on functions
- Pre-commit hooks via Husky

### Git Hooks (Husky)

**Pre-commit Hook:**
- Runs via `lint-staged`
- Lints modified files
- Formats with Prettier
- Prevents commit of poorly formatted code

**.lintstagedrc.js:**
```javascript
module.exports = {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
};
```

### Documentation Practices

**Architectural Decisions:**
- Documented in `docs/ARCHITECTURE.md`
- Feature specifications in `specs/*/spec.md`
- API contracts in `specs/*/contracts/`

**Code Documentation:**
- JSDoc comments for public functions
- Inline comments for non-obvious logic
- Type annotations provide self-documentation
- README files explain folder purposes

**Structure Evolution:**
- Changes tracked in git history
- Migration guides in docs/
- Database migration files versioned
- Specification updates documented

---

## 12. File Count Statistics

```
Total TypeScript Files: ~120+

Breakdown by Category:
- Source code (src/):        ~50 files
  - Bot handlers:            ~10 files
  - Services:                ~25 files
  - Models:                  ~8 files
  - Libraries:               ~10 files
  - Config:                  ~2 files

- Tests (tests/):            ~40+ files
  - Unit tests:              ~20 files
  - Integration tests:       ~15 files
  - E2E tests:               ~10 files

- Configuration:             ~8 files
  - tsconfig, jest, playwright, eslint, etc.

- Documentation:             ~10+ files
  - Specs, guides, architecture

- Infrastructure:            ~15 files
  - Docker, Prisma, GitHub Actions, etc.
```

---

## Maintaining This Blueprint

### When to Update

Update this blueprint when:
- New major feature domains are added
- Folder structure significantly changes
- Naming conventions are updated
- New testing patterns are established
- Documentation location changes

### Update Frequency

- Reviewed: After major feature additions
- Updated: Quarterly or on architectural changes
- Version: Track in document header

### Last Updated
- **Date:** December 10, 2025
- **Version:** 1.0
- **Updated By:** Architecture Documentation
- **Next Review:** Q1 2026

### How to Update

1. Run folder structure analysis
2. Compare with existing blueprint
3. Document changes in this file
4. Update all cross-referencing documentation
5. Validate with team
6. Commit with clear message

---

## Quick Reference: File Location Guide

| What I Need to... | Where to Look | Primary File |
|---|---|---|
| ...add a new feature | src/services/<domain>/ | processor.ts |
| ...validate user input | src/lib/validation.ts | validation.ts |
| ...access database | src/models/<entity>.ts | <entity>.ts |
| ...define database schema | prisma/ | schema.prisma |
| ...handle WhatsApp message | src/bot/handlers/ | message.ts |
| ...configure app behavior | src/config/ | env.ts, constants.ts |
| ...log events | src/lib/ | logger.ts |
| ...cache data | src/lib/ | redis.ts |
| ...collect metrics | src/lib/ | metrics.ts |
| ...set up tests | tests/ | setup.ts |
| ...test a service | tests/unit/services/ | <domain>/<operation>.test.ts |
| ...test integration | tests/integration/ | <domain>/<feature>.test.ts |
| ...test workflows | tests/e2e/ | <workflow>.spec.ts |
| ...configure build | root level | tsconfig.json, jest.config.js |
| ...deploy app | docker/ | Dockerfile, docker-compose.yml |
| ...read documentation | docs/ | [specific guide].md |

---

## Summary

This folder structure blueprint reflects a **layered, domain-driven architecture** optimized for:

1. **Maintainability** - Clear organization makes code easy to find and understand
2. **Scalability** - Domain-based services can grow independently
3. **Testability** - Clear separation allows comprehensive testing at each layer
4. **Development Speed** - Established patterns accelerate feature development
5. **Code Quality** - Structure reinforces best practices and consistency

The WhatsApp Cashflow Bot exemplifies professional Node.js application organization, balancing simplicity with comprehensive structure for a production financial application.
