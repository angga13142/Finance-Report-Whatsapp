# Data Model: WhatsApp Cashflow Bot Enhancements

**Date**: 2025-01-27  
**Feature**: 001-bot-enhancements  
**Purpose**: Define entities, attributes, relationships, and validation rules

## New Entities

### SystemConfig

**Purpose**: Store runtime configuration values that can be modified via developer commands, with environment variable override on startup.

**Attributes**:

- `id` (string, UUID, primary key): Unique identifier
- `key` (string, unique, indexed): Configuration key (e.g., "LOG_LEVEL", "CACHE_TTL")
- `value` (string): Configuration value (stored as string, validated against schema)
- `description` (string, optional): Human-readable description of the configuration
- `updatedAt` (DateTime): Timestamp of last update
- `updatedBy` (string, optional): User ID who last updated (for audit)

**Validation Rules**:

- `key`: Required, must match pattern `^[A-Z_][A-Z0-9_]*$` (uppercase with underscores)
- `value`: Required, validated against Zod schema from `src/config/env.ts` if schema exists
- `key` must be unique across all configuration entries

**Relationships**:

- None (standalone configuration storage)

**State Transitions**:

- Created: Initial configuration entry
- Updated: Value changed via `/config set` command
- Deleted: Configuration removed (rare, typically not deleted)

**Indexes**:

- Primary: `id`
- Unique: `key`
- Index: `updatedAt` (for audit queries)

**Prisma Schema**:

```prisma
model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  description String?
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@index([updatedAt])
  @@map("system_configs")
}
```

---

### MessageTemplate

**Purpose**: Store message templates that can be edited via developer commands without code changes.

**Attributes**:

- `id` (string, UUID, primary key): Unique identifier
- `name` (string, unique, indexed): Template name (e.g., "welcome", "transaction_confirmation")
- `content` (text): Template content with placeholders (e.g., `{{userName}}`, `{{amount}}`)
- `description` (string, optional): Human-readable description
- `updatedAt` (DateTime): Timestamp of last update
- `updatedBy` (string, optional): User ID who last updated (for audit)

**Validation Rules**:

- `name`: Required, must match pattern `^[a-z_][a-z0-9_]*$` (lowercase with underscores)
- `content`: Required, must be valid template syntax (placeholders, escape sequences)
- `name` must be unique across all templates

**Relationships**:

- None (standalone template storage)

**State Transitions**:

- Created: Initial template entry
- Updated: Content changed via `/template edit` command
- Deleted: Template removed (rare, typically not deleted)

**Indexes**:

- Primary: `id`
- Unique: `name`
- Index: `updatedAt` (for audit queries)

**Prisma Schema**:

```prisma
model MessageTemplate {
  id        String   @id @default(uuid())
  name      String   @unique
  content   String   @db.Text
  description String?
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@index([updatedAt])
  @@map("message_templates")
}
```

---

## Enhanced Entities

### User (Enhanced)

**Purpose**: User account management with CRUD operations via WhatsApp commands.

**Existing Attributes** (from current schema):

- `id`, `phoneNumber`, `name`, `role`, `isActive`, `createdAt`, `lastActive`, etc.

**New Methods** (in `UserModel`):

- `create(data)`: Enhanced with duplicate phone number validation
- `update(id, data)`: Enhanced with role validation and audit logging
- `delete(id)`: New method for user deletion (soft delete or hard delete based on requirements)
- `activate(id)`: New method to activate user account
- `deactivate(id)`: New method to deactivate user account
- `list(filters)`: New method to list users with optional role filtering

**Validation Rules** (enhanced):

- Phone number: Must be normalized and validated before create/update
- Role: Must be valid enum value (dev, boss, employee, investor)
- Duplicate prevention: Phone number must be unique
- Deletion: Prevent deletion of dev role users (or require special handling)

**Relationships** (unchanged):

- One-to-many with Transaction
- One-to-many with AuditLog (as actor)

---

### AuditLog (Enhanced)

**Purpose**: Record all administrative operations (user management, developer commands) with full context.

**Existing Attributes** (from current schema):

