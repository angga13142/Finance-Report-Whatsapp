# Feature Specification: WhatsApp Cashflow Bot Platform Modernization

**Feature Branch**: `001-platform-modernization`  
**Created**: December 11, 2025  
**Status**: Draft  
**Input**: User description: "WhatsApp Cashflow Bot platform modernization: Docker migration with session persistence, logging enhancement, message formatting with custom fonts, dynamic user management, and developer superuser capabilities"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Containerized Deployment Without Authentication Loss (Priority: P1)

As a system administrator, I need to deploy and redeploy the WhatsApp Cashflow Bot using Docker containers while preserving the WhatsApp Web session, so that the bot remains authenticated and operational without requiring manual QR code scanning after every container restart.

**Why this priority**: Critical infrastructure change that enables modern deployment practices (CI/CD, scaling, rollback) while maintaining service continuity. Without this, the bot would require manual intervention after each deployment, creating operational bottlenecks.

**Independent Test**: Deploy bot using `docker-compose up`, authenticate via QR code once, then execute `docker-compose down && docker-compose up`. Bot should reconnect to WhatsApp automatically without QR code prompt and process messages immediately.

**Acceptance Scenarios**:

1. **Given** the bot is running in Docker and authenticated, **When** the container is stopped and restarted, **Then** the bot reconnects to WhatsApp within 30 seconds without QR code authentication
2. **Given** the bot has never been deployed before, **When** the container starts for the first time, **Then** the QR code is displayed in container logs for initial authentication
3. **Given** session data exists in Docker volume, **When** the container is recreated from a new image, **Then** the existing session is loaded and WhatsApp connection is established
4. **Given** the bot is processing messages, **When** the container receives SIGTERM (shutdown signal), **Then** the session is saved before container exits and no messages are lost

---

### User Story 2 - Troubleshooting WhatsApp Connection Issues (Priority: P1)

As a developer or system administrator, I need structured logs of all WhatsApp Web events (connection, authentication, message flow) so that I can quickly diagnose and resolve connectivity issues, message delivery failures, and performance bottlenecks without manually reproducing errors.

**Why this priority**: Essential for production support and incident response. Without proper logging, debugging WhatsApp client issues requires guesswork and extended downtime. This directly impacts service reliability.

**Independent Test**: Trigger a WhatsApp disconnection event, reconnection attempt, and message send/receive. Verify all events are logged with timestamps, correlation IDs, and context metadata in structured JSON format.

**Acceptance Scenarios**:

1. **Given** the WhatsApp client generates a QR code, **When** the QR code is displayed, **Then** a structured log entry is created with event type 'qr_code_generated' and timestamp
2. **Given** the WhatsApp client successfully authenticates, **When** authentication completes, **Then** logs show 'authenticated' event with session metadata (no sensitive phone numbers)
3. **Given** a message is received from a user, **When** the message is processed, **Then** logs trace the message flow from receipt to database persistence with a correlation ID
4. **Given** the WhatsApp connection is lost, **When** reconnection is attempted, **Then** logs show 'disconnected' event with error details and 'reconnecting' events with attempt count
5. **Given** LOG_LEVEL is set to DEBUG, **When** any WhatsApp event occurs, **Then** raw event data is logged with sensitive fields masked

---

### User Story 3 - Visually Appealing and Readable Bot Messages (Priority: P2)

As a WhatsApp user interacting with the bot, I need bot responses to be visually formatted with bold headings, aligned numbers, and clear visual hierarchy using custom Unicode fonts, so that I can quickly understand transaction confirmations, reports, and error messages without confusion.

**Why this priority**: Directly improves user experience and reduces support requests from confused users. Well-formatted messages reduce cognitive load and increase trust in the bot's responses. Lower priority than infrastructure (P1) because the bot is functional without it.

**Independent Test**: Send a transaction command and receive a confirmation message. Verify the message uses Unicode bold for headings, monospace for currency amounts, and emoji icons for status indicators.

**Acceptance Scenarios**:

