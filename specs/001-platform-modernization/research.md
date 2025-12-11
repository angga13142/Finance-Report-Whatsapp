# Research: WhatsApp Cashflow Bot Platform Modernization

**Date**: 2025-01-27  
**Feature**: Platform Modernization  
**Branch**: `001-platform-modernization`

## Overview

This document consolidates research findings and technical decisions for the platform modernization feature. All technical unknowns from the implementation plan have been resolved through analysis of existing codebase, best practices, and technology documentation.

## Research Areas

### 1. Docker Session Persistence for WhatsApp Web.js

**Decision**: Use Docker named volumes with bind mount to `.wwebjs_auth` directory, ensuring proper file permissions for non-root Node.js process.

**Rationale**:

- whatsapp-web.js stores session data in `.wwebjs_auth` directory by default
- Docker volumes persist across container lifecycle (stop, restart, recreate)
- Named volumes provide better isolation than bind mounts
- File permissions must allow Node.js process (non-root UID) to read/write

**Alternatives Considered**:

- **Bind mounts to host**: Rejected due to portability concerns and permission complexity
- **External storage (S3, NFS)**: Rejected due to added complexity and latency for session file I/O
- **Redis session storage**: Rejected because whatsapp-web.js requires filesystem-based session storage

**Implementation Notes**:

- Dockerfile must set proper UID/GID for Node.js process (e.g., `node` user with UID 1000)
- Volume mount point: `/app/.wwebjs_auth` → Docker volume `whatsapp-session-data`
- Health check script validates write permissions on startup
- Graceful shutdown handler saves session state on SIGTERM

**References**:

- whatsapp-web.js documentation: Session persistence
- Docker volumes best practices
- Existing codebase: `src/bot/client/auth.ts`

---

### 2. Unicode Mathematical Alphanumeric Symbols for Message Formatting

**Decision**: Implement character mapping tables (Map objects) for ASCII → Unicode mathematical alphanumeric conversion, with graceful fallback to native WhatsApp formatting.

**Rationale**:

- Unicode mathematical alphanumeric symbols (U+1D400-U+1D7FF) provide visual distinction without external font files
- Pre-computed mapping tables enable O(1) lookup performance
- Fallback mechanism ensures compatibility with older WhatsApp clients
- No external dependencies required (pure Unicode character mapping)

**Alternatives Considered**:

- **External font files**: Rejected due to WhatsApp message limitations (no custom font loading)
- **HTML/CSS formatting**: Rejected (WhatsApp messages are plain text)
- **Native WhatsApp formatting only**: Rejected because Unicode symbols provide better visual hierarchy

**Implementation Notes**:

- Character mapping ranges:
  - Bold: U+1D400-U+1D433 (A-Z), U+1D434-U+1D467 (a-z), U+1D7CE-U+1D7D7 (0-9)
  - Italic: U+1D434-U+1D467 (A-Z), U+1D468-U+1D49B (a-z), U+1D7E2-U+1D7EB (0-9)
  - Monospace: U+1D670-U+1D6A3 (A-Z), U+1D6A4-U+1D6D7 (a-z), U+1D7F6-U+1D7FF (0-9)
- Preserve emojis, punctuation, and non-ASCII characters unchanged
- Performance target: <5ms per message (validated with benchmarks)

**References**:

- Unicode Standard: Mathematical Alphanumeric Symbols
- WhatsApp message formatting limitations
- Existing codebase: `src/bot/ui/message.formatter.ts`

---

### 3. Structured Logging with Winston and Correlation IDs

**Decision**: Enhance existing Winston logger (`src/lib/logger.ts`) with structured JSON format, correlation ID tracking, and event-specific metadata for all whatsapp-web.js events.

**Rationale**:

- Existing Winston infrastructure (^3.11.0) provides foundation
- Structured JSON enables log aggregation and querying (ELK, CloudWatch, etc.)
- Correlation IDs track message flow through processing pipeline
- Event-specific metadata provides context for debugging

**Alternatives Considered**:

- **Pino logger**: Rejected to maintain consistency with existing codebase
- **Console logging only**: Rejected due to lack of structure and correlation tracking
- **External logging service (Datadog, Sentry)**: Considered for future enhancement, but not required for MVP

**Implementation Notes**:

- Log format: `{ timestamp, level, eventType, correlationId, metadata }`
- Correlation ID generation: UUID v4 for each incoming message
- Sensitive data masking: Phone numbers (last 4 digits), message content (type + length only)
- Log rotation: Winston DailyRotateFile transport (100MB max, 14-day retention)
- Event types: qr_code_generated, authenticated, ready, disconnected, message_received, message_sent, message_ack, auth_failure

**References**:

- Winston documentation: Transports and formats
- Existing codebase: `src/lib/logger.ts`
- whatsapp-web.js event documentation

---

### 4. WhatsApp Command Interface for User Management

