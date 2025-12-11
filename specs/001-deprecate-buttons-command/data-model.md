# Data Model: Button Deprecation & Command-Based UI

**Feature**: Button Deprecation & Command-Based UI Replacement  
**Date**: December 17, 2025  
**Status**: Design Phase

## Overview

This feature introduces new entities for command processing, message formatting, and conversation context management. Existing data models (User, Transaction, Category, etc.) remain unchanged.

## Entities

### Command

**Purpose**: Represents a parsed user command with recognized intent and confidence scoring.

**Attributes**:

- `rawText` (string, required): Original user input text
- `recognizedIntent` (string, required): Canonical command name (e.g., "catat_penjualan", "lihat_laporan")
- `confidence` (number, 0-1, required): Confidence score from fuzzy matching
- `parameters` (object, optional): Extracted parameters (amount, category, date range, etc.)
- `synonyms` (string[], optional): Alternative commands that mapped to this intent
- `timestamp` (datetime, required): When command was received

**Validation Rules**:

- `confidence` must be between 0 and 1
- `recognizedIntent` must match canonical command names from constants
- `parameters` must match Zod schema for recognized intent

**State Transitions**:

- `received` → `parsed` → `validated` → `executed` | `failed` | `suggestion_shown`

**Relationships**:

- Belongs to User (many-to-one)
- Has one CommandResponse

---

### CommandResponse

**Purpose**: Formatted response message returned to user after command processing.

**Attributes**:

- `commandId` (string, required): Reference to original Command
- `formattedText` (string, required): Formatted message with Markdown and emoji (max 4096 chars)
- `emojiIndicators` (string[], optional): Emoji prefixes used (✅, ⚠️, 💰, 📊)
- `financialData` (object, optional): Embedded financial summaries (balance, totals, trends)
- `suggestions` (string[], optional): Follow-up command suggestions
- `isPaginated` (boolean, default: false): Whether response was split into multiple messages
- `pageNumber` (number, optional): Current page if paginated
- `totalPages` (number, optional): Total pages if paginated
- `timestamp` (datetime, required): When response was generated

**Validation Rules**:

- `formattedText` length ≤ 4096 characters (WhatsApp limit)
- If `isPaginated` is true, `pageNumber` and `totalPages` must be present
- `financialData` must match FinancialSummary schema when present

**Relationships**:

- Belongs to Command (one-to-one)

---

### ConversationContext

**Purpose**: Tracks user's current workflow state during multi-step interactions.

**Attributes**:

- `userId` (string, required): User identifier
- `workflowType` (string, optional): Current workflow ("transaction_entry", "report_view", null if idle)
- `currentStep` (number, optional): Step number in multi-step workflow (1-indexed)
- `enteredData` (object, optional): Data collected so far (amount, category, etc.)
- `pendingTransaction` (object, optional): Incomplete transaction data (amount, category, type)
- `lastActivity` (datetime, required): Last interaction timestamp (used for TTL expiration)
- `expiresAt` (datetime, required): Context expiration time (lastActivity + 30 minutes)

**Validation Rules**:

- `currentStep` must be ≥ 1 if `workflowType` is not null
- `expiresAt` must be > `lastActivity`
- `pendingTransaction` must include required fields for transaction type when present

**State Transitions**:

- `idle` → `active` (workflow started) → `pending_confirmation` → `completed` | `cancelled` | `expired`

**TTL/Expiration**:

- Context expires 30 minutes after `lastActivity` (Redis TTL: 1800 seconds)
- Expired contexts automatically cleaned up by Redis

**Relationships**:

- Belongs to User (many-to-one, one active context per user)

---

### FinancialSummaryCache

**Purpose**: Cached financial data summaries for fast retrieval.

**Attributes**:

- `cacheKey` (string, required): Redis key format: `financial:summary:{userId}:{dateRange}`
- `userId` (string, required): User identifier
- `dateRange` (string, required): Date range identifier ("today", "week", "month", "custom:YYYY-MM-DD:YYYY-MM-DD")
- `balance` (number, required): Current account balance (Rp, confirmed transactions only)
- `income` (number, required): Total income for period
- `expenses` (number, required): Total expenses for period
- `cashflow` (number, required): Net cashflow (income - expenses)
- `pendingCount` (number, optional): Count of pending approval transactions
- `trendData` (object, optional): Trend indicators (percentage changes, comparisons)
- `calculatedAt` (datetime, required): When cache entry was created
- `expiresAt` (datetime, required): Cache expiration (calculatedAt + 30-60 seconds TTL)

