# Feature Specification: WhatsApp Cashflow Bot Enhancements

**Feature Branch**: `001-bot-enhancements`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Generate a comprehensive technical specification document for the following WhatsApp Cashflow Bot enhancements. The specification must align with the existing codebase architecture (4-layer: Bot → Service → Model → Database) and follow all patterns defined in copilot-instructions.md."

## Clarifications

### Session 2025-01-27

- Q: How should the developer phone number be configured? → A: Developer phone number must be configurable via environment variable (e.g., `DEV_PHONE_NUMBER`) to allow deployment-specific configuration without code changes
- Q: Where should runtime configuration changes (via `/config set`) be persisted? → A: Persist to database with environment variable override - Changes saved to database, but environment variables take precedence on startup

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Deploy Bot in Container Without Losing WhatsApp Connection (Priority: P1)

As a system administrator, I want to deploy the WhatsApp Cashflow Bot in a containerized environment so that I can manage infrastructure consistently, while ensuring the WhatsApp authentication session persists across container restarts and redeployments.

**Why this priority**: Containerization is essential for production deployment, scalability, and infrastructure management. Losing WhatsApp authentication on every container restart would require manual QR code re-authentication, causing service downtime and operational disruption.

**Independent Test**: Can be fully tested by deploying the bot in Docker, stopping and restarting the container, and verifying that the WhatsApp connection remains active without requiring new QR code authentication. This delivers reliable, production-ready deployment capability.

**Acceptance Scenarios**:

1. **Given** the bot is running in a Docker container with an active WhatsApp session, **When** the container is stopped and restarted, **Then** the bot automatically reconnects to WhatsApp using the persisted session without requiring QR code authentication
2. **Given** the bot is deployed with Docker Compose, **When** I execute `docker-compose down && docker-compose up`, **Then** the WhatsApp session data is preserved in a Docker volume and the bot reconnects successfully
3. **Given** a new deployment environment, **When** I start the container for the first time, **Then** the system displays a QR code for initial WhatsApp authentication and stores the session in a persistent volume
4. **Given** the container is running, **When** I access the health check endpoint, **Then** it reports the WhatsApp client connection status (connected/disconnected/authenticating)

---

### User Story 2 - Monitor WhatsApp Events for Troubleshooting (Priority: P1)

As a developer or system administrator, I want comprehensive logging of all WhatsApp client events so that I can diagnose connection issues, message delivery problems, and authentication failures without manual investigation.

**Why this priority**: WhatsApp integration issues are difficult to debug without visibility into client events. Structured logging enables rapid troubleshooting of production issues, reducing mean time to resolution (MTTR) and improving system reliability.

**Independent Test**: Can be fully tested by triggering various WhatsApp events (QR generation, authentication, message send/receive, disconnection) and verifying that all events are logged with structured metadata, appropriate log levels, and masked sensitive data. This delivers operational observability for production support.

**Acceptance Scenarios**:

1. **Given** the bot is running, **When** WhatsApp generates a QR code for authentication, **Then** the system logs this event at INFO level with structured metadata including timestamp and correlation ID
2. **Given** a message is received from a user, **When** the message is processed, **Then** the system logs the message receipt event with correlation ID, masked phone number, and masked message content
3. **Given** the WhatsApp connection is lost, **When** the client attempts reconnection, **Then** the system logs reconnection attempts at WARN level with retry count and error details
4. **Given** a message fails to send, **When** the error occurs, **Then** the system logs the failure at ERROR level with full context including recipient (masked), message type, and error details
5. **Given** logs are generated, **When** I review log entries, **Then** all phone numbers and message content are masked according to security patterns, and no sensitive data is exposed

---

### User Story 3 - Improve Message Readability with Enhanced Formatting (Priority: P2)

As a user (boss, employee, investor, or dev), I want bot messages to be visually clear and easy to read so that I can quickly understand transaction confirmations, reports, and system responses without confusion.

**Why this priority**: Improved message formatting enhances user experience, reduces misinterpretation of financial data, and makes the bot more professional and trustworthy. This is especially important for financial transactions where clarity prevents errors.

**Independent Test**: Can be fully tested by sending various message types (transaction confirmations, reports, help menus, error messages) and verifying that messages use consistent formatting with visual hierarchy, appropriate emoji usage, and readable currency formatting. This delivers improved user experience and reduced support queries.

**Acceptance Scenarios**:

