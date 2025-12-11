# Quickstart: WhatsApp Cashflow Bot Enhancements

**Date**: 2025-01-27  
**Feature**: 001-bot-enhancements  
**Purpose**: Quick reference for developers implementing these enhancements

## Prerequisites

- Node.js >=20.0.0
- Docker and Docker Compose
- PostgreSQL database
- Redis server
- WhatsApp account for testing

## Setup

### 1. Database Migrations

Create Prisma migrations for new tables:

```bash
# Create migration for SystemConfig and MessageTemplate
npx prisma migrate dev --name add_system_config_and_templates

# Apply migration
npx prisma migrate deploy
```

### 2. Environment Variables

Add to `.env`:

```bash
# Developer phone number (required for dev role identification)
DEV_PHONE_NUMBER=+6281234567890

# WhatsApp session path (for Docker volume)
WHATSAPP_SESSION_PATH=/app/.wwebjs_auth

# Log level (configurable via /config set)
LOG_LEVEL=info
```

### 3. Docker Setup

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  bot:
    build: .
    volumes:
      - whatsapp-session:/app/.wwebjs_auth
    environment:
      - DEV_PHONE_NUMBER=${DEV_PHONE_NUMBER}
      - LOG_LEVEL=${LOG_LEVEL}
    depends_on:
      - postgres
      - redis

volumes:
  whatsapp-session:
```

## Implementation Order

### Phase 1: Docker Migration (P1)

1. **Create Dockerfile** (`docker/Dockerfile`):
   - Base image: Node.js 20
   - Install Puppeteer dependencies
   - Set up non-root user (UID 1000)
   - Copy application code
   - Expose health check port

2. **Update auth.ts** (`src/bot/client/auth.ts`):
   - Ensure `WHATSAPP_SESSION_PATH` uses Docker volume path
   - Verify volume permissions

3. **Add health check endpoint** (`src/index.ts`):
   - Endpoint: `GET /health`
   - Check: Database, Redis, WhatsApp client status

4. **Test**: `docker-compose up`, verify session persistence

### Phase 2: Logging Enhancement (P1)

1. **Create WhatsApp event logger** (`src/lib/whatsapp-logger.ts`):
   - Wrap Winston logger
   - Add correlation ID generation
   - Integrate with existing `maskSensitiveData()`

2. **Update events.ts** (`src/bot/client/events.ts`):
   - Add event handlers for all WhatsApp events
   - Log with structured metadata
   - Include correlation IDs

3. **Test**: Trigger events, verify logs with correlation IDs

### Phase 3: Font Formatting (P2)

1. **Create font formatter** (`src/lib/font-formatter.ts`):
   - Implement Unicode character mappings
   - Add fallback logic for unsupported characters
   - Performance optimization (caching)

2. **Update message templates** (`src/bot/ui/messages.ts`):
   - Integrate font formatter utilities
   - Apply formatting to all message types
   - Maintain backward compatibility

3. **Test**: Send messages, verify formatting and performance (<5ms)

### Phase 4: User Management (P2)

1. **Create user manager service** (`src/services/user/manager.ts`):
   - Implement CRUD operations
   - Add validation and RBAC checks
   - Integrate audit logging

2. **Create user management handler** (`src/bot/handlers/user-management.ts`):
   - Parse commands: `/user add`, `/user list`, etc.
   - Call service layer
   - Format responses

3. **Update auth middleware** (`src/bot/middleware/auth.ts`):
   - Add boss/dev role checks for user management commands

4. **Test**: Execute commands, verify operations and audit logs

### Phase 5: Developer Capabilities (P3)

1. **Create system config model** (`src/models/config.ts`):
   - Prisma model operations
   - Configuration loading with env override

2. **Create system services**:
   - `src/services/system/config.ts`: Configuration management
   - `src/services/system/diagnostics.ts`: Health checks

3. **Create admin handler** (`src/bot/handlers/admin.ts`):
   - Parse developer commands
   - Route to appropriate services
   - Format responses

4. **Test**: Execute developer commands, verify functionality

## Testing

### Unit Tests

```bash
# Run unit tests
npm test -- --testPathPattern=unit

# Test font formatter
npm test -- font-formatter.test.ts

# Test user manager
npm test -- manager.test.ts
```

### Integration Tests

```bash
# Run integration tests
npm test -- --testPathPattern=integration

# Test user management commands
npm test -- user-management.test.ts

