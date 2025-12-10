# Implementation Tasks: WhatsApp Cashflow Reporting Chatbot

**Feature**: WhatsApp Cashflow Reporting Chatbot  
**Branch**: `004-whatsapp-cashflow-bot`  
**Generated**: 2025-12-09  
**Based on**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Summary

This document contains actionable, dependency-ordered implementation tasks organized by user story priority. Each task is independently executable and follows the strict checklist format.

**Total Tasks**: 197 (156 original + 41 new tasks for coverage gaps)  
**User Stories**: 8 (3 P1, 4 P2, 1 P3)  
**MVP Scope**: User Stories 1-3 (P1 stories) - Core transaction input and automated reporting

## Implementation Strategy

**MVP First**: Start with User Stories 1-3 (P1) to deliver core value:

- User Story 1: Transaction input (foundational data)
- User Story 2: Automated daily reports (primary business objective)
- User Story 3: Multi-step editing (user experience quality)

**Incremental Delivery**: Each user story phase is independently testable and can be deployed separately.

**Parallel Opportunities**: Tasks marked [P] can be executed in parallel within the same phase.

## Dependencies

**Story Completion Order**:

1. **Phase 1-2**: Setup and foundational infrastructure (blocks all stories)
2. **Phase 3**: User Story 1 (P1) - Transaction input (provides data for reports)
3. **Phase 4**: User Story 2 (P1) - Automated reports (depends on US1 data)
4. **Phase 5**: User Story 3 (P1) - Multi-step editing (enhances US1)
5. **Phase 6**: User Story 8 (P2) - Concurrent usage (enhances all previous)
6. **Phase 7**: User Story 6 (P2) - Real-time reports (depends on US2)
7. **Phase 8**: User Story 5 (P2) - Dev management (operational support)
8. **Phase 9**: User Story 4 (P2) - Investor analysis (depends on US2, US6)
9. **Phase 10**: User Story 7 (P3) - Recommendations (depends on US2, US4)
10. **Phase 11**: Polish & cross-cutting concerns

**Note**: User Stories 1, 2, 3 are P1 and form the MVP. Stories 4-8 are P2/P3 and can be implemented in parallel after MVP is complete.

---

## Phase 1: Project Setup

**Goal**: Initialize project structure, dependencies, and development environment.

**Independent Test**: Project builds successfully, all dependencies install, Docker Compose starts PostgreSQL and Redis, Prisma migrations run.

### Setup Tasks

- [x] T001 Create project structure per implementation plan in repository root
- [x] T002 Initialize Node.js project with package.json (Node.js 20 LTS, TypeScript 5.x)
- [x] T003 Configure TypeScript with strict mode in tsconfig.json
- [x] T004 Configure ESLint with TypeScript rules in .eslintrc.js
- [x] T005 [P] Create src/ directory structure (bot/, services/, models/, lib/, config/)
- [x] T006 [P] Create tests/ directory structure (unit/, integration/, e2e/)
- [x] T007 [P] Create prisma/ directory with schema.prisma template
- [x] T008 [P] Create docker/ directory with Dockerfile and docker-compose.yml
- [x] T009 Install core dependencies: whatsapp-web.js@^1.23.0, prisma@^5.0.0, @prisma/client@^5.0.0
- [x] T010 Install supporting dependencies: redis@^4.6.0 (Node.js client library; Redis server version 7.x specified in docker-compose.yml), winston@^3.11.0, node-cron@^3.0.0, pdfkit@^0.13.0, puppeteer@^21.0.0
- [x] T011 Install dev dependencies: typescript@^5.0.0, @types/node@^20.0.0, jest@^29.0.0, @types/jest@^29.0.0, playwright@^1.40.0
- [x] T012 Configure Jest test framework in jest.config.js
- [x] T013 Configure Playwright for E2E tests in playwright.config.ts
- [x] T014 Create .env.example with all required environment variables
- [x] T015 Create .gitignore excluding node_modules/, .env, .wwebjs_auth/, dist/
- [x] T016 Create README.md with project overview and quickstart instructions
- [x] T017 Configure Docker Compose for PostgreSQL 15+ and Redis 7.x in docker/docker-compose.yml
- [x] T018 Create application entry point in src/index.ts