1. **Given** a transaction is successfully recorded, **When** the confirmation message is sent, **Then** the message uses bold formatting for the transaction type, monospace formatting for currency amounts, and appropriate emoji (✅) for visual confirmation
2. **Given** a financial report is generated, **When** the report is sent to the user, **Then** the report uses consistent formatting with bold headers, monospace for numeric data, and emoji categorization (💰 for income, 💸 for expenses, 📊 for reports)
3. **Given** an error occurs, **When** an error message is sent, **Then** the message uses clear visual indicators (❌ emoji) and formatted error text for quick identification
4. **Given** a help menu is displayed, **When** the menu is sent, **Then** the menu uses structured formatting with bold section headers and monospace for command examples
5. **Given** currency values are displayed, **When** amounts are formatted, **Then** they include Rupiah symbol (Rp) and thousand separators for readability (e.g., "Rp 500.000")

---

### User Story 4 - Manage Users via WhatsApp Commands (Priority: P2)

As a boss or dev role user, I want to manage user accounts (create, view, update, delete, activate/deactivate) directly through WhatsApp commands so that I can handle user administration tasks without accessing a separate admin interface or making code changes.

**Why this priority**: User management is a common administrative task. Enabling it via WhatsApp eliminates the need for separate admin tools, reduces operational overhead, and allows immediate response to user access requests or issues.

**Independent Test**: Can be fully tested by executing user management commands (add, list, update, delete, activate, deactivate) as a boss or dev user and verifying that all operations complete successfully with appropriate validation, error handling, and audit logging. This delivers self-service user administration capability.

**Acceptance Scenarios**:

1. **Given** I am logged in as a boss or dev role, **When** I send `/user add +6281234567890 John employee`, **Then** the system creates a new user account with the specified phone number, name, and role, and confirms creation with a success message
2. **Given** I am logged in as a boss or dev role, **When** I send `/user list`, **Then** the system returns a formatted list of all users with their phone numbers (masked), names, roles, and active status
3. **Given** I am logged in as a boss or dev role, **When** I send `/user list employee`, **Then** the system returns only users with the employee role
4. **Given** I am logged in as a boss or dev role, **When** I send `/user update +6281234567890 name Jane`, **Then** the system updates the user's name and confirms the change
5. **Given** I am logged in as a boss or dev role, **When** I send `/user delete +6281234567890`, **Then** the system deletes the user account and confirms deletion
6. **Given** I am logged in as an employee or investor role, **When** I attempt to use a user management command, **Then** the system denies access with a clear permission error message
7. **Given** any user management operation is performed, **When** the operation completes, **Then** the system logs the action to the audit trail with actor, action, target, and timestamp

---

### User Story 5 - Developer Administrative Capabilities (Priority: P3)

As a developer role user, I want comprehensive administrative capabilities to manage system configuration, templates, roles, diagnostics, and cache so that I can maintain and troubleshoot the system without code changes or server access.

**Why this priority**: Developer administrative capabilities enable rapid response to production issues, configuration changes, and system maintenance without requiring code deployments or direct server access. This reduces operational overhead and improves system agility.

**Independent Test**: Can be fully tested by executing developer commands (template management, role management, system diagnostics, configuration management, cache operations) as a dev user and verifying that all operations complete successfully with appropriate security checks and logging. This delivers comprehensive system administration via WhatsApp.

**Acceptance Scenarios**:

1. **Given** I am logged in as a dev role, **When** I send `/template list`, **Then** the system returns a list of all available message templates
2. **Given** I am logged in as a dev role, **When** I send `/template preview welcome`, **Then** the system displays a preview of the welcome message template with current content
3. **Given** I am logged in as a dev role, **When** I send `/template edit welcome [new content]`, **Then** the system validates and updates the template, and confirms the change
4. **Given** I am logged in as a dev role, **When** I send `/role grant +6281234567890 boss`, **Then** the system immediately grants the boss role to the user and the change takes effect for subsequent commands
5. **Given** I am logged in as a dev role, **When** I send `/system status`, **Then** the system reports the health status of database connection, Redis connection, and WhatsApp client connection
6. **Given** I am logged in as a dev role, **When** I send `/system logs 50`, **Then** the system returns the last 50 log entries with masked sensitive data
7. **Given** I am logged in as a dev role, **When** I send `/config view LOG_LEVEL`, **Then** the system returns the current value of the LOG_LEVEL configuration
8. **Given** I am logged in as a dev role, **When** I send `/config set LOG_LEVEL debug`, **Then** the system validates the value, updates the configuration, and applies it without requiring a restart
9. **Given** I am logged in as a dev role, **When** I send `/cache clear`, **Then** the system clears all cache entries and confirms the operation
10. **Given** I am logged in as a boss, employee, or investor role, **When** I attempt to use a developer command, **Then** the system denies access with a clear permission error message
11. **Given** any developer administrative operation is performed, **When** the operation completes, **Then** the system logs the action to the audit trail with full context

