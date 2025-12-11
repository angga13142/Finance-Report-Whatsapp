# Quick Start Guide: Platform Modernization

**Feature**: WhatsApp Cashflow Bot Platform Modernization  
**Branch**: `001-platform-modernization`  
**Date**: 2025-01-27

## Overview

This guide provides step-by-step instructions for setting up and using the modernized WhatsApp Cashflow Bot with Docker, session persistence, enhanced logging, Unicode font formatting, dynamic user management, and developer superuser capabilities.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- Node.js >=20.0.0 (for local development)
- PostgreSQL database (accessible from container)
- Redis server (accessible from container)
- WhatsApp mobile app (for QR code authentication)

## Docker Setup

### 1. Environment Configuration

Create a `.env` file in the repository root:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Redis
REDIS_URL="redis://host:6379"

# WhatsApp
WHATSAPP_SESSION_PATH="/app/.wwebjs_auth"

# Logging
LOG_LEVEL="INFO"  # Options: ERROR, WARN, INFO, DEBUG

# Application
NODE_ENV="production"
PORT=3000
```

### 2. Docker Compose

The `docker-compose.yml` file is located in the `docker/` directory:

```yaml
version: "3.8"

services:
  bot:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: whatsapp-cashflow-bot
    restart: unless-stopped
    volumes:
      - whatsapp-session:/app/.wwebjs_auth
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - LOG_LEVEL=${LOG_LEVEL}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - bot-network

volumes:
  whatsapp-session:
    driver: local

networks:
  bot-network:
    driver: bridge
```

### 3. Build and Start

```bash
# Build the Docker image
docker-compose -f docker/docker-compose.yml build

# Start the container
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f
```

## Initial Authentication (QR Code)

### First-Time Setup

1. **Start the container** (see Docker Setup above)

2. **View container logs** to see the QR code:

   ```bash
   docker-compose -f docker/docker-compose.yml logs -f
   ```

3. **Look for QR code** in the logs:

   ```
   [INFO] QR Code generated. Scan with WhatsApp mobile app.
   [QR CODE DISPLAYED HERE]
   ```

4. **Scan QR code** with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code from the container logs

5. **Wait for authentication**:

   ```
   [INFO] Authenticated successfully
   [INFO] WhatsApp client ready
   ```

6. **Verify connection**:
   ```bash
   curl http://localhost:3000/health
   ```
   Response should show `"whatsapp": "connected"`

### Session Persistence

After initial authentication, the session is saved to the Docker volume. On subsequent container restarts:

1. **Stop container**:

   ```bash
   docker-compose -f docker/docker-compose.yml down
   ```

2. **Start container** (session persists):

   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

3. **Verify automatic reconnection**:
   - Check logs: `docker-compose -f docker/docker-compose.yml logs -f`
   - Should see: `[INFO] Session restored, reconnecting...`
   - Then: `[INFO] WhatsApp client ready` (no QR code needed)

### Troubleshooting Authentication

**Problem**: QR code not appearing in logs

- **Solution**: Check LOG_LEVEL is set to INFO or DEBUG
- **Solution**: Ensure container has proper permissions to write to volume

**Problem**: Session not persisting after restart

- **Solution**: Verify Docker volume exists: `docker volume ls | grep whatsapp-session`
- **Solution**: Check volume mount in docker-compose.yml
- **Solution**: Verify file permissions on volume (Node.js process must have write access)

**Problem**: "Session expired" error

- **Solution**: Delete volume and re-authenticate: `docker volume rm whatsapp-session`
- **Solution**: Check WhatsApp Web session status on mobile app

## Command Reference

### User Management Commands

**Prerequisites**: User must have `dev` or `boss` role

#### Add User

```
/user add +628123456789 "John Doe" employee
```

#### List Users

```
/user list
/user list employee  # Filter by role
```

#### Update User

```
/user update +628123456789 name "John Smith"
/user update +628123456789 role boss
```

#### Delete User

```
/user delete +628123456789
```

#### Activate/Deactivate User

```
/user activate +628123456789
/user deactivate +628123456789
```

### Admin Commands (Dev Role Only)

#### Template Management

```
/template list
/template edit transaction-confirmation
/template preview transaction-confirmation
```

#### System Status

```
/system status
/system logs
/system logs 100  # Last 100 lines
```

#### Configuration Management

```
/config view MAX_TRANSACTION_AMOUNT
/config set MAX_TRANSACTION_AMOUNT 10000000
/config set LOG_LEVEL DEBUG
```

#### Cache Management

```
/cache clear transaction-*
/cache inspect transaction-12345
```

## Message Formatting

The bot now uses Unicode mathematical alphanumeric symbols for visual formatting:

### Examples

**Transaction Confirmation**:

```
━━━━━━━━━━━━━━━━━━━━
✅ Transaction Confirmed
━━━━━━━━━━━━━━━━━━━━