---

## Phase 2: Foundational Infrastructure

**Goal**: Set up database schema, core utilities, and shared infrastructure that blocks all user stories.

**Independent Test**: Database migrations run successfully, Redis connection works, logger outputs structured JSON, environment validation passes.

### Database & Schema

- [x] T019 [P] Define Prisma schema for Users entity in prisma/schema.prisma
- [x] T020 [P] Define Prisma schema for Transactions entity in prisma/schema.prisma
- [x] T021 [P] Define Prisma schema for Categories entity in prisma/schema.prisma
- [x] T022 [P] Define Prisma schema for UserSessions entity in prisma/schema.prisma
- [x] T023 [P] Define Prisma schema for Reports entity in prisma/schema.prisma
- [x] T024 [P] Define Prisma schema for AuditLogs entity in prisma/schema.prisma
- [x] T025 [P] Define Prisma schema for Recommendations entity in prisma/schema.prisma
- [x] T026 Configure TimescaleDB extension in Prisma schema for Transactions timestamp hypertable
- [x] T027 Create initial database migration with npx prisma migrate dev --name init
- [x] T028 Generate Prisma Client with npx prisma generate

### Core Utilities

- [x] T029 [P] Implement environment variable validation in src/config/env.ts
- [x] T030 [P] Implement application constants in src/config/constants.ts
- [x] T031 [P] Implement Winston logger configuration in src/lib/logger.ts
- [x] T032 [P] Implement Redis client wrapper in src/lib/redis.ts
- [x] T033 [P] Implement currency formatting utilities (Rp) in src/lib/currency.ts
- [x] T034 [P] Implement date/time utilities (WITA timezone) in src/lib/date.ts
- [x] T035 [P] Implement input validation helpers in src/lib/validation.ts

### WhatsApp Client Foundation

- [x] T036 Implement LocalAuth session management in src/bot/client/auth.ts
- [x] T037 Implement WhatsApp client initialization in src/bot/client/client.ts
- [x] T038 Implement event handlers (ready, disconnect, qr) in src/bot/client/events.ts
- [x] T039 Implement message event routing in src/bot/client/events.ts

---

## Phase 3: User Story 1 - Employee Records Daily Sales (P1)

**Goal**: Employee can input daily sales transactions through button-based interface in <5 minutes per transaction.

**Independent Test**: Employee can input 5 sales transactions in under 10 minutes, each saved to database with correct amount, category, timestamp, and user attribution. No transaction data loss occurs.

**Acceptance Criteria**:

1. Employee receives welcome menu with [💰 Catat Penjualan] [💸 Catat Pengeluaran] buttons
2. Category selection menu displays product options
3. Confirmation screen shows formatted amount (Rp), timestamp, category
4. Transaction saves within 2 seconds with success message
5. Previous category pre-selected for recurring transactions

### User Story 1 Tasks

- [x] T040 [US1] Create User model operations in src/models/user.ts
- [x] T041 [US1] Create Category model operations in src/models/category.ts
- [x] T042 [US1] Create Transaction model operations in src/models/transaction.ts
- [x] T043 [US1] Implement user authentication service in src/services/user/auth.ts
- [x] T044 [US1] Implement RBAC service in src/services/user/rbac.ts
- [x] T045 [US1] Implement transaction validator (amount, category, duplicate) in src/services/transaction/validator.ts
- [x] T046 [US1] Implement transaction processor in src/services/transaction/processor.ts
- [x] T047 [US1] Implement button menu generation in src/bot/ui/buttons.ts
- [x] T048 [US1] Implement list message generation for categories in src/bot/ui/lists.ts
- [x] T049 [US1] Implement message formatting (Indonesian) in src/bot/ui/messages.ts
- [x] T050 [US1] Implement button callback handler in src/bot/handlers/button.ts
- [x] T051 [US1] Implement text message routing in src/bot/handlers/message.ts
- [x] T052 [US1] Implement session state management middleware in src/bot/middleware/session.ts
- [x] T053 [US1] Implement authentication middleware in src/bot/middleware/auth.ts
- [x] T054 [US1] Implement transaction input workflow handler (category → amount → confirmation) in src/bot/handlers/transaction.ts
- [x] T055 [US1] Implement welcome message handler with role-based menu in src/bot/handlers/message.ts
- [x] T056 [US1] Seed initial categories (income/expense) in prisma/seed.ts
- [x] T057 [US1] Create initial Dev user for testing in prisma/seed.ts

