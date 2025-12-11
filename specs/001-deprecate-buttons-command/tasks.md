# Tasks: Button Deprecation & Command-Based UI Replacement

**Input**: Design documents from `/specs/001-deprecate-buttons-command/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: TDD approach confirmed per Plan §Testing - Tests included and MUST be written first (fail before implementation)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4])
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [x] T001 Install fuse.js dependency for fuzzy command matching in package.json
- [x] T002 [P] Verify existing zod@^3.22.4 and redis@^4.6.0 dependencies are installed
- [x] T003 [P] Add ENABLE_LEGACY_BUTTONS environment variable to .env.example file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create command constants definitions in src/config/constants.ts with COMMANDS object, COMMAND_SYNONYMS mapping, COMMAND_ABBREVIATIONS mapping (cp→catat_penjualan, ll→lihat_laporan per FR-009), and CONFIDENCE_THRESHOLD constant (70% per FR-041)
- [x] T005 [P] Add ENABLE_LEGACY_BUTTONS configuration flag to src/config/env.ts with boolean schema validation and default true
- [x] T006 [P] Extend src/services/system/config.ts to support runtime ENABLE_LEGACY_BUTTONS flag updates with 60-second propagation guarantee and per-user/per-role override support (precedence: user override > role override > global config per FR-036)
- [x] T007 Extend src/lib/redis.ts with conversation context management functions (getContext, setContext, updateContext, clearContext) with 1800s TTL support
- [x] T008 [P] Create command parser in src/bot/handlers/command.parser.ts with fuse.js integration for fuzzy matching and confidence scoring (NOTE: This is a NEW file; existing src/bot/handlers/command.ts contains CommandHandler class for legacy commands and will be extended, not replaced)
- [x] T009 [P] Create message formatter utility in src/bot/ui/message.formatter.ts with emoji indicators, Markdown formatting, and pagination support

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Employee Records Transaction via Text Command (Priority: P1) 🎯 MVP

**Goal**: Employee can record a complete sales transaction using text commands ("catat penjualan") in under 2 minutes with formatted responses

**Independent Test**: Employee types "catat penjualan" → enters amount "500000" → selects category → confirms → receives success message with updated balance. All steps complete in <2 minutes using only text commands.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T010 [P] [US1] Unit test for command parser "catat penjualan" → "catat_penjualan" intent recognition in tests/unit/bot/handlers/command.parser.test.ts
- [x] T011 [P] [US1] Unit test for transaction command parameter validation in tests/unit/bot/handlers/command.parser.test.ts
- [x] T012 [P] [US1] Unit test for conversation context storage/retrieval for transaction workflow in tests/unit/lib/redis.test.ts
- [x] T013 [US1] Integration test for complete transaction flow: "catat penjualan" → amount → category → confirmation in tests/integration/bot/command-flow.test.ts
- [x] T014 [US1] E2E test for WhatsApp transaction command interaction in tests/e2e/whatsapp/command-interaction.test.ts

### Implementation for User Story 1

- [x] T015 [P] [US1] Implement command parser logic for transaction commands ("catat penjualan", synonyms) in src/bot/handlers/command.parser.ts
- [x] T016 [US1] Extend existing src/bot/handlers/command.ts CommandHandler class with new routing logic that maps parsed intents from command.parser.ts to handler functions, integrating with existing aliasMap structure
- [x] T017 [US1] Implement transaction entry command handler in src/bot/handlers/command.ts that initiates multi-step workflow and stores context using conversation context from Redis
- [x] T018 [US1] Implement conversation context updates for transaction entry workflow (amount input, category selection, confirmation) in src/bot/handlers/command.ts
- [x] T019 [US1] Integrate command handler with existing TransactionHandler for actual transaction creation in src/bot/handlers/command.ts
- [x] T020 [P] [US1] Implement formatted balance message generation in src/bot/ui/message.formatter.ts showing current balance with 💰 emoji
- [x] T021 [US1] Implement formatted transaction confirmation message in src/bot/ui/message.formatter.ts with ✅ emoji, amount, category, and updated balance
- [x] T022 [US1] Implement formatted category list message in src/bot/ui/message.formatter.ts with numbered options and emoji indicators
- [x] T023 [US1] Update src/bot/handlers/message.ts to detect text commands and route to command handler when ENABLE_LEGACY_BUTTONS is false or command detected
- [x] T024 [US1] Implement command logging for all transaction commands in src/bot/handlers/command.ts (timestamp, user, command text, intent, result)

**Checkpoint**: User Story 1 should be fully functional - Employee can record transactions via text commands independently

---

## Phase 4: User Story 2 - User Views Financial Report via Command (Priority: P1)

**Goal**: Users can view role-appropriate financial reports by typing "lihat laporan" commands, receiving formatted reports within 5 seconds

**Independent Test**: User types "lihat laporan hari ini" → receives formatted report with balance, income, expenses, cashflow, trends within 5 seconds. Report filtered by role permissions.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T025 [P] [US2] Unit test for report command parser ("lihat laporan hari ini", "lihat laporan minggu ini") in tests/unit/bot/handlers/command.parser.test.ts
- [x] T026 [P] [US2] Unit test for financial summary service with role-based filtering in tests/unit/services/system/financial-summary.test.ts
- [x] T027 [P] [US2] Unit test for financial data caching (30-60s TTL, cache hit/miss) in tests/unit/services/system/financial-summary.test.ts
- [x] T028 [US2] Integration test for financial report generation with caching in tests/integration/services/financial-data.test.ts
- [x] T029 [US2] Integration test for role-based data filtering (Employee/Boss/Investor) in tests/integration/services/financial-data.test.ts

### Implementation for User Story 2

- [x] T030 [P] [US2] Create financial summary service in src/services/system/financial-summary.ts with aggregation logic (balance, income, expenses, cashflow)
- [x] T031 [US2] Implement financial data caching in src/services/system/financial-summary.ts with Redis (30-60s TTL, cache key format: financial:summary:{userId}:{dateRange})
- [x] T032 [US2] Implement role-based data filtering in src/services/system/financial-summary.ts (Employee: own only, Boss: all, Investor: aggregated only)
- [x] T033 [US2] Implement pending transaction separation logic in src/services/system/financial-summary.ts (exclude from balance/trends, show separately)
- [x] T034 [P] [US2] Implement trend calculation (percentage changes, period comparisons) in src/services/system/financial-summary.ts
- [x] T035 [US2] Implement report command handlers for date ranges ("hari ini", "minggu ini", "bulan ini") in src/bot/handlers/command.ts
- [x] T036 [P] [US2] Implement formatted report message generation in src/bot/ui/message.formatter.ts with 📊 emoji, financial metrics, and trend indicators
- [x] T037 [US2] Implement formatted financial summary display in src/bot/ui/message.formatter.ts with Indonesian Rupiah formatting (Rp 500.000), thousand separators
- [x] T038 [US2] Integrate financial summary service with report command handlers in src/bot/handlers/command.ts
- [x] T039 [US2] Implement on-demand cache refresh mechanism ("refresh", "update" commands bypass cache) in src/services/system/financial-summary.ts

**Checkpoint**: User Story 2 should be fully functional - Users can view financial reports via commands independently

---

## Phase 5: User Story 3 - System Provides Command Help and Suggestions (Priority: P2)

**Goal**: Users receive helpful suggestions and role-filtered help when commands are unrecognized or unclear, reducing support burden

**Independent Test**: User types unrecognized command → receives formatted help within 2 seconds showing available commands for their role. User types "catat penjuaan" → receives suggestion "catat penjualan" with confidence indicator.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T040 [P] [US3] Unit test for fuzzy matching suggestions (low confidence commands) in tests/unit/bot/handlers/command.parser.test.ts
- [x] T041 [P] [US3] Unit test for role-filtered help command output in tests/unit/bot/handlers/command.test.ts
- [x] T042 [P] [US3] Unit test for contextual suggestions during multi-step workflows in tests/unit/bot/handlers/command.test.ts
- [x] T043 [US3] Integration test for help command flow with role filtering in tests/integration/bot/command-flow.test.ts

### Implementation for User Story 3

- [x] T044 [US3] Implement command parser suggestion logic for unrecognized commands (top 3 matches with descriptions) in src/bot/handlers/command.parser.ts
- [x] T045 [US3] Implement confidence-based error handling (≥70% auto-execute command, <70% show explicit offer with button fallback option or suggestions) in src/bot/handlers/command.ts
- [x] T046 [US3] Implement help command handler ("bantu", "help") in src/bot/handlers/command.ts with role-filtered command list
- [x] T047 [US3] Create role-based command mapping in src/config/constants.ts defining available commands per role (Employee, Boss, Investor, Dev)
- [x] T048 [P] [US3] Implement formatted help message generation in src/bot/ui/message.formatter.ts with emoji indicators and role labels (🔒 Boss only)
- [x] T049 [US3] Implement contextual suggestion logic based on conversation context (suggests next step during transaction entry) in src/bot/handlers/command.ts
- [x] T050 [US3] Implement command syntax error handling with examples and rephrase suggestions in src/bot/handlers/command.ts
- [x] T051 [US3] Implement command analytics tracking for unrecognized commands (FR-045) in src/bot/handlers/command.ts

**Checkpoint**: User Story 3 should be fully functional - Users receive helpful guidance and suggestions independently

---

## Phase 6: User Story 4 - System Maintains Button Fallback During Transition (Priority: P2)

**Goal**: System supports button fallback via ENABLE_LEGACY_BUTTONS configuration, maintaining 100% backward compatibility when enabled

**Independent Test**: Admin sets ENABLE_LEGACY_BUTTONS=true → all existing button interactions work identically. Admin sets ENABLE_LEGACY_BUTTONS=false → buttons disabled, users directed to use commands.

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T052 [P] [US4] Unit test for ENABLE_LEGACY_BUTTONS configuration flag behavior in tests/unit/services/system/config.test.ts
- [ ] T053 [P] [US4] Unit test for button rendering conditional logic in tests/unit/bot/ui/buttons.test.ts
- [ ] T054 [US4] Integration test for button fallback enabled mode (all buttons work) in tests/integration/bot/command-flow.test.ts
- [ ] T055 [US4] Integration test for button fallback disabled mode (buttons not rendered, command guidance shown) in tests/integration/bot/command-flow.test.ts

### Implementation for User Story 4

- [ ] T056 [US4] Modify src/bot/ui/buttons.ts to check ENABLE_LEGACY_BUTTONS flag before rendering buttons
- [ ] T057 [US4] Modify src/bot/handlers/message.ts to disable button callback processing when ENABLE_LEGACY_BUTTONS is false
- [ ] T058 [US4] Implement clear messaging when buttons disabled (direct users to text commands with examples) in src/bot/handlers/message.ts
- [ ] T059 [US4] Implement warning logging when legacy button interactions attempted while disabled (FR-034) in src/bot/handlers/message.ts
- [ ] T060 [US4] Ensure runtime configuration updates propagate within 60 seconds (FR-035) in src/services/system/config.ts
- [ ] T061 [US4] Implement simultaneous button/command operation support when buttons enabled (FR-039) in src/bot/handlers/message.ts
- [ ] T062 [US4] Verify all existing button functionality works identically when ENABLE_LEGACY_BUTTONS=true (FR-037, FR-040) - regression testing
- [ ] T063 [US4] Implement usage analytics tracking for button vs command usage rates (FR-038) in src/bot/handlers/message.ts, logging interaction type, timestamp, and user role
- [ ] T079 [US4] Create usage analytics reporting service in src/services/system/analytics.ts to aggregate button vs command usage data, generate reports (daily/weekly/monthly), and provide admin API endpoint for accessing analytics data (completes FR-038 reporting requirement)

**Checkpoint**: User Story 4 should be fully functional - Button fallback works correctly independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, performance optimization, error handling, and documentation

- [ ] T064 [P] Implement message pagination for long responses (>4096 chars) in src/bot/ui/message.formatter.ts with continuation indicators ([1/3], [2/3])
- [ ] T065 [P] Implement conversation context expiration handling in src/lib/redis.ts: check TTL expiration (30 minutes/1800s per FR-007), return expiration status, and automatically clear expired contexts
- [ ] T066 [US1] Implement context expiration user notification handler in src/bot/handlers/command.ts: detect expired context on user message, send notification "Sesi Anda berakhir. Mulai ulang dengan perintah baru." (per Clarifications §Q2), and clear context (depends on T065)
- [ ] T067 [P] Add performance monitoring for command parser latency (<100ms target per Plan §Performance Goals) in src/bot/handlers/command.parser.ts
- [ ] T068 [P] Add performance monitoring for response times (simple <2s, data retrieval <5s) in src/bot/handlers/command.ts
- [ ] T069 [P] Implement comprehensive error handling for financial data retrieval failures in src/services/system/financial-summary.ts
- [ ] T070 [P] Add structured logging with context (userId, command, result, latency) in src/bot/handlers/command.ts using Winston
- [ ] T071 [P] Implement command abbreviation support ("cp" for "catat penjualan", "ll" for "lihat laporan") in src/config/constants.ts and src/bot/handlers/command.parser.ts
- [ ] T072 [P] Add validation for all command parameters using Zod schemas per Data Model in src/bot/handlers/command.parser.ts
- [ ] T073 [P] Implement savings goals display (when applicable to role) in src/services/system/financial-summary.ts and src/bot/ui/message.formatter.ts
- [ ] T074 [P] Implement category breakdown display with percentages in src/services/system/financial-summary.ts and src/bot/ui/message.formatter.ts
- [ ] T075 Update documentation with command reference and examples in docs/COMMANDS.md
- [ ] T076 Run quickstart.md validation scenarios to verify all functionality
- [ ] T077 Code cleanup and refactoring across all command-related files
- [ ] T078 Performance optimization (cache hit rate, query optimization) for financial data retrieval
- [ ] T080 [P] Add test coverage validation task: verify test coverage meets constitution requirements (80% lines, 90% branches for business logic) and add coverage reporting to CI/CD pipeline

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories**
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1) and User Story 2 (P1) can proceed in parallel after Foundational
  - User Story 3 (P2) can proceed in parallel with US1/US2
  - User Story 4 (P2) can proceed in parallel with other stories
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Transaction Commands**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1) - Report Commands**: Can start after Foundational (Phase 2) - Can use financial-summary service from US1 or implement independently
- **User Story 3 (P2) - Help & Suggestions**: Can start after Foundational (Phase 2) - Benefits from command parser in Foundational but independently testable
- **User Story 4 (P2) - Button Fallback**: Can start after Foundational (Phase 2) - Independent, modifies existing button code

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Command parser before handlers
- Services before handlers
- Handlers before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:

- T002 and T003 can run in parallel (different files)

**Phase 2 (Foundational)**:

- T005, T006, T008, T009 can run in parallel (different files, no dependencies)
- T007 depends on Redis setup but can run parallel with others

**Phase 3 (User Story 1)**:

- All test tasks (T010-T012) can run in parallel
- T015, T020, T021, T022 can run in parallel (different files)
- T016 depends on T015, T017 depends on T016, etc.

**Phase 4 (User Story 2)**:

- All test tasks (T025-T027) can run in parallel
- T030, T034, T036 can run in parallel
- T031 depends on T030, T032 depends on T030, etc.

**Phase 5 (User Story 3)**:

- All test tasks (T040-T042) can run in parallel
- T044, T047, T048 can run in parallel

**Phase 6 (User Story 4)**:

- All test tasks (T052-T053) can run in parallel
- T056, T057, T058, T059 can run in parallel (different concerns)

**Phase 7 (Polish)**:

- Most tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: T010 - Unit test for command parser in tests/unit/bot/handlers/command.parser.test.ts
Task: T011 - Unit test for transaction command parameter validation in tests/unit/bot/handlers/command.parser.test.ts
Task: T012 - Unit test for conversation context storage in tests/unit/lib/redis.test.ts

# Launch parallel implementation tasks:
Task: T015 - Implement command parser logic in src/bot/handlers/command.parser.ts
Task: T020 - Implement formatted balance message in src/bot/ui/message.formatter.ts
Task: T021 - Implement formatted transaction confirmation in src/bot/ui/message.formatter.ts
Task: T022 - Implement formatted category list in src/bot/ui/message.formatter.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Transaction Commands)
4. Complete Phase 4: User Story 2 (Report Commands)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready

**MVP Scope**: Users can record transactions and view reports via commands. This delivers core value.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP core)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP complete)
4. Add User Story 3 → Test independently → Deploy/Demo (Enhanced UX)
5. Add User Story 4 → Test independently → Deploy/Demo (Backward compatibility)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Transaction Commands) - P1
   - **Developer B**: User Story 2 (Report Commands) - P1
   - **Developer C**: User Story 3 (Help & Suggestions) - P2
   - **Developer D**: User Story 4 (Button Fallback) - P2
3. Stories complete and integrate independently
4. Polish phase tasks distributed across team

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total tasks: 80 (T001-T080)
- Task distribution: Setup (3), Foundational (6), US1 (10+5 tests), US2 (10+5 tests), US3 (8+4 tests), US4 (9+4 tests), Polish (16)
