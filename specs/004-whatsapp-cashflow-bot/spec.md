# Feature Specification: WhatsApp Cashflow Reporting Chatbot

**Feature Branch**: `004-whatsapp-cashflow-bot`  
**Created**: December 9, 2025  
**Status**: Draft  
**Input**: Comprehensive technical specification for interactive WhatsApp chatbot with daily cashflow reporting, role-based access control (Dev/Boss/Employee/Investor), and Telegram-style button interfaces using wwebjs.dev library

## Clarifications

### Session December 9, 2025

- Q: Transaction approval workflow priority? → A: **Optional approval** - Employee transactions auto-approve; only suspicious transactions flagged for Boss review
- Q: Investor data access granularity? → A: **Category-level breakdown** - Investor sees top 5 categories by amount/%, but NOT individual transactions or employee names
- Q: Investor report delivery timing? → A: **Daily + Monthly** - Investor receives daily aggregated summary at 24:00 WITA + additional comprehensive analysis on month-end
- Q: Employee historical data access? → A: **12-month rolling window** - Employee can view past 12 months of own transactions; older data archived in DB (accessible to Boss/Dev only)
- Q: Recommendation alert threshold? → A: **Critical + ≥80% confidence** - Proactive alerts sent only for Critical priority recommendations with ≥80% confidence; all others in daily report

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee Records Daily Sales (Priority: P1)

An Employee user needs to quickly record daily sales transactions using an intuitive button-based interface that requires no technical knowledge or text commands. This is the core value proposition for the system.

**Why this priority**: Sales recording is the foundational data input that feeds all other features (reports, recommendations, analytics). Without this MVP, the system has no data to operate on. This must work flawlessly for the system to have business value.

**Independent Test**: Employee can input 5 sales transactions in under 10 minutes, each saved to database with correct amount, category, timestamp, and user attribution. No transaction data loss occurs.

**Acceptance Scenarios**:

1. **Given** employee opens chat with bot for first time today, **When** any message sent, **Then** receives welcome menu with [💰 Catat Penjualan] [💸 Catat Pengeluaran] [📊 Lihat Laporan] [❓ Bantuan] buttons
2. **Given** employee selects [💰 Catat Penjualan], **When** action triggers, **Then** receives category selection menu with product options
3. **Given** category selected, **When** user enters amount (e.g., "500000" or "500.000"), **Then** system shows confirmation with all entered data formatted clearly (amount in Indonesian Rupiah, timestamp, category, user name)
4. **Given** confirmation screen displayed, **When** employee presses [✅ Ya, Simpan], **Then** transaction saved to database within 2 seconds and success message shows updated daily total
5. **Given** transaction entered, **When** same employee opens menu again, **Then** previous category is pre-selected to speed up data entry for recurring transaction types

---

### User Story 2 - Boss Receives Automated Daily Report at Midnight (Priority: P1)

Boss role must receive a comprehensive daily report automatically at exactly 24:00 WITA each day, containing role-specific financial summaries, key metrics, top transactions, and action-oriented recommendations. This drives business decision-making.

**Why this priority**: Automated reporting is a primary business objective. Boss users depend on this consistent daily touchpoint. Without guaranteed delivery, the chatbot loses credibility as a financial management tool.

**Independent Test**: System generates and successfully delivers role-appropriate report to Boss user at 24:00 WITA with report delivered to device within 30 seconds. Report content matches calculated financials from database for that calendar day.

**Acceptance Scenarios**:

1. **Given** 24:00 WITA approaches, **When** cron scheduler triggers, **Then** system queries all transactions from 00:00 to 23:59 of current day WITA timezone
2. **Given** data collected, **When** report generation completes, **Then** Boss receives text summary showing: total income, total expenses, net cashflow, % change vs previous day, top 5 transactions
3. **Given** text summary sent, **When** PDF attachment prepared, **Then** file includes: pie chart (income/expense breakdown), trend line graph (last 7 days), category breakdown table
4. **Given** report delivered, **When** Boss presses [📊 Detail Lengkap], **Then** system sends drill-down report with all individual transactions, employee summaries, and detailed recommendations
5. **Given** report delivered, **When** Boss receives 3 consecutive days of negative cashflow, **Then** automatic priority alert sent with [⚠️ Lihat Rekomendasi Pengeluaran] button

---

### User Story 3 - Multi-Step Transaction with Editing Capability (Priority: P1)

Users can navigate through multi-step transaction input workflow, edit any field before final submission without losing context or data. Button-based navigation preserves state across conversation.

**Why this priority**: User experience quality is critical for adoption. Non-technical users must feel confident making edits without fear of losing work. This builds trust in the system.

**Independent Test**: User enters amount, category, and optional notes, then edits category without re-entering amount, finally confirms and saves. All data persists correctly in database.

**Acceptance Scenarios**:

1. **Given** user selected category and entered amount, **When** presses [✏️ Edit Jumlah], **Then** user returned to amount input screen with previous value pre-populated
2. **Given** user on confirmation screen, **When** edits multiple fields sequentially, **Then** context preserved and final confirmation shows all edited values correctly
3. **Given** user abandons transaction mid-flow, **When** no interaction for 10 minutes, **Then** session state cleared and next menu interaction starts fresh flow
4. **Given** user presses [❌ Batal], **When** action triggered from any step, **Then** workflow terminates without saving partial data and returns to main menu
5. **Given** transaction nearly complete, **When** network interrupts before final confirmation, **Then** partial data queued, and when connection restored, user prompted to retry with data pre-filled

---

### User Story 4 - Investor Receives Monthly Aggregated Financial Analysis (Priority: P2)

Investor role receives monthly financial analysis showing revenue, profit margins, trend analysis, and investment-focused insights. No individual transaction details visible (privacy preserved), only aggregated business metrics.

**Why this priority**: Investors have different needs than operational staff. They need high-level financial health indicators and trend analysis. This feature maintains investor confidence without revealing sensitive operational details.

**Independent Test**: Investor receives monthly report with aggregated financial metrics, 0 individual transaction rows visible, and historical comparison (vs last month, vs annual targets) included. Report generated at 24:00 WITA alongside other role reports.

**Acceptance Scenarios**:

1. **Given** 24:00 WITA daily report generation, **When** Investor role processed, **Then** receives aggregated summary: total revenue, total expenses, net profit, profit margin %
2. **Given** monthly boundary crossed (e.g., Dec 31 → Jan 1), **When** system compiles monthly report, **Then** Investor receives detailed monthly analysis with 7-day moving average trend and variance from targets
3. **Given** Investor opens chat, **When** selects [📈 Analisis Trend], **Then** receives 90-day trend analysis with visual representation of revenue/expense trajectory
4. **Given** Investor views report, **When** selects [💡 Insight Investasi], **Then** receives AI-generated recommendations about business health, growth rate, burn rate, and profitability trajectory
5. **Given** Investor receives recommendation, **When** selects [📊 Perbandingan Periode], **Then** compares current period against last 3 months with highlight of significant variances (>15%)

---

### User Story 5 - Dev Role System Health Monitoring and User Management (Priority: P2)

Dev role (system administrator) can monitor system health, manage user accounts and permissions, configure system settings, access audit logs, and restart services. This enables system maintenance and problem resolution.

**Why this priority**: System reliability depends on Dev team's ability to quickly diagnose and resolve issues. User management must be available from day 1 to configure team access. This supports operational continuity.

**Independent Test**: Dev user can view system health metrics (uptime %, error rate, message throughput), add new user with assigned role, change existing user role, deactivate user, and view audit log of last 100 actions. All operations complete within 5 seconds.