---

## Phase 4: User Story 2 - Boss Receives Automated Daily Report (P1)

**Goal**: System generates and delivers role-appropriate report to Boss at 24:00 WITA with report delivered within 30 seconds.

**Independent Test**: System generates and successfully delivers role-appropriate report to Boss user at 24:00 WITA with report delivered to device within 30 seconds. Report content matches calculated financials from database for that calendar day.

**Acceptance Criteria**:

1. Cron scheduler triggers at 23:55 WITA to query transactions
2. Boss receives text summary: total income, expenses, cashflow, % change, top 5 transactions
3. PDF attachment includes pie chart, trend line graph, category breakdown table
4. Boss can request drill-down report with [📊 Detail Lengkap] button
5. Priority alerts sent for 3+ consecutive negative cashflow days

### User Story 2 Tasks

- [x] T058 [US2] Create Report model operations in src/models/report.ts
- [x] T059 [US2] Implement report data aggregation service in src/services/report/generator.ts
- [x] T060 [US2] Implement text report formatter in src/services/report/formatter.ts
- [x] T061 [US2] Implement PDF generation with charts in src/services/report/pdf.ts
- [x] T062 [US2] Implement daily report cron job (23:55 WITA) in src/services/scheduler/daily-report.ts
- [x] T063 [US2] Implement report delivery service (24:00 WITA) in src/services/scheduler/delivery.ts
- [x] T064 [US2] Implement role-based report content filtering in src/services/report/generator.ts
- [x] T065 [US2] Implement report delivery rate limiting (15-20 msg/min) in src/services/scheduler/delivery.ts
- [x] T066 [US2] Implement retry logic for failed deliveries (3 retries, 5-min intervals) in src/services/scheduler/delivery.ts
- [x] T067 [US2] Implement report drill-down handler in src/bot/handlers/report.ts
- [x] T068 [US2] Implement report delivery status tracking in src/models/report.ts

---

## Phase 5: User Story 3 - Multi-Step Transaction with Editing (P1)

**Goal**: User can navigate multi-step workflow, edit any field before submission without losing context.

**Independent Test**: User enters amount, category, and optional notes, then edits category without re-entering amount, finally confirms and saves. All data persists correctly in database.

**Acceptance Criteria**:

1. User can edit amount from confirmation screen with [✏️ Edit Jumlah]
2. Multiple field edits preserve context
3. Session timeout clears state after 10 minutes inactivity
4. [❌ Batal] terminates workflow without saving
5. Network interruption queues partial data for retry

### User Story 3 Tasks

- [x] T069 [US3] Enhance session state management for multi-step workflows in src/bot/middleware/session.ts
- [x] T070 [US3] Implement edit field handlers (amount, category, notes) in src/bot/handlers/transaction.ts
- [x] T071 [US3] Implement session timeout cleanup (10 minutes) in src/bot/middleware/session.ts
- [x] T072 [US3] Implement cancellation workflow handler in src/bot/handlers/transaction.ts
- [x] T073 [US3] Implement network interruption recovery with Redis queuing in src/bot/middleware/session.ts
- [x] T074 [US3] Implement context preservation across edits in src/bot/handlers/transaction.ts
- [x] T075 [US3] Implement pre-filled data retry mechanism in src/bot/handlers/transaction.ts

---

## Phase 6: User Story 8 - Multi-User Concurrent Usage (P2)

**Goal**: 50 concurrent users can simultaneously use chatbot without conflicts, data corruption, or performance degradation.

**Independent Test**: 50 concurrent users each input 3 transactions simultaneously. All transactions saved correctly with no duplicates, data corruption, or loss. System response time remains <2 seconds per action.

**Acceptance Criteria**:

1. 10 employees can press [💰 Catat Penjualan] simultaneously with independent menu states
2. Button debouncing prevents duplicate submissions (3-second cooldown)
3. Concurrent report requests generate in parallel without cross-contamination
4. Rate limiting prevents WhatsApp throttling (15-20 msg/min per chat)
5. Database maintains ACID integrity with 50 concurrent writes

### User Story 8 Tasks

- [x] T076 [US8] Implement button debouncing middleware (3-second cooldown) in src/bot/middleware/debounce.ts
- [x] T077 [US8] Implement message rate limiting middleware in src/bot/middleware/rate-limit.ts
- [x] T078 [US8] Configure database connection pool (min 5, max 50) in src/lib/database.ts
- [x] T079 [US8] Implement optimistic locking for concurrent transaction edits in src/models/transaction.ts
- [x] T080 [US8] Implement Redis session isolation for concurrent users in src/bot/middleware/session.ts
- [x] T081 [US8] Implement concurrent report generation queue in src/services/report/generator.ts
- [x] T082 [US8] Add load testing scenarios for 50 concurrent users in tests/integration/load/

---

## Phase 7: User Story 6 - Real-Time Report Access (P2)

**Goal**: Users of all roles can request current financial reports on-demand with role-based filtering.

**Independent Test**: Each role (Employee, Boss, Investor, Dev) requests daily report via [📊 Lihat Laporan Hari Ini], receives role-appropriate filtered view within 5 seconds, with no unauthorized data visible.

**Acceptance Criteria**:

1. Employee sees personal transactions + company totals (aggregated)
2. Boss sees all transactions with employee attribution
3. Investor sees aggregated metrics only, zero individual transactions
4. Excel export generates with role-appropriate filtered data
5. Custom date range reports (weekly, monthly) calculate correctly

### User Story 6 Tasks

- [x] T083 [US6] Implement on-demand report request handler in src/bot/handlers/report.ts
- [x] T084 [US6] Implement role-based data filtering for reports in src/services/report/generator.ts
- [x] T085 [US6] Implement Excel export service in src/services/report/excel.ts
- [x] T086 [US6] Implement custom date range report calculation in src/services/report/generator.ts
- [x] T087 [US6] Implement weekly/monthly report aggregation in src/services/report/generator.ts
- [x] T088 [US6] Implement report request response time optimization (<5 seconds) in src/services/report/generator.ts

---

## Phase 8: User Story 5 - Dev Role System Health Monitoring (P2)

**Goal**: Dev can monitor system health, manage users, configure settings, access audit logs, and restart services.

**Independent Test**: Dev user can view system health metrics (uptime %, error rate, message throughput), add new user with assigned role, change existing user role, deactivate user, and view audit log of last 100 actions. All operations complete within 5 seconds.

**Acceptance Criteria**:

1. Dev receives health dashboard: uptime %, delivery success rate, database status, WhatsApp session status, memory usage
2. Dev can view user list with roles, last active, active/inactive status
3. Dev can change user role, deactivate user, reset session, view user audit log
4. Dev can add new user and send registration link to phone number
5. Dev can access audit log filtered by user/action/date

### User Story 5 Tasks

- [x] T089 [US5] Create AuditLog model operations in src/models/audit.ts
- [x] T090 [US5] Implement audit logging service in src/services/audit/logger.ts
- [x] T091 [US5] Implement user management service in src/services/user/service.ts
- [x] T092 [US5] Implement system health monitoring service in src/services/system/health.ts
- [x] T093 [US5] Implement Dev role menu handler in src/bot/handlers/admin.ts
- [x] T094 [US5] Implement health dashboard handler in src/bot/handlers/admin.ts
- [x] T095 [US5] Implement user management handlers (list, add, edit, deactivate) in src/bot/handlers/admin.ts
- [x] T096 [US5] Implement audit log query handler in src/bot/handlers/admin.ts
- [x] T097 [US5] Implement system configuration handler in src/bot/handlers/admin.ts
- [x] T098 [US5] Integrate audit logging into all sensitive operations (create/edit/delete transactions, role changes)

---

## Phase 9: User Story 4 - Investor Monthly Aggregated Analysis (P2)