Amount: Rp 1.500.000
Category: Food & Dining
Date: 2025-01-27
```

**Monthly Report**:

```
📊 Monthly Report - January 2025
━━━━━━━━━━━━━━━━━━━━

Income: Rp 10.000.000
Expenses: Rp 7.500.000
Balance: Rp 2.500.000
```

**Error Message**:

```
❌ Error: Invalid Amount

The amount must be a positive number.
Please try again with a valid amount.
```

### Font Styles

- **Bold**: Used for headings and emphasis
- **Monospace**: Used for currency amounts and numbers
- **Emojis**: Used for status indicators (✅ success, ❌ error, 💰 financial, 📊 reports)

### Fallback Behavior

If a WhatsApp client doesn't support Unicode mathematical symbols, the bot automatically falls back to native WhatsApp formatting:

- `_bold_` for bold text
- `_italic_` for italic text
- `` `monospace` `` for monospace text

## Logging

### Log Levels

Set `LOG_LEVEL` environment variable:

- `ERROR`: Only errors
- `WARN`: Warnings and errors
- `INFO`: Info, warnings, and errors (default)
- `DEBUG`: All events including debug information

### Log Format

Logs are in structured JSON format:

```json
{
  "timestamp": "2025-01-27T10:30:15.123Z",
  "level": "INFO",
  "eventType": "message_received",
  "correlationId": "abc123-def456",
  "metadata": {
    "phone": "+62812****6789",
    "messageType": "text",
    "length": 25
  }
}
```

### Viewing Logs

**Container logs**:

```bash
docker-compose -f docker/docker-compose.yml logs -f
```

**Application logs** (rotated files):

```bash
# Logs are stored in container at /app/logs/
docker exec whatsapp-cashflow-bot ls -la /app/logs/
```

**Via admin command**:

```
/system logs 100
```

### Log Rotation

- Maximum file size: 100MB
- Retention: 14 days
- Format: `app-YYYY-MM-DD.log`

## Health Checks

### HTTP Endpoint

```bash
curl http://localhost:3000/health
```

**Response**:

```json
{
  "status": "healthy",
  "postgresql": {
    "connected": true,
    "responseTime": 45
  },
  "redis": {
    "connected": true,
    "responseTime": 12
  },
  "whatsapp": {
    "status": "connected",
    "ready": true
  },
  "uptime": 86400,
  "memory": {
    "used": 245,
    "limit": 512
  }
}
```

### Docker Health Check

The container includes a health check that runs every 30 seconds:

```bash
docker ps
# Check "STATUS" column for "(healthy)" indicator
```

## Troubleshooting

### Container Won't Start

1. **Check logs**:

   ```bash
   docker-compose -f docker/docker-compose.yml logs
   ```

2. **Verify environment variables**:

   ```bash
   docker-compose -f docker/docker-compose.yml config
   ```

3. **Check database connectivity**:
   ```bash
   docker exec whatsapp-cashflow-bot node -e "require('pg').connect(process.env.DATABASE_URL, (err) => console.log(err || 'Connected'))"
   ```

### WhatsApp Connection Issues

1. **Check session data**:

   ```bash
   docker exec whatsapp-cashflow-bot ls -la /app/.wwebjs_auth/
   ```

2. **View WhatsApp client logs**:

   ```bash
   docker-compose -f docker/docker-compose.yml logs | grep -i whatsapp
   ```

3. **Re-authenticate** (if needed):
   - Delete volume: `docker volume rm whatsapp-session`
   - Restart container and scan QR code again

### Performance Issues

1. **Check resource usage**:

   ```bash
   docker stats whatsapp-cashflow-bot
   ```

2. **View system metrics**:

   ```
   /system status
   ```

3. **Check log levels**:
   - Set `LOG_LEVEL=WARN` in production to reduce log volume
   - Use `LOG_LEVEL=DEBUG` only for troubleshooting

### Permission Errors

1. **Check volume permissions**:

   ```bash
   docker exec whatsapp-cashflow-bot ls -la /app/.wwebjs_auth/
   ```

2. **Fix permissions** (if needed):
   ```bash
   docker exec whatsapp-cashflow-bot chown -R node:node /app/.wwebjs_auth/
   ```

## Development Setup

### Local Development (Without Docker)

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run database migrations**:

   ```bash
   npm run prisma:migrate
   ```

4. **Start development server**:

   ```bash
   npm run dev
   ```

5. **Session data** will be stored in `.wwebjs_auth/` directory (local)

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## Next Steps

- Review [data-model.md](./data-model.md) for database schema details
- Review [contracts/commands.md](./contracts/commands.md) for complete command reference
- Review [research.md](./research.md) for technical decisions and rationale

## Support

For issues or questions:

1. Check container logs: `docker-compose -f docker/docker-compose.yml logs -f`
2. Check application health: `curl http://localhost:3000/health`
3. Review documentation in `docs/` directory
4. Check GitHub issues for known problems
