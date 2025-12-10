# Data Model: WhatsApp Cashflow Bot

**Date**: 2025-12-09  
**Feature**: WhatsApp Cashflow Reporting Chatbot  
**Database**: PostgreSQL 15+ with TimescaleDB extension

## Entity Relationship Diagram

```
Users (1) ──< (N) Transactions
Users (1) ──< (N) UserSessions
Users (1) ──< (N) AuditLogs
Categories (1) ──< (N) Transactions
Transactions (N) ──< (1) Reports (via aggregation)
Recommendations (N) ──> (N) Users (via target_roles)
```

## Entities

### Users

**Purpose**: Store user accounts with role-based access control.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `phone_number` (VARCHAR(20), unique, indexed) - Format: +62XXXXXXXXXX or 0XXXXXXXXXX
- `name` (VARCHAR(255), nullable) - User's display name
- `role` (ENUM: 'dev', 'boss', 'employee', 'investor', not null, indexed)
- `created_at` (TIMESTAMP, default: now(), indexed)
- `last_active` (TIMESTAMP, nullable, indexed) - Last interaction timestamp
- `is_active` (BOOLEAN, default: true, indexed) - Account activation status
- `auth_token_hash` (VARCHAR(255), nullable) - Encrypted JWT token hash for session validation

**Validation Rules**:
- `phone_number` must match Indonesian format: `^(\+62|0)[0-9]{9,12}$`
- `role` must be one of: dev, boss, employee, investor
- `name` max length: 255 characters
- `phone_number` must be unique across all users

**Relationships**:
- One-to-many with Transactions (user_id foreign key)
- One-to-many with UserSessions (user_id foreign key)
- One-to-many with AuditLogs (user_id foreign key)

**Indexes**:
- Primary key: `id`
- Unique index: `phone_number`
- Index: `role` (for permission checks)
- Index: `is_active` (for filtering active users)
- Composite index: `(role, is_active)` (for role-based queries)

**State Transitions**:
- `is_active: true → false`: User deactivated (cannot send messages)
- `is_active: false → true`: User reactivated (can send messages)
- `role` changes: Immediate effect on next interaction (updated button menu)

### Transactions

**Purpose**: Store financial transactions (income and expenses) with approval workflow.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → Users.id, not null, indexed)
- `type` (ENUM: 'income', 'expense', not null, indexed)
- `category` (VARCHAR(100), not null) - Predefined category name
- `amount` (DECIMAL(15,2), not null, check: amount > 0) - Must be positive
- `description` (VARCHAR(100), nullable) - Optional transaction notes
- `timestamp` (TIMESTAMPTZ, default: now(), indexed) - UTC timestamp
- `approval_status` (ENUM: 'approved', 'pending', 'rejected', default: 'approved', indexed)
- `approval_by` (UUID, foreign key → Users.id, nullable) - Boss/Dev who approved/rejected
- `approved_at` (TIMESTAMPTZ, nullable) - Approval timestamp
- `version` (INTEGER, default: 1) - Optimistic locking for concurrent edits

**Validation Rules**:
- `amount` must be > 0 and < 500,000,000 (Rp 500M max, prevents unrealistic values)
- `category` must exist in Categories table (foreign key constraint)
- `type` must match category type (income category for income transaction)
- `description` max length: 100 characters
- `timestamp` stored in UTC, displayed/calculated in WITA (UTC+8)

**Relationships**:
- Many-to-one with Users (user_id foreign key)
- Many-to-one with Categories (category name reference)

**Indexes**:
- Primary key: `id`
- Index: `user_id` (for user transaction queries)
- Index: `timestamp` (for date range queries, TimescaleDB hypertable)
- Index: `type` (for income/expense filtering)
- Index: `approval_status` (for pending approval queries)
- Composite index: `(user_id, timestamp DESC)` (for user history queries)
- Composite index: `(timestamp, type)` (for daily report aggregation)
- Unique constraint: `(user_id, category, amount, timestamp)` within 1-minute window (duplicate prevention)

**State Transitions**:
- `approval_status: 'approved'` (default for Employee transactions)
- `approval_status: 'pending'` (suspicious transactions flagged for Boss review)
- `approval_status: 'rejected'` (Boss rejects flagged transaction)
- `approval_status: 'pending' → 'approved'` (Boss approves)
- `approval_status: 'pending' → 'rejected'` (Boss rejects)

**TimescaleDB Optimization**:
- Table converted to hypertable with `timestamp` as time column
- Automatic partitioning by month after 100K transactions
- Optimized for time-series queries (daily reports, trend analysis)

### Reports

**Purpose**: Store generated report metadata and summaries.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `report_date` (DATE, not null, indexed) - Date of report (WITA calendar day)
- `generated_at` (TIMESTAMPTZ, default: now(), indexed) - Generation timestamp
- `report_type` (ENUM: 'daily', 'weekly', 'monthly', 'custom', not null)
- `file_path` (VARCHAR(500), nullable) - Path to PDF file (if generated)
- `json_summary` (JSONB, nullable) - Structured report data (for API access)
- `total_income` (DECIMAL(15,2), not null, default: 0)
- `total_expense` (DECIMAL(15,2), not null, default: 0)
- `net_cashflow` (DECIMAL(15,2), not null) - Calculated: total_income - total_expense
- `delivery_status` (JSONB, nullable) - Per-user delivery status: `{user_id: 'success'|'failed'|'pending'}`