**Goal**: Investor receives monthly financial analysis with aggregated metrics, trend analysis, and investment insights. No individual transactions visible.

**Independent Test**: Investor receives monthly report with aggregated financial metrics, 0 individual transaction rows visible, and historical comparison (vs last month, vs annual targets) included. Report generated at 24:00 WITA alongside other role reports.

**Acceptance Criteria**:

1. Investor receives daily aggregated summary: total revenue, expenses, net profit, profit margin %
2. Monthly boundary triggers detailed monthly analysis with 7-day moving average
3. Investor can request 90-day trend analysis with visual representation
4. Investor receives AI-generated investment insights (business health, growth rate, burn rate)
5. Investor can compare current period vs last 3 months with variance highlights (>15%)

### User Story 4 Tasks

- [x] T099 [US4] Implement investor-specific report aggregation (no individual transactions) in src/services/report/generator.ts
- [x] T100 [US4] Implement monthly report generation trigger in src/services/scheduler/daily-report.ts
- [x] T101 [US4] Implement 7-day moving average calculation in src/services/report/generator.ts
- [x] T102 [US4] Implement 90-day trend analysis service in src/services/report/trend.ts
- [x] T103 [US4] Implement investment insights generation in src/services/report/insights.ts
- [x] T104 [US4] Implement period comparison service (vs last month, vs targets) in src/services/report/comparison.ts
- [x] T105 [US4] Implement variance analysis (>15% threshold) in src/services/report/comparison.ts
- [x] T106 [US4] Implement investor menu handler with [📈 Analisis Trend] and [💡 Insight Investasi] in src/bot/handlers/investor.ts

---

## Phase 10: User Story 7 - Recommendation Engine Alerts (P3)

**Goal**: System proactively detects financial anomalies and sends recommendations to Boss and Investor roles.

**Independent Test**: When daily expense exceeds 7-day average by >30%, system automatically sends alert to Boss with [📊 Lihat Detail] and [💬 Diskusi dengan Tim] buttons within 2 hours of anomaly detection.

**Acceptance Criteria**:

1. Expense spike >30% vs 7-day average triggers Boss alert
2. Revenue decline >15% vs last week triggers Boss alert with trend analysis
3. 3 consecutive negative cashflow days triggers high-priority alert
4. Investor receives investment-focused insights via [💡 Insight Investasi]
5. Monthly target variance >20% triggers Boss and Investor notifications

### User Story 7 Tasks

- [x] T107 [US7] Create Recommendation model operations in src/models/recommendation.ts
- [x] T108 [US7] Implement recommendation engine core in src/services/recommendation/engine.ts
- [x] T109 [US7] Implement financial anomaly analyzer in src/services/recommendation/analyzer.ts
- [x] T110 [US7] Implement confidence score calculator (0-100%) in src/services/recommendation/confidence.ts
- [x] T111 [US7] Implement expense spike detection (>30% threshold) in src/services/recommendation/analyzer.ts
- [x] T112 [US7] Implement revenue decline detection (>15% threshold) in src/services/recommendation/analyzer.ts
- [x] T113 [US7] Implement negative cashflow detection (3+ days) in src/services/recommendation/analyzer.ts
- [x] T114 [US7] Implement alert delivery gating (Critical + ≥80% confidence) in src/services/recommendation/engine.ts
- [x] T115 [US7] Implement recommendation delivery service in src/services/recommendation/delivery.ts
- [x] T116 [US7] Implement recommendation dismissal tracking in src/models/recommendation.ts
- [x] T117 [US7] Implement recommendation action buttons ([📊 Lihat Detail], [💬 Diskusi dengan Tim]) in src/bot/handlers/recommendation.ts

---

## Phase 11: Polish & Cross-Cutting Concerns

**Goal**: Complete remaining features, optimize performance, add monitoring, and prepare for production deployment.

**Independent Test**: All features work end-to-end, performance targets met (<1s button latency, <2s text response, <30s report generation), monitoring dashboards display correctly, production deployment succeeds.

### Text Command Fallbacks