---

### Edge Cases

**Docker & Session Persistence**:

- **EC-001**: When Docker volume permissions prevent the Node.js process from reading/writing session data, system MUST log error at ERROR level, attempt to fix permissions (chmod/chown), and if unsuccessful, fall back to displaying QR code for re-authentication
- **EC-002**: When WhatsApp session corruption or invalid session data is detected on container startup, system MUST log warning, delete corrupted session files, and trigger QR code authentication flow
- **EC-003**: When container restarts during active WhatsApp connection, system MUST gracefully disconnect, save session state, and restore connection on restart within 10 seconds
- **EC-004**: When Docker volume mount fails, system MUST log error and continue with in-memory session (non-persistent) with warning message

**Logging**:

- **EC-005**: When log files reach maximum size (5MB) during high-volume message processing, system MUST rotate log file asynchronously without blocking message processing, keeping maximum 5 rotated files
- **EC-006**: When log write failures occur during high-volume events, system MUST queue log writes asynchronously, retry up to 3 times with exponential backoff, and continue message processing without blocking (see FR-036 for implementation details)
- **EC-007**: When correlation ID collision occurs (extremely rare with UUID v4), system MUST generate new correlation ID and log warning

**Font Formatting**:

- **EC-008**: When Unicode font conversion encounters unsupported characters (emojis, special symbols), system MUST preserve original characters unchanged and continue conversion for supported characters
- **EC-009**: When font conversion performance exceeds 5ms threshold, system MUST log warning and consider optimization (caching, batch processing)
- **EC-010**: When message exceeds 4096 character limit, system MUST truncate with ellipsis while preserving formatting structure

**User Management**:

- **EC-011**: When user management command is sent with invalid phone number format, system MUST return error: "❌ Invalid phone number format. Use +6281234567890 or 081234567890"
- **EC-012**: When duplicate user creation is attempted, system MUST return error: "❌ User with phone number +62 \*\*\*\*7890 already exists" and prevent database insert
- **EC-013**: When user deletion is attempted for dev role user, system MUST return error: "❌ Cannot delete dev role user" and prevent deletion
- **EC-014**: When user deletion is attempted for active session user, system MUST invalidate their active sessions in Redis before deletion
- **EC-015**: When role change is performed on currently active user, system MUST update session permissions immediately and invalidate cached RBAC checks
- **EC-016**: When concurrent user management operations conflict, system MUST use database transactions and optimistic locking, with last-write-wins strategy and conflict notification

**Developer Capabilities**:

- **EC-017**: When template edit contains invalid syntax or formatting, system MUST validate before persistence, reject with error: "❌ Invalid template syntax. Check placeholder format: {{placeholder}}", and prevent database update
- **EC-018**: When configuration change requires validation against schemas and validation fails, system MUST reject with error: "❌ Invalid value for '[key]'. [validation error message]" and prevent database update
- **EC-019**: When cache clear operation is performed during active message processing, system MUST use non-blocking Redis SCAN operation or queue clear operation after current message batch completes
- **EC-020**: When system diagnostics encounters database or Redis temporarily unavailable, system MUST return "disconnected" status with timeout error details (masked), and continue checking other components
- **EC-021**: When DEV_PHONE_NUMBER environment variable is not set or contains invalid phone number, system MUST log warning, use fallback dev user identification (if configured), or deny dev role access until properly configured
- **EC-022**: When configuration value is set via `/config set` but same key exists in environment variables on next startup, system MUST apply environment variable value (env takes precedence) and log info message about override
- **EC-023**: When template edit conflicts occur (concurrent edits), system MUST use database optimistic locking, apply last-write-wins strategy, and notify user of conflict
- **EC-024**: When configuration change breaks system functionality, system MUST validate critical configuration values before applying, provide rollback mechanism (revert to previous value), and log error with context

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST persist WhatsApp authentication session data in a Docker named volume (not bind mount) that survives container restarts and redeployments. Volume must be declared in docker-compose.yml with name `whatsapp-session` and mounted at `/app/.wwebjs_auth` with read/write permissions for Node.js user (UID 1000, GID 1000, mode 755)
- **FR-002**: System MUST automatically restore WhatsApp session from persisted data on container startup within 10 seconds of container start, without requiring QR code re-authentication
- **FR-003**: System MUST support initial QR code authentication workflow in containerized environment with proper volume permissions. On first container start with no existing session, system MUST display QR code and wait for authentication, then store session in persistent volume
- **FR-004**: System MUST provide a health check endpoint at `GET /health` that returns JSON response: `{"status": "ok"|"degraded"|"down", "whatsapp": "connected"|"disconnected"|"authenticating", "database": "connected"|"disconnected", "redis": "connected"|"disconnected", "timestamp": "ISO8601"}` with HTTP status 200 (ok), 503 (degraded/down)
- **FR-005**: System MUST log all WhatsApp client events (QR generation, authentication success/failure, disconnection, message receive, message send, message send failure) with structured JSON format. Log entry structure: `{"timestamp": "ISO8601", "level": "ERROR|WARN|INFO|DEBUG", "event": "whatsapp.qr"|"whatsapp.auth"|"whatsapp.disconnect"|"whatsapp.message.receive"|"whatsapp.message.send"|"whatsapp.message.send.failure", "correlationId": "UUIDv4", "data": {...masked...}, "metadata": {...}}`. Example log entry: `{"timestamp": "2025-01-27T10:30:00.000Z", "level": "INFO", "event": "whatsapp.message.receive", "correlationId": "550e8400-e29b-41d4-a716-446655440000", "data": {"from": "+62 ****7890", "message": "[REDACTED]", "messageId": "msg_123"}, "metadata": {"clientVersion": "1.34.2", "sessionId": "session-cashflow-bot"}}`
- **FR-006**: System MUST use appropriate log levels: ERROR for connection failures and message send failures, WARN for reconnection attempts and authentication warnings, INFO for successful operations (QR generation, authentication success, message receive, message send success), DEBUG for raw event details
- **FR-007**: System MUST include correlation IDs (UUID v4 format) in log entries to trace message flows from receipt to database persistence. Correlation ID MUST be generated per message flow and persist across all related log entries for that flow
- **FR-008**: System MUST mask sensitive data (phone numbers, message content) in all log entries following established security patterns from `src/lib/logger.ts` (`SENSITIVE_PATTERNS`). Phone numbers masked as `+62 ****7890`, message content masked as `[REDACTED]` or truncated with `...`
- **FR-009**: System MUST support configurable log level via environment variable `LOG_LEVEL` (values: error, warn, info, debug). Default: info
- **FR-036**: System MUST handle log write failures during high-volume message processing by queuing log writes asynchronously and continuing message processing without blocking. Failed log writes MUST be retried up to 3 times with exponential backoff
- **FR-037**: System MUST implement log file rotation when log files reach 5MB size, keeping maximum 5 rotated files. Rotation MUST not block message processing
- **FR-010**: System MUST apply enhanced formatting to all bot response messages using Unicode mathematical alphanumeric symbols (U+1D400 to U+1D7FF range) for visual styling. Character mappings: Bold (U+1D400-1D433 for A-Z, U+1D434-1D467 for a-z, U+1D7CE-1D7D7 for 0-9), Italic (U+1D434-1D467 for A-Z, U+1D468-1D49B for a-z), Monospace (U+1D670-1D6A3 for A-Z, U+1D68A-1D6BD for a-z, U+1D7F6-1D7FF for 0-9), Script (U+1D49C-1D4CF for A-Z, U+1D4D0-1D503 for a-z)
- **FR-011**: System MUST provide font conversion utilities for bold, italic, monospace, script, and bold-italic text transformations. Utilities MUST cache character mappings for performance optimization (target: <5ms per message)
- **FR-012**: System MUST use consistent visual hierarchy in messages: bold Unicode formatting for headers and transaction types, monospace Unicode formatting for numeric data (amounts, IDs, dates), emoji for categorization (✅ success, ❌ error, 💰 income, 💸 expense, 📊 reports, ⚙️ system). Visual hierarchy MUST be consistent across all message types (transaction confirmations, reports, error messages, help menus)
- **FR-013**: System MUST format currency values with Rupiah symbol (Rp) prefix and thousand separators using dots (e.g., "Rp 500.000", "Rp 1.250.000"). Format: `Rp [amount with thousand separators]`
- **FR-014**: System MUST gracefully handle unsupported characters in font conversion by preserving original characters (emojis, special symbols, non-ASCII characters) and falling back to native WhatsApp formatting (_bold_, _italic_, `monospace`) if Unicode conversion fails. Font conversion MUST not add more than 5ms overhead per message
- **FR-038**: System MUST handle very long messages (over 4096 characters) by truncating with ellipsis and preserving formatting. Message length limit: 4096 characters (WhatsApp Web.js limit)
- **FR-039**: System MUST handle mixed character sets (Unicode mathematical symbols + emojis + ASCII) by converting supported characters and preserving unsupported characters unchanged
- **FR-015**: System MUST allow boss and dev role users to create new user accounts via WhatsApp command `/user add <phone> <name> <role>`. Parameters: phone (required, format: +6281234567890 or 081234567890), name (required, 1-100 characters), role (required, enum: dev|boss|employee|investor)
- **FR-016**: System MUST allow boss and dev role users to list all users or filter by role via WhatsApp command `/user list [role]`. Optional role parameter filters results. Response MUST include masked phone numbers, names, roles, and active status
- **FR-017**: System MUST allow boss and dev role users to update user fields via WhatsApp command `/user update <phone> <field> <value>`. Allowed fields: name (string, 1-100 chars), role (enum: dev|boss|employee|investor), isActive (boolean: true|false). Phone number format: +6281234567890 or 081234567890
- **FR-018**: System MUST allow boss and dev role users to delete user accounts via WhatsApp command `/user delete <phone>`. Deletion MUST be hard delete (permanent removal from database). System MUST prevent deletion of dev role users. Phone number format: +6281234567890 or 081234567890
- **FR-019**: System MUST allow boss and dev role users to activate or deactivate user accounts via WhatsApp commands `/user activate <phone>` and `/user deactivate <phone>`. Activation sets `isActive=true`, deactivation sets `isActive=false`. System MUST prevent deactivation of dev role users. State changes MUST take effect immediately for subsequent operations
- **FR-020**: System MUST validate phone number format (Indonesian format: +62XXXXXXXXXX or 0XXXXXXXXXX, 8-12 digits after prefix), normalize phone numbers using `normalizePhoneNumber()` utility, validate role enum values (dev|boss|employee|investor), and prevent duplicate user creation by checking phone number uniqueness before database insert
- **FR-021**: System MUST log all user management operations to audit trail with actor (user ID and masked phone number), action (user.create|user.update|user.delete|user.activate|user.deactivate), target (affected user phone number, masked), timestamp (ISO8601), and context (changed fields with old/new values only, unchanged fields omitted). Context field MUST be a JSON object containing only fields that were modified, with each field having `oldValue` and `newValue` properties.
- **FR-022**: System MUST deny user management commands to employee and investor roles with clear error message: "❌ Permission denied. Only boss and dev roles can manage users"
- **FR-040**: System MUST handle user deletion of active session users by invalidating their active sessions in Redis and preventing further message processing
- **FR-041**: System MUST handle role changes of currently active users by updating their session permissions immediately and invalidating cached RBAC checks
- **FR-042**: System MUST handle concurrent user management operations using database transactions and optimistic locking to prevent conflicts
- **FR-023**: System MUST allow dev role users to list, edit, and preview message templates via WhatsApp commands `/template list`, `/template edit <name> <content>`, `/template preview <name>`. Template names MUST be lowercase with underscores (pattern: ^[a-z\_][a-z0-9_]\*$). Template content MUST support placeholders in format `{{placeholderName}}` and escape sequences
- **FR-024**: System MUST allow dev role users to grant and revoke user roles via WhatsApp commands `/role grant <phone> <role>` and `/role revoke <phone> <role>`. Role changes MUST take effect immediately by updating user session permissions and invalidating cached RBAC checks. System MUST prevent revoking dev role. Phone number format: +6281234567890 or 081234567890
- **FR-025**: System MUST allow dev role users to view system diagnostics via WhatsApp command `/system status`. Diagnostics MUST check database connection (timeout: 2s), Redis connection (timeout: 1s), and WhatsApp client status (immediate state check). Response MUST include status for each component: "connected"|"disconnected"|"error" with error details (masked)
- **FR-026**: System MUST allow dev role users to view recent log entries via WhatsApp command `/system logs [lines]`. Optional lines parameter (default: 50, max: 200) specifies number of log entries to retrieve. Response MUST mask all sensitive data (phone numbers, message content) before display
- **FR-027**: System MUST allow dev role users to view and modify runtime configuration via WhatsApp commands `/config view <key>` and `/config set <key> <value>`. Configuration keys MUST match pattern `^[A-Z_][A-Z0-9_]*$` (uppercase with underscores). Values MUST be validated against Zod schemas from `src/config/env.ts` if schema exists
- **FR-028**: System MUST allow dev role users to clear cache entries via WhatsApp command `/cache clear [pattern]`. Optional pattern supports wildcards: `*` (all), `user:*` (user cache), `session:*` (session cache). Pattern matching MUST use Redis SCAN for production-safe operation. Response MUST include count of cleared keys
- **FR-029**: System MUST validate template edits for syntax correctness before persistence. Validation MUST check: placeholder format `{{placeholderName}}` (alphanumeric with underscores), escape sequences, content length (max 5000 characters), and template syntax errors. Invalid templates MUST be rejected with clear error message
- **FR-030**: System MUST validate configuration changes against schema definitions from `src/config/env.ts` before applying. Allowed configuration keys MUST be defined in environment schema. Invalid keys or values MUST be rejected with clear error message. Configuration changes MUST be applied immediately without requiring restart (if applicable)
- **FR-043**: System MUST handle template edit conflicts (concurrent edits) using database optimistic locking. Last write wins with conflict notification to user
- **FR-044**: System MUST handle configuration changes that break system functionality by validating critical configuration values before applying and providing rollback mechanism (revert to previous value)
- **FR-045**: System MUST handle cache clear during active message processing by queuing clear operation and executing after current message batch completes (message batch defined as: all messages received within a 1-second time window, or up to 50 messages, whichever comes first), or by using non-blocking Redis SCAN operation
- **FR-035**: System MUST persist runtime configuration changes (via `/config set`) to database, with environment variables taking precedence on application startup
- **FR-031**: System MUST deny developer administrative commands to non-dev roles with clear error messages
- **FR-032**: System MUST log all developer administrative operations to audit trail with full context
- **FR-033**: System MUST not expose sensitive data (secrets, credentials) in diagnostic outputs or log views
- **FR-034**: System MUST allow developer phone number to be configured via environment variable (e.g., `DEV_PHONE_NUMBER`) to enable deployment-specific dev user identification without code changes