**Validation Rules**:
- `report_date` must be valid date
- `total_income` and `total_expense` must be >= 0
- `net_cashflow` = `total_income` - `total_expense` (calculated, not stored separately if redundant)

**Relationships**:
- Reports are aggregated from Transactions (no direct foreign key, calculated)

**Indexes**:
- Primary key: `id`
- Index: `report_date` (for date-based queries)
- Index: `generated_at` (for generation time queries)
- Index: `report_type` (for filtering by type)
- Composite index: `(report_date, report_type)` (for daily report lookups)
- GIN index: `json_summary` (for JSON queries)

**State Transitions**:
- Report generation: `generated_at` set, `json_summary` populated
- PDF generation: `file_path` set
- Delivery: `delivery_status` updated per user

### UserSessions

**Purpose**: Store user conversation state and temporary input data.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → Users.id, not null, indexed)
- `phone_number` (VARCHAR(20), not null, indexed) - Denormalized for quick lookup
- `state` (JSONB, not null) - Current menu state: `{menu: 'main'|'transaction'|'category'|'amount'|'confirm', step: number}`
- `context_data` (JSONB, nullable) - Temporary input data: `{category: string, amount: number, description: string}`
- `created_at` (TIMESTAMPTZ, default: now(), indexed)
- `expires_at` (TIMESTAMPTZ, not null, indexed) - TTL: created_at + 10 minutes

**Validation Rules**:
- `state.menu` must be valid menu identifier
- `context_data` must be valid JSON structure
- `expires_at` must be > `created_at`
- Session automatically cleared after 10 minutes of inactivity

**Relationships**:
- Many-to-one with Users (user_id foreign key)

**Indexes**:
- Primary key: `id`
- Index: `user_id` (for user session lookup)
- Index: `phone_number` (for quick phone-based lookup)
- Index: `expires_at` (for TTL cleanup queries)
- Composite index: `(user_id, expires_at)` (for active session queries)

**State Transitions**:
- Session created: On first user interaction
- State updated: On button press or message
- Session expired: After 10 minutes inactivity (TTL cleanup)
- Session cleared: On transaction completion or cancellation

**Redis Caching**:
- Primary storage: Redis (fast access)
- Backup storage: PostgreSQL (persistence across restarts)
- Sync: Every 5 minutes or on critical state changes

### Categories

**Purpose**: Store transaction categories (income and expense types).

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `name` (VARCHAR(100), unique, not null) - Category name (e.g., "Produk A", "Utilities")
- `type` (ENUM: 'income', 'expense', not null, indexed)
- `icon` (VARCHAR(10), nullable) - Emoji icon for display
- `is_active` (BOOLEAN, default: true, indexed) - Category activation status
- `created_by_user_id` (UUID, foreign key → Users.id, nullable) - Dev/Boss who created category
- `created_at` (TIMESTAMPTZ, default: now())

**Validation Rules**:
- `name` must be unique across all categories
- `name` max length: 100 characters
- `type` must be 'income' or 'expense'
- `icon` max length: 10 characters (emoji)

**Relationships**:
- One-to-many with Transactions (category name reference)
- Many-to-one with Users (created_by_user_id foreign key)

**Indexes**:
- Primary key: `id`
- Unique index: `name`
- Index: `type` (for filtering income/expense categories)
- Index: `is_active` (for filtering active categories)
- Composite index: `(type, is_active)` (for menu generation)

**State Transitions**:
- `is_active: true → false`: Category deactivated (hidden from menus, existing transactions preserved)
- `is_active: false → true`: Category reactivated (visible in menus)

**Caching**:
- Category list cached in Redis (1-day TTL)
- Cache invalidated on category create/update/delete

### AuditLogs

**Purpose**: Immutable audit trail of all system actions.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → Users.id, nullable, indexed) - Nullable for system actions
- `action` (VARCHAR(100), not null, indexed) - Action type: 'transaction_create', 'role_change', 'user_deactivate', etc.
- `details` (JSONB, nullable) - Action parameters: `{before: object, after: object, transaction_id: uuid, etc.}`
- `timestamp` (TIMESTAMPTZ, default: now(), indexed) - Action timestamp
- `ip_address` (VARCHAR(45), nullable) - Null for WhatsApp (no IP available)
- `affected_entity_id` (UUID, nullable, indexed) - ID of affected entity (transaction, user, etc.)
- `affected_entity_type` (VARCHAR(50), nullable) - Type: 'transaction', 'user', 'category', etc.

**Validation Rules**:
- `action` must be predefined action type
- `details` must be valid JSON structure
- `timestamp` cannot be modified (immutable)

**Relationships**:
- Many-to-one with Users (user_id foreign key, nullable)

