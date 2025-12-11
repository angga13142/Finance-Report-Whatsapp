---
description: "Task list for WhatsApp Cashflow Bot Enhancements implementation"
---

# Tasks: WhatsApp Cashflow Bot Enhancements

**Input**: Design documents from `/specs/001-bot-enhancements/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included per TDD approach specified in plan.md (70% unit, 20% integration, 10% E2E).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths follow existing 4-layer architecture: Bot → Service → Model → Database

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Docker containerization setup

- [x] T001 Create Docker directory structure (docker/, docker/Dockerfile, docker/docker-compose.yml, docker/.dockerignore)
- [x] T002 [P] Create Dockerfile with Node.js 20+ base image, non-root user (UID 1000, GID 1000), and volume mount point for WhatsApp session in docker/Dockerfile
- [x] T003 [P] Create docker-compose.yml with whatsapp-session named volume, service definition, and health check configuration in docker/docker-compose.yml
- [x] T004 [P] Create .dockerignore file to exclude unnecessary files from Docker build context in docker/.dockerignore
- [x] T005 [P] Update package.json with Docker-related scripts (docker:build, docker:up, docker:down) if these scripts don't already exist in package.json scripts section

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create Prisma migration for SystemConfig model (id, key, value, description, updatedAt, updatedBy) in prisma/migrations/
- [x] T007 Create Prisma migration for MessageTemplate model (id, name, content, description, updatedAt, updatedBy) in prisma/migrations/
- [x] T008 [P] Create SystemConfig model with Prisma schema methods (findByKey, create, update, delete) in src/models/config.ts
- [x] T009 [P] Create MessageTemplate model with Prisma schema methods (findByName, list, create, update, delete) in src/models/template.ts
- [x] T010 [P] Enhance User model with new methods (list with role filter, activate, deactivate, delete with validation) in src/models/user.ts
- [x] T011 [P] Enhance AuditLog model usage for new action types (user.create, user.update, user.delete, config.set, template.edit, etc.) in src/models/audit.ts
- [x] T012 [P] Enhance environment configuration with DEV_PHONE_NUMBER variable and validation schema in src/config/env.ts
- [x] T013 Setup correlation ID generation utility (UUID v4) with in-memory storage for active message flows in src/lib/correlation.ts. Correlation IDs MUST be stored in a Map<string, string> keyed by message ID, with automatic cleanup after message processing completes (TTL: 5 minutes). For distributed tracing, correlation IDs are passed through request context and logged with each operation.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Deploy Bot in Container Without Losing WhatsApp Connection (Priority: P1) 🎯 MVP

**Goal**: Enable Docker containerization with persistent WhatsApp session that survives container restarts

**Independent Test**: Deploy bot in Docker, stop and restart container, verify WhatsApp connection remains active without requiring new QR code authentication

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T014 [P] [US1] Integration test for Docker session persistence in tests/integration/docker/session-persistence.test.ts
- [x] T015 [P] [US1] Integration test for health check endpoint in tests/integration/api/health.test.ts

### Implementation for User Story 1

- [x] T016 [US1] Enhance LocalAuth configuration to use Docker volume path with proper permissions in src/bot/client/auth.ts
- [x] T017 [US1] Enhance WhatsApp client initialization to handle session restoration on container startup with retry logic (3 attempts with 5-second delays between attempts) in src/bot/client/client.ts. If all restoration attempts fail, trigger QR code authentication flow
- [x] T018 [US1] Add session corruption detection and recovery logic (delete corrupted files, trigger QR auth) in src/bot/client/auth.ts
- [x] T019 [US1] Create or enhance health check endpoint (GET /health) with WhatsApp client status in src/services/system/health.ts
- [x] T020 [US1] Add Express route for health check endpoint in src/index.ts or appropriate route file
- [x] T021 [US1] Add Docker volume permission handling (chmod/chown) on container startup if volume permissions are incorrect (UID/GID mismatch or insufficient read/write permissions detected). Check permissions on startup, attempt automatic fix (chmod 755, chown 1000:1000), and if fix fails, log error and fall back to QR code authentication
- [x] T022 [US1] Add logging for session restoration events (success/failure) in src/bot/client/client.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Monitor WhatsApp Events for Troubleshooting (Priority: P1)

**Goal**: Comprehensive structured logging of all WhatsApp client events with correlation IDs and sensitive data masking

**Independent Test**: Trigger various WhatsApp events (QR generation, authentication, message send/receive, disconnection) and verify all events are logged with structured metadata, appropriate log levels, and masked sensitive data

### Tests for User Story 2

- [x] T023 [P] [US2] Unit test for WhatsApp event logger with correlation ID generation in tests/unit/lib/whatsapp-logger.test.ts
- [x] T024 [P] [US2] Unit test for sensitive data masking in WhatsApp logs in tests/unit/lib/whatsapp-logger.test.ts
- [x] T025 [P] [US2] Integration test for WhatsApp event logging (QR, auth, disconnect, message events) in tests/integration/bot/client/events-logging.test.ts

### Implementation for User Story 2

- [x] T026 [US2] Create WhatsApp event logger wrapper around Winston with structured JSON format in src/lib/whatsapp-logger.ts
- [x] T027 [US2] Enhance WhatsApp client event handlers to use new logger with correlation IDs in src/bot/client/events.ts
- [x] T028 [US2] Add correlation ID generation per message flow (UUID v4) and persistence across related log entries in src/lib/whatsapp-logger.ts
- [x] T029 [US2] Enhance sensitive data masking for WhatsApp events (phone numbers, message content) using existing SENSITIVE_PATTERNS in src/lib/whatsapp-logger.ts
- [x] T030 [US2] Add log level assignment (ERROR for failures, WARN for reconnections, INFO for success, DEBUG for raw events) in src/lib/whatsapp-logger.ts
- [x] T031 [US2] Add log file rotation configuration (5MB size limit, 5 rotated files) in src/lib/logger.ts
- [x] T032 [US2] Add async log write queue for high-volume message processing with retry mechanism (3 retries, exponential backoff) in src/lib/whatsapp-logger.ts
- [x] T033 [US2] Add logging for all WhatsApp events: QR generation, authentication success/failure, disconnection, message receive, message send, message send failure in src/bot/client/events.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Improve Message Readability with Enhanced Formatting (Priority: P2)

**Goal**: Enhanced message formatting using Unicode mathematical alphanumeric symbols for visual styling with consistent hierarchy

**Independent Test**: Send various message types (transaction confirmations, reports, help menus, error messages) and verify messages use consistent formatting with visual hierarchy, appropriate emoji usage, and readable currency formatting

### Tests for User Story 3

- [ ] T034 [P] [US3] Unit test for Unicode font conversion utilities (bold, italic, monospace, script) in tests/unit/lib/font-formatter.test.ts
- [ ] T035 [P] [US3] Unit test for font conversion fallback behavior (unsupported characters) in tests/unit/lib/font-formatter.test.ts
- [ ] T036 [P] [US3] Unit test for currency formatting (Rupiah symbol, thousand separators) in tests/unit/lib/font-formatter.test.ts
- [ ] T037 [P] [US3] Performance test for font conversion (<5ms per message) in tests/unit/lib/font-formatter.test.ts

### Implementation for User Story 3

- [ ] T038 [US3] Create Unicode font conversion utilities with character mapping tables (Bold, Italic, Monospace, Script) using Unicode ranges specified in FR-010 (U+1D400-1D7FF) in src/lib/font-formatter.ts. Validate character mappings against specified Unicode ranges
- [ ] T039 [US3] Add character mapping cache for performance optimization (<5ms target) in src/lib/font-formatter.ts
- [ ] T040 [US3] Add fallback to native WhatsApp formatting (_bold_, _italic_, `monospace`) for unsupported characters in src/lib/font-formatter.ts
- [ ] T041 [US3] Enhance message formatting utilities with visual hierarchy (bold headers, monospace numeric, emoji categorization) in src/bot/ui/messages.ts
- [ ] T042 [US3] Add currency formatting function with Rupiah symbol and thousand separators (dots) in src/bot/ui/messages.ts
- [ ] T043 [US3] Add message length limit handling (4096 characters) with truncation and formatting preservation in src/bot/ui/messages.ts
- [ ] T044 [US3] Update all message sending functions to use enhanced formatting (transaction confirmations, reports, error messages, help menus) in src/bot/ui/messages.ts

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Manage Users via WhatsApp Commands (Priority: P2)

**Goal**: User account management (create, view, update, delete, activate/deactivate) via WhatsApp commands for boss/dev roles

**Independent Test**: Execute user management commands (add, list, update, delete, activate, deactivate) as a boss or dev user and verify all operations complete successfully with appropriate validation, error handling, and audit logging

### Tests for User Story 4

- [ ] T045 [P] [US4] Unit test for UserManagerService (create, list, update, delete, activate, deactivate) in tests/unit/services/user/manager.test.ts
- [ ] T046 [P] [US4] Unit test for phone number validation and normalization in tests/unit/services/user/manager.test.ts
- [ ] T047 [P] [US4] Unit test for RBAC enforcement (boss/dev only) in tests/unit/services/user/manager.test.ts
- [ ] T048 [P] [US4] Integration test for user management commands via WhatsApp in tests/integration/bot/handlers/user-management.test.ts
- [ ] T049 [P] [US4] E2E test for user management workflow in tests/e2e/workflows/user-management.spec.ts

### Implementation for User Story 4

- [ ] T050 [US4] Create UserManagerService with CRUD operations (create, list, update, delete, activate, deactivate) in src/services/user/manager.ts
- [ ] T051 [US4] Add phone number validation and normalization using existing utilities in src/services/user/manager.ts
- [ ] T052 [US4] Add role validation (enum: dev|boss|employee|investor) and duplicate phone number prevention in src/services/user/manager.ts
- [ ] T053 [US4] Add RBAC checks (boss/dev only) and permission error messages in src/services/user/manager.ts
- [ ] T054 [US4] Add audit logging for all user management operations (user.create, user.update, user.delete, user.activate, user.deactivate) in src/services/user/manager.ts
- [ ] T055 [US4] Add session invalidation for deleted/updated users in Redis in src/services/user/manager.ts
- [ ] T056 [US4] Add concurrent operation handling (database transactions, optimistic locking) in src/services/user/manager.ts
- [ ] T057 [US4] Create user-management handler with command parsing (/user add, /user list, /user update, /user delete, /user activate, /user deactivate) in src/bot/handlers/user-management.ts
- [ ] T058 [US4] Add command registration in message router/command parser in src/bot/handlers/command.parser.ts or appropriate file
- [ ] T059 [US4] Add formatted response messages with masked phone numbers for user management commands in src/bot/handlers/user-management.ts
- [ ] T060 [US4] Add error handling and clear error messages for user management commands in src/bot/handlers/user-management.ts

**Checkpoint**: At this point, User Stories 1, 2, 3, AND 4 should all work independently

---

## Phase 7: User Story 5 - Developer Administrative Capabilities (Priority: P3)

**Goal**: Comprehensive administrative capabilities for dev role users (template management, role management, system diagnostics, configuration management, cache operations)

**Independent Test**: Execute developer commands (template management, role management, system diagnostics, configuration management, cache operations) as a dev user and verify all operations complete successfully with appropriate security checks and logging

### Tests for User Story 5

- [x] T061 [P] [US5] Unit test for ConfigService (view, set, validation, persistence) in tests/unit/services/system/config.test.ts
- [x] T062 [P] [US5] Unit test for DiagnosticsService (database, Redis, WhatsApp status) in tests/unit/services/system/diagnostics.test.ts
- [x] T063 [P] [US5] Unit test for template validation (syntax, placeholders, escape sequences) in tests/unit/services/system/template.test.ts
- [x] T064 [P] [US5] Unit test for cache clear operations (pattern matching, Redis SCAN) in tests/unit/services/system/cache.test.ts
- [x] T065 [P] [US5] Integration test for admin commands via WhatsApp in tests/integration/bot/handlers/admin.test.ts
- [x] T066 [P] [US5] E2E test for admin workflow in tests/e2e/workflows/admin-commands.spec.ts

### Implementation for User Story 5

- [x] T067 [US5] Enhance ConfigService with view, set operations, Zod schema validation, and database persistence with env override in src/services/system/config.ts
- [x] T068 [US5] Create DiagnosticsService with database, Redis, and WhatsApp client health checks (timeouts: 2s DB, 1s Redis) in src/services/system/diagnostics.ts
- [x] T069 [US5] Create TemplateService with list, preview, edit operations and syntax validation in src/services/system/template.ts
- [x] T070 [US5] Create CacheService with clear operation and pattern matching (Redis SCAN) in src/services/system/cache.ts
- [x] T071 [US5] Add role grant/revoke service with immediate session permission updates in src/services/user/rbac.ts or new file
- [x] T072 [US5] Add RBAC checks (dev-only) for all admin commands in src/bot/middleware/auth.ts
- [x] T073 [US5] Add audit logging for all admin operations (config.set, template.edit, role.grant, cache.clear, system.status) in admin handler
- [x] T074 [US5] Enhance admin handler with template commands (/template list, /template preview, /template edit) in src/bot/handlers/admin.ts
- [x] T075 [US5] Add role management commands (/role grant, /role revoke) in src/bot/handlers/admin.ts
- [x] T076 [US5] Add system diagnostics commands (/system status, /system logs) in src/bot/handlers/admin.ts
- [x] T077 [US5] Add configuration commands (/config view, /config set) in src/bot/handlers/admin.ts
- [x] T078 [US5] Add cache commands (/cache clear [pattern]) in src/bot/handlers/admin.ts
- [x] T079 [US5] Add command registration in message router/command parser in src/bot/handlers/command.parser.ts or appropriate file
- [x] T080 [US5] Add formatted response messages for admin commands in src/bot/handlers/admin.ts
- [x] T081 [US5] Add error handling and clear error messages for admin commands in src/bot/handlers/admin.ts
- [x] T082 [US5] Add configuration rollback mechanism for invalid changes in src/services/system/config.ts
- [x] T083 [US5] Add template edit conflict handling (optimistic locking, last-write-wins) in src/services/system/template.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T084 [P] Update documentation (README.md, API docs) with new commands and features
- [ ] T085 [P] Code cleanup and refactoring across all new files
- [ ] T086 [P] Performance optimization (font conversion caching, log write queue tuning)
- [ ] T087 [P] Security hardening (RBAC validation, audit logging coverage verification)
- [ ] T088 [P] Run quickstart.md validation tests
- [ ] T089 [P] Add integration tests for cross-story interactions (e.g., user management + admin commands)
- [ ] T090 [P] Add monitoring and alerting configuration for health check endpoint
- [ ] T091 [P] Update Docker documentation with deployment instructions
- [ ] T092 [US1] Implement session backup service with automatic backups every 5 minutes, storing backups in `.wwebjs_auth/session-cashflow-bot/.backups/` with timestamped filenames (format: `session-backup-YYYYMMDD-HHMMSS.tar.gz`) in src/services/system/session-backup.ts
- [ ] T093 [US1] Implement session backup cleanup (keep last 10 backups, remove older backups) and restore functionality (restore from most recent backup on corruption detection) in src/services/system/session-backup.ts
- [ ] T094 [P] Add load testing task to validate NFR-005 (performance degradation under load, 2x baseline maximum) using performance testing tools (e.g., k6, Artillery) in tests/performance/load-test.spec.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (can run parallel with US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Uses enhanced User model from Foundational
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Uses SystemConfig and MessageTemplate models from Foundational

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before handlers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Stories 1 and 2 (both P1) can start in parallel
- User Stories 3 and 4 (both P2) can start in parallel after US1/US2
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Integration test for Docker session persistence in tests/integration/docker/session-persistence.test.ts"
Task: "Integration test for health check endpoint in tests/integration/api/health.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Unit test for WhatsApp event logger with correlation ID generation in tests/unit/lib/whatsapp-logger.test.ts"
Task: "Unit test for sensitive data masking in WhatsApp logs in tests/unit/lib/whatsapp-logger.test.ts"
Task: "Integration test for WhatsApp event logging in tests/integration/bot/client/events-logging.test.ts"
```

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "Unit test for UserManagerService in tests/unit/services/user/manager.test.ts"
Task: "Unit test for phone number validation in tests/unit/services/user/manager.test.ts"
Task: "Unit test for RBAC enforcement in tests/unit/services/user/manager.test.ts"
Task: "Integration test for user management commands in tests/integration/bot/handlers/user-management.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Docker containerization)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhanced observability)
4. Add User Story 3 → Test independently → Deploy/Demo (Better UX)
5. Add User Story 4 → Test independently → Deploy/Demo (User management)
6. Add User Story 5 → Test independently → Deploy/Demo (Admin capabilities)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Docker)
   - Developer B: User Story 2 (Logging)