### Key Entities _(include if feature involves data)_

- **WhatsApp Session**: Represents the authentication state and connection data for WhatsApp Web client, persisted in Docker volume, includes session tokens and client configuration
- **Log Entry**: Represents a structured log record with timestamp, level, event type, correlation ID, masked data, and metadata for WhatsApp events and system operations
- **Message Template**: Represents a reusable message format with placeholders for dynamic content, stored in database or configuration, editable via developer commands
- **User Account**: Represents a user entity with phone number, name, role, and active status, manageable via WhatsApp commands by authorized roles
- **Audit Log Entry**: Represents a record of administrative actions including actor (who), action (what), target (affected entity), timestamp, and context metadata
- **System Configuration**: Represents runtime configuration values (key-value pairs) that can be viewed and modified via developer commands, validated against schemas, persisted to database with environment variable override on startup
- **Cache Entry**: Represents cached data stored in Redis with optional pattern matching for bulk operations, clearable via developer commands

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: WhatsApp authentication session persists across 100% of container restarts without requiring manual QR code re-authentication
- **SC-002**: All WhatsApp client events (QR generation, authentication, disconnection, message events) are logged with structured metadata within 100ms of event occurrence
- **SC-003**: Log entries include correlation IDs for 100% of message flows, enabling end-to-end tracing from message receipt to database persistence
- **SC-004**: Zero sensitive data (phone numbers, message content) is exposed in log files, verified through automated security scanning
- **SC-005**: Message formatting enhancement improves user comprehension, measured by 30% reduction in support queries related to message clarity
- **SC-006**: Font conversion utilities process text transformations in under 5ms per message, maintaining message delivery performance
- **SC-007**: Boss and dev users can complete user management operations (create, list, update, delete) in under 30 seconds per operation via WhatsApp commands
- **SC-008**: User management commands validate inputs and prevent errors with 100% success rate for valid inputs and 100% error detection for invalid inputs
- **SC-009**: Developer administrative commands enable system configuration changes without code deployment, reducing configuration update time from hours to under 2 minutes
- **SC-010**: System diagnostics commands provide accurate health status for all infrastructure components (database, Redis, WhatsApp client) within 5 seconds
- **SC-011**: All administrative operations (user management, developer commands) are logged to audit trail with 100% coverage and complete context
- **SC-012**: Role-based access control prevents unauthorized access attempts with 100% enforcement rate for user management and developer commands

