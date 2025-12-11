# Docker Setup Guide: WhatsApp Cashflow Bot

This guide provides instructions for setting up and running the WhatsApp Cashflow Bot using Docker.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- PostgreSQL database (accessible from container)
- Redis server (accessible from container)
- WhatsApp mobile app (for QR code authentication)

## Quick Start

### 1. Environment Configuration

Create a `.env` file in the repository root:

```bash
# Database
DATABASE_URL="postgresql://cashflow_user:cashflow_pass@postgres:5432/cashflow_bot"

# Redis
REDIS_URL="redis://redis:6379"

# WhatsApp
WHATSAPP_SESSION_PATH="/app/.wwebjs_auth"

# Logging
LOG_LEVEL="INFO"  # Options: ERROR, WARN, INFO, DEBUG

# Application
NODE_ENV="production"
PORT=3000
```

### 2. Build and Start

```bash
# Build the Docker image
npm run docker:build

# Start the container
npm run docker:up

# View logs
npm run docker:logs
```

Or use Docker Compose directly:

```bash
# Build
docker-compose -f docker/docker-compose.yml build

# Start
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f
```

## Initial Authentication (QR Code)

### First-Time Setup

1. **Start the container** (see Quick Start above)

2. **View container logs** to see the QR code:

   ```bash
   npm run docker:logs
   # or
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

After initial authentication, the session is saved to the Docker volume `whatsapp-session`. On subsequent container restarts:

1. **Stop container**:

   ```bash
   npm run docker:down
   ```

2. **Start container** (session persists):

   ```bash
   npm run docker:up
   ```

3. **Verify automatic reconnection**:
   - Check logs: `npm run docker:logs`
   - Should see: `[INFO] Session restored, reconnecting...`
   - Then: `[INFO] WhatsApp client ready` (no QR code needed)

## Volume Management

### WhatsApp Session Volume

The WhatsApp session is stored in a Docker named volume `whatsapp-session`:

```bash
# List volumes
docker volume ls | grep whatsapp-session

# Inspect volume
docker volume inspect whatsapp-session

# Remove volume (if you need to re-authenticate)
docker volume rm whatsapp-session
```

### Volume Permissions

The container runs as non-root user (UID 1000) with proper permissions:

- Directories: 755 permissions
- Files: 644 permissions
- Ownership: nodejs:nodejs (UID 1000)

If you encounter permission issues:

```bash
# Check permissions inside container
docker exec cashflow_bot ls -la /app/.wwebjs_auth/

# Fix permissions (if needed)
docker exec cashflow_bot chown -R nodejs:nodejs /app/.wwebjs_auth/
docker exec cashflow_bot chmod -R 755 /app/.wwebjs_auth/
```

## Health Checks

The container includes a health check that validates WhatsApp client connection:

```bash
# Check container health status
docker ps
# Look for "(healthy)" in STATUS column

# Manual health check
curl http://localhost:3000/health
```

Health check configuration:

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Start period**: 60 seconds (allows time for WhatsApp authentication)
- **Retries**: 3

## Troubleshooting

### Container Won't Start

1. **Check logs**:

   ```bash
   npm run docker:logs
   ```

2. **Verify environment variables**:

   ```bash
   docker-compose -f docker/docker-compose.yml config
   ```

3. **Check database connectivity**:
   ```bash
   docker exec cashflow_bot node -e "require('pg').connect(process.env.DATABASE_URL, (err) => console.log(err || 'Connected'))"
   ```

### WhatsApp Connection Issues

1. **Check session data**:

   ```bash
   docker exec cashflow_bot ls -la /app/.wwebjs_auth/
   ```

2. **View WhatsApp client logs**:

   ```bash
   docker-compose -f docker/docker-compose.yml logs | grep -i whatsapp
   ```

3. **Re-authenticate** (if needed):
   - Delete volume: `docker volume rm whatsapp-session`
   - Restart container and scan QR code again

### Session Not Persisting After Restart

**Problem**: Session not persisting after container restart

**Solutions**:

- Verify Docker volume exists: `docker volume ls | grep whatsapp-session`
- Check volume mount in docker-compose.yml (should be `whatsapp-session:/app/.wwebjs_auth`)
- Verify file permissions on volume (Node.js process must have write access)
- Check container logs for permission errors

### Permission Errors

**Problem**: Permission denied errors when writing to `.wwebjs_auth`

**Solutions**:

1. Check volume permissions:

   ```bash
   docker exec cashflow_bot ls -la /app/.wwebjs_auth/
   ```

2. Fix permissions (if needed):

   ```bash
   docker exec cashflow_bot chown -R nodejs:nodejs /app/.wwebjs_auth/
   docker exec cashflow_bot chmod -R 755 /app/.wwebjs_auth/
   ```

3. Verify user ID:
   ```bash
   docker exec cashflow_bot id
   # Should show: uid=1000(nodejs) gid=1000(nodejs)
   ```

### QR Code Not Appearing

**Problem**: QR code not appearing in logs

**Solutions**:

- Check LOG_LEVEL is set to INFO or DEBUG
- Ensure container has proper permissions to write to volume
- Check if session directory exists: `docker exec cashflow_bot ls -la /app/.wwebjs_auth/`

### Session Expired Error

**Problem**: "Session expired" error

**Solutions**:

- Delete volume and re-authenticate: `docker volume rm whatsapp-session`
- Check WhatsApp Web session status on mobile app
- Restart container and scan QR code again

### Performance Issues

1. **Check resource usage**:

   ```bash
   docker stats cashflow_bot
   ```

2. **View system metrics**:

   ```bash
   curl http://localhost:3000/health
   ```

3. **Check log levels**:
   - Set `LOG_LEVEL=WARN` in production to reduce log volume
   - Use `LOG_LEVEL=DEBUG` only for troubleshooting

## Container Lifecycle

### Stop Container

```bash
npm run docker:down
# or
docker-compose -f docker/docker-compose.yml down
```

### Restart Container

```bash
npm run docker:restart
# or
docker-compose -f docker/docker-compose.yml restart bot
```

### Rebuild Container

```bash
npm run docker:build
npm run docker:up
```

### View Logs

```bash
npm run docker:logs
# or
docker-compose -f docker/docker-compose.yml logs -f bot
```

## Development vs Production

### Development

For local development, use `docker-compose.dev.yml`:

```bash
docker-compose -f docker/docker-compose.dev.yml up -d
```

### Production

For production deployment, use `docker-compose.yml`:

```bash
docker-compose -f docker/docker-compose.yml up -d
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [WhatsApp Web.js Documentation](https://wwebjs.dev/)
- Main project README: `../README.md`
- Quickstart guide: `../specs/001-platform-modernization/quickstart.md`

## Support

For issues or questions:

1. Check container logs: `npm run docker:logs`
2. Check application health: `curl http://localhost:3000/health`
3. Review documentation in `docs/` directory
4. Check GitHub issues for known problems