- [x] T118 Implement text command parser (/start, /help, /menu, /laporan, /catat) in src/bot/handlers/command.ts
- [x] T119 Implement command routing to appropriate handlers in src/bot/handlers/command.ts
- [x] T120 Implement numbered text menu fallback for button rendering failures in src/bot/ui/buttons.ts

### Error Handling & Recovery

- [x] T121 Implement user-friendly error messages (Indonesian) in src/bot/ui/messages.ts
- [x] T122 Implement error recovery buttons ([🔄 Coba Lagi] [🏠 Menu Utama]) in src/bot/ui/buttons.ts
- [x] T123 Implement WhatsApp session disconnection detection and reconnection in src/bot/client/events.ts
- [x] T124 Implement invalid input handling with format examples in src/bot/handlers/message.ts
- [x] T125 Implement media message handling (graceful ignore) in src/bot/handlers/message.ts

### Transaction Approval Workflow

- [x] T126 Implement suspicious transaction detection (duplicates, unrealistic amounts) in src/services/transaction/approval.ts
- [x] T127 Implement approval workflow service (auto-approve, flagged-pending, manually-approved/rejected) in src/services/transaction/approval.ts
- [x] T128 Implement approval status tracking in src/models/transaction.ts
- [x] T129 Implement Boss approval/rejection handlers in src/bot/handlers/approval.ts
- [x] T129a [US1] Verify approval workflow state machine (auto-approve → flagged-pending → manually-approved/rejected) covers FR-075 and FR-076 requirements

### Low-Priority Features (Phase 2+)

- [x] T177 [FR-022] Implement user profile viewing (phone, name, role, registration date) in src/bot/handlers/profile.ts
- [x] T178 [FR-024] Implement account deletion request workflow in src/bot/handlers/profile.ts
- [x] T179 [FR-025] Implement user activity summary display for Boss/Dev in src/bot/handlers/admin.ts
- [x] T180 [FR-034] Implement keyboard shortcuts for power users (number shortcuts: 1, 2, 3) in src/bot/handlers/command.ts
- [ ] T181 [FR-038] Implement button label customization by Dev role in src/services/system/config.ts
- [ ] T182 [FR-040] Implement full localization support (Indonesian with English fallback) in src/lib/i18n.ts
- [ ] T183 [FR-064] Implement saved report templates for Boss in src/services/report/templates.ts
- [ ] T184 [FR-065] Implement custom report scheduling (beyond 24:00) in src/services/scheduler/custom.ts
- [ ] T185 [FR-074] Implement bulk transaction entry for Power Users (Dev/Boss) in src/bot/handlers/transaction.ts
- [x] T186 [FR-078] Implement transaction editing after submission (same-day edits, previous day by Boss/Dev) in src/bot/handlers/transaction.ts
- [x] T187 [FR-079] Implement transaction deletion (soft delete) with Boss/Dev permission in src/services/transaction/processor.ts
- [ ] T188 [FR-080] Implement receipt SMS/WhatsApp confirmation (optional, Dev-enabled) in src/services/notification/receipt.ts
- [x] T189 [FR-085] Implement recommendation dismissal tracking in src/models/recommendation.ts (✅ Already implemented in Phase 10)
- [ ] T190 [FR-087] Implement recommendation learning from user acknowledgment patterns in src/services/recommendation/learning.ts
- [ ] T191 [FR-088] Implement custom recommendation rules creation by Dev/Boss in src/services/recommendation/rules.ts
- [ ] T192 [FR-089] Implement monthly trending insights generation in src/services/recommendation/trending.ts
- [ ] T193 [FR-090] Implement recommendation export to email/Slack in src/services/recommendation/export.ts
- [x] T194 [FR-098] Implement manual report generation trigger for Dev in src/bot/handlers/admin.ts
- [ ] T195 [FR-099] Implement database backup/restore via bot commands in src/bot/handlers/admin.ts
- [x] T196 [FR-100] Implement graceful shutdown with session preservation in src/bot/client/shutdown.ts
- [ ] T197 [FR-089] Implement monthly insight generation scheduler (runs at month-end) in src/services/scheduler/monthly-insights.ts

### Performance & Monitoring