1. **Given** a transaction is successfully recorded, **When** the bot sends a confirmation message, **Then** the message uses Unicode bold for "Transaction Confirmed" heading and monospace font for currency amounts
2. **Given** a monthly report is requested, **When** the bot generates the report message, **Then** category names are formatted with Unicode bold, amounts use monospace with Rupiah symbols, and totals are visually distinguished
3. **Given** an error occurs (e.g., invalid amount), **When** the bot sends an error message, **Then** the message uses ❌ emoji and Unicode bold for error type
4. **Given** a user requests the help menu, **When** the bot sends the command list, **Then** commands use monospace font and descriptions use regular Unicode text
5. **Given** a client doesn't support Unicode mathematical alphanumeric symbols, **When** the bot sends a formatted message, **Then** the message degrades gracefully to native WhatsApp formatting (_bold_, _italic_, `monospace`)

---

### User Story 4 - Dynamic User Onboarding and Role Assignment (Priority: P2)

As a business owner (boss role) or developer (dev role), I need to add new team members, assign their roles, and manage their access to the bot directly through WhatsApp commands, so that I can onboard employees, accountants, or investors without requiring code changes or developer intervention.

**Why this priority**: Removes operational bottleneck where user management requires code deployment. Enables business agility and self-service administration. Priority below infrastructure (P1) but critical for reducing dependency on developers.

**Independent Test**: Send `/user add 628123456789 "John Doe" employee` command from a boss-role account. Verify new user can immediately access employee-level commands and all actions are logged in audit trail.

**Acceptance Scenarios**:

1. **Given** I am authenticated as a boss or dev role, **When** I send `/user add <phone> <name> <role>`, **Then** a new user is created and can immediately use bot commands appropriate to their role
2. **Given** I am authenticated as an employee, **When** I send `/user add <phone> <name> <role>`, **Then** the bot responds with "Permission denied: user management requires boss or dev role"
3. **Given** I am authenticated as boss, **When** I send `/user list employee`, **Then** the bot displays all users with employee role including phone numbers and active status
4. **Given** a user account exists, **When** I send `/user deactivate <phone>`, **Then** the user can no longer use the bot until reactivated
5. **Given** I send `/user add` with an invalid phone number, **When** the command is processed, **Then** the bot responds with validation error and correct phone format example
6. **Given** any user management command is executed, **When** the operation completes, **Then** an audit log entry is created with timestamp, actor, action, and target user

---

### User Story 5 - Real-Time Template and Configuration Management (Priority: P3)

As a developer (dev role), I need to edit message templates, modify system configuration, and diagnose system health through WhatsApp commands, so that I can respond to issues, adjust bot behavior, and troubleshoot problems without server access or code deployments.

**Why this priority**: Powerful administrative capability that improves developer productivity and incident response time. Lowest priority because it's a convenience feature for developers rather than core business functionality or infrastructure requirement.

**Independent Test**: Send `/template edit transaction-confirmation` command, modify the message format, then trigger a transaction. Verify the new template format is used immediately without container restart.

**Acceptance Scenarios**:

1. **Given** I am authenticated as dev role, **When** I send `/system status`, **Then** the bot responds with connection status for PostgreSQL, Redis, and WhatsApp client with response time metrics
2. **Given** I am authenticated as dev, **When** I send `/template list`, **Then** the bot displays all available message templates with their names and descriptions
3. **Given** I am authenticated as dev, **When** I send `/template edit <name>` and provide new template text, **Then** the template is validated, saved, and used for subsequent messages without restart
4. **Given** I am authenticated as boss, **When** I send `/system status`, **Then** the bot responds with "Permission denied: admin commands require dev role"
5. **Given** I am authenticated as dev, **When** I send `/cache clear transaction-*`, **Then** all Redis cache entries matching the pattern are cleared and a confirmation message is sent
6. **Given** I am authenticated as dev, **When** I send `/config set MAX_TRANSACTION_AMOUNT 10000000`, **Then** the configuration is validated against Zod schema, persisted to database, and applied immediately