## Recovery Scenarios

**Session Recovery**:

- **RC-001**: When WhatsApp session corruption is detected, system MUST delete corrupted session files, trigger QR code authentication flow, and store new session in persistent volume
- **RC-002**: When session restoration fails on container startup, system MUST log error, attempt restoration up to 3 times with 5-second delays, and if all attempts fail, trigger QR code authentication flow

**Logging Recovery**:

- **RC-003**: When log write failures occur, system MUST retry up to 3 times with exponential backoff (1s, 2s, 4s), and if all retries fail, log error to console and continue message processing

**Configuration Recovery**:

- **RC-004**: When invalid configuration change is applied, system MUST provide rollback mechanism: revert to previous value from database, log rollback action to audit trail, and notify dev user of rollback

**User Management Recovery**:

- **RC-005**: When user management operation fails (database error, validation error), system MUST rollback transaction, return clear error message to user, and log failure to audit trail with full context

## Non-Functional Requirements

### Performance Requirements

- **NFR-001**: Font conversion utilities MUST process text transformations in under 5ms per message (p95 latency). Performance MUST be optimized through character mapping caching
- **NFR-002**: User management operations (create, list, update, delete) MUST complete in under 30 seconds per operation (p95 latency) via WhatsApp commands
- **NFR-003**: System diagnostics commands MUST provide health status within 5 seconds (p95 latency), with individual component checks timing out after 2s (database) or 1s (Redis)
- **NFR-004**: Log event processing MUST complete within 100ms of event occurrence (p95 latency) without blocking message processing
- **NFR-005**: When system is under high load, performance degradation MUST not exceed 2x baseline latency for critical operations. System MUST continue processing messages even if logging is delayed
- **NFR-006**: Font conversion MUST use memory-efficient character mapping cache with maximum 1MB memory footprint

