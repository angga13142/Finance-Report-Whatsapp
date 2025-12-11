# Tasks: WhatsApp Cashflow Bot Platform Modernization

**Input**: Design documents from `/specs/001-platform-modernization/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md

**Tests**: Tests are included per spec requirements (FR-024, TDD approach confirmed in plan.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Docker infrastructure setup

- [ ] T001 Create docker directory structure: docker/Dockerfile, docker/docker-compose.yml, docker/.dockerignore
- [ ] T002 [P] Create .dockerignore file in docker/ to exclude node_modules, .git, dist, etc.
- [ ] T003 [P] Create docker-compose.yml in docker/ with whatsapp-session volume, environment variables, health check configuration
- [ ] T004 Create Dockerfile in docker/ with Node.js 20 base image, Puppeteer/Chromium dependencies, non-root user setup (UID 1000)
- [ ] T005 [P] Add Docker build and run scripts to package.json (docker:build, docker:up, docker:down)
- [ ] T006 [P] Create docker/README.md with setup instructions, QR code authentication process, troubleshooting guide

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create Prisma migration for SystemConfiguration model in prisma/migrations/
- [ ] T008 [P] Add indexes to AuditLog model in prisma/schema.prisma (action, targetEntity+targetId, timestamp)
- [ ] T009 [P] Run Prisma migration to apply SystemConfiguration model and AuditLog indexes
- [ ] T010 [P] Enhance Winston logger in src/lib/logger.ts with structured JSON format, correlation ID support, log rotation (100MB max, 14-day retention)
- [ ] T011 [P] Create correlation ID utility in src/lib/correlation-id.ts with UUID v4 generation
- [ ] T012 [P] Create data masking utility in src/lib/data-masker.ts for phone numbers (last 4 digits) and message content (type+length only)
- [ ] T013 [P] Create health check endpoint in src/services/system/health.ts for PostgreSQL, Redis, WhatsApp client status
- [ ] T014 [P] Update Express app in src/index.ts to expose health check endpoint at /health

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Containerized Deployment Without Authentication Loss (Priority: P1) 🎯 MVP

**Goal**: Enable Docker containerization with WhatsApp session persistence across container lifecycle events (stop, restart, recreate)

**Independent Test**: Deploy bot using `docker-compose up`, authenticate via QR code once, then execute `docker-compose down && docker-compose up`. Bot should reconnect to WhatsApp automatically without QR code prompt and process messages immediately.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US1] Create E2E test for Docker session persistence in tests/e2e/docker-session-persistence.spec.ts
- [ ] T016 [P] [US1] Create integration test for session detection and restoration in tests/integration/session-restore.test.ts
- [ ] T017 [P] [US1] Create unit test for graceful shutdown handler in tests/unit/shutdown-handler.test.ts

### Implementation for User Story 1

- [ ] T018 [US1] Update src/bot/client/auth.ts to detect existing session data in .wwebjs_auth directory on startup
- [ ] T019 [US1] Implement session restoration logic in src/bot/client/auth.ts to load existing session or initiate QR code workflow
- [ ] T020 [US1] Update src/bot/client/shutdown.ts to gracefully save session state on SIGTERM signal
- [ ] T021 [US1] Configure Dockerfile to set proper file permissions (755 directories, 644 files) and ownership (UID 1000) for .wwebjs_auth volume
- [ ] T022 [US1] Update docker-compose.yml to mount whatsapp-session volume to /app/.wwebjs_auth with proper permissions
- [ ] T023 [US1] Add health check configuration to docker-compose.yml that validates WhatsApp client connection status
- [ ] T024 [US1] Update src/services/system/health.ts to return WhatsApp connection status (connected, authenticating, disconnected)
- [ ] T025 [US1] Add QR code display to container logs in src/bot/client/auth.ts when session not found
- [ ] T026 [US1] Test Docker volume persistence: stop container, restart, verify session restored
- [ ] T027 [US1] Test Docker volume persistence: recreate container from new image, verify session loaded

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Bot can be deployed in Docker with session persistence working.

---

## Phase 4: User Story 2 - Troubleshooting WhatsApp Connection Issues (Priority: P1)

**Goal**: Implement structured JSON logging for all WhatsApp Web events with correlation IDs and sensitive data masking

**Independent Test**: Trigger a WhatsApp disconnection event, reconnection attempt, and message send/receive. Verify all events are logged with timestamps, correlation IDs, and context metadata in structured JSON format.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T028 [P] [US2] Create unit test for correlation ID generation in tests/unit/correlation-id.test.ts
- [ ] T029 [P] [US2] Create unit test for data masking utility in tests/unit/data-masker.test.ts
- [ ] T030 [P] [US2] Create integration test for structured logging in tests/integration/logging.test.ts
- [ ] T031 [P] [US2] Create E2E test for WhatsApp event logging in tests/e2e/whatsapp-events-logging.spec.ts

### Implementation for User Story 2

- [ ] T032 [US2] Enhance src/bot/client/events.ts to log all whatsapp-web.js events (qr_code_generated, authenticated, ready, disconnected, message_received, message_sent, message_ack, auth_failure) with structured JSON format
- [ ] T033 [US2] Integrate correlation ID generation in src/bot/handlers/message.ts for each incoming message
- [ ] T034 [US2] Add correlation ID tracking through message processing pipeline (receipt → validation → service → database → response) in src/bot/handlers/message.ts
- [ ] T035 [US2] Implement sensitive data masking in src/lib/logger.ts for phone numbers (last 4 digits) and message content (type+length only)
- [ ] T036 [US2] Configure Winston log rotation in src/lib/logger.ts (maximum 100MB per file, retain last 14 days)
- [ ] T037 [US2] Add LOG_LEVEL environment variable support (ERROR, WARN, INFO, DEBUG) in src/lib/logger.ts
- [ ] T038 [US2] Update src/bot/client/events.ts to log raw event data at DEBUG level with sensitive fields masked
- [ ] T039 [US2] Add structured log format validation: timestamp (ISO 8601), level, eventType, correlationId, metadata
- [ ] T040 [US2] Test log rotation: verify logs rotate at 100MB and retain for 14 days
- [ ] T041 [US2] Test correlation ID tracking: verify same correlation ID appears in all log entries for a single message

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently. All WhatsApp events are logged with structured JSON, correlation IDs, and masked sensitive data.

---

## Phase 5: User Story 3 - Visually Appealing and Readable Bot Messages (Priority: P2)

**Goal**: Implement Unicode font conversion utilities and update all message templates to use formatted text with graceful fallback

**Independent Test**: Send a transaction command and receive a confirmation message. Verify the message uses Unicode bold for headings, monospace for currency amounts, and emoji icons for status indicators.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T042 [P] [US3] Create unit test for font conversion functions in tests/unit/font-formatter.test.ts (empty strings, special characters, mixed alphabets, numbers, long strings)
- [ ] T043 [P] [US3] Create unit test for Unicode fallback behavior in tests/unit/font-fallback.test.ts
- [ ] T044 [P] [US3] Create performance test for font conversion (<5ms requirement) in tests/unit/font-performance.test.ts

### Implementation for User Story 3

- [ ] T045 [US3] Create font conversion utility library in src/lib/font-formatter.ts with functions: toBold(), toItalic(), toMonospace(), toScript(), toBoldItalic()
- [ ] T046 [US3] Implement Unicode character mapping tables in src/lib/font-formatter.ts (Bold: U+1D400-U+1D433 A-Z, U+1D434-U+1D467 a-z, U+1D7CE-U+1D7D7 0-9)
- [ ] T047 [US3] Implement Unicode character mapping tables in src/lib/font-formatter.ts (Italic: U+1D434-U+1D467 A-Z, U+1D468-U+1D49B a-z, U+1D7E2-U+1D7EB 0-9)
- [ ] T048 [US3] Implement Unicode character mapping tables in src/lib/font-formatter.ts (Monospace: U+1D670-U+1D6A3 A-Z, U+1D6A4-U+1D6D7 a-z, U+1D7F6-U+1D7FF 0-9)
- [ ] T049 [US3] Implement character preservation logic in src/lib/font-formatter.ts to preserve emojis, punctuation, and non-ASCII characters unchanged
- [ ] T050 [US3] Implement fallback detection in src/lib/font-formatter.ts: if character mapping returns undefined/null, use original character with native WhatsApp formatting (_bold_, _italic_, `` `monospace` ``)
- [ ] T051 [US3] Pre-compute character mapping tables at application startup in src/lib/font-formatter.ts for O(1) lookup performance
- [ ] T052 [US3] Update transaction confirmation message template in src/bot/ui/messages.ts to use toBold() for headings and toMonospace() for currency amounts
- [ ] T053 [US3] Update monthly report message template in src/bot/ui/messages.ts to use toBold() for category names, toMonospace() for amounts with Rupiah symbols
- [ ] T054 [US3] Update error message templates in src/bot/ui/messages.ts to use ❌ emoji and toBold() for error type
- [ ] T055 [US3] Update help menu template in src/bot/ui/messages.ts to use toMonospace() for commands
- [ ] T056 [US3] Update all message templates in src/bot/ui/ to use font conversion utilities for consistent visual hierarchy
- [ ] T057 [US3] Add emoji prefixes to message templates: ✅ for success, ❌ for error, 💰 for financial data, 📊 for reports
- [ ] T058 [US3] Verify font conversion performance: measure conversion time per message, ensure <5ms overhead
- [ ] T059 [US3] Test graceful fallback: verify messages degrade to native formatting when Unicode not supported

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently. All messages use Unicode font formatting with graceful fallback.

---

## Phase 6: User Story 4 - Dynamic User Onboarding and Role Assignment (Priority: P2)

**Goal**: Implement WhatsApp command interface for user management (add, list, update, delete, activate, deactivate) with RBAC enforcement and audit logging

**Independent Test**: Send `/user add 628123456789 "John Doe" employee` command from a boss-role account. Verify new user can immediately access employee-level commands and all actions are logged in audit trail.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T060 [P] [US4] Create unit test for user management service in tests/unit/user-service.test.ts
- [ ] T061 [P] [US4] Create unit test for phone number normalization in tests/unit/phone-normalization.test.ts
- [ ] T062 [P] [US4] Create unit test for role validation in tests/unit/role-validation.test.ts
- [ ] T063 [P] [US4] Create integration test for user management commands in tests/integration/user-commands.test.ts
- [ ] T064 [P] [US4] Create E2E test for user management workflow in tests/e2e/user-management.spec.ts

### Implementation for User Story 4

- [ ] T065 [US4] Create user management command handler in src/bot/handlers/user.ts with commands: /user add, /user list, /user update, /user delete, /user activate, /user deactivate
- [ ] T066 [US4] Implement /user add command handler in src/bot/handlers/user.ts with phone number normalization, role validation, duplicate prevention
- [ ] T067 [US4] Implement /user list command handler in src/bot/handlers/user.ts with optional role filter, display phone (last 4 digits), name, role, active status, created date
- [ ] T068 [US4] Implement /user update command handler in src/bot/handlers/user.ts with Prisma transactions for atomic multi-field updates
- [ ] T069 [US4] Implement /user delete command handler in src/bot/handlers/user.ts (soft delete: set isActive=false)
- [ ] T070 [US4] Implement /user activate command handler in src/bot/handlers/user.ts (set isActive=true)
- [ ] T071 [US4] Implement /user deactivate command handler in src/bot/handlers/user.ts (set isActive=false, invalidate Redis cache immediately)
- [ ] T072 [US4] Enhance RBAC middleware in src/bot/middleware/auth.ts to enforce dev/boss role requirement for user management commands
- [ ] T073 [US4] Enhance user service in src/services/user/service.ts with user CRUD operations using Prisma transactions
- [ ] T074 [US4] Integrate phone number normalization in src/services/user/service.ts using existing normalizePhoneNumber() from src/lib/validation.ts
- [ ] T075 [US4] Add role validation in src/services/user/service.ts against Prisma UserRole enum (dev, boss, employee, investor)
- [ ] T076 [US4] Implement audit logging in src/services/user/service.ts for all user management operations (add, update, delete, activate, deactivate) to AuditLog model
- [ ] T077 [US4] Add error response formatting in src/bot/handlers/user.ts per contracts/commands.yaml (permission denied, invalid phone, invalid role, duplicate user, validation errors)
- [ ] T078 [US4] Implement access revocation logic in src/bot/middleware/auth.ts: check isActive flag, deny access on next command after deactivation
- [ ] T079 [US4] Add Redis cache invalidation in src/services/user/service.ts for user list and user data on create/update/delete operations
- [ ] T080 [US4] Test user management commands: verify RBAC enforcement, phone normalization, role validation, audit logging
- [ ] T081 [US4] Test concurrent user management commands: verify Prisma transactions prevent race conditions

**Checkpoint**: At this point, User Story 4 should be fully functional and testable independently. Boss and dev roles can manage users via WhatsApp commands with full audit trail.

---

## Phase 7: User Story 5 - Real-Time Template and Configuration Management (Priority: P3)

**Goal**: Implement admin commands for template management, system configuration, system diagnostics, and cache management accessible only to dev role

**Independent Test**: Send `/template edit transaction-confirmation` command, modify the message format, then trigger a transaction. Verify the new template format is used immediately without container restart.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T082 [P] [US5] Create unit test for template management service in tests/unit/template-service.test.ts
- [ ] T083 [P] [US5] Create unit test for configuration service in tests/unit/config-service.test.ts
- [ ] T084 [P] [US5] Create unit test for system diagnostics in tests/unit/system-diagnostics.test.ts
- [ ] T085 [P] [US5] Create integration test for admin commands in tests/integration/admin-commands.test.ts
- [ ] T086 [P] [US5] Create E2E test for admin command workflow in tests/e2e/admin-commands.spec.ts

### Implementation for User Story 5

- [ ] T087 [US5] Enhance admin command handler in src/bot/handlers/admin.ts with commands: /template list, /template edit, /template preview, /role grant, /role revoke, /system status, /system logs, /system metrics, /config view, /config set, /cache clear, /cache inspect
- [ ] T088 [US5] Implement /template list command in src/bot/handlers/admin.ts to display all templates from src/bot/ui/ with names, file paths, descriptions
- [ ] T089 [US5] Implement /template edit command in src/bot/handlers/admin.ts with interactive flow: show current template, accept new content, validate syntax (required placeholders in format {{variableName}}), save to SystemConfiguration
- [ ] T090 [US5] Implement /template preview command in src/bot/handlers/admin.ts to render template with sample data and display formatted output
- [ ] T091 [US5] Implement /role grant command in src/bot/handlers/admin.ts to update user role and invalidate Redis cache (user-<phone>, session-<phone>, role-<phone>)
- [ ] T092 [US5] Implement /role revoke command in src/bot/handlers/admin.ts to update user role and invalidate Redis cache
- [ ] T093 [US5] Enhance /system status command in src/services/system/health.ts to aggregate health checks from PostgreSQL, Redis, WhatsApp client in parallel with 5-second timeout per service
- [ ] T094 [US5] Implement /system logs command in src/bot/handlers/admin.ts to return last N lines (default 50, max 500) from application log file
- [ ] T095 [US5] Implement /system metrics command in src/bot/handlers/admin.ts to display Prometheus metrics (message processing rate, database query performance, cache hit ratio, error rates)
- [ ] T096 [US5] Implement /config view command in src/bot/handlers/admin.ts to retrieve configuration from SystemConfiguration and display (mask sensitive values like API keys)
- [ ] T097 [US5] Implement /config set command in src/bot/handlers/admin.ts to validate value against Zod schema from src/config/env.ts, persist to SystemConfiguration, apply immediately
- [ ] T098 [US5] Implement /cache clear command in src/bot/handlers/admin.ts to clear Redis keys matching glob pattern (e.g., transaction-\*) and return count
- [ ] T099 [US5] Implement /cache inspect command in src/bot/handlers/admin.ts to retrieve cached value with TTL information
- [ ] T100 [US5] Create template management service in src/services/system/template.ts with validation (required placeholders), version history, rollback capability
- [ ] T101 [US5] Create configuration service in src/services/system/config.ts with Zod schema validation, immediate application, sensitive value masking
- [ ] T102 [US5] Enhance RBAC middleware in src/bot/middleware/auth.ts to enforce dev role requirement for all admin commands
- [ ] T103 [US5] Implement audit logging in src/services/system/ for all admin operations (template edit, config set, cache clear, etc.) to AuditLog model
- [ ] T104 [US5] Add error response formatting in src/bot/handlers/admin.ts per contracts/commands.yaml (permission denied, validation errors, not found)
- [ ] T105 [US5] Implement template validation in src/services/system/template.ts: check for required placeholders in format {{variableName}}, validate placeholder names match expected variables
- [ ] T106 [US5] Ensure template edits don't affect messages in send queue: new templates take effect only for messages generated after save operation completes
- [ ] T107 [US5] Test admin commands: verify dev role enforcement, template validation, config validation, audit logging
- [ ] T108 [US5] Test template edit: verify new template used immediately on next message without restart

**Checkpoint**: At this point, User Story 5 should be fully functional and testable independently. Dev role can manage templates, configuration, and system diagnostics via WhatsApp commands.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, documentation, and final validation

- [ ] T109 [P] Update documentation in docs/ with Docker setup guide, QR authentication process, command reference
- [ ] T110 [P] Create docker/README.md with troubleshooting guide for common Docker issues (permissions, session persistence, health checks)
- [ ] T111 [P] Update quickstart.md validation: test all Docker commands, QR code authentication, command examples
- [ ] T112 [P] Add performance benchmarks: verify font conversion <5ms, user ops <2s, admin <10s, startup <60s
- [ ] T113 [P] Add security review: verify sensitive data masking, RBAC enforcement, input validation, SQL injection prevention
- [ ] T114 [P] Add comprehensive integration tests for all user stories working together in tests/integration/full-workflow.test.ts
- [ ] T115 [P] Code cleanup and refactoring: ensure all code follows 4-layer architecture, TypeScript strict mode, naming conventions
- [ ] T116 [P] Add error handling improvements: ensure all error paths are handled gracefully with user-friendly messages
- [ ] T117 [P] Add monitoring and observability: verify all metrics are exposed, health checks work, logs are structured
- [ ] T118 [P] Run full test suite: unit tests, integration tests, E2E tests, verify >80% coverage for critical paths
- [ ] T119 [P] Validate all acceptance scenarios from spec.md: test each user story's independent test criteria
- [ ] T120 [P] Performance testing: verify system handles 1000 concurrent WhatsApp users without degradation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 3 (P2): Can start after Foundational - No dependencies on other stories
  - User Story 4 (P2): Can start after Foundational - May use existing User model but independently testable
  - User Story 5 (P3): Can start after Foundational - Uses SystemConfiguration from Foundational, independently testable
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - Docker infrastructure only
- **User Story 2 (P1)**: Independent - Logging infrastructure only
- **User Story 3 (P2)**: Independent - Font formatting only
- **User Story 4 (P2)**: Independent - Uses existing User model, enhances services
- **User Story 5 (P3)**: Independent - Uses SystemConfiguration from Foundational phase

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models/entities before services
- Services before handlers/endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Setup Phase**: T002, T003, T005, T006 can run in parallel
- **Foundational Phase**: T008, T010, T011, T012, T013 can run in parallel
- **After Foundational**: All user stories (US1, US2, US3, US4, US5) can start in parallel if team capacity allows
- **Within US1**: T015, T016, T017 (tests) can run in parallel
- **Within US2**: T028, T029, T030, T031 (tests) can run in parallel
- **Within US3**: T042, T043, T044 (tests) can run in parallel; T046, T047, T048 (mapping tables) can run in parallel
- **Within US4**: T060, T061, T062, T063, T064 (tests) can run in parallel
- **Within US5**: T082, T083, T084, T085, T086 (tests) can run in parallel
- **Polish Phase**: T109, T110, T111, T112, T113, T114, T115, T116, T117, T118, T119, T120 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create E2E test for Docker session persistence in tests/e2e/docker-session-persistence.spec.ts"
Task: "Create integration test for session detection and restoration in tests/integration/session-restore.test.ts"
Task: "Create unit test for graceful shutdown handler in tests/unit/shutdown-handler.test.ts"

# Then implement core features:
Task: "Update src/bot/client/auth.ts to detect existing session data"
Task: "Implement session restoration logic in src/bot/client/auth.ts"
Task: "Update src/bot/client/shutdown.ts to gracefully save session state"
```