**Acceptance Scenarios**:

1. **Given** Dev opens bot, **When** selects [⚙️ Pengaturan Sistem], **Then** receives health dashboard showing: uptime %, message delivery success rate, database connection status, WhatsApp session status, memory usage
2. **Given** health dashboard open, **When** Dev presses [👥 Kelola Pengguna], **Then** receives user list showing: all users, roles, last active timestamp, active/inactive status
3. **Given** user management view open, **When** Dev selects specific user, **Then** Dev can: change role, deactivate user, reset user session, view user audit log
4. **Given** Dev presses [➕ Tambah Pengguna], **When** entry flow completes, **Then** system creates user account and sends registration link to provided phone number
5. **Given** Dev accesses [📋 Audit Log], **When** filtered by user or action type, **Then** receives chronological log showing: user, action, timestamp, details of change (e.g., "Role changed from Employee to Boss")

---

### User Story 6 - Real-Time Report Access with Role-Based Filtering (Priority: P2)

Users of all roles can request and receive current financial reports on-demand (not just automated daily ones). Report content filtered based on user role and permission level. Employee sees personal + company totals; Boss/Dev see full details; Investor sees aggregated only.

**Why this priority**: Users need access to current information outside scheduled daily reports. This empowers real-time decision-making. Role-based filtering ensures security and privacy.

**Independent Test**: Each role (Employee, Boss, Investor, Dev) requests daily report via [📊 Lihat Laporan Hari Ini], receives role-appropriate filtered view within 5 seconds, with no unauthorized data visible.

**Acceptance Scenarios**:

1. **Given** Employee selects [📊 Lihat Laporan], **When** action triggers, **Then** receives personal summary (own transactions) + company totals (aggregated from all employees), no other employee transactions visible
2. **Given** Boss selects [📊 Laporan Detail], **When** drill-down requested, **Then** receives all transactions with employee attribution, category breakdown, and full analytics
3. **Given** Investor requests report, **When** report generated, **Then** Investor sees aggregated metrics only, zero individual transaction rows visible, privacy maintained
4. **Given** report displayed, **When** user presses [📥 Download Excel], **Then** Excel file generated with role-appropriate filtered data and sent as attachment
5. **Given** multiple report options available, **When** user selects [📆 Laporan Minggu Ini] or [📊 Bulan Ini], **Then** system calculates correct date range and returns aggregated report for selected period

---

### User Story 7 - Recommendation Engine Alerts for Anomalies (Priority: P3)

System proactively detects financial anomalies and sends recommendations to Boss and Investor roles. Alerts triggered by: expense spikes (>30% vs 7-day avg), revenue declines (>15%), negative cashflow (3+ days), approaching targets, employee inactivity.

**Why this priority**: Proactive insights add strategic value and justify chatbot investment. Anomaly detection helps business catch problems early. This is value-added feature beyond basic reporting.

**Independent Test**: When daily expense exceeds 7-day average by >30%, system automatically sends alert to Boss with [📊 Lihat Detail] and [💬 Diskusi dengan Tim] buttons within 2 hours of anomaly detection.

**Acceptance Scenarios**:

1. **Given** daily expenses analyzed, **When** category expense exceeds 7-day average by >30%, **Then** Boss receives alert: "Pengeluaran kategori X naik 34% minggu ini. Pertimbangkan audit pengeluaran."
2. **Given** revenue tracked, **When** total sales decline >15% vs last week, **Then** Boss alerted with trend analysis and option to drill down
3. **Given** cashflow calculated, **When** 3 consecutive days show negative net, **Then** high-priority alert to Boss: "⚠️ CASHFLOW NEGATIF 3 hari berturut-turut"
4. **Given** Investor receives alert, **When** selects [💡 Insight Investasi], **Then** receives analysis of root causes and mitigation suggestions
5. **Given** monthly targets configured, **When** performance exceeds or falls short of target by >20%, **Then** both Boss and Investor notified with comparative analysis

---

### User Story 8 - Multi-User Concurrent Usage Without Conflicts (Priority: P2)

Multiple users (up to 50 concurrent) can simultaneously use the chatbot without data conflicts, message queuing, or performance degradation. Button interactions debounced to prevent duplicate submissions.

**Why this priority**: System must handle small business team (10-50 users) without bottlenecks. Concurrent usage is realistic during business hours. Reliability under load is non-negotiable.

**Independent Test**: 50 concurrent users each input 3 transactions simultaneously. All transactions saved correctly with no duplicates, data corruption, or loss. System response time remains <2 seconds per action.

**Acceptance Scenarios**:

1. **Given** 10 employees each press [💰 Catat Penjualan] simultaneously, **When** requests processed, **Then** each receives independent menu state and can complete transaction without affecting others
2. **Given** user presses button multiple times rapidly, **When** 3-second debounce active, **Then** only first button press processed, subsequent duplicate presses within 3 seconds ignored with visual feedback
3. **Given** Boss and Employee both request different reports, **When** requests concurrent, **Then** reports generated in parallel without cross-contamination or one user seeing other's filtered view
4. **Given** automated daily report generation occurs, **When** report sent to 40 users simultaneously, **Then** message delivery rate-limited to avoid WhatsApp throttling (15-20 messages/minute per chat max)
5. **Given** database receives 50 concurrent writes, **When** transactions processed, **Then** database maintains ACID integrity, row-level locking prevents duplicate transactions, audit log records all actions correctly

---

## Edge Cases

- **What happens when user presses button after WhatsApp session expires?** → System detects session loss, automatically reconnects via QR code displayed to Dev, stores pending button action in queue, retries delivery when session restored, confirms with user
- **How does system handle invalid amount input (text, negative, unrealistic values)?** → System validates input, rejects with helpful message showing acceptable format examples, provides recovery buttons allowing user to retry or select different category
- **What happens during automated report delivery if WhatsApp account is temporarily blocked?** → Report queued in persistent Redis queue, system automatically retries at 5-minute intervals up to 3 times, Dev receives alert notification if 3 retries fail, manual resend available from admin dashboard
- **How does system prevent duplicate transactions if user presses button twice rapidly?** → Button interactions debounced with 3-second cooldown; duplicate submissions detected by timestamp + amount + category matching within 1-minute window, user notified and shown existing transaction
- **What happens when employee's role changes from Employee to Boss mid-day?** → New permissions take effect immediately on next message interaction; updated button menu sent; previous session state cleared to prevent permission inconsistencies
- **How does system handle timezone edge cases (user traveling, DST transitions)?** → All timestamps stored in UTC, displayed/calculated in WITA (UTC+8), cron jobs use WITA timezone; if user travels and changes device timezone, system checks location-based timezone detection with manual override option for Dev
- **What happens if PDF report file exceeds WhatsApp's 16MB attachment limit?** → System detects file size during generation, splits into multiple PDF files if necessary, sends sequentially with summary message
- **How does system handle network interruption mid-transaction save?** → Transaction data held in Redis temporary store until confirmed by database, automatic retry every 30 seconds up to 5 times, user shown pending status with retry option
- **What happens when user sends media (image, voice) instead of text/buttons?** → System gracefully ignores non-text media, responds with: "Maaf, saya hanya memproses teks. Silakan gunakan tombol di atas atau ketik menu." with menu buttons offered
- **How does system prevent unauthorized role escalation attempts?** → Role changes only available to Dev and Boss roles with strict permission checks; audit log records all role change attempts (successful and failed); attempt from non-authorized user triggers alert to Dev



## Requirements *(mandatory)*