3. After US1/US2 complete:
   - Developer A: User Story 3 (Formatting)
   - Developer B: User Story 4 (User Management)
4. After US3/US4 complete:
   - Developer A: User Story 5 (Admin)
   - Developer B: Polish & Cross-Cutting
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Follow existing 4-layer architecture patterns (Bot → Service → Model → Database)
- Use existing utilities where possible (normalizePhoneNumber, validatePhoneNumber, maskSensitiveData)
- Maintain compatibility with existing codebase patterns

---

## Task Summary

**Total Tasks**: 94

- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 8 tasks
- **Phase 3 (US1 - Docker)**: 9 tasks (2 tests, 7 implementation)
- **Phase 4 (US2 - Logging)**: 11 tasks (3 tests, 8 implementation)
- **Phase 5 (US3 - Formatting)**: 11 tasks (4 tests, 7 implementation)
- **Phase 6 (US4 - User Management)**: 16 tasks (5 tests, 11 implementation)
- **Phase 7 (US5 - Admin)**: 23 tasks (6 tests, 17 implementation)
- **Phase 8 (Polish)**: 11 tasks (includes 3 new tasks: T092-T094)

**Parallel Opportunities**: 45 tasks marked [P] can run in parallel

**MVP Scope**: Phases 1-3 (Setup + Foundational + User Story 1) = 22 tasks
