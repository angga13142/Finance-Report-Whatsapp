# Implementation Plan: WhatsApp Cashflow Bot Enhancements

**Branch**: `001-bot-enhancements` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-bot-enhancements/spec.md`

## Summary

This plan implements five major enhancements to the WhatsApp Cashflow Bot: (1) Docker containerization with WhatsApp session persistence, (2) Enhanced WhatsApp Web.js event logging with correlation IDs and sensitive data masking, (3) Unicode font formatting utilities for improved message readability, (4) Dynamic user management via WhatsApp commands for boss/dev roles, and (5) Developer superuser capabilities for system administration. All enhancements follow the existing 4-layer architecture (Bot → Service → Model → Database) and maintain compatibility with current codebase patterns.

## Technical Context

**Language/Version**: TypeScript 5.0.0+, Node.js >=20.0.0 (ES2022, CommonJS)  
**Primary Dependencies**: whatsapp-web.js ^1.34.2, Prisma ^5.0.0, Winston ^3.11.0, Express.js ^5.2.1, Redis ^4.6.0, Zod ^3.22.4  
**Storage**: PostgreSQL (via Prisma), Redis (session/cache), Docker volumes (WhatsApp session data)  
**Testing**: Jest ^29.0.0 (unit/integration), Playwright ^1.40.0 (E2E), ts-jest ^29.1.0. Test coverage targets: 80% lines, 90% branches for business logic (per constitution TS-001). Test pyramid: 70% unit, 20% integration, 10% E2E.  
**Target Platform**: Linux containers (Docker), Node.js runtime  
**Project Type**: Single backend service (WhatsApp bot with Express health endpoints at `GET /health`)  
**Performance Goals**: Font conversion <5ms per message, user management operations <30s, system diagnostics <5s, log events <100ms  
**Constraints**: Must maintain WhatsApp Web.js ^1.34.2 compatibility, preserve 4-layer architecture, zero-downtime session restoration, Unicode font fallback support  
**Scale/Scope**: Production deployment with persistent sessions, enhanced observability, improved UX, administrative capabilities

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify compliance with engineering constitution principles:

**Code Quality**:

- [x] Type safety and static analysis tools configured (TypeScript strict mode, ESLint)
- [x] Documentation plan defined for public APIs (JSDoc for services, inline comments for complex logic)
- [x] Code organization structure aligns with constitution (4-layer architecture: Bot → Service → Model → Database)
- [x] Security considerations identified (OWASP Top 10: input validation, sensitive data masking, RBAC enforcement, audit logging)
- [x] Dependency management strategy defined (exact version pinning per copilot-instructions.md)
- [x] Error handling and observability approach planned (structured logging, correlation IDs, health checks)

**Testing**:

- [x] Test pyramid strategy defined (70% unit, 20% integration, 10% E2E per constitution)
- [x] TDD approach confirmed (tests written before implementation)
- [x] Test data management strategy defined (fixtures, factories, isolated test databases)
- [x] Performance testing plan for critical paths (font conversion <5ms, user management <30s, diagnostics <5s)

**User Experience** (if applicable):

- [x] Design system usage confirmed (consistent message formatting, Unicode fonts, emoji standards)
- [x] Accessibility requirements identified (WhatsApp message readability, clear error messages)
- [x] Responsive design approach defined (WhatsApp message formatting, text wrapping)
- [x] Error handling and user feedback patterns planned (clear error messages, success confirmations)

**Performance**:

- [x] API response time targets defined (health check <200ms, diagnostics <5s)
- [x] Resource consumption limits identified (Docker container constraints, memory limits)
- [x] Scalability approach confirmed (stateless services, horizontal scaling ready)
- [x] Monitoring and observability plan defined (structured logging, correlation IDs, health endpoints)

**Exceptions**: None required - all enhancements align with constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-bot-enhancements/
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
├── bot/
│   ├── client/
│   │   ├── auth.ts              # WhatsApp authentication (enhanced for Docker volumes)
│   │   ├── client.ts            # WhatsApp client initialization
│   │   ├── events.ts            # Event handlers (enhanced logging)
│   │   └── shutdown.ts
│   ├── handlers/
│   │   ├── admin.ts             # NEW: Developer administrative commands
│   │   ├── user-management.ts   # NEW: User CRUD commands
│   │   ├── message.ts
│   │   └── [existing handlers]
│   ├── middleware/
│   │   ├── auth.ts              # RBAC enforcement (enhanced for dev/boss checks)
│   │   └── [existing middleware]
│   └── ui/
│       ├── messages.ts           # Enhanced with font formatting
│       └── [existing UI files]
├── services/
│   ├── user/
│   │   ├── manager.ts           # NEW: User management service
│   │   └── [existing user services]
│   ├── system/
│   │   ├── config.ts            # NEW: Configuration management service
│   │   ├── diagnostics.ts       # NEW: System health diagnostics
│   │   └── [existing system services]
│   ├── audit/
│   │   └── logger.ts            # Enhanced for admin operations
│   └── [existing services]
├── models/
│   ├── user.ts                  # Enhanced with user management methods
│   ├── config.ts                # NEW: System configuration model
│   └── [existing models]
├── lib/
│   ├── font-formatter.ts        # NEW: Unicode font conversion utilities
│   ├── logger.ts                # Enhanced with WhatsApp event logging
│   └── [existing lib files]
└── config/
    ├── env.ts                   # Enhanced with DEV_PHONE_NUMBER, config schema
    └── constants.ts

tests/
├── unit/
│   ├── lib/
│   │   └── font-formatter.test.ts
│   ├── services/
│   │   ├── user/
│   │   │   └── manager.test.ts
│   │   └── system/
│   │       ├── config.test.ts
│   │       └── diagnostics.test.ts
│   └── [existing unit tests]
├── integration/
│   ├── bot/
│   │   └── handlers/
│   │       ├── admin.test.ts
│   │       └── user-management.test.ts
│   ├── docker/
│   │   └── session-persistence.test.ts
│   └── [existing integration tests]
└── e2e/
    ├── workflows/
    │   ├── user-management.spec.ts
    │   └── admin-commands.spec.ts
    └── [existing e2e tests]

docker/
├── Dockerfile
├── docker-compose.yml
└── .dockerignore
```

**Structure Decision**: Single project structure maintained. New files added to existing 4-layer architecture:

- **Bot Layer**: New handlers (admin.ts, user-management.ts), enhanced existing handlers
- **Service Layer**: New services (user/manager.ts, system/config.ts, system/diagnostics.ts)
- **Model Layer**: New model (config.ts), enhanced existing models
- **Infrastructure**: New lib (font-formatter.ts), enhanced logger.ts

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all enhancements align with constitution principles and existing architecture patterns.