---

### Edge Cases

- **What happens when Docker volume is deleted but container is restarted?** System should detect missing session data and initiate QR code authentication workflow as if it's a first-time setup.

- **How does the system handle concurrent user management commands?** Prisma transactions ensure atomic operations, and optimistic locking prevents race conditions when updating the same user simultaneously.

- **What happens when a font conversion function encounters an emoji or special character?** The font formatter should preserve emojis and symbols unchanged while only converting alphanumeric ASCII characters to their Unicode mathematical equivalents.

- **How does logging behave when disk space is full?** Winston should fail gracefully with warnings in console and continue operation without crashing, using log rotation to manage disk space (max file size and retention).

- **What happens when a dev user tries to edit a template with invalid syntax?** Template validation should reject the change with a clear error message showing the validation failure (e.g., missing placeholder variables) and preserve the existing template.

- **How does the bot handle phone number formats from different countries?** Phone number normalization should support international formats with country codes, and validation should accept formats like +628123456789, 08123456789, or 628123456789.

- **What happens when WhatsApp Web session expires during operation?** The bot should detect session expiration, log a WARN-level event, trigger a reconnection attempt, and if reconnection fails after 3 attempts, log an ERROR and wait for manual QR code re-authentication.

- **How does the system handle template edits during active message sending?** Template edits should not affect messages already in the send queue. New templates take effect only for messages generated after the template save operation completes.

## Requirements _(mandatory)_

**Note**: Error response formats for all WhatsApp commands are defined in `contracts/commands.md`. This document provides the complete specification of error messages, success responses, and command syntax.

### Functional Requirements

#### Docker Migration with Session Persistence

- **FR-001**: System MUST persist WhatsApp Web session data (.wwebjs_auth directory) to a Docker volume that survives container lifecycle events. Specific events: container stop (docker stop), container restart (docker restart), container recreate (docker-compose down && docker-compose up), image update with volume preservation. Test scenarios: Stop container for up to 24 hours, restart container, recreate container from new image with same volume.
- **FR-002**: Dockerfile MUST include all Puppeteer and Chromium system dependencies required by whatsapp-web.js ^1.34.2 to run in a headless Linux container
- **FR-003**: Docker volume MUST have appropriate file permissions allowing the Node.js process (running as non-root user, typically UID 1000) to read and write session files. Default permissions: 755 for directories, 644 for files. Dockerfile MUST set ownership using `chown` command.
- **FR-004**: Docker Compose configuration MUST expose a health check endpoint that reports WhatsApp client connection status (connected, authenticating, disconnected)
- **FR-005**: On container startup, system MUST detect if session data exists and either restore the session automatically or initiate QR code authentication workflow
- **FR-006**: QR code for initial authentication MUST be displayed in container logs in a format that can be scanned by mobile WhatsApp application
- **FR-007**: On container shutdown (SIGTERM), system MUST gracefully save session state before exiting

#### WhatsApp Logging Enhancement

- **FR-008**: System MUST log all whatsapp-web.js client events in structured JSON format using Winston logger. Log format schema: `{ "timestamp": "ISO 8601", "level": "ERROR|WARN|INFO|DEBUG", "eventType": "string", "correlationId": "string", "metadata": "object" }`
- **FR-009**: Each log entry MUST include: timestamp (ISO 8601), log level, event type, correlation ID, and event-specific metadata
- **FR-010**: System MUST support configurable log levels (ERROR, WARN, INFO, DEBUG) via LOG_LEVEL environment variable
- **FR-011**: System MUST mask sensitive data in logs including phone numbers (show only last 4 digits) and message content (log only message type and length, not content)
- **FR-012**: System MUST assign a unique correlation ID (UUID v4 format) to each incoming message and track it through all processing stages (receipt → validation → service → database → response). Correlation ID MUST be unique per message and persist across all log entries for that message.
- **FR-013**: System MUST log the following WhatsApp events at minimum: qr_code_generated, authenticated, ready, disconnected, message_received, message_sent, message_ack, auth_failure
- **FR-014**: Log rotation MUST be configured to prevent disk space exhaustion (maximum 100MB per log file, retain last 14 days)

