# Implementation Plan: WhatsApp Cashflow Reporting Chatbot

**Branch**: `004-whatsapp-cashflow-bot` | **Date**: 2025-12-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-whatsapp-cashflow-bot/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an interactive WhatsApp chatbot for daily cashflow reporting with role-based access control (Dev/Boss/Employee/Investor). The bot uses wwebjs.dev library to interact with WhatsApp Web, providing button-based interfaces for transaction input, automated daily reports at 24:00 WITA, and real-time financial analytics. The system processes transactions, generates role-specific reports with PDF attachments, implements recommendation engine for anomaly detection, and maintains comprehensive audit trails.

**Technical Approach**:

- Node.js 20 LTS with TypeScript for type safety and maintainability
- WhatsApp Web.js (wwebjs.dev) v1.23.0+ with LocalAuth for session persistence
- PostgreSQL 15+ with TimescaleDB extension for time-series transaction optimization
- Redis 7.x for session state management and caching
- Prisma 5.x ORM for database abstraction and migrations
- Azure Container Apps or App Service for production deployment
- Comprehensive testing strategy (70% unit, 20% integration, 10% E2E) with 80%+ coverage target

**Research Findings**: Best practices consolidated from WhatsApp Web.js documentation, Azure deployment guidelines, and Node.js/TypeScript industry standards. All technical decisions documented in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 20 LTS (upgrade from 18+ per spec)  
**Primary Dependencies**: whatsapp-web.js (wwebjs.dev) v1.23.0+, Prisma 5.x, Puppeteer, node-cron v3.0+, PDFKit v0.13+, Redis 7.x, Winston v3.x  
**Storage**: PostgreSQL 15+ with TimescaleDB extension for time-series transaction data, Redis 7.x for session state and caching  
**Testing**: Jest v29.x (unit/integration), Playwright v1.4+ (E2E), target 80%+ code coverage  
**Target Platform**: Linux server (Docker containers), production deployment on Azure Container Apps or Azure App Service
**Project Type**: single (Node.js backend service with WhatsApp integration)

**Performance Goals**:

- Button interaction latency <1s (99th percentile)
- Text message response <2s (95th percentile)
- Report generation <30s for daily reports (up to 1000 transactions)
- Support 50 concurrent users with <2s response time (95th percentile)
- Database queries <500ms (95th percentile)

**Constraints**:

- WhatsApp rate limiting: 15-20 messages/minute per chat
- PDF attachment size limit: 16MB (WhatsApp constraint)
- Session timeout: 10 minutes user inactivity
- Button debounce: 3-second cooldown
- WITA timezone (UTC+8) for all scheduling and reports

**Scale/Scope**:

- 10-50 concurrent users (small business team)
- 4 user roles (Dev, Boss, Employee, Investor)
- 100+ transactions per day
- 7-year data retention requirement (Indonesian financial compliance)
- Horizontal scaling support for 100+ users (future)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with engineering constitution principles:

**Code Quality**:

- [x] Type safety and static analysis tools configured
  - TypeScript strict mode enabled, ESLint with TypeScript rules, SonarQube for static analysis
- [x] Documentation plan defined for public APIs
  - JSDoc for all public functions, OpenAPI/Swagger for API contracts, README with architecture overview
- [x] Code organization structure aligns with constitution
  - Feature-based organization (transaction, report, user, recommendation modules), shared utilities extracted
- [x] Security considerations identified (OWASP Top 10)
  - Input validation, parameterized queries (Prisma), RBAC enforcement, audit logging, encrypted sessions (JWT in Redis)
- [x] Dependency management strategy defined
  - Dependencies pinned to specific versions, Dependabot for security patches, 7-day patch SLA, major upgrades require approval
- [x] Error handling and observability approach planned
  - Winston structured logging (JSON), error boundaries, health check endpoints, Prometheus metrics, Grafana dashboards

**Testing**:

- [x] Test pyramid strategy defined (70% unit, 20% integration, 10% E2E)
  - Unit tests: business logic, validation, calculations (Jest, <2min execution)
  - Integration tests: database operations, wwebjs interactions, Redis sessions (Jest, <10min execution)
  - E2E tests: critical user paths (Playwright, <30min execution, 10% of suite)
- [x] TDD approach confirmed
  - Red-Green-Refactor cycle for all new features, tests written before implementation
- [x] Test data management strategy defined
  - Test database with migrations, factory functions for test data, cleanup after each test
- [x] Performance testing plan for critical paths
  - Load testing: 50 concurrent users, response time benchmarks, database query performance tests

**User Experience** (if applicable):

- [x] Design system usage confirmed
  - Consistent button interface patterns, emoji prefixes, Indonesian language (Bahasa Indonesia) with English fallback
- [x] Accessibility requirements identified (WCAG 2.1 AA)
  - Text fallback for buttons, keyboard shortcuts, high contrast support, emoji alternatives for color-only indicators
- [x] Responsive design approach defined
  - WhatsApp interface adapts to message length, button menus work on all WhatsApp versions, graceful degradation
