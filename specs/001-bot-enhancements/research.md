# Research: WhatsApp Cashflow Bot Enhancements

**Date**: 2025-01-27  
**Feature**: 001-bot-enhancements  
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Docker Session Persistence

**Decision**: Use Docker volumes with proper permissions for WhatsApp session data persistence.

**Rationale**:

- Docker volumes provide persistent storage that survives container lifecycle
- LocalAuth from whatsapp-web.js stores session in filesystem directory
- Volume mounts ensure session data persists across restarts
- Non-root user permissions required for Node.js process to read/write

**Alternatives Considered**:

- **Bind mounts**: Rejected - less portable, requires host path management
- **External storage (S3)**: Rejected - adds complexity, requires sync mechanism
- **Database storage**: Rejected - session data is filesystem-based, not easily serializable

**Implementation Pattern**:

- Mount `.wwebjs_auth` directory to Docker volume
- Set volume permissions to allow Node.js user (UID 1000) read/write access
- Use `docker-compose.yml` volume declaration for persistence
- Health check endpoint validates session restoration

**References**:

- Docker volumes documentation: https://docs.docker.com/storage/volumes/
- whatsapp-web.js LocalAuth: https://wwebjs.dev/guide/authentication.html#local-auth

---

## WhatsApp Event Logging

**Decision**: Integrate structured JSON logging with correlation IDs and sensitive data masking using Winston logger.

**Rationale**:

- Winston ^3.11.0 already in use, maintains consistency
- Structured JSON enables log aggregation and querying
- Correlation IDs enable end-to-end message flow tracing
- Sensitive data masking required for security compliance

**Alternatives Considered**:

- **Separate logging library**: Rejected - adds dependency, Winston sufficient
- **File-based logging only**: Rejected - structured JSON needed for production
- **No correlation IDs**: Rejected - tracing critical for debugging production issues

**Implementation Pattern**:

- Create WhatsApp event logger wrapper around Winston
- Generate correlation ID per message flow (UUID v4)
- Apply existing `maskSensitiveData()` function from logger.ts
- Log levels: ERROR (failures), WARN (reconnections), INFO (success), DEBUG (raw events)
- Separate log stream for WhatsApp events (optional, can use existing transports)

**References**:

- Winston structured logging: https://github.com/winstonjs/winston#formats
- Correlation ID pattern: https://microservices.io/patterns/observability/correlation-id.html

---

## Unicode Font Conversion

**Decision**: Use Unicode Mathematical Alphanumeric Symbols (U+1D400 to U+1D7FF) for font styling with graceful fallback.

**Rationale**:

- Unicode mathematical symbols provide bold, italic, monospace, script variants
- No external dependencies required (pure TypeScript string manipulation)
- Graceful fallback to native WhatsApp formatting for unsupported characters
- Performance target (<5ms) achievable with character mapping

**Alternatives Considered**:

- **External font libraries**: Rejected - adds dependencies, WhatsApp doesn't support custom fonts
- **Image-based formatting**: Rejected - complex, not supported by WhatsApp Web.js
- **Native WhatsApp formatting only**: Rejected - limited styling options, doesn't meet requirements

**Implementation Pattern**:

- Create character mapping tables for A-Z, a-z, 0-9 to Unicode mathematical symbols
- Handle unsupported characters (emojis, special chars) by preserving original
- Cache character mappings for performance
- Fallback to native formatting (_bold_, _italic_, `monospace`) if Unicode fails

**Character Mapping Ranges**:

- Bold: U+1D400-1D433 (A-Z), U+1D434-1D467 (a-z), U+1D7CE-1D7D7 (0-9)
- Italic: U+1D434-1D467 (A-Z), U+1D468-1D49B (a-z), U+1D7CE-1D7D7 (0-9)
- Monospace: U+1D670-1D6A3 (A-Z), U+1D68A-1D6BD (a-z), U+1D7F6-1D7FF (0-9)
- Script: U+1D49C-1D4CF (A-Z), U+1D4D0-1D503 (a-z)

**References**:

- Unicode Mathematical Alphanumeric Symbols: https://www.unicode.org/charts/PDF/U1D400.pdf
- WhatsApp formatting: https://faq.whatsapp.com/general/chats/how-to-format-your-messages

---

## User Management Service Design

**Decision**: Create service layer (`user/manager.ts`) following existing service patterns with validation, RBAC checks, and audit logging.

**Rationale**:

- Maintains 4-layer architecture separation (Bot → Service → Model → Database)
- Reuses existing UserModel for database operations
- Validation logic centralized in service layer
- Audit logging integrated with existing audit service

**Alternatives Considered**:

- **Handler-only implementation**: Rejected - violates architecture, no separation of concerns
- **Model-only implementation**: Rejected - business logic belongs in service layer
- **External user management API**: Rejected - out of scope, WhatsApp commands required

**Implementation Pattern**:

- Service methods: `createUser()`, `listUsers()`, `updateUser()`, `deleteUser()`, `activateUser()`, `deactivateUser()`
- Input validation: phone number format, role enum, duplicate prevention
- RBAC enforcement: check caller role (boss/dev) before operations
- Audit logging: log all operations with actor, action, target, timestamp
- Error handling: return structured errors with user-friendly messages

**References**:

- Existing service patterns: `src/services/transaction/processor.ts`
- Existing validation: `src/lib/validation.ts` (`normalizePhoneNumber`, `validatePhoneNumber`)

---

## Configuration Management

**Decision**: Store runtime configuration in database (new `SystemConfig` model) with environment variable override on startup.

**Rationale**:

- Database persistence enables runtime changes without code deployment
- Environment variable override maintains deployment flexibility
- Schema validation ensures configuration integrity
- Audit trail for configuration changes

**Alternatives Considered**:

- **Environment file only**: Rejected - requires container restart, doesn't meet requirement
- **In-memory only**: Rejected - changes lost on restart, doesn't meet requirement
- **External config service**: Rejected - adds complexity, database sufficient

**Implementation Pattern**:

- Create `SystemConfig` Prisma model: `key` (string, unique), `value` (string), `updatedAt` (timestamp)
- Service methods: `getConfig()`, `setConfig()`, `listConfigs()`
- On startup: Load from database, override with environment variables
- Validation: Use Zod schemas from `src/config/env.ts` for value validation
- Cache: Store in-memory cache for fast access, invalidate on updates

**References**:

- Existing config patterns: `src/config/env.ts` (Zod schemas)
- Prisma model patterns: `src/models/user.ts`

---

## System Diagnostics

**Decision**: Aggregate health status from database, Redis, and WhatsApp client with timeout handling.

**Rationale**:

- Single endpoint provides comprehensive system health view
- Timeout handling prevents diagnostics from blocking on failures
- Structured response enables automated health checks
- Follows existing health check patterns

**Alternatives Considered**:

- **Separate endpoints per component**: Rejected - adds complexity, single endpoint sufficient
- **No timeout handling**: Rejected - could block on failures, poor UX
- **External monitoring integration**: Rejected - out of scope, basic diagnostics sufficient

**Implementation Pattern**:

- Check database: Prisma connection test with timeout (2s)
- Check Redis: Connection ping with timeout (1s)
- Check WhatsApp: Client connection state (connected/disconnected/authenticating)
- Return structured JSON: `{ database: 'ok'|'error', redis: 'ok'|'error', whatsapp: 'connected'|'disconnected'|'authenticating' }`
- Error details included for debugging (masked sensitive data)

**References**:

- Existing health check: Express server health endpoint pattern
- Prisma connection testing: `prisma.$connect()`

---

## Template Management

**Decision**: Store message templates in database (new `MessageTemplate` model) with validation and preview capabilities.

**Rationale**:

- Database storage enables runtime editing without code changes
- Validation ensures template syntax correctness
- Preview capability allows safe testing before deployment
- Follows existing model patterns

**Alternatives Considered**:

- **File-based templates**: Rejected - requires code deployment for changes
- **Hardcoded templates**: Rejected - doesn't meet requirement for runtime editing
- **External template service**: Rejected - adds complexity, database sufficient

**Implementation Pattern**:

- Create `MessageTemplate` Prisma model: `name` (string, unique), `content` (text), `updatedAt` (timestamp)
- Service methods: `listTemplates()`, `getTemplate()`, `updateTemplate()`, `previewTemplate()`
- Validation: Check for valid placeholder syntax, escape sequences
- Preview: Render template with sample data for dev review
- Cache: Store in-memory cache for fast access, invalidate on updates

**References**:

- Existing template usage: `src/bot/ui/messages.ts`
- Template placeholder patterns: Existing message formatting

---

## Cache Management

**Decision**: Use Redis pattern matching for cache clearing with optional key pattern support.

**Rationale**:

- Redis supports pattern matching (KEYS command or SCAN for production)
- Enables selective cache invalidation
- Follows existing Redis usage patterns
- Performance acceptable for admin operations

**Alternatives Considered**:

- **Clear all only**: Rejected - too broad, could impact performance
- **Exact key matching only**: Rejected - too restrictive, pattern matching needed
- **External cache service**: Rejected - Redis sufficient, no need for additional service

**Implementation Pattern**:

- Use Redis `SCAN` with pattern for production-safe pattern matching
- Support patterns: `*` (all), `user:*` (user cache), `session:*` (session cache)
- Return count of cleared keys for confirmation
- Log cache clear operations to audit trail

**References**:

- Redis SCAN pattern: https://redis.io/commands/scan/
- Existing Redis usage: `src/lib/redis.ts`

---

## Summary

All technical unknowns resolved. Implementation patterns established following existing codebase architecture and best practices. No blocking technical issues identified.