#### Message Formatting with Custom Fonts

- **FR-015**: System MUST provide a font conversion utility library (src/lib/font-formatter.ts) with functions: toBold(), toItalic(), toMonospace(), toScript(), toBoldItalic()
- **FR-016**: Font conversion functions MUST convert ASCII alphanumeric characters (A-Z, a-z, 0-9) to their Unicode mathematical alphanumeric symbol equivalents. Specific Unicode ranges: Bold (U+1D400-U+1D433 for A-Z, U+1D434-U+1D467 for a-z, U+1D7CE-U+1D7D7 for 0-9), Italic (U+1D434-U+1D467 for A-Z, U+1D468-U+1D49B for a-z, U+1D7E2-U+1D7EB for 0-9), Monospace (U+1D670-U+1D6A3 for A-Z, U+1D6A4-U+1D6D7 for a-z, U+1D7F6-U+1D7FF for 0-9)
- **FR-017**: Font conversion functions MUST preserve emojis, punctuation, and non-ASCII characters unchanged
- **FR-018**: System MUST handle gracefully when a Unicode mathematical character has no equivalent (e.g., certain numbers in some font styles) by falling back to native WhatsApp formatting (_bold_, _italic_, `` `monospace` ``). Detection method: If character mapping lookup returns undefined or null, use original character and apply native formatting wrapper instead.
- **FR-019**: All message templates in src/bot/ui/ MUST be updated to use font conversion utilities for consistent visual hierarchy
- **FR-020**: Currency amounts MUST be formatted using toMonospace() with Rupiah symbol (Rp) and thousand separators (e.g., "Rp 1.500.000")
- **FR-021**: Message headings MUST use toBold() for primary headings and toBoldItalic() for secondary emphasis
- **FR-022**: Error messages MUST use ❌ emoji prefix, success messages ✅ emoji, financial data 💰 emoji, and reports 📊 emoji
- **FR-023**: Font conversion MUST add less than 5ms overhead per message to maintain performance
- **FR-024**: System MUST include unit tests verifying font conversion with edge cases: empty strings, special characters, mixed alphabets, numbers, long strings

#### Dynamic User Management

- **FR-025**: System MUST provide WhatsApp commands: `/user add <phone> <name> <role>`, `/user list [role]`, `/user update <phone> <field> <value>`, `/user delete <phone>`, `/user activate <phone>`, `/user deactivate <phone>`. Error response formats are defined in contracts/commands.md
- **FR-026**: User management commands MUST only be accessible to users with dev or boss roles (RBAC enforcement in middleware)
- **FR-027**: Phone number validation MUST normalize international formats (+628xxx, 08xxx, 628xxx) to a canonical format (E.164) using existing normalizePhoneNumber() function
- **FR-028**: Role validation MUST check against Prisma UserRole enum (dev, boss, employee, investor) and reject invalid roles
- **FR-029**: System MUST prevent duplicate user creation (same phone number) and respond with clear error message. Error response format: `❌ User already exists with phone number: <phone>` (see contracts/commands.md)
- **FR-030**: All user management operations MUST be logged to AuditLog model with: timestamp, actor (user who executed command), action (add/update/delete/activate/deactivate), target (affected user), and old/new values
- **FR-031**: User deactivation MUST immediately revoke access (active sessions denied on next command). Timing: Access revocation takes effect on the next command attempt after deactivation, with no grace period. Redis cache MUST be invalidated immediately upon deactivation.
- **FR-032**: `/user list` command MUST support optional role filter and display: phone number (last 4 digits visible), full name, role, active status, created date
- **FR-033**: User update operations MUST use Prisma transactions for multi-field updates to ensure atomicity

#### Developer Superuser Capabilities