**Indexes**:
- Primary key: `id`
- Index: `user_id` (for user action queries)
- Index: `action` (for action type filtering)
- Index: `timestamp` (for chronological queries)
- Index: `affected_entity_id` (for entity history queries)
- Composite index: `(user_id, timestamp DESC)` (for user audit log)
- Composite index: `(action, timestamp DESC)` (for action type queries)
- GIN index: `details` (for JSON queries)

**Retention**:
- 7-year retention (Indonesian financial compliance)
- Automatic archival after 1 year (move to cold storage)
- Immutable: No updates or deletes allowed

### Recommendations

**Purpose**: Store financial anomaly recommendations with confidence scores.

**Fields**:
- `id` (UUID, primary key, auto-generated)
- `generated_at` (TIMESTAMPTZ, default: now(), indexed) - Generation timestamp
- `type` (ENUM: 'expense_spike', 'revenue_decline', 'cashflow_warning', 'employee_inactivity', 'target_variance', not null, indexed)
- `content` (JSONB, not null) - Formatted message: `{title: string, message: string, data: object}`
- `priority` (ENUM: 'critical', 'high', 'medium', 'low', not null, indexed)
- `confidence_score` (INTEGER, not null, check: 0 <= confidence_score <= 100) - 0-100% confidence
- `target_roles` (TEXT[], not null) - Array of roles: ['boss'], ['boss', 'investor'], etc.
- `dismissed_by_users` (UUID[], default: '{}') - Array of user IDs who dismissed recommendation
- `acknowledged_at` (TIMESTAMPTZ, nullable) - First acknowledgment timestamp

**Validation Rules**:
- `confidence_score` must be 0-100
- `target_roles` must contain valid role values
- `type` must be predefined recommendation type
- `content` must be valid JSON structure

**Relationships**:
- Many-to-many with Users (via target_roles array and dismissed_by_users array)

**Indexes**:
- Primary key: `id`
- Index: `generated_at` (for chronological queries)
- Index: `type` (for type filtering)
- Index: `priority` (for priority filtering)
- Index: `confidence_score` (for confidence filtering)
- Composite index: `(priority, confidence_score)` (for alert gating: Critical + ≥80%)
- GIN index: `target_roles` (for array queries)
- GIN index: `content` (for JSON queries)

**State Transitions**:
- Generated: `generated_at` set, `dismissed_by_users` = []
- Dismissed: User ID added to `dismissed_by_users` array
- Acknowledged: `acknowledged_at` set on first acknowledgment

**Alert Gating Logic**:
- Proactive alert sent: `priority = 'critical'` AND `confidence_score >= 80`
- All others included in daily report (not sent as proactive alerts)

## Database Constraints

### Foreign Key Constraints
- `Transactions.user_id` → `Users.id` (CASCADE on user delete: archive transactions)
- `Transactions.approval_by` → `Users.id` (SET NULL on user delete)
- `UserSessions.user_id` → `Users.id` (CASCADE on user delete)
- `AuditLogs.user_id` → `Users.id` (SET NULL on user delete)
- `Categories.created_by_user_id` → `Users.id` (SET NULL on user delete)

### Check Constraints
- `Transactions.amount > 0` (positive amounts only)
- `Transactions.amount < 500000000` (max Rp 500M, prevents unrealistic values)
- `Recommendations.confidence_score >= 0 AND confidence_score <= 100`

### Unique Constraints
- `Users.phone_number` (unique)
- `Categories.name` (unique)
- `Transactions(user_id, category, amount, timestamp)` within 1-minute window (duplicate prevention via application logic)

## Data Validation Rules

### Phone Number Format
- Indonesian format: `^(\+62|0)[0-9]{9,12}$`
- Examples: `+6281234567890`, `081234567890`
- Stored normalized: `+62XXXXXXXXXX` (convert `0` prefix to `+62`)

### Amount Format
- Accept input: `500000`, `500.000`, `500,000`
- Parse to: `500000.00` (DECIMAL)
- Display: `Rp 500.000` (Indonesian format with thousand separators)

### Timestamp Handling
- Storage: UTC (TIMESTAMPTZ)
- Display: WITA (UTC+8)
- Cron jobs: WITA timezone
- Date range queries: Convert WITA to UTC for database queries

## Data Retention & Archival

### Retention Policy
- **Transactions**: 7 years (Indonesian financial compliance)
- **Reports**: 7 years
- **AuditLogs**: 7 years (immutable)
- **UserSessions**: 24 hours (TTL)
- **Recommendations**: 90 days (then archived)

### Archival Strategy
- Transactions >1 year: Move to TimescaleDB compressed chunks
- Reports >1 year: Move to Azure Blob Storage (cold storage)
- AuditLogs >1 year: Move to Azure Blob Storage (immutable archive)
- Automatic archival via scheduled job (monthly)

## Migration Strategy

### Initial Schema
- Prisma schema defines all entities
- Migrations version-controlled
- Rollback capability for all migrations

### TimescaleDB Setup
- Convert `Transactions` table to hypertable after initial migration
- Partition by month automatically after 100K transactions
- Enable compression for old partitions (>1 year)

### Index Optimization
- Create indexes after data load (faster initial migration)
- Monitor index usage and remove unused indexes
- Add composite indexes based on query patterns