- [ ] T130 Implement Prometheus metrics collection (response time, error rate, message throughput) in src/lib/metrics.ts
- [ ] T131 Implement health check endpoint in src/index.ts
- [ ] T132 Configure Grafana dashboards for system health monitoring
- [ ] T133 Implement performance monitoring middleware in src/bot/middleware/metrics.ts
- [ ] T134 Optimize database queries for <500ms target (95th percentile)
- [ ] T135 Implement Redis caching for daily totals, user roles, category lists in src/lib/redis.ts

### Security & Compliance

- [ ] T136 Implement input validation for all user inputs (type, format, length, range) in src/lib/validation.ts
- [ ] T137 Implement SQL injection prevention (Prisma parameterized queries) - verify all queries use Prisma
- [ ] T138 Implement sensitive data masking in logs (amounts, phone numbers) in src/lib/logger.ts
- [ ] T139 Implement account lockout after 5 failed attempts (15 minutes) in src/services/user/auth.ts
- [ ] T140 Implement 7-year data retention archival strategy in src/services/data/archival.ts

### Documentation & Deployment

- [ ] T141 Generate OpenAPI/Swagger documentation from contracts in docs/api/
- [ ] T142 Create CHANGELOG.md with version history
- [ ] T143 Create production Dockerfile in docker/Dockerfile
- [ ] T144 Create Azure deployment configuration (Container Apps or App Service) in infra/
- [ ] T145 Create database backup automation (daily at 01:00 WITA) in src/services/system/backup.ts
- [ ] T145a [Polish] Implement backup verification and restore testing in tests/integration/system/backup.test.ts
- [ ] T146 Create quickstart guide updates based on implementation in quickstart.md

### Testing

- [ ] T147 Write unit tests for transaction validation (70% coverage target) in tests/unit/services/transaction/
- [ ] T148 Write unit tests for report generation calculations in tests/unit/services/report/
- [ ] T149 Write integration tests for database operations in tests/integration/database/
- [ ] T150 Write integration tests for WhatsApp client interactions in tests/integration/wwebjs/
- [ ] T151 Write integration tests for Redis session management in tests/integration/redis/
- [ ] T152 Write E2E tests for User Story 1 (transaction input) in tests/e2e/user-stories/us1/
- [ ] T153 Write E2E tests for User Story 2 (automated reports) in tests/e2e/user-stories/us2/
- [ ] T154 Write E2E tests for User Story 3 (multi-step editing) in tests/e2e/user-stories/us3/
- [ ] T155 Write E2E tests for role-based access control in tests/e2e/roles/
- [ ] T156 Write performance tests for 50 concurrent users in tests/integration/load/

### Success Criteria Validation

- [ ] T157 [SC] Validate SC-001: Employee transaction input <5 min per transaction, <2% error rate in tests/e2e/success-criteria/sc001.test.ts
- [ ] T158 [SC] Validate SC-002: Automated daily reports 99% delivery rate over 30 days in tests/integration/success-criteria/sc002.test.ts
- [ ] T159 [SC] Validate SC-003: On-demand report generation <5 seconds in tests/integration/success-criteria/sc003.test.ts
- [ ] T160 [SC] Validate SC-004: 50 concurrent users <2s response time, zero data corruption in tests/integration/load/sc004.test.ts
- [ ] T161 [SC] Validate SC-005: Button interface 98% render success rate in tests/e2e/success-criteria/sc005.test.ts
- [ ] T162 [SC] Validate SC-006: Role-based access control 100% unauthorized access prevention in tests/e2e/roles/sc006.test.ts
- [ ] T163 [SC] Validate SC-007: Recommendation engine 95% anomaly detection within 2 hours in tests/integration/success-criteria/sc007.test.ts
- [ ] T164 [SC] Validate SC-008: System 99.5% uptime, session recovery <2 minutes in tests/integration/success-criteria/sc008.test.ts
- [ ] T165 [SC] Validate SC-009: 90% first-time transaction success without help in tests/e2e/success-criteria/sc009.test.ts
- [ ] T166 [SC] Validate SC-010: 100% transaction audit trail coverage in tests/integration/success-criteria/sc010.test.ts
- [ ] T167 [SC] Validate SC-011: 7-year data retention compliance in tests/integration/success-criteria/sc011.test.ts
- [ ] T168 [SC] Validate SC-012: Multi-language support 95% readability in tests/e2e/success-criteria/sc012.test.ts
- [ ] T169 [SC] Validate SC-013: Cost per transaction <Rp 100 in tests/integration/success-criteria/sc013.test.ts
- [ ] T170 [SC] Validate SC-014: 85% Boss user satisfaction (requires user survey, mark as manual validation)
- [ ] T171 [SC] Validate SC-015: Negative cashflow alerts >90% precision in tests/integration/success-criteria/sc015.test.ts
- [ ] T172 [SC] Validate SC-016: Database backup zero data loss in tests/integration/system/sc016.test.ts
- [ ] T173 [SC] Validate SC-017: Excel export <10 seconds for 30-day period in tests/integration/success-criteria/sc017.test.ts
- [ ] T174 [SC] Validate SC-018: Session recovery <1 minute on bot restart in tests/integration/success-criteria/sc018.test.ts
- [ ] T175 [SC] Validate SC-019: New user registration <5 minutes in tests/e2e/success-criteria/sc019.test.ts
- [ ] T176 [SC] Validate SC-020: Category addition without code deployment in tests/integration/success-criteria/sc020.test.ts