- **FR-034**: System MUST provide admin commands accessible only to dev role: `/template list`, `/template edit <name>`, `/template preview <name>`, `/role grant <phone> <role>`, `/role revoke <phone> <role>`, `/system status`, `/system logs [lines]`, `/system metrics`, `/config view <key>`, `/config set <key> <value>`, `/cache clear [pattern]`, `/cache inspect <key>`. Error response formats are defined in contracts/commands.md
- **FR-035**: `/template list` MUST display all message templates from src/bot/ui/ with their names, file paths, and usage descriptions
- **FR-036**: `/template edit <name>` MUST validate template syntax (check for required placeholder variables in format `{{variableName}}`, validate placeholder names match expected variables, reject if required placeholders are missing), save to database, and apply immediately (next message sent after save operation completes) without container restart
- **FR-037**: `/template preview <name>` MUST render the template with sample data and display the formatted output for review
- **FR-038**: `/role grant` and `/role revoke` MUST update user roles immediately and invalidate relevant sessions in Redis cache. Cache key patterns to invalidate: `user-<phone>`, `session-<phone>`, `role-<phone>`
- **FR-039**: `/system status` MUST aggregate health checks from: PostgreSQL (connection pool status), Redis (connection status), WhatsApp client (connection state), and include response time metrics for each. Aggregation method: Execute health checks in parallel with 5-second timeout per service. If any service check times out, mark as "timeout" status.
- **FR-040**: `/system logs [lines]` MUST return the last N lines (default 50, max 500) from the application log file
- **FR-041**: `/system metrics` MUST display Prometheus metrics including: message processing rate, database query performance, cache hit ratio, error rates
- **FR-042**: `/config view <key>` MUST retrieve configuration value from database and display (mask sensitive values like API keys)
- **FR-043**: `/config set <key> <value>` MUST validate new configuration value against Zod schema from src/config/env.ts before persisting. If validation fails, return error message: `❌ Validation error: <specific Zod validation error message>`. Schema location: `src/config/env.ts`, validation error handling: Return user-friendly error message with specific field and constraint violated.
- **FR-044**: `/cache clear [pattern]` MUST clear Redis keys matching the pattern (supports wildcards using glob pattern syntax, e.g., `transaction-*` matches all keys starting with "transaction-") and return count of cleared keys
- **FR-045**: `/cache inspect <key>` MUST retrieve and display the cached value with TTL information
- **FR-046**: All admin operations MUST be logged to AuditLog with full context for security auditing

### Key Entities

- **WhatsAppSession** (Docker Volume): Persistent storage for whatsapp-web.js authentication state including .wwebjs_auth directory contents. Critical for maintaining authenticated state across container restarts.

- **LogEntry** (Winston Transport): Structured JSON log records containing timestamp, level, event type, correlation ID, and masked metadata. Persisted to rotating log files with retention policy.

- **FontConversionMap** (Library Constant): Character mapping tables from ASCII alphanumeric to Unicode mathematical alphanumeric symbols for each font style (bold, italic, monospace, script, bold-italic).

- **MessageTemplate** (Configuration Entity): Editable message format strings stored in database with placeholder variables. Used by UI layer to generate consistent user-facing messages. Includes version history for rollback.

- **AuditLog** (Existing Prisma Model): Immutable record of all user management and admin operations. Attributes: id, timestamp, actorUserId, action, targetEntity, targetId, oldValue, newValue, metadata.

