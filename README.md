# WhatsApp Cashflow Reporting Chatbot

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/license-ISC-blue)

An interactive WhatsApp chatbot for daily cashflow reporting with role-based access control (Dev/Boss/Employee/Investor). The bot provides button-based interfaces for transaction input, automated daily reports at 24:00 WITA, and real-time financial analytics. Built with TypeScript, Node.js, PostgreSQL, and Prisma for production-grade financial data handling.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Development](#development)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Contributing](#contributing)
- [Documentation](#documentation)

## Features

- 📱 **WhatsApp Integration**: Button-based interactive interface using WhatsApp Web.js with persistent session management
- 💰 **Transaction Management**: Quick transaction recording with automatic category selection and amount validation
- 📊 **Automated Reports**: Daily financial reports delivered precisely at 24:00 WITA with email/PDF options
- 👥 **Role-Based Access Control (RBAC)**: 4 roles (Dev, Boss, Employee, Investor) with granular permission enforcement
- 🔔 **Smart Anomaly Detection**: Real-time alerts for unusual transaction patterns and expense spikes
- 📈 **Advanced Analytics**: Trend analysis, 7-day moving averages, period comparisons, and custom reporting
- 🔒 **Enterprise Security**: JWT authentication, RBAC enforcement, comprehensive audit trails, encrypted storage
- 🔄 **Transaction Approval Workflows**: Multi-level approval for transactions exceeding configured thresholds
- 📱 **Real-time Notifications**: Instant WhatsApp notifications for approvals, reports, and alerts
- ⚡ **High Performance**: Connection pooling, Redis caching, query optimization, rate limiting

## Technology Stack

### Core Backend
- **Runtime**: Node.js 20 LTS with ES2022 target
- **Language**: TypeScript 5.x with strict mode enabled
- **Web Framework**: Express.js 5.x for HTTP endpoints (health checks, metrics)
- **WhatsApp Integration**: whatsapp-web.js v1.23.0+ with LocalAuth and Puppeteer

### Data & Storage
- **Primary Database**: PostgreSQL 15+ with TimescaleDB extension for time-series optimization
- **ORM**: Prisma 5.x with connection pooling and query optimization
- **Session/Cache**: Redis 7.x (Alpine) for session management, rate limiting, and data caching
- **Schema Validation**: Zod runtime validation for environment variables and inputs

### Development & Quality
- **Testing Framework**: Jest 29.x (unit/integration) with ts-jest preset
- **E2E Testing**: Playwright 1.40.0+ for end-to-end workflows
- **Code Quality**: ESLint 8.x with TypeScript plugin, Prettier 3.x for formatting
- **Git Hooks**: Husky 9.x with lint-staged for pre-commit automation
- **Type Checking**: TypeScript strict mode with explicit return types

### Monitoring & Logging
- **Logging**: Winston 3.11.0 with JSON structured logs and file rotation
- **Metrics**: Prometheus client 15.1.3 for application observability
- **Monitoring**: Prometheus + Grafana stack for visualization and alerting
- **Container**: Docker with multi-stage builds, Alpine base images for efficiency

### Utilities & Libraries
- **Report Generation**: ExcelJS 4.4.0 (Excel), PDFKit 0.13.0 (PDF)
- **Date/Time**: Luxon 3.7.2 for WITA timezone handling
- **Job Scheduling**: node-cron 3.0.0 for scheduled tasks
- **Authentication**: jsonwebtoken 9.0.3 for JWT tokens
- **Environment**: dotenv 16.3.1 for configuration management

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WhatsApp Clients                        │
│                   (Users with Phones)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    WhatsApp Web.js
                   (Browser Automation)
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   ┌────▼──────┐                    ┌────────▼────────┐
   │  Message  │                    │  Event Handler  │
   │  Handlers │                    │  (QR, Auth)     │
   └────┬──────┘                    └─────────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │  Bot Layer (Message Routing & Validation) │
   │  - Command parsing                        │
   │  - RBAC authorization                     │
   │  - Session management                     │
   │  - Rate limiting                          │
   └────┬───────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │   Service Layer (Domain Business Logic)   │
   │  - transaction/    (processing)           │
   │  - approval/       (workflow)             │
   │  - report/         (generation)           │
   │  - user/           (RBAC)                 │
   │  - recommendation/ (analytics)            │
   │  - scheduler/      (jobs)                 │
   └────┬───────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │    Model Layer (Data Access with ORM)     │
   │  - Prisma client                          │
   │  - Query optimization                     │
   │  - Connection pooling                     │
   └────┬───────────────────────────────────────┘
        │
   ┌────┴─────┬──────────┬──────────┬─────────┐
   │           │          │          │         │
┌──▼──┐   ┌───▼──┐  ┌────▼───┐ ┌──▼──┐  ┌────▼────┐
│ DB  │   │Redis │  │Logs    │ │Metrics┐ │Audit   │
└─────┘   └──────┘  └────────┘ └──────┘  └────────┘
  (PG)   (Session) (Winston)  (Prometh) (Database)
```

### Layered Architecture

1. **Bot Layer** (`src/bot/`) - WhatsApp integration and message routing
   - Client management (authentication, lifecycle)
   - Event handlers (message routing, command dispatch)
   - Middleware (RBAC, rate limiting, session management)
   - UI components (message formatting, button menus)

2. **Service Layer** (`src/services/`) - Domain-driven business logic
   - Transaction processing and approval workflows
   - Report generation and scheduling
   - User management and role-based access control
   - Recommendation and anomaly detection
   - Audit logging and notifications

3. **Model Layer** (`src/models/`) - Data access and ORM integration
   - Entity-specific database operations
   - Query optimization with eager loading
   - Type-safe Prisma client usage
   - Pagination and filtering patterns

4. **Infrastructure Layer** (`src/lib/`) - Cross-cutting concerns
   - Winston logging with structured output
   - Prisma client with connection pooling
   - Redis session and cache management
   - Prometheus metrics collection
   - Input validation and formatting utilities

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.0.0 or higher (check with `node --version`)
- **npm** 10.x or higher (included with Node.js)
- **Docker** and **Docker Compose** for running PostgreSQL and Redis
- **Git** for version control
- **WhatsApp** account for testing bot functionality

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/angga13142/Finance-Report-Whatsapp.git
   cd Finance-Report-Whatsapp
   git checkout 004-whatsapp-cashflow-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   # Required variables:
   # - DATABASE_URL: PostgreSQL connection string
   # - REDIS_HOST, REDIS_PORT: Redis connection
   # - JWT_SECRET: Authentication secret (min 32 characters)
   # - WHATSAPP_SESSION_PATH: Directory for WhatsApp sessions
   ```

4. **Start infrastructure services:**
   ```bash
   # Start PostgreSQL and Redis with Docker Compose
   docker-compose -f docker/docker-compose.dev.yml up -d
   
   # Verify services are running
   docker-compose -f docker/docker-compose.dev.yml ps
   ```

5. **Initialize the database:**
   ```bash
   # Create database schema and run migrations
   npm run prisma:migrate
   
   # Seed initial data (roles, categories, etc.)
   npm run prisma:seed
   ```

6. **Start the application:**
   ```bash
   # Development mode with hot reload
   npm run dev
   ```

7. **Authenticate WhatsApp:**
   - On first run, you'll see a QR code in the terminal
   - Open WhatsApp on your phone and scan the QR code
   - The bot is now authenticated and will remain so for future runs

### Quick Verification

```bash
# Verify the bot is running
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics
```

## Development

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint              # Check code quality
npm run lint:fix          # Auto-fix linting issues

# Formatting
npm run format            # Format code with Prettier

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit         # Unit tests only (fast, isolated)
npm run test:integration  # Integration tests (with dependencies)
npm run test:e2e          # End-to-end tests (full workflows)

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage

# Run tests matching a pattern
npm test -- --testNamePattern="validateAmount"
```

### Database Management

```bash
# Open Prisma Studio GUI (browser-based database viewer)
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Deploy migrations to production database
npm run prisma:deploy

# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Seed database with initial data
npm run prisma:seed
```

### Docker Commands

```bash
# Development environment
docker-compose -f docker/docker-compose.dev.yml up -d

# Production environment
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.dev.yml logs -f bot

# Stop services
docker-compose -f docker/docker-compose.dev.yml down
```

## Project Structure

The project follows a **layered, domain-driven architecture** for maintainability and scalability:

```
Finance-Report-Whatsapp/
├── .github/                    # GitHub configuration
│   ├── copilot-instructions.md # Copilot/AI guidelines
│   ├── instructions/           # Detailed coding standards
│   ├── prompts/                # Custom Copilot prompts
│   └── workflows/              # GitHub Actions CI/CD
│
├── docker/                     # Container configuration
│   ├── Dockerfile              # Multi-stage production build
│   ├── docker-compose.yml      # Production services
│   ├── docker-compose.dev.yml  # Development services
│   └── prometheus.yml          # Monitoring config
│
├── docs/                       # Documentation
│   ├── TECHNOLOGY_STACK_BLUEPRINT.md    # Tech stack reference
│   ├── PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md # Code organization
│   ├── WORKFLOW_DOCUMENTATION.md        # Feature workflows
│   ├── TESTING_GUIDE.md                 # Testing standards
│   └── HUSKY_SETUP.md                   # Git hooks setup
│
├── prisma/                     # Database ORM
│   ├── schema.prisma           # Database schema definition
│   ├── seed.ts                 # Database seeding script
│   └── migrations/             # Migration history
│
├── scripts/                    # Build and utility scripts
│   └── preflight/              # Pre-flight checks (Node version, prerequisites)
│
├── specs/                      # Project specifications
│   └── 004-whatsapp-cashflow-bot/
│       ├── spec.md             # Detailed specification
│       ├── plan.md             # Implementation plan
│       ├── data-model.md       # Entity relationship diagram
│       └── contracts/          # API contracts (YAML)
│
├── src/                        # Source code
│   ├── index.ts                # Application entry point
│   │
│   ├── bot/                    # WhatsApp bot integration layer
│   │   ├── client/             # WhatsApp client (authentication, lifecycle)
│   │   ├── handlers/           # Message handlers (routing, workflows)
│   │   │   ├── message.ts      # Main message router (dispatcher)
│   │   │   ├── transaction.ts  # Transaction workflow handler
│   │   │   ├── approval.ts     # Approval workflow handler
│   │   │   ├── report.ts       # Report request handler
│   │   │   └── ...
│   │   ├── middleware/         # Message preprocessing (auth, rate limit, session)
│   │   └── ui/                 # WhatsApp UI components (buttons, lists, messages)
│   │
│   ├── services/               # Business logic services (domain-driven)
│   │   ├── transaction/        # Transaction recording & approval
│   │   ├── report/             # Report generation & scheduling
│   │   ├── approval/           # Approval workflow logic
│   │   ├── user/               # User management & RBAC
│   │   ├── recommendation/     # Anomaly detection & insights
│   │   ├── notification/       # Message delivery
│   │   ├── audit/              # Audit trail logging
│   │   ├── scheduler/          # Cron job management
│   │   ├── data/               # Data transformation
│   │   └── system/             # System health & maintenance
│   │
│   ├── models/                 # Data access layer (ORM)
│   │   ├── user.ts             # User data operations
│   │   ├── transaction.ts      # Transaction data operations
│   │   ├── category.ts         # Category data operations
│   │   ├── report.ts           # Report data operations
│   │   └── ...
│   │
│   ├── lib/                    # Infrastructure & utilities
│   │   ├── logger.ts           # Winston logging configuration
│   │   ├── database.ts         # Prisma client & connection pooling
│   │   ├── redis.ts            # Redis client & helper functions
│   │   ├── metrics.ts          # Prometheus metrics definitions
│   │   ├── validation.ts       # Input validation helpers
│   │   ├── currency.ts         # Currency parsing & formatting
│   │   ├── date.ts             # Date/time utilities (WITA timezone)
│   │   ├── cache.ts            # Caching utilities
│   │   └── constants.ts        # Application constants
│   │
│   └── config/                 # Configuration
│       ├── env.ts              # Environment variables (Zod schema)
│       └── constants.ts        # Application constants & defaults
│
├── tests/                      # Test suites (mirroring src structure)
│   ├── setup.ts                # Jest configuration & fixtures
│   ├── unit/                   # Unit tests (fast, isolated)
│   │   ├── lib/
│   │   ├── models/
│   │   └── services/
│   ├── integration/            # Integration tests (with dependencies)
│   │   ├── database/
│   │   ├── redis/
│   │   ├── scheduler/
│   │   └── wwebjs/
│   └── e2e/                    # End-to-end tests (Playwright)
│       ├── workflows/          # Complete user workflows
│       ├── roles/              # Role-based access tests
│       └── success-criteria/   # User acceptance tests
│
├── logs/                       # Runtime logs (generated)
│   ├── error.log
│   └── combined.log
│
├── dist/                       # Compiled output (generated)
│
├── node_modules/               # Dependencies (generated)
│
├── .env.example                # Environment variables template
├── .eslintrc.js                # ESLint configuration
├── .lintstagedrc.js            # Pre-commit linting
├── jest.config.js              # Jest testing configuration
├── playwright.config.ts        # Playwright E2E configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Project metadata & scripts
├── package-lock.json           # Dependency lock file
└── README.md                   # This file
```

For detailed folder structure explanation, see [PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md](docs/PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md)

## Key Features Explained

### 1. Transaction Management
- **Quick Input**: Button-based interface for fast transaction recording
- **Validation**: Multi-level validation (format, business logic, database constraints)
- **Categories**: Smart category selection with type matching
- **Approval**: Auto-approval for normal transactions, manual approval for suspicious ones

### 2. Role-Based Access Control
- **Developer (Dev)**: Full system access, configuration, user management
- **Boss**: View all reports, approve high-value transactions, send analytics
- **Employee**: Record transactions, view personal reports
- **Investor**: View summary reports, portfolio analytics

### 3. Automated Reporting
- **Daily Reports**: Automatically generated at 24:00 WITA every day
- **Multiple Formats**: WhatsApp message, PDF download, Excel export
- **Role-Specific Views**: Each role sees relevant data
- **Scheduled Delivery**: Cron-based scheduling with retry logic

### 4. Smart Analytics
- **Anomaly Detection**: Flags unusual spending patterns
- **Trend Analysis**: 7-day moving averages and period comparisons
- **Recommendations**: Actionable insights based on data patterns
- **Real-time Alerts**: Immediate notification of unusual activity

### 5. Security & Audit
- **JWT Authentication**: Session-based authentication with token expiration
- **RBAC Enforcement**: Permission checks on every operation
- **Audit Trails**: Complete logging of all transactions and approvals
- **Data Encryption**: Sensitive data encrypted at rest and in transit

## Development Workflow

### Branching Strategy
- **main**: Production-ready code
- **develop**: Development branch for feature integration
- **feature/\***: Feature branches from develop
- **hotfix/\***: Critical fixes from main

### Commit Standards
Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(scope): description        # New feature
fix(scope): description         # Bug fix
refactor(scope): description    # Code refactoring
perf(scope): description        # Performance improvement
security(scope): description    # Security fix
test(scope): description        # Test additions
docs(scope): description        # Documentation
```

Examples:
- `feat(transaction): add transaction editing functionality`
- `fix(approval): correct threshold validation logic`
- `security(auth): implement JWT token refresh`
- `test(validator): add currency validation tests`

### Pull Request Process
1. Create feature branch from develop
2. Implement feature with tests
3. Ensure all tests pass: `npm test`
4. Run code quality checks: `npm run lint && npm run type-check`
5. Submit pull request with description
6. Pass peer review (security-focused)
7. Merge with squash commit to main

## Coding Standards

### TypeScript
- **Strict Mode**: All files must compile with `strict: true`
- **Explicit Types**: No implicit `any` types
- **Return Types**: All functions must have explicit return types
- **Null Safety**: Strict null checks enabled

```typescript
// ✅ GOOD: Explicit types and return types
async function processTransaction(
  userId: string,
  amount: number,
  category: string,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  // Implementation
}

// ❌ BAD: Implicit types and missing return type
async function processTransaction(userId, amount, category) {
  // Implementation
}
```

### NestJS Patterns (where applicable)
- Use dependency injection for services
- Implement guards for authorization
- Use interceptors for cross-cutting concerns
- Create pipes for validation
- Use exception filters for error handling

### Code Organization
- **Single Responsibility**: Each function/class has one purpose
- **DRY (Don't Repeat Yourself)**: Extract common logic to utilities
- **SOLID Principles**: Follow SOLID design principles
- **Clear Naming**: Names reflect purpose and intent

### Async/Await
```typescript
// ✅ GOOD: Async/await pattern
async function getUserTransactions(userId: string): Promise<Transaction[]> {
  try {
    const transactions = await TransactionModel.findByUserId(userId);
    return transactions;
  } catch (error) {
    logger.error("Failed to fetch transactions", { error, userId });
    throw error;
  }
}

// ❌ BAD: Promise chains
function getUserTransactions(userId) {
  return TransactionModel.findByUserId(userId)
    .then(transactions => transactions)
    .catch(error => { throw error; });
}
```

### Error Handling
- Validate inputs early (fail fast)
- Use typed errors with context
- Log errors with structured data
- Return meaningful error messages to users

```typescript
try {
  // Validation
  const validation = TransactionValidator.validate(data);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(", ") };
  }
  
  // Business logic
  const result = await TransactionProcessor.process(data);
  
  // Logging
  logger.info("Transaction processed", { userId: data.userId, transactionId: result.id });
  return result;
} catch (error) {
  // Error handling with context
  logger.error("Transaction processing failed", {
    error: error instanceof Error ? error.message : String(error),
    data: { userId: data.userId, amount: data.amount },
  });
  return { success: false, error: "Transaction processing failed" };
}
```

### Performance Guidelines
- **Query Optimization**: Use `select()` and `where()` to limit data transfer
- **Connection Pooling**: Database uses connection pooling (min: 5, max: 50)
- **Caching**: Cache frequently accessed data in Redis with TTL
- **Rate Limiting**: Prevent abuse with per-user rate limits
- **Async Operations**: Use scheduled jobs for heavy processing

## Testing

### Test Strategy

The project uses a **Test Pyramid** approach:

```
        /\
       /  \  E2E Tests (10%)
      /    \ Playwright
     /______\
    /\      /\
   /  \    /  \  Integration Tests (30%)
  /    \  /    \ Jest with real dependencies
 /______\/______\
/\      /\      /\
/  \    /  \    /  \ Unit Tests (60%)
/    \  /    \  /    \ Jest isolated tests
/______\/______\/______\
```

### Unit Tests
- Fast, isolated tests of individual functions
- Mock external dependencies
- Test success and failure cases
- Aim for >80% code coverage

```bash
npm run test:unit
```

### Integration Tests
- Test service interactions with real database
- Verify API contracts
- Test database migrations
- Use test fixtures for consistent data

```bash
npm run test:integration
```

### E2E Tests (Playwright)
- Test complete user workflows
- Verify UI interactions
- Test role-based access control
- Validate multi-step processes

```bash
npm run test:e2e
```

### Coverage Requirements
- **Minimum**: 70% line coverage
- **Target**: 80% statement coverage
- **Critical paths**: 90% coverage

See [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for comprehensive testing documentation.

## Contributing

We welcome contributions from team members! Please follow these guidelines:

### Before You Start
1. Check existing [issues](https://github.com/angga13142/Finance-Report-Whatsapp/issues)
2. Review [TECHNOLOGY_STACK_BLUEPRINT.md](docs/TECHNOLOGY_STACK_BLUEPRINT.md) for architecture
3. Read [CODE_EXEMPLARS](docs/) for coding patterns
4. Understand [WORKFLOW_DOCUMENTATION.md](docs/WORKFLOW_DOCUMENTATION.md)

### Development Process
1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes following coding standards
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Run linting: `npm run lint:fix && npm run format`
6. Commit with conventional commit message
7. Push to your branch
8. Create a pull request with description

### Pre-commit Checklist
- [ ] Code follows TypeScript strict mode
- [ ] All tests pass (`npm test`)
- [ ] Code is formatted (`npm run format`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Commit message follows conventional commits
- [ ] Documentation is updated if needed

### Security Considerations
- Never commit secrets or credentials
- Use environment variables for sensitive data
- Validate all user inputs
- Check OWASP security guidelines
- Review [security-and-owasp.instructions.md](../.github/instructions/security-and-owasp.instructions.md)

## Documentation

### Key Documentation Files

| Document | Purpose |
|----------|---------|
| [TECHNOLOGY_STACK_BLUEPRINT.md](docs/TECHNOLOGY_STACK_BLUEPRINT.md) | Complete technology stack reference with usage patterns |
| [PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md](docs/PROJECT_FOLDER_STRUCTURE_BLUEPRINT.md) | Folder organization and navigation guide |
| [WORKFLOW_DOCUMENTATION.md](docs/WORKFLOW_DOCUMENTATION.md) | Feature workflows and implementation examples |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Testing strategies and best practices |
| [HUSKY_SETUP.md](docs/HUSKY_SETUP.md) | Git hooks and pre-commit automation |

### Additional Resources

- **Specifications**: See [specs/004-whatsapp-cashflow-bot/](specs/004-whatsapp-cashflow-bot/) for detailed feature specifications
- **API Contracts**: See [specs/*/contracts/](specs/004-whatsapp-cashflow-bot/contracts/) for API contract definitions
- **Copilot Instructions**: See [.github/copilot-instructions.md](.github/copilot-instructions.md) for AI assistant guidelines

### Code Exemplars
The project includes code exemplars demonstrating best practices:
- Service layer patterns
- Model layer data access
- Handler message routing
- Middleware implementation
- Test structure and organization

## Troubleshooting

### Common Issues

**Issue: WhatsApp QR Code Not Appearing**
```bash
# Clear existing session
rm -rf .wwebjs_auth

# Restart the bot
npm run dev
```

**Issue: Database Connection Failed**
```bash
# Verify PostgreSQL is running
docker-compose -f docker/docker-compose.dev.yml ps

# Check database URL in .env
echo $DATABASE_URL

# Restart services
docker-compose -f docker/docker-compose.dev.yml restart postgres
```

**Issue: Tests Failing**
```bash
# Clear Jest cache
npm test -- --clearCache

# Run tests in watch mode for debugging
npm test -- --watch

# Run specific test file
npm test validator.test.ts
```

**Issue: Port Already in Use**
```bash
# Check which process is using port 3000
lsof -i :3000

# Kill the process (macOS/Linux)
kill -9 <PID>

# Or change PORT in .env
PORT=3001 npm run dev
```

For more help, see [COPILOT_TROUBLESHOOTING.md](.github/COPILOT_TROUBLESHOOTING.md)

## Performance Tips

- Use Prisma Studio to analyze queries: `npm run prisma:studio`
- Monitor database connections: check connection pool status
- Review logs for slow queries: `tail -f logs/combined.log`
- Use Redis for frequently accessed data
- Implement pagination for large result sets
- Profile with Prometheus metrics on `/metrics` endpoint

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/angga13142/Finance-Report-Whatsapp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/angga13142/Finance-Report-Whatsapp/discussions)
- **Documentation**: See docs/ folder for detailed guides

## Acknowledgments

Built with best practices from:
- [Clean Code Principles](https://en.wikipedia.org/wiki/Robert_C._Martin)
- [SOLID Design Principles](https://en.wikipedia.org/wiki/SOLID)
- [OWASP Security Guidelines](https://owasp.org/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Last Updated**: December 10, 2025  
**Project Status**: Active Development  
**Repository**: [Finance-Report-Whatsapp](https://github.com/angga13142/Finance-Report-Whatsapp)
├── models/           # Prisma models and database access
├── lib/              # Shared utilities
└── config/           # Configuration management

tests/
├── unit/             # Unit tests (70% of suite)
├── integration/      # Integration tests (20%)
└── e2e/              # End-to-end tests (10%)
```

## Documentation

- [Implementation Plan](./specs/004-whatsapp-cashflow-bot/plan.md) - Technical architecture
- [Data Model](./specs/004-whatsapp-cashflow-bot/data-model.md) - Database schema
- [API Contracts](./specs/004-whatsapp-cashflow-bot/contracts/) - Message contracts
- [Quickstart Guide](./specs/004-whatsapp-cashflow-bot/quickstart.md) - Detailed setup guide

## Bot Commands

Send these commands via WhatsApp:

- `/start` - Show welcome menu
- `/help` - Show help message
- `/menu` - Return to main menu
- `/laporan` - View daily report
- `/catat` - Start transaction input

## Performance Targets

- Button interaction: <1s (99th percentile)
- Text message response: <2s (95th percentile)
- Report generation: <30s for daily reports
- Support 50 concurrent users
- 99% report delivery success rate

## Contributing

1. Create a feature branch from `main`
2. Implement changes with tests (80%+ coverage)
3. Run linting and type checks
4. Submit pull request

## License

ISC

## Support

- **Documentation**: See `docs/` directory
- **Issues**: Create GitHub issue
- **Team**: Contact Finance Engineering Team