# Test Docker session persistence
npm test -- session-persistence.test.ts
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Test user management workflow
npm run test:e2e -- user-management.spec.ts
```

## Common Patterns

### Adding a New Command

1. **Define command syntax** in `contracts/whatsapp-commands.md`
2. **Create handler method** in appropriate handler file
3. **Create service method** if business logic needed
4. **Add RBAC check** in middleware
5. **Add audit logging** for all operations
6. **Write tests** (unit, integration, E2E)

### Adding a New Service

1. **Create service file** in `src/services/<domain>/`
2. **Follow existing patterns** (static methods, error handling)
3. **Use models** for database operations
4. **Add logging** for operations
5. **Write unit tests**

### Adding a New Model

1. **Update Prisma schema** (`prisma/schema.prisma`)
2. **Create migration**: `npx prisma migrate dev --name <name>`
3. **Create model file** in `src/models/`
4. **Follow existing patterns** (static methods, error handling)
5. **Write unit tests**

## Debugging

### WhatsApp Session Issues

```bash
# Check session directory permissions
ls -la .wwebjs_auth/session-cashflow-bot/

# Check Docker volume mount
docker exec <container> ls -la /app/.wwebjs_auth/

# View session files
docker exec <container> cat /app/.wwebjs_auth/session-cashflow-bot/.data.json
```

### Logging Issues

```bash
# Check log files
tail -f logs/combined.log

# Filter WhatsApp events
tail -f logs/combined.log | grep "whatsapp"

# Check correlation IDs
tail -f logs/combined.log | grep "correlationId"
```

### Configuration Issues

```bash
# View current configuration
# Via WhatsApp: /config view LOG_LEVEL

# Check database
npx prisma studio
# Navigate to SystemConfig table

# Check environment variables
docker exec <container> env | grep LOG_LEVEL
```

## Performance Optimization

### Font Formatting

- Cache character mappings (avoid repeated lookups)
- Batch character conversions
- Measure performance: `console.time('font-convert')`

### User Management

- Use database indexes (phone_number, role)
- Batch operations when possible
- Optimize queries (select only needed fields)

### Configuration

- Cache configuration in memory
- Invalidate cache on updates
- Use connection pooling for database

## Security Checklist

- [ ] Phone numbers masked in logs
- [ ] Message content masked in logs
- [ ] RBAC checks on all commands
- [ ] Input validation on all user inputs
- [ ] Audit logging for all operations
- [ ] Sensitive data not exposed in diagnostics
- [ ] Environment variables for secrets
- [ ] Docker volume permissions correct

## Deployment

### Pre-deployment

1. Run all tests: `npm test && npm run test:e2e`
2. Check linting: `npm run lint`
3. Build Docker image: `docker build -t cashflow-bot .`
4. Test Docker container: `docker-compose up`

### Deployment

1. **Database migration**:

   ```bash
   npx prisma migrate deploy
   ```

2. **Docker deployment**:

   ```bash
   docker-compose up -d
   ```

3. **Verify health**:

   ```bash
   curl http://localhost:3000/health
   ```

4. **Verify WhatsApp connection**:
   - Check logs for authentication
   - Send test message to bot

### Post-deployment

1. Monitor logs: `docker-compose logs -f bot`
2. Check health endpoint: `curl http://localhost:3000/health`
3. Test commands: Send test commands via WhatsApp
4. Verify session persistence: Restart container, check reconnection

## Troubleshooting

### Container won't start

- Check Docker logs: `docker-compose logs bot`
- Verify environment variables
- Check volume permissions
- Verify database/Redis connectivity

### WhatsApp session lost

- Check volume mount: `docker volume inspect <volume-name>`
- Verify session directory exists
- Check file permissions
- Review authentication logs

### Commands not working

- Check RBAC: Verify user role in database
- Check logs: Look for error messages
- Verify handler registration
- Test with dev role user

### Performance issues

- Check font conversion timing
- Monitor database query performance
- Check Redis connection
- Review log volume

## Next Steps

After completing implementation:

1. Run `/speckit.tasks` to generate detailed task list
2. Implement tasks in priority order (P1 → P2 → P3)
3. Write tests as you implement (TDD)
4. Update documentation as needed
5. Deploy to staging for testing
6. Deploy to production after validation

## Resources

- **Specification**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Command Contracts**: [contracts/whatsapp-commands.md](./contracts/whatsapp-commands.md)
- **Research**: [research.md](./research.md)
- **Architecture**: `.github/copilot-instructions.md`
- **Constitution**: `.specify/memory/constitution.md`