- **SystemConfiguration** (New Prisma Model): Runtime-editable configuration key-value pairs validated against Zod schemas. Attributes: key, value, type, schema, updatedBy, updatedAt. Enables configuration changes without deployment.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: WhatsApp session persists across container restarts with 100% success rate (no manual QR code re-authentication required for normal restarts)
- **SC-002**: Container startup time from cold boot to WhatsApp "ready" state completes in under 60 seconds with existing session
- **SC-003**: All WhatsApp client events (minimum 13 event types as defined in FR-013) are logged with structured JSON format and correlation IDs
- **SC-004**: Log files do not exceed 100MB per file and system automatically rotates logs maintaining 14-day retention
- **SC-005**: Message formatting with Unicode fonts renders correctly on 95% of WhatsApp clients (Android, iOS, WhatsApp Web)
- **SC-006**: Font conversion overhead adds less than 5ms per message (measured from conversion function call to return)
- **SC-007**: User management operations (add, update, delete, activate, deactivate) complete in under 2 seconds including database persistence and audit logging
- **SC-008**: Boss and dev roles can onboard new users without developer involvement, reducing onboarding time from 1 day (code deployment) to 1 minute (WhatsApp command)
- **SC-009**: Developer admin commands provide system diagnostics in under 10 seconds, enabling rapid incident response
- **SC-010**: Template edits take effect immediately (next message sent) without requiring application restart or deployment
- **SC-011**: Zero downtime during Docker container updates (rolling deployment with session persistence)
- **SC-012**: All user management and admin operations are auditable with 100% audit log coverage for compliance requirements
- **SC-013**: System handles at least 1000 concurrent WhatsApp users with containerized deployment without performance degradation
- **SC-014**: Error messages and formatted reports are understood by 90% of users on first read (measured by reduction in support questions about message interpretation)

## Assumptions

- WhatsApp Web API (via whatsapp-web.js) will remain compatible with version ^1.34.2 and not introduce breaking changes requiring library upgrade
- Docker volume storage will have sufficient IOPS and throughput to handle session file I/O without performance bottlenecks
- Unicode mathematical alphanumeric symbols (U+1D400-U+1D7FF) are supported by modern WhatsApp clients (Android 8+, iOS 12+, WhatsApp Web on modern browsers)
- PostgreSQL database has sufficient capacity to store template versions, configuration history, and expanded audit logs
- Redis cache has sufficient memory to store session data, configuration cache, and template cache
- System administrators have access to Docker logs for initial QR code authentication during first deployment
- Network connectivity between WhatsApp servers and the containerized bot is stable for session maintenance
- File system permissions in Docker container can be configured to allow non-root Node.js process to write to session volume
- Font files in `font/` directory are decorative/reference only; actual font rendering uses Unicode mathematical symbols which don't require font file loading

## Dependencies

- **External**:
  - WhatsApp Web services availability and API stability (whatsapp-web.js relies on WhatsApp Web interface)
  - Docker Engine 20.10+ and Docker Compose 2.0+ for containerization
  - Chromium/Puppeteer compatibility with whatsapp-web.js ^1.34.2 in containerized Linux environment
  - Unicode support in WhatsApp client applications for mathematical alphanumeric symbols

- **Internal**:
  - Existing authentication flow in src/bot/client/auth.ts must be compatible with containerized environment
  - Existing logger infrastructure (src/lib/logger.ts) using Winston ^3.11.0 for log enhancement
  - Existing RBAC middleware (src/bot/middleware/auth.ts) for user management and admin command authorization
  - Existing validation utilities (src/lib/validation.ts) for phone number normalization
  - Existing Prisma schema and migration system for database changes (new SystemConfiguration model, AuditLog enhancements)
  - Existing Redis infrastructure (src/lib/redis.ts) for cache management commands
  - Existing environment configuration (src/config/env.ts with Zod schemas) for configuration validation

## Constraints

- **Technical**:
  - MUST maintain exact version: whatsapp-web.js ^1.34.2, Node.js >=20.0.0, TypeScript 5.x (no breaking version changes)
  - MUST use existing 4-layer architecture (Bot → Service → Model → Database) without architectural violations
  - MUST follow existing patterns in .github/copilot-instructions.md for code organization and naming
  - Font conversion MUST NOT load external font files (only Unicode character mapping)
  - Docker image MUST be optimized for size (multi-stage builds, minimal base image)
  - MUST run Node.js process as non-root user in container for security

- **Security**:
  - MUST mask all sensitive data (phone numbers, API keys, secrets) in logs
  - MUST enforce RBAC for all user management and admin commands (no privilege escalation)
  - MUST use Prisma parameterized queries (no SQL injection)
  - MUST validate all command inputs before processing
  - MUST encrypt WhatsApp session data at rest in Docker volume (if host supports volume encryption)
  - Admin commands MUST log all actions to audit trail with actor identification
  - Template edits MUST validate syntax to prevent injection attacks