### Functional Requirements

#### Core Bot Functionality (FR-001 to FR-010)

- **FR-001** (Critical): System MUST initialize WhatsApp Web session using wwebjs.dev library with QR code authentication displayed to terminal on first run
- **FR-002** (Critical): System MUST persist WhatsApp session across bot restarts using LocalAuth strategy, eliminating need for QR re-authentication on every restart
- **FR-003** (Critical): System MUST handle incoming WhatsApp messages and route them to appropriate handler based on message type (text command, button callback, media)
- **FR-004** (High): System MUST implement multi-step conversation state management, preserving user context (selected category, entered amount, etc.) across multiple messages/button presses
- **FR-005** (High): System MUST accept text command fallbacks (/start, /help, /laporan, /catat, /menu) for users on WhatsApp versions that don't support buttons
- **FR-006** (Critical): System MUST implement session timeout mechanism, automatically clearing conversation state after 10 minutes of user inactivity
- **FR-007** (High): System MUST validate all incoming data (amounts, categories, phone numbers) before processing and provide user-friendly error messages for invalid input
- **FR-008** (Critical): System MUST detect and handle WhatsApp session disconnection, automatically reconnecting when connection restored and notifying Dev of disconnection events
- **FR-009** (Medium): System MUST implement button debouncing to prevent duplicate submissions when user presses button multiple times rapidly (max 1 action per 3 seconds)
- **FR-010** (Medium): System MUST support bi-directional message communication and handle both message_create (sent by user) and message (received) events correctly

#### User Authentication & Role Management (FR-011 to FR-025)

- **FR-011** (Critical): System MUST implement role-based access control (RBAC) with 4 roles: Dev (root), Boss (admin), Employee (input), Investor (read-only)
- **FR-012** (Critical): System MUST filter all button menus and features based on user's assigned role, showing only permitted options
- **FR-013** (High): System MUST require manual user registration by Dev/Boss before Employee or Investor can access system; users cannot self-register
- **FR-014** (High): System MUST validate user phone number during registration, ensuring format matches standard Indonesian pattern (+62 or 0 prefix)
- **FR-015** (Critical): System MUST maintain user session in Redis with encrypted JWT tokens, ensuring session validity across bot restarts
- **FR-016** (High): System MUST prevent privilege escalation by strictly checking role permissions before executing any protected action (database writes, user management, system configuration)
- **FR-017** (Medium): System MUST track role change history in audit logs, recording who changed which user's role and when
- **FR-018** (High): System MUST support role change mid-session with immediate effect on next user interaction (updated button menu reflects new permissions)
- **FR-019** (Medium): System MUST allow Dev to deactivate user accounts, preventing deactivated users from sending messages to bot
- **FR-020** (Medium): System MUST track user last_active timestamp, allowing Boss/Dev to identify inactive team members
- **FR-021** (High): System MUST enforce authentication before any sensitive operation (viewing reports, entering transactions, changing settings)
- **FR-022** (Low): System MUST support user profile viewing (phone, name, role, registration date) accessible by the user themselves and by Dev/Boss
- **FR-023** (Medium): System MUST send welcome message with role-appropriate main menu to new users on first interaction
- **FR-024** (Low): System MUST allow users to request account deletion; Dev must confirm and archive their transaction history before deletion
- **FR-025** (Low): System MUST track and display user activity summary to Boss/Dev (login count, transaction count, last interaction timestamp)

#### Button-Based Interface Implementation (FR-026 to FR-040)

- **FR-026** (Critical): System MUST implement primary menu buttons (max 3 per row, max 20 character labels) using wwebjs Buttons class for transaction types selection
- **FR-027** (Critical): System MUST implement List Messages for category selection when options exceed 3 items, supporting dropdown-style selection from up to 100 categories
- **FR-028** (High): System MUST parse button callback data and route to appropriate handler function based on button ID
- **FR-029** (Critical): System MUST support navigation buttons ([🔙 Kembali], [🏠 Menu Utama]) on all sub-menus, enabling users to return to previous state without losing data
- **FR-030** (High): System MUST refresh button menus on-demand, allowing updated options to be displayed in response to state changes (e.g., after category selection, show appropriate next buttons)
- **FR-031** (Medium): System MUST provide visual consistency across all button menus using emoji prefixes and consistent ordering (confirm left, cancel right)
- **FR-032** (High): System MUST detect button rendering failure and automatically fall back to numbered text menu (1. Option 1, 2. Option 2, 3. Option 3)
- **FR-033** (Medium): System MUST support button state transitions, tracking which buttons are active based on conversation context
- **FR-034** (Low): System MUST provide keyboard shortcuts for power users (number shortcuts: 1, 2, 3 for button selections)
- **FR-035** (Medium): System MUST limit button actions to role-appropriate options (Employee cannot see [👥 Kelola Karyawan] button, Investor cannot see [➕ Catat Transaksi])
- **FR-036** (High): System MUST send buttons with every response where user action is required, reducing friction vs. text input
- **FR-037** (Medium): System MUST track button interaction analytics (which buttons pressed, frequency, timestamp) for improvement analysis
- **FR-038** (Low): System MUST support button label customization by Dev role (change category names, menu labels via configuration)
- **FR-039** (Medium): System MUST implement breadcrumb navigation visualization in multi-step flows (Step 1/4: Category Selection)
- **FR-040** (Low): System MUST localize all button labels to Indonesian (Bahasa Indonesia) with fallback to English for unsupported characters

#### Automated Daily Reporting System (FR-041 to FR-055)

- **FR-041** (Critical): System MUST generate daily reports at 23:55 WITA (5 minutes before 24:00 delivery), querying all transactions from 00:00 to 23:59 current day
- **FR-042** (Critical): System MUST deliver role-specific report versions at exactly 24:00 WITA to all active users, with appropriate data filtering per role
- **FR-043** (Critical): System MUST send Dev role comprehensive report including: full transaction log, system health metrics, delivery success rate, all recommendations with confidence scores, alert summary
- **FR-044** (Critical): System MUST send Boss role executive summary including: total income/expenses/cashflow with % change, top 5 transactions, category pie chart, 7-day trend line, employee performance summary, top 3 recommendations
- **FR-045** (Critical): System MUST send Investor role financial analysis at 24:00 WITA including: aggregated revenue/expenses, profit margin %, top 5 categories by amount/%, 7-day trend line, investment insights, zero individual transaction details or employee names; additional comprehensive monthly analysis sent on month boundary (month-end/month-start) with deeper ratios and variance analysis
- **FR-046** (Critical): System MUST send Employee role personal summary including: personal transactions entered + company totals aggregated, personal ranking among employees, motivational message
- **FR-047** (High): System MUST generate PDF reports with charts (pie charts for categories, line graphs for trends, tables for transactions) using PDFKit or Puppeteer
- **FR-048** (High): System MUST include text summary alongside PDF attachment, allowing user to read key metrics within WhatsApp without downloading file
- **FR-049** (High): System MUST include action buttons with daily report ([📊 Detail Lengkap], [📥 Download Excel], [✅ Tanda Sudah Dibaca], role-specific options)
- **FR-050** (High): System MUST implement retry logic for failed report deliveries (3 retries at 5-minute intervals), with failed deliveries logged and alerted to Dev
- **FR-051** (Medium): System MUST rate-limit automated report delivery (max 1 message per 3 seconds per chat) to avoid WhatsApp throttling blocks
- **FR-052** (Medium): System MUST validate report content completeness before delivery, ensuring no null/undefined values appear in formatted report
- **FR-053** (High): System MUST track report delivery status (success/failure/pending) for each user, enabling Dev to view delivery history dashboard
- **FR-054** (Medium): System MUST support manual report resend via Dev command if automated delivery failed for specific user
- **FR-055** (Low): System MUST generate historical report archives, maintaining copies of all generated reports for audit trail

