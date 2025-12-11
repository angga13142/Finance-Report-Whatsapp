# WhatsApp Command Contracts

**Date**: 2025-01-27  
**Feature**: 001-bot-enhancements  
**Purpose**: Define command syntax, parameters, responses, and error handling

## Command Format

All commands follow the pattern: `/command [subcommand] [arguments]`

Commands are case-insensitive. Arguments are space-separated. Multi-word arguments can be quoted.

---

## User Management Commands

### `/user add <phone> <name> <role>`

**Purpose**: Create a new user account.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `phone` (required): Phone number in format `+6281234567890` or `081234567890`
- `name` (required): User's display name (1-100 characters)
- `role` (required): User role (`dev`, `boss`, `employee`, `investor`)

**Success Response**:

```
✅ User created successfully

Phone: +62 ****7890
Name: John Doe
Role: employee
Status: Active
```

**Error Responses**:

- Invalid phone format: `❌ Invalid phone number format. Use +6281234567890 or 081234567890`
- Duplicate phone: `❌ User with phone number +62 ****7890 already exists`
- Invalid role: `❌ Invalid role. Must be: dev, boss, employee, investor`
- Permission denied: `❌ Permission denied. Only boss and dev roles can manage users`

**Validation**:

- Phone number normalized and validated
- Role must be valid enum value
- Duplicate phone number prevented

---

### `/user list [role]`

**Purpose**: List all users or filter by role.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `role` (optional): Filter by role (`dev`, `boss`, `employee`, `investor`)

**Success Response** (filtered):

```
👥 Users (employee role)

1. +62 ****7890 - John Doe (Active)
2. +62 ****8901 - Jane Smith (Active)
3. +62 ****9012 - Bob Johnson (Inactive)

Total: 3 users
```

**Success Response** (all users):

```
👥 All Users

1. +62 ****7890 - John Doe (employee, Active)
2. +62 ****8901 - Jane Smith (boss, Active)
3. +62 ****9012 - Bob Johnson (employee, Inactive)

Total: 3 users
```

**Error Responses**:

- Permission denied: `❌ Permission denied. Only boss and dev roles can view users`
- Invalid role filter: `❌ Invalid role filter. Must be: dev, boss, employee, investor`

**Validation**:

- Role filter validated if provided
- Phone numbers masked in output

---

### `/user update <phone> <field> <value>`

**Purpose**: Update a user's field.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `phone` (required): Phone number of user to update
- `field` (required): Field to update (`name`, `role`, `isActive`)
- `value` (required): New value for the field

**Success Response**:

```
✅ User updated successfully

Phone: +62 ****7890
Field: name
Old value: John Doe
New value: John Smith
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Invalid field: `❌ Invalid field. Must be: name, role, isActive`
- Invalid value: `❌ Invalid value for field 'role'. Must be: dev, boss, employee, investor`
- Permission denied: `❌ Permission denied. Only boss and dev roles can update users`

**Validation**:

- Phone number normalized and validated
- Field must be one of: `name`, `role`, `isActive`
- Value validated based on field type
- Role changes validated (enum check)

---

### `/user delete <phone>`

**Purpose**: Delete a user account.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `phone` (required): Phone number of user to delete

**Success Response**:

```
✅ User deleted successfully

Phone: +62 ****7890
Name: John Doe
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Cannot delete dev: `❌ Cannot delete dev role user`
- Permission denied: `❌ Permission denied. Only boss and dev roles can delete users`

**Validation**:

- Phone number normalized and validated
- Prevent deletion of dev role users (or require special handling)

---

### `/user activate <phone>`

**Purpose**: Activate a user account.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `phone` (required): Phone number of user to activate

**Success Response**:

```
✅ User activated successfully

Phone: +62 ****7890
Name: John Doe
Status: Active
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Already active: `ℹ️ User is already active`
- Permission denied: `❌ Permission denied. Only boss and dev roles can activate users`

---

### `/user deactivate <phone>`

**Purpose**: Deactivate a user account.

**Authorization**: Boss or Dev role required.

**Parameters**:

- `phone` (required): Phone number of user to deactivate

**Success Response**:

```
✅ User deactivated successfully