---

## Parallel Example: User Story 3

```bash
# Launch all font conversion mapping implementations together:
Task: "Implement Unicode character mapping tables in src/lib/font-formatter.ts (Bold ranges)"
Task: "Implement Unicode character mapping tables in src/lib/font-formatter.ts (Italic ranges)"
Task: "Implement Unicode character mapping tables in src/lib/font-formatter.ts (Monospace ranges)"

# Then update templates in parallel:
Task: "Update transaction confirmation message template in src/bot/ui/messages.ts"
Task: "Update monthly report message template in src/bot/ui/messages.ts"
Task: "Update error message templates in src/bot/ui/messages.ts"
Task: "Update help menu template in src/bot/ui/messages.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Docker Migration)
4. Complete Phase 4: User Story 2 (Logging Enhancement)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Docker infrastructure)
3. Add User Story 2 → Test independently → Deploy/Demo (Logging infrastructure)
4. Add User Story 3 → Test independently → Deploy/Demo (UX improvement)
5. Add User Story 4 → Test independently → Deploy/Demo (User management)
6. Add User Story 5 → Test independently → Deploy/Demo (Admin capabilities)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Docker)
   - Developer B: User Story 2 (Logging)
   - Developer C: User Story 3 (Fonts) - can start after US1/US2 or in parallel
3. After P1 stories complete:
   - Developer A: User Story 4 (User Management)
   - Developer B: User Story 5 (Admin Commands)
   - Developer C: Polish & Documentation
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Follow TDD approach: write tests first, ensure they fail, then implement
- All tasks include exact file paths for clarity
- Performance budgets must be enforced: font conversion <5ms, user ops <2s, admin <10s, startup <60s

---

## Summary

**Total Tasks**: 120

- **Phase 1 (Setup)**: 6 tasks
- **Phase 2 (Foundational)**: 8 tasks
- **Phase 3 (US1 - Docker)**: 13 tasks (3 tests + 10 implementation)
- **Phase 4 (US2 - Logging)**: 14 tasks (4 tests + 10 implementation)
- **Phase 5 (US3 - Fonts)**: 18 tasks (3 tests + 15 implementation)
- **Phase 6 (US4 - User Management)**: 22 tasks (5 tests + 17 implementation)
- **Phase 7 (US5 - Admin)**: 27 tasks (5 tests + 22 implementation)
- **Phase 8 (Polish)**: 12 tasks

**Task Count per User Story**:

- US1: 13 tasks
- US2: 14 tasks
- US3: 18 tasks
- US4: 22 tasks
- US5: 27 tasks

**Parallel Opportunities Identified**:

- Setup: 4 parallel tasks
- Foundational: 5 parallel tasks
- All user stories can run in parallel after Foundational
- Multiple parallel opportunities within each story

**Independent Test Criteria**:

- US1: Docker session persistence test (docker-compose down && docker-compose up)
- US2: WhatsApp event logging test (disconnection, reconnection, message flow)
- US3: Transaction command with formatted message verification
- US4: /user add command from boss role, verify immediate access
- US5: /template edit command, verify immediate template application

**Suggested MVP Scope**: User Stories 1 & 2 (P1) - Docker infrastructure and logging infrastructure. These are critical for production deployment and troubleshooting.

**Format Validation**: ✅ All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
