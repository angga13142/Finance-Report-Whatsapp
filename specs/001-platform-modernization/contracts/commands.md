# WhatsApp Command Interface Contracts

# Platform Modernization Feature

**Version**: 1.0.0  
**Date**: 2025-01-27  
**Format**: WhatsApp Text Commands

## Overview

This document defines the command interface contracts for user management and admin operations. All commands are sent via WhatsApp messages and responses are returned as WhatsApp text messages.

## Command Format

- **Prefix**: `/` (forward slash)
- **Structure**: `/command <action> [arguments]`
- **Case**: Commands are case-insensitive
- **Whitespace**: Multiple spaces are normalized to single space
- **Quotes**: Use double quotes for arguments containing spaces

## User Management Commands

### `/user add`

**Description**: Add a new user to the system with specified role.

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user add <phone> <name> <role>`

**Parameters**:

- `phone` (required): Phone number in format `+628123456789`, `08123456789`, or `628123456789`
- `name` (required): User's full name (quoted if contains spaces, e.g., `"John Doe"`)
- `role` (required): One of: `dev`, `boss`, `employee`, `investor`

**Examples**:

```
/user add +628123456789 "John Doe" employee
/user add 08123456789 Alice boss
/user add 628123456789 Bob investor
```

**Success Response**:

```
✅ User added successfully
Phone: +628123456789
Name: John Doe
Role: employee
Status: active
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ Invalid phone number format. Use: +628123456789, 08123456789, or 628123456789`
- `❌ Invalid role. Valid roles: dev, boss, employee, investor`
- `❌ User already exists with phone number: +628123456789`
- `❌ Validation error: name must be between 1 and 100 characters`

**Side Effects**:

- Creates new User record in database
- Logs action to AuditLog (action: `user.add`)
- Invalidates Redis cache for user list

---

### `/user list`

**Description**: List all users, optionally filtered by role.

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user list [role]`

**Parameters**:

- `role` (optional): Filter by role (`dev`, `boss`, `employee`, `investor`). If omitted, lists all users.

**Examples**:

```
/user list
/user list employee
/user list boss
```

**Success Response**:

```
👥 Users (employee role):
1. +62812****6789 - John Doe (active, created: 2025-01-15)
2. +62813****7890 - Alice Smith (active, created: 2025-01-20)
3. +62814****8901 - Bob Johnson (inactive, created: 2025-01-10)

Total: 3 users
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ Invalid role. Valid roles: dev, boss, employee, investor`

**Side Effects**: None (read-only operation)

---

### `/user update`

**Description**: Update user information (name, role, or other fields).

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user update <phone> <field> <value>`

**Parameters**:

- `phone` (required): Phone number of user to update
- `field` (required): Field to update (`name`, `role`)
- `value` (required): New value for the field

**Examples**:

```
/user update +628123456789 name "John Smith"
/user update +628123456789 role boss
```

**Success Response**:

```
✅ User updated successfully
Phone: +628123456789
Field: name
Old value: John Doe
New value: John Smith
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ User not found: +628123456789`
- `❌ Invalid field. Valid fields: name, role`
- `❌ Invalid role. Valid roles: dev, boss, employee, investor`
- `❌ Validation error: name must be between 1 and 100 characters`

**Side Effects**:

- Updates User record in database (atomic transaction)
- Logs action to AuditLog (action: `user.update`, includes oldValue and newValue)
- Invalidates Redis cache for affected user

---

### `/user delete`

**Description**: Delete a user from the system (soft delete by deactivating).

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user delete <phone>`

**Parameters**:

- `phone` (required): Phone number of user to delete

**Examples**:

```
/user delete +628123456789
```

**Success Response**:

```
✅ User deleted successfully
Phone: +628123456789
Name: John Doe
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ User not found: +628123456789`

**Side Effects**:

- Sets `isActive = false` on User record (soft delete)
- Logs action to AuditLog (action: `user.delete`)
- Invalidates Redis cache for affected user

---

### `/user activate`