Phone: +62 ****7890
Name: John Doe
Status: Inactive
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Already inactive: `ℹ️ User is already inactive`
- Cannot deactivate dev: `❌ Cannot deactivate dev role user`
- Permission denied: `❌ Permission denied. Only boss and dev roles can deactivate users`

---

## Developer Administrative Commands

### `/template list`

**Purpose**: List all available message templates.

**Authorization**: Dev role required.

**Success Response**:

```
📋 Message Templates

1. welcome - Welcome message template
2. transaction_confirmation - Transaction confirmation template
3. error_message - Error message template
4. help_menu - Help menu template

Total: 4 templates
```

**Error Responses**:

- Permission denied: `❌ Permission denied. Only dev role can manage templates`

---

### `/template preview <name>`

**Purpose**: Preview a message template with sample data.

**Authorization**: Dev role required.

**Parameters**:

- `name` (required): Template name

**Success Response**:

```
📋 Template Preview: welcome

Content:
Halo {{userName}}!

Selamat datang di WhatsApp Cashflow Bot.
Anda login sebagai: {{roleLabel}}

Gunakan tombol di bawah untuk memulai.

---
Sample output:
Halo John Doe!

Selamat datang di WhatsApp Cashflow Bot.
Anda login sebagai: Employee

Gunakan tombol di bawah untuk memulai.
```

**Error Responses**:

- Template not found: `❌ Template 'welcome' not found`
- Permission denied: `❌ Permission denied. Only dev role can preview templates`

---

### `/template edit <name> <content>`

**Purpose**: Edit a message template.

**Authorization**: Dev role required.

**Parameters**:

- `name` (required): Template name
- `content` (required): New template content (multi-line supported)

**Success Response**:

```
✅ Template updated successfully

Name: welcome
Updated: 2025-01-27 10:30:00
```

**Error Responses**:

- Template not found: `❌ Template 'welcome' not found`
- Invalid syntax: `❌ Invalid template syntax. Check placeholder format: {{placeholder}}`
- Permission denied: `❌ Permission denied. Only dev role can edit templates`

**Validation**:

- Template syntax validation (placeholders, escape sequences)
- Content length validation (max 5000 characters)

---

### `/role grant <phone> <role>`

**Purpose**: Grant a role to a user.

**Authorization**: Dev role required.

**Parameters**:

- `phone` (required): Phone number of user
- `role` (required): Role to grant (`dev`, `boss`, `employee`, `investor`)

**Success Response**:

```
✅ Role granted successfully

Phone: +62 ****7890
Name: John Doe
New role: boss
Effective: Immediately
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Invalid role: `❌ Invalid role. Must be: dev, boss, employee, investor`
- Permission denied: `❌ Permission denied. Only dev role can grant roles`

**Validation**:

- Role must be valid enum value
- Change takes effect immediately (session update)

---

### `/role revoke <phone> <role>`

**Purpose**: Revoke a role from a user (downgrade).

**Authorization**: Dev role required.

**Parameters**:

- `phone` (required): Phone number of user
- `role` (required): Role to revoke

**Success Response**:

```
✅ Role revoked successfully

Phone: +62 ****7890
Name: John Doe
Previous role: boss
New role: employee
Effective: Immediately
```

**Error Responses**:

- User not found: `❌ User with phone number +62 ****7890 not found`
- Invalid role: `❌ Invalid role. Must be: dev, boss, employee, investor`
- Cannot revoke dev: `❌ Cannot revoke dev role`
- Permission denied: `❌ Permission denied. Only dev role can revoke roles`

---

### `/system status`

**Purpose**: View system health status.

**Authorization**: Dev role required.

**Success Response**:

```
📊 System Status

Database: ✅ Connected
Redis: ✅ Connected
WhatsApp: ✅ Connected

Uptime: 2d 5h 30m
Last check: 2025-01-27 10:30:00
```

**Error Response** (partial failure):

```
📊 System Status

Database: ✅ Connected
Redis: ❌ Disconnected
WhatsApp: ⚠️ Authenticating