- [x] Error handling and user feedback patterns planned
  - User-friendly error messages in Bahasa Indonesia, recovery buttons ([🔄 Coba Lagi] [🏠 Menu Utama]), context-aware help

**Performance**:

- [x] API response time targets defined
  - Button interaction: <1s (99th percentile), text response: <2s (95th percentile), report generation: <30s
- [x] Resource consumption limits identified
  - Memory: <2GB per instance, CPU: <70% average, database connections: min 5, max 50 pool
- [x] Scalability approach confirmed
  - Horizontal scaling via Docker containers, Redis for shared state, database read replicas for reports, message queue (Bull.js) for bursts
- [x] Monitoring and observability plan defined
  - Prometheus metrics (response time, error rate, message throughput), Grafana dashboards, Winston structured logs, health check endpoints

**Exceptions**: None required. All constitution principles can be met with planned architecture.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── bot/                    # WhatsApp bot core
│   ├── client/             # wwebjs.dev client wrapper
│   │   ├── auth.ts         # LocalAuth session management
│   │   ├── client.ts       # Client initialization and lifecycle
│   │   └── events.ts       # Event handlers (message, ready, disconnect)
│   ├── handlers/           # Message and button handlers
│   │   ├── message.ts      # Text message routing
│   │   ├── button.ts       # Button callback handling
│   │   └── command.ts      # Text command parsing (/start, /help, etc.)
│   ├── middleware/         # Request processing middleware
│   │   ├── auth.ts         # User authentication and role checking
│   │   ├── debounce.ts    # Button debouncing (3-second cooldown)
│   │   ├── rate-limit.ts  # Message rate limiting
│   │   └── session.ts     # Session state management
│   └── ui/                 # Button and message formatting
│       ├── buttons.ts      # Button menu generation
│       ├── lists.ts        # List message generation (categories)
│       └── messages.ts    # Message formatting (Indonesian)
├── services/               # Business logic services
│   ├── transaction/      # Transaction processing
│   │   ├── processor.ts   # Transaction creation and validation
│   │   ├── validator.ts   # Amount, category, duplicate validation
│   │   └── approval.ts    # Approval workflow (optional)
│   ├── report/             # Report generation
│   │   ├── generator.ts   # Report data aggregation
│   │   ├── formatter.ts   # Text and PDF formatting
│   │   ├── pdf.ts         # PDF generation with charts
│   │   └── excel.ts       # Excel export
│   ├── recommendation/    # Anomaly detection and recommendations
│   │   ├── engine.ts      # Rule-based recommendation engine
│   │   ├── analyzer.ts    # Financial anomaly detection
│   │   └── confidence.ts  # Confidence score calculation
│   ├── user/              # User management
│   │   ├── service.ts     # User CRUD operations
│   │   ├── auth.ts        # Authentication and session management
│   │   └── rbac.ts        # Role-based access control
│   └── scheduler/         # Cron job management
│       ├── daily-report.ts # Daily report generation (23:55 WITA)
│       └── delivery.ts     # Report delivery (24:00 WITA)
├── models/                 # Prisma models and database access
│   ├── user.ts            # User model operations
│   ├── transaction.ts     # Transaction model operations
│   ├── report.ts          # Report model operations
│   ├── session.ts         # Session model operations
│   └── audit.ts           # Audit log operations
├── lib/                    # Shared utilities
│   ├── redis.ts           # Redis client and helpers
│   ├── logger.ts          # Winston logger configuration
│   ├── currency.ts        # Currency formatting (Rp)
│   ├── date.ts            # Date/time utilities (WITA timezone)
│   └── validation.ts     # Input validation helpers
├── config/                 # Configuration management
│   ├── env.ts             # Environment variable validation
│   └── constants.ts       # Application constants
└── index.ts                # Application entry point

tests/
├── unit/                   # Unit tests (70% of suite)
│   ├── services/          # Service layer unit tests
│   ├── models/            # Model layer unit tests
│   └── lib/               # Utility function tests
├── integration/           # Integration tests (20% of suite)
│   ├── database/          # Database integration tests
│   ├── redis/             # Redis integration tests
│   ├── wwebjs/            # WhatsApp client integration tests
│   └── scheduler/         # Cron job integration tests
└── e2e/                    # End-to-end tests (10% of suite)
    ├── user-stories/       # User story acceptance tests
    ├── roles/             # Role-based access tests
    └── workflows/         # Complete workflow tests

prisma/
├── schema.prisma           # Database schema
└── migrations/             # Database migrations

docker/
├── Dockerfile             # Production Docker image
└── docker-compose.yml     # Local development environment

infra/                      # Infrastructure as Code (Azure)
├── bicep/                 # Bicep templates for Azure resources
└── terraform/             # Terraform configurations (if needed)
```

**Structure Decision**: Single Node.js project with feature-based organization. Code organized by domain (bot, services, models) rather than technical layer. Shared utilities in `lib/`, configuration in `config/`, and tests mirror source structure. Follows constitution principle CQ-003 for consistent code organization.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