**Description**: Activate a previously deactivated user.

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user activate <phone>`

**Parameters**:

- `phone` (required): Phone number of user to activate

**Examples**:

```
/user activate +628123456789
```

**Success Response**:

```
✅ User activated successfully
Phone: +628123456789
Name: John Doe
Status: active
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ User not found: +628123456789`
- `❌ User is already active`

**Side Effects**:

- Sets `isActive = true` on User record
- Logs action to AuditLog (action: `user.activate`)
- Invalidates Redis cache for affected user

---

### `/user deactivate`

**Description**: Deactivate a user (revokes access immediately).

**Authorization**: `dev` or `boss` role required

**Syntax**: `/user deactivate <phone>`

**Parameters**:

- `phone` (required): Phone number of user to deactivate

**Examples**:

```
/user deactivate +628123456789
```

**Success Response**:

```
✅ User deactivated successfully
Phone: +628123456789
Name: John Doe
Status: inactive
```

**Error Responses**:

- `❌ Permission denied: user management requires boss or dev role`
- `❌ User not found: +628123456789`
- `❌ User is already inactive`

**Side Effects**:

- Sets `isActive = false` on User record
- Logs action to AuditLog (action: `user.deactivate`)
- Invalidates Redis cache for affected user
- Active sessions denied on next command (checked in middleware)

---

## Admin Commands (Dev Role Only)

### `/template list`

**Description**: List all available message templates.

**Authorization**: `dev` role required

**Syntax**: `/template list`

**Examples**:

```
/template list
```

**Success Response**:

```
📝 Available Templates:
1. transaction-confirmation - Transaction confirmation message
2. error-invalid-amount - Invalid amount error message
3. monthly-report - Monthly financial report format
4. help-menu - Help command menu

Total: 4 templates
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`

**Side Effects**: None (read-only operation)

---

### `/template edit`

**Description**: Edit a message template (validates syntax and saves immediately).

**Authorization**: `dev` role required

**Syntax**: `/template edit <name>`

**Parameters**:

- `name` (required): Template name (e.g., `transaction-confirmation`)

**Interactive Flow**:

1. User sends `/template edit transaction-confirmation`
2. Bot responds with current template and prompts for new content
3. User sends new template text
4. Bot validates and saves

**Examples**:

```
/template edit transaction-confirmation
[Bot shows current template]
[User sends new template text]
```

**Success Response**:

```
✅ Template updated successfully
Name: transaction-confirmation
Version: 2
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Template not found: transaction-confirmation`
- `❌ Validation error: Missing required placeholder {{amount}}`
- `❌ Validation error: Invalid template syntax`

**Side Effects**:

- Updates SystemConfiguration with key `template.<name>`
- Logs action to AuditLog (action: `template.edit`)
- Invalidates Redis cache for template
- New template used immediately for subsequent messages

---

### `/template preview`

**Description**: Preview a template with sample data.

**Authorization**: `dev` role required

**Syntax**: `/template preview <name>`

**Parameters**:

- `name` (required): Template name

**Examples**:

```
/template preview transaction-confirmation
```

**Success Response**:

```
📝 Template Preview: transaction-confirmation

Sample Output:
━━━━━━━━━━━━━━━━━━━━
✅ Transaction Confirmed
━━━━━━━━━━━━━━━━━━━━

Amount: Rp 1.500.000
Category: Food & Dining
Date: 2025-01-27
Status: Approved
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Template not found: transaction-confirmation`

**Side Effects**: None (read-only operation)

---

### `/system status`

**Description**: Display system health status (PostgreSQL, Redis, WhatsApp client).

**Authorization**: `dev` role required

**Syntax**: `/system status`

**Examples**:

```
/system status
```

**Success Response**:

```
🏥 System Status

PostgreSQL: ✅ Connected (45ms)
Redis: ✅ Connected (12ms)
WhatsApp: ✅ Connected (ready)
Uptime: 2d 5h 30m
Memory: 245MB / 512MB
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ System error: Unable to connect to PostgreSQL`

**Side Effects**: None (read-only operation)

---

### `/system logs`

**Description**: Retrieve recent application logs.

**Authorization**: `dev` role required

**Syntax**: `/system logs [lines]`

**Parameters**:

- `lines` (optional): Number of lines to retrieve (default: 50, max: 500)

**Examples**:

```
/system logs
/system logs 100
```

**Success Response**:

```
📋 Recent Logs (last 50 lines):