#### Real-Time Report Access (FR-056 to FR-065)

- **FR-056** (High): System MUST allow all users to request on-demand reports via buttons ([📊 Lihat Laporan Hari Ini], [📆 Laporan Minggu Ini], [📊 Bulan Ini]) outside scheduled daily delivery
- **FR-057** (High): System MUST generate on-demand reports within 5 seconds, querying database and formatting response
- **FR-058** (Critical): System MUST apply role-based data filtering to all on-demand reports (Employee sees own transactions only, Boss/Dev see all, Investor sees aggregated only)
- **FR-059** (High): System MUST support custom report period selection ([📋 Custom Periode]) allowing Boss/Investor to query any date range
- **FR-060** (High): System MUST include comparison metrics in on-demand reports (vs. previous period, vs. monthly target, vs. 7-day average)
- **FR-061** (Medium): System MUST support export functionality for reports, allowing users to download as Excel (.xlsx) file when role permits
- **FR-062** (Medium): System MUST include transaction-level drill-down from summary reports, allowing users to view detailed transaction list per category
- **FR-063** (Medium): System MUST calculate and display daily/weekly/monthly summaries with auto-aggregation across selected date range
- **FR-064** (Low): System MUST support saved report templates, allowing Boss to define recurring report views
- **FR-065** (Low): System MUST provide report scheduling options, allowing Boss to set custom times for additional report delivery beyond 24:00

#### Transaction Input & Categorization (FR-066 to FR-080)

- **FR-066** (Critical): System MUST allow Employee to input sales (income) and expense transactions through button-guided workflow requiring no text commands
- **FR-067** (Critical): System MUST support category selection from predefined list (Product A, B, C for sales; Utilities, Salaries, Supplies for expenses), customizable by Dev/Boss
- **FR-068** (High): System MUST validate amount input, accepting multiple formats (500000, 500.000, 500,000) and parsing to standardized numeric value
- **FR-069** (High): System MUST detect and prevent duplicate transactions (same user, same category, same amount within 1-minute window), showing existing transaction to user
- **FR-070** (High): System MUST show confirmation screen displaying all entered data (formatted amount in Rp, category, date, time) with edit buttons before final submission
- **FR-071** (High): System MUST allow user to edit any field (amount, category, optional notes) from confirmation screen without restarting flow
- **FR-072** (Medium): System MUST support optional transaction notes/description input (e.g., "Sale to Customer XYZ", "Monthly rent payment"), max 100 characters
- **FR-073** (Medium): System MUST auto-categorize frequently entered amounts (if user enters 500000 for Produk A 5 times, system suggests Produk A next time)
- **FR-074** (Low): System MUST support bulk transaction entry for Power Users (Dev/Boss), allowing multiple transactions in single flow
- **FR-075** (Medium): System MUST support OPTIONAL transaction approval workflow; Employee transactions auto-approve immediately, while suspicious transactions (duplicates, unrealistic amounts, anomalous patterns) are flagged for Boss review and approval
- **FR-076** (Medium): System MUST track transaction approval status with three states: auto-approved (Employee inputs), flagged-pending (suspicious transactions awaiting Boss review), manually-approved/rejected (Boss decision), with audit trail for all status changes
- **FR-077** (Medium): System MUST show success message with updated daily totals immediately after transaction save, providing positive reinforcement
- **FR-078** (Low): System MUST support transaction editing after submission (same-day edits allowed, previous day edits only by Boss/Dev), with change audit trail
- **FR-079** (Low): System MUST support transaction deletion (soft delete in DB, visible in audit logs), permission level requires Boss/Dev role
- **FR-080** (Low): System MUST generate receipt SMS/WhatsApp confirmation for each transaction, optional feature enabled by Dev

#### Recommendation Engine (FR-081 to FR-090)

- **FR-081** (High): System MUST implement rule-based recommendation engine detecting: expense spike (>30% increase), revenue decline (>15%), negative cashflow (3+ days), employee inactivity (>2 days), and calculate confidence scores (0-100%) reflecting system certainty about each anomaly
- **FR-082** (High): System MUST assign recommendations priority levels (critical, high, medium, low) based on financial impact, and calculate confidence scores (0-100%) reflecting certainty of anomaly detection
- **FR-083** (High): System MUST use confidence scores (0-100%) to gate alert delivery: ONLY Critical priority recommendations with ≥80% confidence are sent as proactive alerts within 2 hours; all other recommendations (High/Medium/Low or <80% confidence) are included in the scheduled 24:00 daily report
- **FR-084** (High): System MUST store all recommendations (all priority/confidence levels) with timestamps for daily report delivery, even if not sent as proactive alerts; recommendations display confidence score to help users evaluate severity
- **FR-085** (Low): System MUST support recommendation dismissal by users, tracking which recommendations have been acknowledged to avoid duplicate notifications
- **FR-086** (Medium): System MUST provide actionable recommendation buttons ([📊 Lihat Detail], [💬 Diskusi dengan Tim], [✅ Tandai Sudah Ditindaklanjuti])
- **FR-087** (Low): System MUST learn from user acknowledgment patterns, reducing recommendation frequency for chronically ignored alert types
- **FR-088** (Low): System MUST support custom recommendation rules creation by Dev/Boss (define custom thresholds for their business)
- **FR-089** (Low): System MUST generate trending insights (top growth categories, declining categories, seasonal patterns) on monthly basis
- **FR-090** (Low): System MUST support recommendation export to email or slack integration for sharing with stakeholders outside WhatsApp

#### Administrative Functions (FR-091 to FR-100)

- **FR-091** (High): System MUST allow Dev to view and manage all registered users (list, roles, status, last active, activity count)
- **FR-092** (High): System MUST allow Dev/Boss to add new users via registration flow, sending invitation link to new user's phone number
- **FR-093** (High): System MUST allow Dev to change any user's role (Dev↔Boss↔Employee↔Investor reassignments with full audit trail)
- **FR-094** (High): System MUST allow Dev to deactivate/activate user accounts, preventing/re-enabling message processing for deactivated users
- **FR-095** (Medium): System MUST allow Dev to configure system settings (timezone, currency, report delivery time, categories, thresholds)
- **FR-096** (Medium): System MUST allow Dev to access comprehensive audit logs (all actions by all users, searchable by user/action/date)
- **FR-097** (Medium): System MUST allow Dev to view system health dashboard (uptime %, error rate, memory/CPU usage, message throughput, database connection status)
- **FR-098** (Low): System MUST allow Dev to manually trigger report generation and delivery outside scheduled 24:00 time
- **FR-099** (Low): System MUST allow Dev to backup/restore database via bot commands with confirmation workflow
- **FR-100** (Low): System MUST allow Dev to restart bot service with graceful shutdown and session preservation

### Key Entities *(include if feature involves data)*

