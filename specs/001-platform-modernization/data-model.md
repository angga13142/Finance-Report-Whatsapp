# Data Model: WhatsApp Cashflow Bot Platform Modernization

**Date**: 2025-01-27  
**Feature**: Platform Modernization  
**Branch**: `001-platform-modernization`

## Overview

This document defines the data model for platform modernization features, including new entities, enhanced existing models, and validation rules. All database changes will be implemented via Prisma migrations.

## New Entities

### SystemConfiguration

**Purpose**: Store runtime-editable system configuration key-value pairs with Zod schema validation.

**Schema**:

```prisma
model SystemConfiguration {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json     // Stored as JSON to support various types
  type      String   // "string", "number", "boolean", "object", "array"
  schema    String?  // Zod schema string for validation
  updatedBy String?  // userId who last updated
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@map("system_configurations")
}
```

**Fields**:

- `id`: Unique identifier (CUID)
- `key`: Configuration key (unique, e.g., "MAX_TRANSACTION_AMOUNT", "LOG_LEVEL")
- `value`: Configuration value stored as JSON (supports strings, numbers, booleans, objects, arrays)
- `type`: Type indicator for value interpretation
- `schema`: Optional Zod schema string for validation (stored as string, parsed at runtime)
- `updatedBy`: User ID who last modified the configuration (for audit trail)
- `updatedAt`: Timestamp of last update
- `createdAt`: Timestamp of creation

**Validation Rules**:

- `key`: Required, unique, alphanumeric with underscores/hyphens, max 100 chars
- `value`: Must be valid JSON, must match `type` if provided
- `schema`: If provided, must be valid Zod schema string
- `updatedBy`: Must reference existing User if provided

**State Transitions**: None (simple CRUD entity)

**Relationships**:

- `updatedBy` → `User.id` (optional foreign key)

**Indexes**:

- Primary key on `id`
- Unique index on `key`
- Index on `updatedAt` for querying recent changes

---

### MessageTemplate (Enhanced Concept)

**Purpose**: Store editable message templates with version history for rollback capability.

**Note**: This is a conceptual entity. Implementation may use SystemConfiguration with `key` prefix `template.` or a dedicated `MessageTemplate` model. For MVP, using SystemConfiguration is simpler.

**Storage Approach**: Store in `SystemConfiguration` table with keys like `template.transaction-confirmation`, `template.error-invalid-amount`, etc.

**Schema** (if implemented as separate model):

```prisma
model MessageTemplate {
  id          String   @id @default(cuid())
  name        String   @unique // e.g., "transaction-confirmation"
  description String?  // Human-readable description
  content     String   // Template string with placeholders (e.g., "{{amount}}")
  placeholders String[] // Array of required placeholder names
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  updatedBy   String?  // userId
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@map("message_templates")
}
```

**Fields** (if using SystemConfiguration):

- `key`: `template.<template-name>` (e.g., `template.transaction-confirmation`)
- `value`: JSON object `{ content: string, placeholders: string[], version: number, description?: string }`
- `type`: `"object"`
- `schema`: Zod schema for template validation

**Validation Rules**:

- Template content must contain all required placeholders
- Placeholder format: `{{variableName}}` (double curly braces)
- Template name: kebab-case, alphanumeric with hyphens
- Version must increment on updates

**State Transitions**:

- `draft` → `active` (when saved and validated)
- `active` → `archived` (when new version becomes active)

---

## Enhanced Existing Entities

### AuditLog (Enhanced)

**Purpose**: Track all user management and admin operations for security auditing and compliance.