---

## Parallel Execution Examples

### User Story 1 (Phase 3)

**Parallel Group 1** (Models - no dependencies):

- T040, T041, T042 can run in parallel

**Parallel Group 2** (Services - depends on models):

- T043, T044, T045, T046 can run in parallel after Group 1

**Parallel Group 3** (UI Components - independent):

- T047, T048, T049 can run in parallel

**Parallel Group 4** (Handlers - depends on services and UI):

- T050, T051, T054, T055 can run in parallel after Groups 2-3

### User Story 2 (Phase 4)

**Parallel Group 1**:

- T058, T059, T060, T061 can run in parallel

**Parallel Group 2**:

- T062, T063, T064 can run in parallel after Group 1

### Phase 11 (Polish)

**Parallel Group 1** (Independent features):

- T118, T121, T126, T130, T136 can run in parallel

**Parallel Group 2** (Testing):

- T147, T148, T149, T150, T151 can run in parallel

---

## Task Summary by User Story

| User Story                       | Priority | Task Count | Tasks     |
| -------------------------------- | -------- | ---------- | --------- |
| Setup                            | -        | 18         | T001-T018 |
| Foundational                     | -        | 21         | T019-T039 |
| US1 - Employee Records Sales     | P1       | 18         | T040-T057 |
| US2 - Automated Daily Reports    | P1       | 11         | T058-T068 |
| US3 - Multi-Step Editing         | P1       | 7          | T069-T075 |
| US8 - Concurrent Usage           | P2       | 7          | T076-T082 |
| US6 - Real-Time Reports          | P2       | 6          | T083-T088 |
| US5 - Dev Management             | P2       | 10         | T089-T098 |
| US4 - Investor Analysis          | P2       | 8          | T099-T106 |
| US7 - Recommendations            | P3       | 11         | T107-T117 |
| Polish & Cross-Cutting           | -        | 40         | T118-T156 |
| Success Criteria Validation      | -        | 20         | T157-T176 |
| Low-Priority Features (Phase 2+) | -        | 21         | T177-T197 |

**Total**: 197 tasks (156 original + 41 new: 20 success criteria validation + 21 low-priority features)

---

## MVP Scope Recommendation

**Minimum Viable Product (MVP)**: Phases 1-5 (User Stories 1-3)

This delivers:

- ✅ Core transaction input (US1)
- ✅ Automated daily reports (US2)
- ✅ Multi-step editing capability (US3)
- ✅ All foundational infrastructure

**Estimated MVP Completion**: ~60-80 tasks (T001-T075 + critical polish tasks)

**Post-MVP**: User Stories 4-8 can be implemented incrementally based on business priorities.

---

**Last Updated**: 2025-12-09  
**Next Steps**: Begin Phase 1 (Setup) tasks, then proceed through phases in dependency order.