**Validation Rules**:

- `balance`, `income`, `expenses`, `cashflow` must be numeric (Decimal type for precision)
- `pendingCount` must be ≥ 0
- `expiresAt` must be > `calculatedAt`
- `dateRange` must match valid pattern

**Cache Invalidation**:

- Invalidate on transaction creation/update
- Invalidate on approval/rejection
- Manual invalidation via "refresh" command

**Relationships**:

- Belongs to User (many-to-one)

---

### CommandLog

**Purpose**: Audit log of all command interactions for analytics and improvement.

**Attributes**:

- `id` (string, required): Unique log entry identifier
- `userId` (string, required): User who issued command
- `rawCommand` (string, required): Original command text
- `recognizedIntent` (string, required): Recognized command intent
- `confidence` (number, 0-1, required): Recognition confidence score
- `executionResult` (string, required): "success" | "failure" | "suggestion_shown" | "error"
- `responseTime` (number, optional): Milliseconds to process command
- `usedFallback` (boolean, default: false): Whether button fallback was used
- `errorMessage` (string, optional): Error message if execution failed
- `timestamp` (datetime, required): When command was processed

**Validation Rules**:

- `confidence` must be between 0 and 1
- `executionResult` must be one of valid enum values
- `responseTime` must be ≥ 0 if present

**Retention**: 6+ months for compliance and analytics

**Relationships**:

- Belongs to User (many-to-one)

---

## Existing Entity Modifications

### User (No Changes)

- Existing User model remains unchanged
- Command processing uses existing `id`, `phoneNumber`, `role` attributes

### Transaction (No Changes)

- Existing Transaction model remains unchanged
- Commands create/read transactions using existing model

### Category (No Changes)

- Existing Category model remains unchanged
- Commands reference categories using existing model

---

## Data Flow

### Command Processing Flow

```
User Input (Text)
  ↓
Command Entity (parsed, validated)
  ↓
Command Handler (business logic)
  ↓
Financial Summary (cached if available)
  ↓
CommandResponse Entity (formatted)
  ↓
WhatsApp Message (sent to user)
```

### Conversation Context Flow

```
User Starts Workflow
  ↓
ConversationContext Created/Updated (Redis)
  ↓
Multi-step Data Collection
  ↓
Context Updated on Each Step (TTL refreshed)
  ↓
Workflow Complete → Context Cleared
  OR
30 minutes inactivity → Context Expired (Redis TTL)
```

### Financial Cache Flow

```
Command Requests Financial Data
  ↓
Check Redis Cache (key: financial:summary:{userId}:{range})
  ↓
Cache Hit? → Return cached data
Cache Miss? → Query Database → Calculate → Cache (TTL 30-60s) → Return
```

---

## Storage Strategy

### Redis (Ephemeral)

- `ConversationContext`: TTL 1800 seconds (30 minutes)
- `FinancialSummaryCache`: TTL 30-60 seconds
- Key patterns:
  - `conversation:{userId}`
  - `financial:summary:{userId}:{dateRange}`

### PostgreSQL (Persistent)

- `CommandLog`: Persistent audit log (6+ month retention)
- Existing tables unchanged

### Filesystem (WhatsApp Session)

- `.wwebjs_auth/`: WhatsApp session persistence (existing)
- No new filesystem storage required

---

## Validation Schemas (Zod)

### Command Parameter Schemas

```typescript
// Transaction entry command
const TransactionCommandSchema = z.object({
  amount: z.number().positive().max(999999999999),
  category: z.string().min(1).max(100),
  type: z.enum(["income", "expense"]),
  description: z.string().optional().max(500),
});

// Report request command
const ReportCommandSchema = z.object({
  dateRange: z.enum(["today", "week", "month", "custom"]),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// Balance check command
const BalanceCommandSchema = z.object({
  includePending: z.boolean().default(false),
});
```

---

## Indexes and Performance

### Redis Keys

- Conversation context: O(1) lookup by userId
- Financial cache: O(1) lookup by userId + dateRange

### PostgreSQL Indexes (CommandLog)

- `userId` + `timestamp` (composite index for user command history)
- `recognizedIntent` + `timestamp` (for analytics on command usage)
- `executionResult` + `timestamp` (for error rate tracking)

---

## Migration Notes

- No database migrations required (new entities stored in Redis + CommandLog table)
- CommandLog table can be added in future migration if analytics needed beyond Redis
- Existing code remains unchanged, new command handlers integrate alongside button handlers