- **Performance**:
  - Font conversion overhead MUST NOT exceed 5ms per message
  - Container startup MUST NOT exceed 60 seconds to WhatsApp ready state
  - User management operations MUST complete within 2 seconds
  - Admin diagnostic commands MUST respond within 10 seconds
  - Log writing MUST be asynchronous to avoid blocking message processing
  - Template edits MUST NOT require application restart

- **Operational**:
  - MUST support zero-downtime deployments with session persistence
  - MUST include rollback strategy for failed Docker deployments
  - MUST document QR code authentication process for first-time container setup
  - MUST provide Docker Compose configuration for both development and production environments
  - MUST maintain backward compatibility with existing database schema (Prisma migrations only, no breaking changes)

## Scope Boundaries

### In Scope

- Docker containerization of existing WhatsApp Cashflow Bot application
- WhatsApp session persistence across container lifecycle using Docker volumes
- Structured JSON logging for all whatsapp-web.js events with correlation tracking
- Unicode font conversion utility for message formatting (bold, italic, monospace, script)
- WhatsApp command interface for user management (CRUD operations) by boss and dev roles
- WhatsApp command interface for admin operations (templates, config, diagnostics) by dev role
- Database migrations for new SystemConfiguration and AuditLog enhancements
- Comprehensive unit, integration, and e2e tests for all new features
- Documentation for Docker setup, QR authentication, command reference, and font style guide

### Out of Scope

- Migration to different WhatsApp client library (staying with whatsapp-web.js ^1.34.2)
- Kubernetes orchestration (Docker Compose only)
- Multi-instance/clustering support (single container deployment)
- Automated QR code authentication without human intervention (not technically feasible with WhatsApp Web)
- Custom font file loading or web font rendering (Unicode symbols only)
- Graphical user interface for user management or admin operations (WhatsApp commands only)
- Real-time log streaming web dashboard (CLI access to logs only)
- Advanced template editor with syntax highlighting (plain text editing via WhatsApp)
- Multi-tenancy or multiple WhatsApp number support (single bot instance)
- Backup and restore automation for session data (manual volume backup)
- Performance monitoring dashboard (Prometheus metrics endpoint only)
- Migration of existing users or data (operates on existing database)
- Changes to existing transaction, approval, or reporting workflows (infrastructure and UX improvements only)

## Risks & Mitigations

### Risk 1: WhatsApp Session Invalidation in Docker Environment

**Description**: WhatsApp Web may invalidate sessions more aggressively in containerized environments due to IP changes, container ID changes, or filesystem differences.

**Likelihood**: Medium  
**Impact**: High (would require frequent manual QR code re-authentication)

**Mitigation**:

- Use Docker volume with consistent mount point to preserve filesystem identity
- Assign static IP to container in Docker network
- Implement session health check on startup to detect invalid sessions early
- Document QR code re-authentication process for rapid recovery
- Monitor session lifetime metrics to detect patterns of invalidation

### Risk 2: Unicode Font Compatibility

**Description**: Some WhatsApp clients (older Android/iOS versions, modified clients) may not render Unicode mathematical alphanumeric symbols correctly, displaying boxes or garbled text.

**Likelihood**: Medium  
**Impact**: Medium (affects user experience but not functionality)

**Mitigation**:

- Implement automatic fallback to native WhatsApp formatting (_bold_, _italic_) when Unicode fonts fail
- Include user agent detection (if possible) to select appropriate formatting method
- Provide configuration option to disable Unicode fonts and use native formatting only
- Document known compatibility issues and recommended client versions
- Design templates to be readable even without font styling (content-first approach)

### Risk 3: Docker Volume Permission Issues

**Description**: File permissions on Docker volumes may prevent Node.js process (non-root user) from reading/writing session files, causing authentication failures.

**Likelihood**: Medium  
**Impact**: High (prevents bot from starting)