### Security Requirements

- **NFR-007**: Data masking requirements MUST be explicitly defined for all sensitive data types: phone numbers (masked as `+62 ****7890`), message content (masked as `[REDACTED]`), amounts (masked as `Rp ******.***`), credentials (masked as `***[REDACTED]***`)
- **NFR-008**: RBAC enforcement MUST be explicitly specified for all protected operations: user management (boss/dev only), developer commands (dev only), with 100% enforcement rate verified through automated testing
- **NFR-009**: System MUST prevent privilege escalation by validating role changes (prevent employee/investor from gaining dev/boss role except via dev user), and logging all role changes to audit trail
- **NFR-010**: Audit logging MUST be explicitly defined for all sensitive operations with required fields: actor (user ID, masked phone), action (operation type), target (affected entity), timestamp (ISO8601), context (field changes, parameters)
- **NFR-011**: Configuration values containing secrets (API keys, passwords) MUST be stored securely (encrypted at rest if applicable) and never exposed in diagnostic outputs or log views

### Reliability Requirements

- **NFR-012**: System MUST handle infrastructure failures gracefully: database unavailability (return "disconnected" status, continue with cached data if available), Redis unavailability (log warning, continue with degraded functionality), WhatsApp disconnection (attempt reconnection with exponential backoff)
- **NFR-013**: System MUST provide graceful degradation when services are unavailable: continue processing messages with cached data, queue operations for retry, and notify users of degraded service status
- **NFR-014**: Session persistence reliability MUST be ensured through: regular session state backups (every 5 minutes) stored in the same Docker volume at `.wwebjs_auth/session-cashflow-bot/.backups/` with timestamped filenames (format: `session-backup-YYYYMMDD-HHMMSS.tar.gz`), session corruption detection and recovery, automatic backup cleanup (keep last 10 backups, remove older backups), restore procedure (on corruption detection, system attempts to restore from most recent backup before triggering QR re-authentication), and volume backup strategy documentation. Backup storage uses same volume as session data to ensure persistence across container restarts. Backup process MUST be non-blocking and not interfere with WhatsApp client operations.