- `id`, `userId`, `action`, `entityType`, `entityId`, `changes`, `timestamp`, etc.

**Enhanced Usage**:

- Log user management operations: `action` = "user.create", "user.update", "user.delete", "user.activate", "user.deactivate"
- Log developer commands: `action` = "config.set", "template.edit", "role.grant", "cache.clear", "system.diagnostics"
- Include full context: `changes` field stores before/after state, command parameters, etc.

**New Action Types**:

- `user.create`, `user.update`, `user.delete`, `user.activate`, `user.deactivate`
- `config.set`, `config.view`
- `template.edit`, `template.preview`
- `role.grant`, `role.revoke`
- `cache.clear`
- `system.status`, `system.logs`

---

## Filesystem Entities (Not in Database)

### WhatsApp Session

**Purpose**: Store WhatsApp Web authentication session data in Docker volume.

**Storage Location**: `.wwebjs_auth/session-cashflow-bot/` (mounted to Docker volume)

**Structure** (managed by whatsapp-web.js LocalAuth):

- Session tokens
- Client configuration
- Authentication state

**Persistence Strategy**:

- Docker volume mount ensures data survives container restarts
- Volume permissions: UID 1000 (Node.js user) read/write access
- No database storage (filesystem-based by whatsapp-web.js design)

**Validation**:

- Session data integrity checked on container startup
- Corrupted sessions trigger re-authentication flow (QR code)

---

## Data Flow

### Configuration Loading (Startup)

1. Application starts
2. Load environment variables (from `.env` or container environment)
3. Load configuration from database (`SystemConfig` table)
4. Override database values with environment variables (env takes precedence)
5. Validate all configuration values against Zod schemas
6. Cache configuration in memory for fast access

### Configuration Update (Runtime)

1. Dev user executes `/config set LOG_LEVEL debug`
2. Validate value against Zod schema
3. Update `SystemConfig` table (database write)
4. Update in-memory cache
5. Apply configuration change (if applicable, e.g., logger level)
6. Log operation to `AuditLog`

### User Management Flow

1. Boss/Dev user executes `/user add +6281234567890 John employee`
2. Validate phone number format
3. Check for duplicate phone number
4. Validate role enum value
5. Create user in database (`User` table)
6. Log operation to `AuditLog` (action: "user.create")
7. Return success message to user

### Template Management Flow

1. Dev user executes `/template edit welcome [new content]`
2. Validate template syntax (placeholders, escape sequences)
3. Update `MessageTemplate` table (database write)
4. Invalidate template cache
5. Log operation to `AuditLog` (action: "template.edit")
6. Return confirmation to user

---

## Migration Strategy

**New Tables**:

1. `SystemConfig` table creation
2. `MessageTemplate` table creation

**Existing Tables**:

- No schema changes to `User` table (enhancements are code-level)
- No schema changes to `AuditLog` table (enhancements are usage-level)

**Migration Steps**:

1. Create Prisma migration for new tables
2. Seed initial configuration values (optional)
3. Seed initial message templates (optional)
4. Run migration in production with zero-downtime strategy

---

## Validation Summary

**Phone Numbers**:

- Format: Indonesian format (+62 or 0 prefix)
- Normalization: `normalizePhoneNumber()` from `src/lib/validation.ts`
- Validation: `validatePhoneNumber()` from `src/lib/validation.ts`
- Uniqueness: Enforced at database level (unique constraint)

**Roles**:

- Enum values: `dev`, `boss`, `employee`, `investor`
- Validation: Prisma enum validation
- RBAC: Enforced in middleware (`src/bot/middleware/auth.ts`)

**Configuration Keys**:

- Pattern: `^[A-Z_][A-Z0-9_]*$` (uppercase with underscores)
- Validation: Zod schema from `src/config/env.ts` (if exists)
- Uniqueness: Enforced at database level (unique constraint)

**Template Names**:

- Pattern: `^[a-z_][a-z0-9_]*$` (lowercase with underscores)
- Validation: Template syntax validation (placeholders, escape sequences)
- Uniqueness: Enforced at database level (unique constraint)