Uptime: 2d 5h 30m
Last check: 2025-01-27 10:30:00
```

**Error Responses**:

- Permission denied: `❌ Permission denied. Only dev role can view system status`

**Timeout Handling**:

- Database check: 2s timeout
- Redis check: 1s timeout
- WhatsApp check: Immediate (state check)

---

### `/system logs [lines]`

**Purpose**: View recent log entries.

**Authorization**: Dev role required.

**Parameters**:

- `lines` (optional): Number of lines to retrieve (default: 50, max: 200)

**Success Response**:

```
📋 Recent Logs (last 50 lines)

[2025-01-27 10:29:45] INFO: Message received from +62 ****7890
[2025-01-27 10:29:46] INFO: Transaction processed successfully
[2025-01-27 10:29:47] WARN: Reconnection attempt 1/3
[2025-01-27 10:29:48] INFO: Reconnection successful

Total: 50 lines
```

**Error Responses**:

- Permission denied: `❌ Permission denied. Only dev role can view logs`
- Invalid line count: `❌ Invalid line count. Must be between 1 and 200`

**Data Masking**:

- Phone numbers masked
- Message content masked
- Sensitive data redacted

---

### `/config view <key>`

**Purpose**: View a configuration value.

**Authorization**: Dev role required.

**Parameters**:

- `key` (required): Configuration key (e.g., `LOG_LEVEL`)

**Success Response**:

```
⚙️ Configuration

Key: LOG_LEVEL
Value: info
Source: Database
Updated: 2025-01-27 10:00:00
```

**Error Responses**:

- Config not found: `❌ Configuration 'LOG_LEVEL' not found`
- Permission denied: `❌ Permission denied. Only dev role can view configuration`

---

### `/config set <key> <value>`

**Purpose**: Set a configuration value.

**Authorization**: Dev role required.

**Parameters**:

- `key` (required): Configuration key
- `value` (required): Configuration value

**Success Response**:

```
✅ Configuration updated successfully

Key: LOG_LEVEL
Old value: info
New value: debug
Updated: 2025-01-27 10:30:00
Applied: Immediately
```

**Error Responses**:

- Invalid key: `❌ Invalid configuration key 'INVALID_KEY'`
- Invalid value: `❌ Invalid value for 'LOG_LEVEL'. Must be: error, warn, info, debug`
- Permission denied: `❌ Permission denied. Only dev role can set configuration`

**Validation**:

- Key validated against allowed keys
- Value validated against Zod schema from `src/config/env.ts`

---

### `/cache clear [pattern]`

**Purpose**: Clear cache entries.

**Authorization**: Dev role required.

**Parameters**:

- `pattern` (optional): Cache key pattern (e.g., `user:*`, `session:*`, default: `*` for all)

**Success Response**:

```
✅ Cache cleared successfully

Pattern: user:*
Keys cleared: 15
Duration: 50ms
```

**Error Responses**:

- Permission denied: `❌ Permission denied. Only dev role can clear cache`
- Invalid pattern: `❌ Invalid cache pattern. Use wildcards: *`

**Pattern Examples**:

- `*`: Clear all cache
- `user:*`: Clear user-related cache
- `session:*`: Clear session-related cache

---

## Error Handling Standards

**General Error Format**:

```
❌ [Error Type]: [Error Message]

[Additional context if applicable]
```

**Error Types**:

- `Permission denied`: RBAC violation
- `Invalid [field]`: Validation failure
- `[Entity] not found`: Entity not found
- `System error`: Internal error (with masked details)

**Masking**:

- Phone numbers: `+62 ****7890`
- Message content: `[REDACTED]`
- Sensitive data: `***[REDACTED]***`

---

## Response Time Targets

- User management commands: < 30 seconds
- Developer commands: < 5 seconds (diagnostics), < 2 minutes (config changes)
- Template operations: < 10 seconds
- Cache operations: < 5 seconds

---

## Audit Logging

All commands log to `AuditLog` with:

- Actor: User ID and phone number (masked)
- Action: Command name and parameters (masked)
- Target: Affected entity
- Timestamp: Operation time
- Result: Success or error