**Decision**: Extend existing command handler pattern (`src/bot/handlers/`) with new user management commands, enforcing RBAC via existing middleware (`src/bot/middleware/auth.ts`).

**Rationale**:

- Existing command parser and handler infrastructure supports extension
- RBAC middleware already enforces role-based access (dev, boss, employee, investor)
- WhatsApp command interface aligns with bot's interaction model
- No additional infrastructure required (uses existing Prisma and Redis)

**Alternatives Considered**:

- **Web admin panel**: Rejected due to scope (out of scope per spec)
- **REST API**: Rejected because bot operates via WhatsApp only
- **Database direct access**: Rejected due to security and audit requirements

**Implementation Notes**:

- Command format: `/user <action> <args>` (e.g., `/user add 628123456789 "John Doe" employee`)
- Phone number normalization: Use existing `normalizePhoneNumber()` from `src/lib/validation.ts`
- Role validation: Check against Prisma UserRole enum
- Audit logging: All operations logged to AuditLog model via existing `src/services/audit/logger.ts`
- Transaction safety: Prisma transactions for multi-field updates

**References**:

- Existing codebase: `src/bot/handlers/command.ts`, `src/bot/middleware/auth.ts`
- Prisma transaction documentation
- Existing user service: `src/services/user/service.ts`

---

### 5. Template Management and System Configuration

**Decision**: Store message templates and system configuration in PostgreSQL (new SystemConfiguration model) with Zod schema validation, enabling runtime edits without deployment.

**Rationale**:

- Database storage enables runtime edits without code changes
- Zod validation ensures type safety and prevents invalid configurations
- Version history support for templates enables rollback capability
- Existing Prisma infrastructure supports new models seamlessly

**Alternatives Considered**:

- **File-based templates**: Rejected because runtime edits require file system access and deployment
- **Environment variables only**: Rejected due to lack of runtime editability
- **External config service**: Rejected due to added complexity and scope

**Implementation Notes**:

- SystemConfiguration model: `key` (string, unique), `value` (JSON), `type` (string), `schema` (Zod schema string), `updatedBy` (userId), `updatedAt` (timestamp)
- Template storage: Store template strings with placeholder variables (e.g., `{{amount}}`, `{{category}}`)
- Validation: Zod schema validation before save, template syntax validation (required placeholders)
- Caching: Redis cache for frequently accessed templates and configurations
- Preview: `/template preview` command renders template with sample data

**References**:

- Prisma schema documentation
- Zod validation library
- Existing codebase: `src/config/env.ts` (Zod schemas), `src/services/system/config.ts`

---

### 6. Docker Containerization with Puppeteer Dependencies

**Decision**: Multi-stage Dockerfile with Node.js base image, installing Chromium and Puppeteer system dependencies required for whatsapp-web.js headless operation.

**Rationale**:

- whatsapp-web.js requires Puppeteer and Chromium for WhatsApp Web automation
- Multi-stage builds optimize image size
- System dependencies (libnss3, libatk-bridge2.0, etc.) required for headless Chromium
- Non-root user execution for security compliance

**Alternatives Considered**:

- **Alpine Linux base**: Rejected due to compatibility issues with Chromium dependencies
- **Full desktop environment**: Rejected due to unnecessary bloat and security surface
- **External browser service**: Rejected due to added complexity and latency

**Implementation Notes**:

- Base image: `node:20-slim` (Debian-based for Chromium compatibility)
- System dependencies: Install via `apt-get` (libnss3, libatk-bridge2.0, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxrandr2, libgbm1, libasound2, libpango-1.0-0, libcairo2, libatk1.0-0)
- User: Create `node` user (UID 1000) and run application as non-root
- Health check: HTTP endpoint `/health` returns WhatsApp connection status
- Docker Compose: Define service with volume mounts, environment variables, health checks

**References**:

- Puppeteer Docker documentation
- whatsapp-web.js installation requirements
- Docker best practices for Node.js applications

---

## Technical Decisions Summary

| Area                | Decision                             | Rationale                                                      |
| ------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Session Persistence | Docker named volumes                 | Persistence across container lifecycle, proper isolation       |
| Font Formatting     | Unicode mathematical symbols         | Visual hierarchy without external dependencies                 |
| Logging             | Winston structured JSON              | Existing infrastructure, correlation tracking, log aggregation |
| User Management     | WhatsApp commands + RBAC             | Aligns with bot interaction model, existing infrastructure     |
| Templates/Config    | PostgreSQL + Zod validation          | Runtime editability, type safety, version history              |
| Containerization    | Multi-stage Dockerfile with Chromium | Optimized size, security, Puppeteer compatibility              |

## Unresolved Questions

None. All technical unknowns have been resolved through codebase analysis and best practices research.

## Next Steps

Proceed to Phase 1: Design & Contracts

- Generate data-model.md (entities, relationships, validation rules)
- Generate API contracts (WhatsApp command interfaces)
- Create quickstart.md (Docker setup, QR authentication, command reference)
- Update agent context files