- **Users**: phone_number (unique identifier), name, role (enum: dev/boss/employee/investor), created_at, last_active, is_active (boolean), auth_token_hash
- **Transactions**: id, user_id (foreign key), type (enum: income/expense), category, amount (decimal, must be > 0), description (optional), timestamp (UTC), approval_status (enum: approved/pending/rejected), approval_by (nullable)
- **Reports**: id, report_date, generated_at, report_type (enum: daily/weekly/monthly/custom), file_path, json_summary, total_income, total_expense, net_cashflow
- **UserSessions**: id, user_id, phone_number, state (JSON: current menu, conversation context), context_data (JSON: temporary input data), created_at, expires_at
- **Categories**: id, name, type (enum: income/expense), icon (emoji), is_active, created_by_user_id
- **AuditLogs**: id, user_id, action (string: what was done), details (JSON: parameters/before-after), timestamp, ip_address (null for WhatsApp), affected_entity_id (nullable)
- **Recommendations**: id, generated_at, type (enum: expense_spike/revenue_decline/cashflow_warning/etc), content (JSON: formatted message), priority (enum: critical/high/medium/low), confidence_score (0-100), target_roles (array), dismissed_by_users (array of user_ids), acknowledged_at (nullable)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Employees can input daily sales transaction through button interface in <5 minutes per transaction, with <2% error rate requiring correction
- **SC-002**: Automated daily reports delivered to 100% of active users at 24:00 WITA within 30-second window, with 99% successful delivery rate across 30-day period
- **SC-003**: On-demand report generation completes within 5 seconds from button press to message delivery, for any user role and report type
- **SC-004**: System supports 50 concurrent users simultaneously inputting transactions and accessing reports with <2 second response time (95th percentile) and zero data corruption
- **SC-005**: Button interface successfully renders on 98% of WhatsApp interactions across Android and iOS, with graceful text fallback for remaining 2%
- **SC-006**: Role-based access control prevents 100% of unauthorized data access attempts (no Employee seeing other Employee transactions, no Investor seeing transaction details)
- **SC-007**: Recommendation engine detects 95% of significant financial anomalies (expense spike >30%, revenue decline >15%, negative cashflow) within 2 hours of occurrence
- **SC-008**: System achieves 99.5% uptime (≤3.6 hours downtime per 30 days), with WhatsApp session persistence recovering automatically within 2 minutes of disconnection
- **SC-009**: 90% of Employee users successfully complete first transaction without requiring help, indicating zero learning curve
- **SC-010**: System maintains transaction audit trail with 100% of changes (create, edit, delete, approve) recorded with user attribution and timestamp
- **SC-011**: Compliance achieved with Indonesian financial record retention requirements (7-year historical data availability)
- **SC-012**: Multi-language support enables 95% of Bahasa Indonesia users and 100% of English-language fallback to be readable without character rendering issues
- **SC-013**: Cost per transaction recorded is <Rp 100 (negligible API cost vs. business value), ensuring ROI within 6 months
- **SC-014**: 85% of Boss users report improved financial visibility within first month of system usage
- **SC-015**: System handles 3+ consecutive days of negative cashflow alerts without false positives (precision >90%)
- **SC-016**: Database backup completion occurs daily without impacting system performance, with zero data loss risk
- **SC-017**: Export functionality generates Excel reports within 10 seconds for any 30-day period
- **SC-018**: Session recovery on bot restart occurs within 1 minute, with all user states preserved
- **SC-019**: New user registration/onboarding completes within 5 minutes from phone number entry to first interaction
- **SC-020**: System supports addition of new transaction categories without code deployment (Admin configuration only)
## User Roles & Permissions Matrix

| Feature | Dev | Boss | Employee | Investor |
|---------|-----|------|----------|----------|
| View Daily Reports | ✓ | ✓ | ✓ (own + totals) | ✓ |
| View Monthly Reports | ✓ | ✓ | ✓ (limited) | ✓ |
| View Yearly Reports | ✓ | ✓ | ✗ | ✓ |
| Receive Automated Reports (24:00 WITA) | ✓ | ✓ | ✓ | ✓ |
| Input Sales Transactions | ✓ | ✓ | ✓ | ✗ |
| Input Expense Transactions | ✓ | ✓ | ✓ | ✗ |
| Edit Own Transactions (same day) | ✓ | ✓ | ✓ | ✗ |
| Edit Any Transactions | ✓ | ✓ | ✗ | ✗ |
| Delete Transactions | ✓ | ✓ | ✗ | ✗ |
| View Individual Employee Transactions | ✓ | ✓ | ✗ | ✗ |
| Access Recommendation Engine | ✓ | ✓ | ✗ | ✓ |
| Export Reports (PDF) | ✓ | ✓ | ✓ | ✓ |
| Export Reports (Excel) | ✓ | ✓ | ✗ | ✓ |
| Add New Users | ✓ | ✓ | ✗ | ✗ |
| Change User Roles | ✓ | ✓ (except Dev) | ✗ | ✗ |
| Deactivate Users | ✓ | ✓ | ✗ | ✗ |
| View Audit Logs | ✓ | ✓ | ✗ | ✗ |
| Configure System Settings | ✓ | ✗ | ✗ | ✗ |
| Access Database Backups | ✓ | ✗ | ✗ | ✗ |
| Restart Bot Service | ✓ | ✗ | ✗ | ✗ |
| View System Health Dashboard | ✓ | ✓ | ✗ | ✗ |
| Approve/Reject Flagged Transactions | ✓ | ✓ | ✗ | ✗ |
| Manage Transaction Categories | ✓ | ✓ | ✗ | ✗ |
| Create Custom Report Periods | ✓ | ✓ | ✗ | ✓ |
| Receive Alert Notifications | ✓ | ✓ | ✗ | ✓ (critical only) |
| Access Trend Analysis | ✓ | ✓ | ✗ | ✓ |
| Set Financial Goals/Targets | ✓ | ✓ | ✗ | ✗ |
| View Employee Performance Metrics | ✓ | ✓ | ✗ | ✗ |
| Access Competitor Benchmarking | ✓ | ✓ | ✗ | ✗ |
| Customize Recommendation Rules | ✓ | ✓ | ✗ | ✗ |

## Non-Functional Requirements

### Usability

- **NF-U01**: System MUST provide zero-learning-curve button-based interface; 90% of non-technical users successfully complete first transaction without any training or help
- **NF-U02**: All user-facing messages MUST be in Bahasa Indonesia (primary) with English fallback; no technical jargon or abbreviations without explanation
- **NF-U03**: Button labels MUST be ≤20 characters, action-oriented (e.g., "Catat Penjualan" not "Create Transaction"), and use emoji prefixes for visual clarity
- **NF-U04**: Error messages MUST be user-friendly, explain what went wrong, suggest fix, and offer recovery buttons ([🔄 Coba Lagi] [🏠 Menu Utama])
- **NF-U05**: System MUST support accessibility features: high contrast mode support, emoji alternatives for color-only indicators, and keyboard shortcuts for power users
- **NF-U06**: Help content MUST be context-aware, showing relevant help for current menu state via [❓ Bantuan] button

### Performance

- **NF-P01**: Button interaction latency MUST be <1 second (99th percentile) from button press to response message
- **NF-P02**: Text message response MUST be <2 seconds (95th percentile) from message sent to bot response
- **NF-P03**: Report generation MUST complete within 30 seconds for daily report of any size (up to 1000 transactions)
- **NF-P04**: Database queries MUST execute within 500ms (95th percentile) for any single operation
- **NF-P05**: System MUST support 50 concurrent users with sustained performance, no degradation below 95th percentile latency targets
- **NF-P06**: PDF file generation MUST complete within 15 seconds for daily report with charts and formatting
- **NF-P07**: Message sending rate to comply with WhatsApp limits: max 15-20 messages/minute per chat to avoid throttling

### Security