**Mitigation**:

- Explicitly set volume permissions in Dockerfile using chown
- Run Node.js as a specific UID/GID with documented requirements
- Include health check script that validates write permissions on startup
- Provide troubleshooting documentation for common permission errors
- Test on multiple Docker host configurations (Linux, Docker Desktop, cloud providers)

### Risk 4: Template Edit Syntax Errors

**Description**: Developers editing templates via WhatsApp commands may introduce syntax errors (missing placeholders, malformed formatting) that break message generation.

**Likelihood**: Medium  
**Impact**: Medium (affects specific message types)

**Mitigation**:

- Implement strict template validation before saving (check for required placeholders)
- Store template version history in database for rollback capability
- Provide `/template preview` command to test changes before applying
- Log all template edits to audit trail with before/after comparison
- Implement template sandboxing to test rendering with sample data before activation
- Set up automated tests that verify critical templates remain functional after edits

### Risk 5: Log Storage Exhaustion

**Description**: High message volume or DEBUG logging in production could fill disk space with logs, causing application or host system failures.

**Likelihood**: Low  
**Impact**: High (could crash application or host)

**Mitigation**:

- Configure aggressive log rotation (100MB max file size, 14-day retention)
- Implement log level guards (DEBUG only in development, INFO+ in production)
- Set up disk space monitoring alerts in Docker host
- Use log streaming to external systems (e.g., CloudWatch, ELK) for long-term retention
- Include emergency log cleanup command in admin toolkit (`/system logs clear --older-than 7d`)

### Risk 6: Performance Degradation from Font Conversion

**Description**: Font conversion for every message could introduce latency if character mapping is inefficient, affecting user experience under high load.

**Likelihood**: Low  
**Impact**: Medium (slower response times)

**Mitigation**:

- Pre-compute character mapping tables at application startup
- Use efficient lookup data structures (Map or object literal)
- Implement caching for frequently used formatted strings
- Set performance budget (5ms max) and enforce with automated tests
- Profile font conversion in load tests with realistic message volumes
- Provide configuration option to disable font conversion if performance issues occur

## Implementation Phases (Suggested)

### Phase 1: Docker Migration Foundation (P1)

- Dockerfile creation with Puppeteer dependencies
- Docker Compose configuration with session volume
- Session persistence testing and validation
- Health check endpoint implementation
- Documentation for initial QR code setup

### Phase 2: Logging Infrastructure (P1)

- Winston logger enhancement with structured events
- WhatsApp event listeners with correlation IDs
- Log masking for sensitive data
- Log rotation configuration
- Integration testing for log coverage

### Phase 3: Message Formatting (P2)

- Font conversion utility library implementation
- Unicode character mapping tables
- Unit tests for font conversion functions
- Template updates for all UI components
- Compatibility testing across WhatsApp clients
- Font style guide documentation

### Phase 4: User Management (P2)

- User management command handlers
- Service layer for CRUD operations
- RBAC enforcement in middleware
- Audit log integration
- Unit and integration tests
- Command reference documentation

### Phase 5: Admin Capabilities (P3)

- Admin command handlers (template, config, system, cache)
- Template management service with validation
- Configuration service with Zod validation
- System diagnostics aggregation
- Cache management utilities
- Security review and penetration testing
- Admin command reference documentation

## Notes

- All implementations must follow patterns in .github/copilot-instructions.md (4-layer architecture, naming conventions, TypeScript strict mode)
- Security requirements from .github/instructions/security-and-owasp.instructions.md apply to all command inputs and template edits
- Testing standards from .github/instructions/testing-jest-playwright.instructions.md must be followed (>80% coverage for critical paths)
- Database changes require Prisma migrations (no manual schema edits)
- Font conversion is purely Unicode-based (no external font file dependencies)
- Graceful degradation is essential for cross-client compatibility (Unicode fonts, logging, session persistence)
- Performance budgets must be enforced: font conversion <5ms, user operations <2s, admin diagnostics <10s, container startup <60s
