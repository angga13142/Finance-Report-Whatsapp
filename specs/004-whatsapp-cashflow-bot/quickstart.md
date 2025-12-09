# Quickstart Guide: WhatsApp Cashflow Bot

**Date**: 2025-12-09  
**Feature**: WhatsApp Cashflow Reporting Chatbot  
**Purpose**: Get the bot up and running in development environment

## Prerequisites

- Node.js 20 LTS (or 18+ with upgrade plan)
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7.x (or use Docker)
- WhatsApp account for bot (phone number)

## Local Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd finance
git checkout 004-whatsapp-cashflow-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cashflow_bot"
REDIS_URL="redis://localhost:6379"

# WhatsApp
WHATSAPP_SESSION_PATH="./.wwebjs_auth"
WHATSAPP_CLIENT_NAME="CashflowBot"

# Application
NODE_ENV="development"
PORT=3000
LOG_LEVEL="debug"

# Timezone
TZ="Asia/Makassar"  # WITA (UTC+8)

# Security
JWT_SECRET="your-secret-key-change-in-production"
ENCRYPTION_KEY="your-encryption-key-32-chars"

# Azure (for production)
AZURE_SUBSCRIPTION_ID=""
AZURE_RESOURCE_GROUP=""
AZURE_KEY_VAULT_NAME=""
```

### 3. Start Services with Docker Compose

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 5

# Run database migrations
npx prisma migrate dev

# Seed initial data (categories, dev user)
npx prisma db seed
```

### 4. Initialize WhatsApp Session

```bash
# Start the bot (first time will show QR code)
npm run dev

# Scan QR code with WhatsApp mobile app
# Session will be saved to .wwebjs_auth/ directory
```

**Note**: On first run, the bot will display a QR code in the terminal. Scan it with your WhatsApp mobile app to authenticate. The session will be persisted in `.wwebjs_auth/` directory.

### 5. Register First User (Dev Role)

```bash
# Use Prisma Studio to add first user
npx prisma studio

# Or use database directly:
# INSERT INTO "Users" (phone_number, name, role, is_active)
# VALUES ('+6281234567890', 'Dev User', 'dev', true);
```

### 6. Test the Bot

1. Send a message to the bot's WhatsApp number: `/start`
2. You should receive a welcome message with button menu
3. Test transaction input: Press `[💰 Catat Penjualan]` button
4. Follow the button-guided workflow

## Development Workflow

### Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start

# With PM2 (production-like)
pm2 start ecosystem.config.js
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Database Management

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check

# Format code
npm run format
```

## Project Structure

```
src/
├── bot/              # WhatsApp bot core
├── services/         # Business logic
├── models/           # Database models
├── lib/              # Utilities
└── config/           # Configuration

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
└── e2e/              # End-to-end tests
```

## Key Commands

### Bot Commands (via WhatsApp)

- `/start` - Show welcome menu
- `/help` - Show help message
- `/menu` - Return to main menu
- `/laporan` - View daily report
- `/catat` - Start transaction input

### Development Commands

```bash
# Start all services
docker-compose up

# Stop all services
docker-compose down

# View logs
docker-compose logs -f bot

# Run specific test
npm test -- transaction.test.ts

# Debug mode
DEBUG=* npm run dev
```

## Common Issues

### QR Code Not Appearing

- Check that Puppeteer/Chromium is installed: `npm install puppeteer`
- Verify `.wwebjs_auth/` directory is writable
- Check browser console for errors

### Database Connection Failed

- Verify PostgreSQL is running: `docker-compose ps`
- Check `DATABASE_URL` in `.env`
- Test connection: `psql $DATABASE_URL`

### Redis Connection Failed

- Verify Redis is running: `docker-compose ps`
- Check `REDIS_URL` in `.env`
- Test connection: `redis-cli -u $REDIS_URL ping`

### Session Expired

- Delete `.wwebjs_auth/` directory
- Restart bot to generate new QR code
- Scan QR code again

### Button Not Working

- Check WhatsApp version supports buttons (Android/iOS latest)
- Verify button callback routing in `src/bot/handlers/button.ts`
- Check session state in Redis: `redis-cli GET "session:+6281234567890"`

## Next Steps

1. **Read the Specification**: Review [spec.md](./spec.md) for complete requirements
2. **Review Data Model**: See [data-model.md](./data-model.md) for database schema
3. **Check API Contracts**: See [contracts/](./contracts/) for message and service contracts
4. **Follow Implementation Plan**: See [plan.md](./plan.md) for phased implementation

## Production Deployment

See deployment documentation for:
- Azure Container Apps setup
- Database migration strategy
- Environment variable management
- Monitoring and alerting configuration

## Getting Help

- **Documentation**: See `docs/` directory
- **Issues**: Create GitHub issue
- **Team**: Contact Finance Engineering Team

---

**Last Updated**: 2025-12-09