[2025-01-27T10:30:15Z] INFO: message_received correlationId=abc123
[2025-01-27T10:30:16Z] INFO: message_processed correlationId=abc123
[2025-01-27T10:30:17Z] INFO: message_sent correlationId=abc123
...
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Invalid line count. Maximum: 500`

**Side Effects**: None (read-only operation)

---

### `/config view`

**Description**: View a configuration value.

**Authorization**: `dev` role required

**Syntax**: `/config view <key>`

**Parameters**:

- `key` (required): Configuration key (e.g., `MAX_TRANSACTION_AMOUNT`)

**Examples**:

```
/config view MAX_TRANSACTION_AMOUNT
/config view LOG_LEVEL
```

**Success Response**:

```
⚙️ Configuration: MAX_TRANSACTION_AMOUNT
Value: 10000000
Type: number
Last updated: 2025-01-25 by user +628123456789
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Configuration not found: MAX_TRANSACTION_AMOUNT`

**Side Effects**: None (read-only operation)

---

### `/config set`

**Description**: Set a configuration value (validates against Zod schema).

**Authorization**: `dev` role required

**Syntax**: `/config set <key> <value>`

**Parameters**:

- `key` (required): Configuration key
- `value` (required): New value (must match type and schema)

**Examples**:

```
/config set MAX_TRANSACTION_AMOUNT 10000000
/config set LOG_LEVEL DEBUG
```

**Success Response**:

```
✅ Configuration updated successfully
Key: MAX_TRANSACTION_AMOUNT
Old value: 5000000
New value: 10000000
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Validation error: Value must be a positive number`
- `❌ Validation error: Invalid LOG_LEVEL. Valid values: ERROR, WARN, INFO, DEBUG`

**Side Effects**:

- Updates SystemConfiguration in database
- Logs action to AuditLog (action: `config.set`)
- Invalidates Redis cache for configuration
- Configuration applied immediately (no restart required)

---

### `/cache clear`

**Description**: Clear Redis cache entries matching a pattern.

**Authorization**: `dev` role required

**Syntax**: `/cache clear [pattern]`

**Parameters**:

- `pattern` (optional): Redis key pattern with wildcards (e.g., `transaction-*`). If omitted, clears all cache.

**Examples**:

```
/cache clear transaction-*
/cache clear user-*
/cache clear
```

**Success Response**:

```
✅ Cache cleared successfully
Pattern: transaction-*
Keys cleared: 42
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Invalid pattern: syntax error`

**Side Effects**:

- Deletes matching Redis keys
- Logs action to AuditLog (action: `cache.clear`)

---

### `/cache inspect`

**Description**: Inspect a cached value with TTL information.

**Authorization**: `dev` role required

**Syntax**: `/cache inspect <key>`

**Parameters**:

- `key` (required): Redis cache key

**Examples**:

```
/cache inspect transaction-12345
/cache inspect user-+628123456789
```

**Success Response**:

```
🔍 Cache Inspection: transaction-12345

Value: {"amount": 1500000, "category": "Food"}
TTL: 300 seconds (5 minutes)
Type: string
Size: 45 bytes
```

**Error Responses**:

- `❌ Permission denied: admin commands require dev role`
- `❌ Cache key not found: transaction-12345`

**Side Effects**: None (read-only operation)

---

## Error Response Format

All error responses follow this format:

```
❌ [Error Type]: [Error Message]
[Optional: Additional context or suggestions]
```

**Error Types**:

- `Permission denied`: Authorization failure
- `Validation error`: Input validation failure
- `Not found`: Resource not found
- `System error`: Internal system error

## Common Validation Rules

### Phone Number

- Accepts: `+628123456789`, `08123456789`, `628123456789`
- Normalized to: E.164 format (`+628123456789`)
- Validation: E.164 pattern, country code check

### Role

- Valid values: `dev`, `boss`, `employee`, `investor`
- Case-insensitive
- Must match UserRole enum

### Template Name

- Format: kebab-case (lowercase, hyphens)
- Valid characters: `a-z`, `0-9`, `-`
- Max length: 50 characters

### Configuration Key

- Format: UPPER_SNAKE_CASE
- Valid characters: `A-Z`, `0-9`, `_`
- Max length: 100 characters

## Rate Limiting

All commands are subject to rate limiting (existing middleware):

- User commands: 10 requests per minute per user
- Admin commands: 20 requests per minute per user (dev role)

## Audit Logging

All commands (except read-only operations like `/user list`, `/template list`, `/system status`) are logged to AuditLog with:

- `actorUserId`: User who executed command
- `action`: Command action (e.g., `user.add`, `template.edit`)
- `targetEntity`: Affected entity type
- `targetId`: Affected entity ID
- `oldValue`/`newValue`: For update operations
- `metadata`: Additional context (correlation ID, timestamp)