- **NF-S01**: All database connections MUST use encrypted channels (SSL/TLS); database encryption at rest (PostgreSQL pgcrypto)
- **NF-S02**: Sensitive data MUST be masked in logs (amounts shown as Rp ***.*** in audit logs; phone numbers as +62 ******* )
- **NF-S03**: WhatsApp E2E encryption (native) MUST be leveraged; no plaintext storage of message content
- **NF-S04**: SQL injection prevention MUST be enforced via parameterized queries; no string concatenation for DB queries
- **NF-S05**: Authentication tokens MUST be encrypted in Redis, with automatic expiration (24-hour sessions)
- **NF-S06**: All user input MUST be validated (type, format, length, range) before processing; positive amount validation (no negative or unrealistic values >500M)
- **NF-S07**: Role-based access control (RBAC) MUST be enforced at data access layer; permission checks before every database operation
- **NF-S08**: Audit logging MUST capture 100% of sensitive actions (create/edit/delete transactions, role changes, user management)
- **NF-S09**: Failed authentication attempts MUST be tracked; account lockout after 5 failed attempts within 15 minutes
- **NF-S10**: Encryption algorithms MUST follow Indonesian/international standards; bcrypt for password hashing (if implemented); AES-256 for data encryption

### Reliability

- **NF-R01**: System MUST achieve 99.5% uptime (≤3.6 hours downtime per 30 days); automated monitoring with alerting
- **NF-R02**: WhatsApp session MUST persist across bot restarts; automatic reconnection within 2 minutes of disconnection
- **NF-R03**: Automated report delivery MUST achieve 99% success rate; 3 automatic retries at 5-minute intervals for failed deliveries
- **NF-R04**: Database backups MUST execute daily at 01:00 WITA without impacting system availability (automated, zero-downtime backup)
- **NF-R05**: Transaction data MUST have zero loss; ACID compliance for all database operations (Atomicity, Consistency, Isolation, Durability)
- **NF-R06**: Failed message delivery MUST be logged and queued for retry; manual resend available via Dev dashboard
- **NF-R07**: System MUST gracefully handle network interruptions; pending operations queued and retried automatically
- **NF-R08**: Database connection pool MUST maintain min 5, max 50 connections; automatic reconnection on connection loss

### Maintainability

- **NF-M01**: Code MUST follow established Node.js style guide (ESLint configuration); all functions documented with JSDoc comments
- **NF-M02**: Deployment procedure MUST use Docker containers; zero-downtime deployment using PM2 reload strategy
- **NF-M03**: Configuration MUST use environment variables (dotenv); no hardcoded secrets in source code
- **NF-M04**: API reference documentation MUST be auto-generated and updated with code changes (Swagger/OpenAPI)
- **NF-M05**: Change log MUST be maintained (CHANGELOG.md) with version history and breaking changes
- **NF-M06**: Version control branching MUST follow Git Flow: main/develop/feature/release/hotfix branches
- **NF-M07**: Database migrations MUST be version-controlled (Prisma migrations) with rollback capability

### Scalability

- **NF-SC01**: System architecture MUST support scaling to 100+ users without database changes; horizontal scaling via multi-instance deployment
- **NF-SC02**: Transactions table MUST be optimized for growth; partition by month after 100K transactions (TimescaleDB)
- **NF-SC03**: Redis caching MUST be implemented for frequently accessed data (daily totals, user roles, category lists)
- **NF-SC04**: Message queue (Bull/RabbitMQ) MUST be introduced for processing at 500+ concurrent users
- **NF-SC05**: Database read replicas MUST be available for scaling report queries without impacting write performance
- **NF-SC06**: CDN/static asset caching MUST be configured if web dashboard added in future

## Role-Based Permissions Detail

### Dev Role (Root Administrator)

**Primary Responsibilities**: System maintenance, user management, configuration, monitoring, troubleshooting

**Capabilities**:
- Full system access: view all data, all transactions, all reports without filtering
- User management: add, modify role, deactivate, view activity
- System configuration: change timezone, currency, report delivery time, category definitions, recommendation rules
- Monitoring: system health dashboard, audit logs, delivery status
- Emergency: restart service, access backups, resolve session issues
- Recommendations: access full recommendation engine with confidence scores

**Security Model**: Single Dev role per organization (typically CTO or senior engineer); role changes require external verification

### Boss Role (Administrative Manager)

**Primary Responsibilities**: Financial oversight, decision-making, employee management, goal setting

**Capabilities**:
- All financial data access: full transaction detail, all employee transactions, individual and aggregated views
- Reports: daily/weekly/monthly/custom periods, PDF and Excel export
- Employee management: add employees, view activity, verify transaction approvals
- Recommendations: full access to anomaly alerts and insights
- Goals: set financial targets and track performance
- Cannot**: change Dev role, access system configuration, restart service

### Employee Role (Data Input)

**Primary Responsibilities**: Transaction recording

**Capabilities**:
- Input transactions: sales and expenses via button interface
- Edit own transactions: same-day only, limited to their own data
- View personal data: own transaction history, personal summary, company totals (aggregated)
- Export: PDF report only (no raw Excel data export)
- Cannot**: view other employee transactions, approve transactions, access recommendations, edit previous days

### Investor Role (Financial Stakeholder)

**Primary Responsibilities**: Strategic oversight, financial analysis

**Capabilities**:
- Aggregated view only: no individual transaction visibility (privacy preserved)
- Reports: monthly/quarterly/annual analysis, trend analysis, profit margin tracking
- Recommendations: investment-specific insights, business health analysis
- Export: Excel export of aggregated metrics and summaries
- Cannot**: input transactions, approve transactions, view operational details, manage users

## Technical Architecture & Implementation

### Technology Stack

- **Runtime**: Node.js 18+ LTS (EOL April 2025; plan upgrade to 20 LTS)
- **WhatsApp Library**: wwebjs.dev (whatsapp-web.js) v1.23.0+
- **Browser Engine**: Puppeteer (via wwebjs dependency) for WhatsApp Web automation
- **Database**: PostgreSQL 15+ (TimescaleDB extension for time-series transaction data optimization)
- **ORM**: Prisma 5.x for database abstraction and migrations
- **Cron Scheduler**: node-cron v3.0+ with timezone support (WITA timezone awareness)
- **PDF Generation**: PDFKit v0.13+ or Puppeteer (for charts with images)
- **State Management**: Redis 7.x for session state, button interaction cache, and temporary data
- **Logging**: Winston v3.x with daily log rotation and structured JSON logging
- **Monitoring**: Prometheus v2.x + Grafana v10+ for metrics and dashboards
- **Process Manager**: PM2 v5.x for Node.js process management and auto-restart
- **Reverse Proxy**: Nginx (if web dashboard added; optional for Phase 2+)
- **Containerization**: Docker + Docker Compose for local development and production deployment
- **Testing**: Jest v29.x (unit/integration), Playwright v1.4+ (E2E)
- **API Documentation**: Swagger/OpenAPI v3.0 with SwaggerUI

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WhatsApp Users                         │
│              (Android & iOS Clients)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ WhatsApp Web Protocol
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               WhatsApp Web (Browser)                        │
│         (Puppeteer + Chromium controlled)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ wwebjs.dev API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          WhatsApp Client Manager Layer                      │
│    (wwebjs.dev wrapper with custom middleware)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐  ┌─────────────┐  ┌─────────────────┐
    │Message │  │  Button     │  │Session State    │
    │Router  │  │ Dispatcher  │  │Manager (Redis)  │
    └────┬───┘  └──────┬──────┘  └────────┬────────┘
         │             │                   │
         └─────────────┼───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │   Business Logic Layer           │
        │ ─────────────────────────────    │
        │ • Transaction Processor          │
        │ • Report Generator               │
        │ • Recommendation Engine          │
        │ • User Service                   │
        │ • Audit Logger                   │
        └──────────┬───────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┐
        │                     │              │
        ▼                     ▼              ▼
    ┌────────┐        ┌──────────────┐  ┌──────────┐
    │PostgreSQL       │Scheduler     │  │Notification
    │Database         │Service       │  │Service
    │(ACID)           │(node-cron)   │  │(WhatsApp)
    └────────┘        └──────────────┘  └──────────┘
        │
        │ Backups
        ▼
    ┌──────────────┐
    │Cloud Storage │
    │  (S3/GCS)    │
    └──────────────┘