**Existing Schema** (from Prisma schema):

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  actorUserId String?  // User who performed the action
  action      String   // Action type (e.g., "user.add", "user.update", "template.edit")
  targetEntity String  // Entity type (e.g., "User", "Template", "Config")
  targetId    String?  // ID of affected entity
  oldValue    Json?    // Previous value (for updates)
  newValue    Json?    // New value (for creates/updates)
  metadata    Json?    // Additional context (IP, user agent, etc.)

  @@map("audit_logs")
}
```

**Enhancements**:

- Add index on `action` for querying by action type
- Add index on `targetEntity` + `targetId` for entity-specific queries
- Add index on `timestamp` for time-range queries
- Ensure `metadata` field supports correlation IDs and request context

**New Action Types** (for this feature):

- `user.add`, `user.update`, `user.delete`, `user.activate`, `user.deactivate`
- `template.edit`, `template.preview`
- `config.set`, `config.view`
- `cache.clear`, `cache.inspect`
- `role.grant`, `role.revoke`
- `system.status`, `system.logs`, `system.metrics`

**Validation Rules**:

- `action`: Required, must match predefined action types
- `targetEntity`: Required, must match Prisma model names
- `actorUserId`: Optional (system actions may not have actor)
- `oldValue`/`newValue`: Must be valid JSON, sensitive data should be masked

---

### User (Enhanced)

**Purpose**: User accounts with role-based access control. Enhanced with dynamic management capabilities.

**Existing Schema** (from Prisma schema):

```prisma
model User {
  id        String   @id @default(cuid())
  phone     String   @unique
  name      String
  role      UserRole
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum UserRole {
  dev
  boss
  employee
  investor
}
```

**Enhancements**:

- No schema changes required (existing model supports all requirements)
- Validation: Phone number normalization via `normalizePhoneNumber()` before save
- Role validation: Must be one of `dev`, `boss`, `employee`, `investor`
- Active status: `isActive` flag controls access (checked in middleware)

**Validation Rules**:

- `phone`: Required, must be normalized to E.164 format (e.g., +628123456789)
- `name`: Required, min 1 char, max 100 chars
- `role`: Required, must be valid UserRole enum value
- `isActive`: Defaults to `true`, can be toggled via `/user activate` or `/user deactivate`

**State Transitions**:

- `active` → `inactive` (via `/user deactivate`)
- `inactive` → `active` (via `/user activate`)

**Relationships**:

- One-to-many with `AuditLog` (via `actorUserId` and `targetId`)

---

## Data Relationships

```
User
  ├── AuditLog (actorUserId) - User who performed action
  ├── AuditLog (targetId) - User who was affected
  └── SystemConfiguration (updatedBy) - User who updated config

SystemConfiguration
  ├── User (updatedBy) - Optional reference to updater
  └── AuditLog (targetId) - Audit trail for config changes

AuditLog
  ├── User (actorUserId) - Optional reference to actor
  └── User (targetId) - Optional reference to target (if targetEntity is "User")
```

## Validation Rules Summary

### Phone Number Validation

- **Input formats accepted**: `+628123456789`, `08123456789`, `628123456789`
- **Normalization**: Convert to E.164 format (`+628123456789`)
- **Validation**: Must match E.164 pattern, country code validation
- **Function**: `normalizePhoneNumber()` in `src/lib/validation.ts`

### Role Validation

- **Valid roles**: `dev`, `boss`, `employee`, `investor`
- **Validation**: Must match UserRole enum
- **RBAC enforcement**: Middleware in `src/bot/middleware/auth.ts`

### Template Validation

- **Placeholder format**: `{{variableName}}` (double curly braces, camelCase)
- **Required placeholders**: Must be present in template content
- **Syntax validation**: Check for unmatched braces, invalid characters
- **Zod schema**: Validate template structure before save

### Configuration Validation

- **Key format**: Alphanumeric with underscores/hyphens, max 100 chars
- **Value validation**: Must match `type` and `schema` if provided
- **Zod schema**: Parse and validate schema string at runtime
- **Type safety**: TypeScript types derived from Zod schemas

## Database Migrations Required

1. **Create SystemConfiguration model**:

   ```prisma
   model SystemConfiguration {
     id        String   @id @default(cuid())
     key       String   @unique
     value     Json
     type      String
     schema    String?
     updatedBy String?
     updatedAt DateTime @updatedAt
     createdAt DateTime @default(now())

     @@map("system_configurations")
   }
   ```

2. **Add indexes to AuditLog** (if not already present):
   - Index on `action`
   - Index on `targetEntity` + `targetId`
   - Index on `timestamp`

3. **No changes to User model** (existing schema sufficient)

## Data Access Patterns

### User Management

- **Create**: `User.create()` with normalized phone, validated role
- **Update**: `User.update()` with Prisma transaction for atomicity
- **List**: `User.findMany()` with optional role filter
- **Deactivate**: `User.update({ isActive: false })`

### Configuration Management

- **Get**: `SystemConfiguration.findUnique({ where: { key } })`
- **Set**: `SystemConfiguration.upsert()` with Zod validation
- **List**: `SystemConfiguration.findMany()` with optional key pattern filter

### Template Management

- **Get**: Query `SystemConfiguration` with `key` prefix `template.`
- **Set**: `SystemConfiguration.upsert()` with template validation
- **List**: `SystemConfiguration.findMany({ where: { key: { startsWith: "template." } } })`

### Audit Logging

- **Create**: `AuditLog.create()` after every user/admin operation
- **Query**: `AuditLog.findMany()` with filters (action, targetEntity, timestamp range)
- **Retention**: Consider archival strategy for old audit logs (out of scope for MVP)

## Performance Considerations

- **Indexes**: All foreign keys and frequently queried fields indexed
- **Caching**: SystemConfiguration and MessageTemplate cached in Redis (TTL: 5 minutes)
- **Query optimization**: Use Prisma `select` to fetch only required fields
- **Connection pooling**: Prisma connection pool configured (existing setup)

## Security Considerations

- **Sensitive data**: Phone numbers masked in logs (last 4 digits only)
- **RBAC**: All operations enforce role-based access control
- **Audit trail**: All user/admin operations logged to AuditLog
- **Input validation**: All inputs validated before database operations
- **SQL injection**: Prevented via Prisma parameterized queries