### Observability Requirements

- **NFR-015**: Logging requirements MUST be explicitly defined for all critical operations: WhatsApp events (all events logged), user management (all operations logged), developer commands (all operations logged), with structured JSON format and correlation IDs
- **NFR-016**: Health check requirements MUST be explicitly specified: endpoint `GET /health`, response format (JSON with status fields), HTTP status codes (200 for ok, 503 for degraded/down), timeout handling (2s database, 1s Redis)
- **NFR-017**: System MUST monitor configuration changes by logging all configuration updates to audit trail with before/after values, actor, and timestamp

## Assumptions

- Docker and Docker Compose are available in the deployment environment
- WhatsApp Web.js library version ^1.34.2 is maintained (no breaking changes)
- Existing 4-layer architecture (Bot → Service → Model → Database) patterns are preserved
- Winston logger ^3.11.0 infrastructure is available and compatible
- Prisma ORM is used for all database operations including user management
- Redis is available for session management and caching
- Existing RBAC system with roles (dev, boss, employee, investor) is in place
- Font files in `font/` directory are available for Unicode conversion utilities
- Existing validation utilities (`normalizePhoneNumber`, `validatePhoneNumber`) are available
- Existing audit logging infrastructure is available for recording administrative actions
- Environment variables for configuration (LOG_LEVEL, DEV_PHONE_NUMBER, etc.) are supported
- Health check endpoint infrastructure exists or can be added to Express server
- Developer phone number is configured via environment variable for deployment flexibility
- Docker named volumes are preferred over bind mounts for portability
- Node.js process runs as non-root user (UID 1000, GID 1000) in containers
- WhatsApp Web.js LocalAuth stores session in filesystem directory structure
- Correlation IDs use UUID v4 format for uniqueness guarantees
- Log file rotation uses Winston's built-in rotation with 5MB size limit and 5 file retention
- Font conversion character mappings are cached in memory for performance
- Database transactions are used for multi-step user management operations
- Redis SCAN is used for production-safe cache pattern matching (not KEYS command)
- Configuration validation uses Zod schemas from existing `src/config/env.ts`
- Template placeholders use `{{placeholderName}}` format with alphanumeric and underscore characters
- Phone number normalization uses existing `normalizePhoneNumber()` utility from `src/lib/validation.ts`
- Audit logging uses existing audit service infrastructure from `src/services/audit/`

## Dependencies

**External Dependencies** (with version constraints):

- Docker >=20.10 and Docker Compose >=2.0 for containerization
- WhatsApp Web.js ^1.34.2 (exact version constraint, no breaking changes allowed)
- Prisma ^5.0.0 for database operations
- Winston ^3.11.0 for structured logging
- Express.js ^5.2.1 for health check endpoints
- Redis ^4.6.0 for session/cache storage
- Zod ^3.22.4 for configuration validation
- Node.js >=20.0.0 (LTS) for runtime
- TypeScript 5.0.0+ for type safety

**Internal Dependencies**:

- Existing WhatsApp Web.js client integration in `src/bot/client/`
- Existing Winston logger in `src/lib/logger.ts` with `SENSITIVE_PATTERNS` and `maskSensitiveData()` function
- Existing Prisma models and database schema
- Existing RBAC middleware in `src/bot/middleware/auth.ts`
- Existing validation utilities in `src/lib/validation.ts` (`normalizePhoneNumber()`, `validatePhoneNumber()`)
- Existing audit logging service in `src/services/audit/`
- Existing Express server for health check endpoint
- Font files in `font/` directory for Unicode conversion (if applicable)

**Dependency Version Conflict Handling**:

- System MUST validate dependency versions match constraints before deployment
- Version conflicts MUST be resolved through dependency update process with testing
- Breaking changes in dependencies MUST trigger feature review and migration plan

## Out of Scope

- Migration of existing non-containerized deployments (assumes new containerized deployment)
- Real-time log streaming or log aggregation services (logs remain file-based with optional external aggregation)
- Message template versioning or rollback capabilities
- Advanced cache invalidation strategies beyond pattern-based clearing
- Multi-instance deployment or load balancing configuration
- Database migration tools or schema change management
- External monitoring or alerting system integration
- WhatsApp Business API migration (remains on WhatsApp Web.js)
- User interface for non-WhatsApp administration (all administration via WhatsApp commands)