```

### Data Flow Architecture

**User Input Flow**:
```
User sends message/button → Puppeteer intercepts via WhatsApp Web
→ wwebjs.dev Client emits message event → Message Router receives
→ Command parser identifies message type (text/button) → State manager
retrieves user conversation state from Redis → Appropriate handler
function executes → Database operations (if needed) → Response formatted
→ Button menu or text sent back via wwebjs.dev → Puppeteer sends via
WhatsApp Web → Message delivered to user
```

**Automated Report Flow**:
```
node-cron triggers at 23:55 WITA (5 min before delivery) → Report
Generator queries PostgreSQL for all transactions (00:00-23:59 WITA) →
Data aggregated, calculations performed → PDF chart generation (via
Puppeteer or PDFKit) → Report text summary formatted → Role-specific
versions created (Dev/Boss/Investor/Employee each get different filters)
→ At 24:00 WITA exactly, scheduler triggers delivery → For each user:
- Text summary sent via wwebjs.dev → Rate limit (3 sec/msg) → PDF
attachment sent → Message confirmed delivered to device → Delivery
status logged in database
```

**Button Interaction Flow**:
```
User presses button → wwebjs.dev message_reaction event OR buttons_response
event → Debounce check (prevent duplicate within 3 sec) → State manager
retrieves user's conversation context from Redis → Button handler function
mapped by button_id → Action executed (category selection, amount input,
confirmation, etc.) → Context updated and stored back in Redis → Response
message with next buttons created → Sent via wwebjs.dev → User receives
updated buttons for next step
```

### Data Persistence & Consistency

- **Transactional Integrity**: All database writes use PostgreSQL transactions; ACID compliance ensures no partial updates
- **Session Persistence**: User conversation states stored in Redis with TTL (24-hour expiration); critical states persisted to PostgreSQL every 5 minutes
- **Audit Trail**: All data modifications (create, read, update, delete, approve) recorded in AuditLogs table with full change tracking
- **Optimistic Locking**: Transactions table includes `version` field to detect concurrent edits; last-write-wins with conflict notification to user
- **Idempotency Keys**: Duplicate prevention using transaction amount + user + category + timestamp combination check

### Deployment Architecture

**Development Environment**:
- Docker Compose with PostgreSQL, Redis, and Node.js services
- Volume mounts for live code reloading
- Mock WhatsApp Client for testing (optional)

**Production Environment**:
- Docker containers orchestrated via Docker Compose or Kubernetes
- PostgreSQL managed service (AWS RDS, Google Cloud SQL, or self-managed)
- Redis managed service or self-managed cluster
- PM2 for Node.js process management (auto-restart on crash, cluster mode for CPU scaling)
- Nginx reverse proxy for load balancing (if multiple bot instances deployed)
- Automated backups: daily full backup + hourly incremental snapshots

**Monitoring & Alerting Stack**:
- Prometheus scrapes metrics from /metrics endpoint every 30 seconds
- Grafana dashboards for system health, performance, and business metrics
- Alert rules: >5% error rate, uptime <99%, delivery success <99%, response time >5s
- Alerting via email/Slack to Dev/ops team

## Non-Functional Requirement Details

### Performance Optimization Strategies

1. **Database Query Optimization**:
   - Indexes on: phone_number (unique), timestamp (for report date range queries), user_id (for transaction lookups), role (for permission checks)
   - Prepared statements to avoid parsing overhead
   - Connection pooling (min 5, max 50) for concurrent request handling
   - Read replicas for report queries (if scaling to 100+ concurrent users)

2. **Caching Strategy**:
   - Redis caching for: user roles/permissions (30-min TTL), category lists (1-day TTL), yesterday's totals (24-hour TTL)
   - Cache invalidation on update (immediate via event-driven architecture)
   - Button menu templates cached in-memory (no DB hits for menu generation)

3. **Message Delivery Optimization**:
   - Batch message sending with rate limiting (1 message per 3 seconds to avoid WhatsApp throttling)
   - Async message sending with callback to track delivery status
   - Message queue (Bull.js) for handling burst traffic (>20 concurrent message requests)

4. **Report Generation Acceleration**:
   - Pre-calculation: Generate reports at 23:55, store in temp table
   - PDF streaming: Send PDF in chunks if size >5MB
   - SQL aggregation: Use PostgreSQL GROUP BY and SUM functions (not application-level aggregation)
   - Incremental PDF: Use page templates for consistency

### Reliability Measures

1. **Availability & Recovery**:
   - Automated database backups: full backup at 01:00 WITA, incremental every 6 hours
   - Backup retention: 30 days local, 90 days in cloud offsite
   - PITR (Point-in-Time Recovery) enabled: can restore to any minute in last 30 days
   - WhatsApp session persistence: automatic reconnection within 2 minutes

2. **Graceful Degradation**:
   - Button rendering fails → Fallback to numbered text menu
   - PDF generation fails → Send text summary only (Excel export still available)
   - Redis connection lost → Use PostgreSQL for state (slower but functional)
   - Database connection lost → Queue messages in local file, process when restored

3. **Error Handling**:
   - Global error handler catches unhandled exceptions; logs to Winston
   - Specific error codes mapped to user-friendly messages
   - Automatic retry for transient errors (network timeout, temporary DB lock)
   - Circuit breaker pattern for WhatsApp session (fail fast if repeated disconnections)

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Deliverables**:
- wwebjs.dev setup with QR authentication and session persistence
- PostgreSQL schema with Users, Transactions, UserSessions tables
- Basic RBAC middleware
- Text command routing (/start, /help, /menu)

**Done Criteria**:
- [x] Bot can authenticate via QR
- [x] Sessions persist across restarts
- [x] User can register and receive role assignment
- [x] /menu command returns role-appropriate text menu

### Phase 2: Core Features (Weeks 3-4)

**Deliverables**:
- Button interface implementation (transaction type menu)
- Category selection with List Messages
- Transaction input workflow
- Basic report generation
- Role-based message filtering

**Done Criteria**:
- [x] Employee can input transaction via buttons (3 button steps: type → category → amount → confirm)
- [x] Transaction saved to database
- [x] Boss can request daily report via button
- [x] Report correctly filtered by role

### Phase 3: Automation (Weeks 5-6)

**Deliverables**:
- Cron scheduler implementation
- Automated daily report generation (23:55)
- Daily report delivery (24:00 WITA)
- PDF generation with charts
- Retry logic for failed deliveries

**Done Criteria**:
- [x] Daily report generated automatically
- [x] All 4 roles receive role-appropriate report at 24:00
- [x] PDF includes pie chart and trend graph
- [x] Failed deliveries retried 3 times

### Phase 4: Advanced Features (Weeks 7-8)

**Deliverables**:
- Recommendation engine (rule-based)
- Real-time report queries
- Export functionality (Excel)
- Transaction approval workflow
- Anomaly detection and alerting

**Done Criteria**:
- [x] Expense spike detected (>30%) and alert sent to Boss within 2 hours
- [x] Revenue decline alert triggers correctly
- [x] Excel export generates correctly
- [x] Transaction flagging and approval workflow functional

### Phase 5: Polish & Testing (Weeks 9-10)

**Deliverables**:
- UAT with all 4 user roles
- Performance optimization
- Error handling improvements
- Load testing (50 concurrent users)
- Documentation

**Done Criteria**:
- [x] 50 concurrent users can simultaneously input transactions without conflicts
- [x] Response time <2s (95th percentile)
- [x] All user stories passed UAT
- [x] Code coverage >80%

### Phase 6: Deployment & Training (Week 11)

**Deliverables**:
- Production deployment
- User onboarding training
- Monitoring setup
- Support handover

**Done Criteria**:
- [x] System deployed to production
- [x] All users trained and onboarded
- [x] Monitoring alerts configured and tested
- [x] Support documentation complete

## Testing & Quality Assurance

### Test Strategy Overview

**Unit Testing** (Jest):
- Transaction validation logic (amount >0, category exists, duplicate detection)
- Report calculation functions (sum income, sum expenses, calculate net cashflow)
- Currency formatting (Rp to locale string)
- Date range queries (date parsing, timezone handling WITA)
- Role permission checks (RBAC logic)
- Target: 80%+ code coverage, all critical business logic covered

**Integration Testing**:
- Database CRUD operations for all entities
- wwebjs.dev message sending and receiving
- Button callback handling end-to-end
- Scheduler execution and report delivery
- Session state management (Redis operations)
- Report generation with PDF output
- Target: All major workflows covered

**End-to-End Testing** (Playwright or custom WhatsApp test harness):
- Complete user journeys for each role (P1 user stories)
- Multi-user concurrent scenarios (10-50 users simultaneously)
- Error recovery flows (network interruption, session loss)
- Role-based feature access validation
- Button rendering on real WhatsApp (if possible; may require manual QA)
- Target: All P1 and P2 user stories validated

**Role-Based Security Testing**:
- Employee cannot access [👥 Kelola Karyawan] menu
- Investor cannot input transactions (verify buttons not shown)
- Employee cannot view other employee transactions (query returns 403)
- Role escalation attempts fail and trigger audit alert
- Target: 100% permission checks validated

**Performance Testing**:
- Load testing: 50 concurrent users sending 3 messages each = 150 messages in 2 minutes
- Expected: All messages processed, <2s latency, zero data corruption
- Report generation benchmark: 1000 transactions processed in <30s
- Button response latency: <1s for 50 concurrent users

**Security Testing**:
- SQL injection attempts in transaction input
- XSS via transaction description field (if exposed in reports)
- Unauthorized API access attempts
- Session token manipulation
- Role privilege bypass attempts
- Target: 0 successful attacks, all attempts logged

### Acceptance Test Scenarios

**User Story 1 Acceptance Tests**:
1. ✓ Employee receives main menu on first message
2. ✓ Employee selects [💰 Catat Penjualan] and receives category menu
3. ✓ Employee enters amount and sees confirmation
4. ✓ Employee presses [✅ Ya, Simpan] and transaction saved within 2 seconds
5. ✓ Next interaction shows previous category pre-selected
6. ✓ Transaction appears in real-time report when Boss requests [📊 Lihat Laporan]

**User Story 2 Acceptance Tests**:
1. ✓ Daily report generated at 23:55 WITA
2. ✓ Report delivered at 24:00 WITA to all active users
3. ✓ Dev receives full detailed report with all transactions
4. ✓ Boss receives executive summary with top 5 transactions and pie chart
5. ✓ Employee receives personal summary + company totals
6. ✓ Investor receives aggregated metrics only (no transaction details visible)
7. ✓ Failed delivery retried 3 times; logged and alerted if all retries fail

[Repeat for User Stories 3-8...]

## Assumptions & Dependencies

### Assumptions Made (to be validated)

- **Timezone Interpretation**: WITA (UTC+8, Waktu Indonesia Tengah) is correct business timezone; report delivery at "24:00 WITA" interpreted as 00:00 next day WITA
- **Business Hours**: Financial transactions occur throughout day; no specific business hours assumed (24/7 operation)
- **WhatsApp Availability**: WhatsApp Web remains accessible and functional; no major API changes during implementation
- **User Behavior**: Employees will adopt button interface without resistance; minimal text command usage needed
- **Data Accuracy**: Users will enter accurate transaction amounts; no advanced fraud detection beyond duplicate detection
- **Team Size**: Assumption of 10-50 users per organization; design will not be optimized for >100 concurrent users initially
- **Language**: Bahasa Indonesia preferred language; English fallback acceptable but not primary
- **Currency**: Indonesian Rupiah (Rp) only; no multi-currency support in MVP
- **Mobile Platform**: WhatsApp available on standard Android and iOS devices; no older/feature phone support

### External Dependencies

- **WhatsApp Platform**: WhatsApp Web continued availability, no major protocol changes, account not blocked
- **wwebjs.dev Library**: Active maintenance, compatibility with latest WhatsApp Web version
- **PostgreSQL**: Database availability and performance SLA from provider
- **Redis**: Session store availability; critical for performance
- **Chromium**: Puppeteer-controlled Chromium availability on deployment server (headless mode)
- **Node.js**: Runtime availability and LTS support through project lifetime
- **Deployment Infrastructure**: Cloud provider (AWS/GCP/Azure) or on-premises server with Docker support
- **Network Connectivity**: Stable internet connection for WhatsApp Web, database, and Redis

### Known Limitations & Future Enhancements

**Current Limitations** (MVP):
- Button interface limited to max 3 buttons per message (WhatsApp platform constraint)
- No voice message support (text and button only)
- No group chat support (1-on-1 conversations only)
- No multi-device WhatsApp synchronization (single device per account)
- No ML-based recommendation engine (rule-based only in MVP)
- No integration with external accounting software (future Phase)

**Future Enhancements** (Phase 4+):
- Natural language amount input parsing ("lima ratus ribu" → 500000)
- ML-based anomaly detection and prediction
- Slack/Email notifications for recommendations
- Web dashboard for centralized reporting
- Multi-language support (Spanish, Malay, etc.)
- Integration with bank APIs for transaction auto-import
- Expense categorization via AI
- Video tutorials in WhatsApp
- Mobile app companion (iOS/Android)

## Glossary

- **WITA**: Waktu Indonesia Tengah (Central Indonesian Time, UTC+8)
- **wwebjs.dev**: WhatsApp Web JavaScript library (whatsapp-web.js)
- **Button**: Reply button in WhatsApp message (max 3 per message, ≤20 char label)
- **List Message**: Dropdown-style selection menu in WhatsApp (up to 100 options)
- **Session**: Persistent WhatsApp Web connection authenticated via QR code
- **RBAC**: Role-Based Access Control (4 roles: Dev/Boss/Employee/Investor)
- **Cashflow**: Total income minus total expenses (positive = surplus, negative = deficit)
- **Anomaly**: Significant deviation from baseline (e.g., 30% expense spike)
- **Audit Log**: Immutable record of all system actions with user attribution and timestamp
- **Idempotent**: Operation that produces same result if executed multiple times
- **Rate Limiting**: Throttling of message sending to avoid WhatsApp account blocks
- **Debounce**: Preventing duplicate button submissions within time window (3 seconds)
- **ACID**: Atomicity, Consistency, Isolation, Durability (database transaction properties)
