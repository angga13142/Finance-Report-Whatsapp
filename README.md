# WhatsApp Cashflow Reporting Chatbot

An interactive WhatsApp chatbot for daily cashflow reporting with role-based access control (Dev/Boss/Employee/Investor). The bot provides button-based interfaces for transaction input, automated daily reports at 24:00 WITA, and real-time financial analytics.

## Features

- 📱 **WhatsApp Integration**: Button-based interface using WhatsApp Web.js
- 💰 **Transaction Management**: Quick transaction input with category selection
- 📊 **Automated Reports**: Daily financial reports delivered at 24:00 WITA
- 👥 **Role-Based Access**: 4 roles (Dev, Boss, Employee, Investor) with different permissions
- 🔔 **Smart Alerts**: Anomaly detection and proactive recommendations
- 📈 **Analytics**: Trend analysis, 7-day moving averages, and period comparisons
- 🔒 **Security**: JWT authentication, RBAC, comprehensive audit logs

## Tech Stack

- **Runtime**: Node.js 20 LTS with TypeScript 5.x
- **WhatsApp**: whatsapp-web.js v1.23.0+ with LocalAuth
- **Database**: PostgreSQL 15+ with TimescaleDB extension
- **Cache**: Redis 7.x for session management
- **ORM**: Prisma 5.x
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Deployment**: Azure Container Apps or Azure App Service

## Quick Start

### Prerequisites

- Node.js 20 LTS
- Docker and Docker Compose
- WhatsApp account

### Installation

```bash
# Clone repository
git clone <repository-url>
cd finance
git checkout 004-whatsapp-cashflow-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start services (PostgreSQL + Redis)
docker-compose up -d

# Run database migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed

# Start the bot
npm run dev
```

On first run, scan the QR code displayed in terminal with your WhatsApp mobile app.

### Development

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # E2E tests
npm run test:coverage      # Coverage report

# Code quality
npm run lint               # Lint code
npm run type-check         # TypeScript check
npm run format             # Format code

# Database management
npm run prisma:studio      # Open Prisma Studio GUI
npm run prisma:migrate     # Create migration
npm run prisma:generate    # Generate Prisma Client
```

## Project Structure

```
src/
├── bot/              # WhatsApp bot core
│   ├── client/       # WhatsApp client wrapper
│   ├── handlers/     # Message and button handlers
│   ├── middleware/   # Request processing middleware
│   └── ui/           # Button and message formatting
├── services/         # Business logic services
│   ├── transaction/  # Transaction processing
│   ├── report/       # Report generation
│   ├── recommendation/ # Anomaly detection
│   ├── user/         # User management
│   └── scheduler/    # Cron job management
├── models/           # Prisma models and database access
├── lib/              # Shared utilities
└── config/           # Configuration management

tests/
├── unit/             # Unit tests (70% of suite)
├── integration/      # Integration tests (20%)
└── e2e/              # End-to-end tests (10%)
```

## Documentation

- [Implementation Plan](./specs/004-whatsapp-cashflow-bot/plan.md) - Technical architecture
- [Data Model](./specs/004-whatsapp-cashflow-bot/data-model.md) - Database schema
- [API Contracts](./specs/004-whatsapp-cashflow-bot/contracts/) - Message contracts
- [Quickstart Guide](./specs/004-whatsapp-cashflow-bot/quickstart.md) - Detailed setup guide

## Bot Commands

Send these commands via WhatsApp:

- `/start` - Show welcome menu
- `/help` - Show help message
- `/menu` - Return to main menu
- `/laporan` - View daily report
- `/catat` - Start transaction input

## Performance Targets

- Button interaction: <1s (99th percentile)
- Text message response: <2s (95th percentile)
- Report generation: <30s for daily reports
- Support 50 concurrent users
- 99% report delivery success rate

## Contributing

1. Create a feature branch from `main`
2. Implement changes with tests (80%+ coverage)
3. Run linting and type checks
4. Submit pull request

## License

ISC

## Support

- **Documentation**: See `docs/` directory
- **Issues**: Create GitHub issue
- **Team**: Contact Finance Engineering Team
