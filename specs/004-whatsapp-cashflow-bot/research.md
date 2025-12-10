# Research: WhatsApp Cashflow Bot Implementation Best Practices

**Date**: 2025-12-09  
**Feature**: WhatsApp Cashflow Reporting Chatbot  
**Purpose**: Consolidate research findings from site.md references, Context7 MCP, and Azure MCP best practices

## WhatsApp Web.js (wwebjs.dev) Best Practices

### Authentication & Session Persistence

**Decision**: Use LocalAuth strategy for session persistence across bot restarts.

**Rationale**: 
- LocalAuth stores session data locally, eliminating need for QR re-authentication on every restart
- Reduces operational overhead and improves user experience
- Session data stored in `.wwebjs_auth/` directory (should be persisted in Docker volumes)
- Supports automatic reconnection when session expires

**Alternatives Considered**:
- RemoteAuth: Requires external storage (Redis/S3), adds complexity for single-instance deployment
- NoAuth: Requires QR scan on every restart, poor user experience

**Implementation Notes**:
- Store `.wwebjs_auth/` directory in Docker volume or persistent storage
- Implement session health monitoring to detect disconnections
- Automatic reconnection logic with exponential backoff
- QR code display to terminal for initial authentication (Dev role only)

**References**:
- https://wwebjs.dev/guide/creating-your-bot/authentication.html
- https://docs.wwebjs.dev/

### Message Handling & Button Interfaces

**Decision**: Use Buttons class for primary menus (max 3 buttons per row), List Messages for category selection (up to 100 options).

**Rationale**:
- Buttons provide intuitive interface for non-technical users
- List Messages handle large option sets (categories) efficiently
- Fallback to numbered text menu if button rendering fails (accessibility)

**Alternatives Considered**:
- Text-only commands: Higher learning curve, less user-friendly
- Only buttons: Limited to 3 options per message, requires multiple messages

**Implementation Notes**:
- Button labels ≤20 characters, use emoji prefixes for visual clarity
- Implement button callback parsing and routing
- Debounce button interactions (3-second cooldown) to prevent duplicates
- Track button interaction analytics for UX improvement
- Graceful fallback to text menu if buttons fail to render

**References**:
- https://wwebjs.dev/guide/creating-your-bot/
- https://wwebjs.dev/guide/creating-your-bot/mentions.html

### Attachment Handling

**Decision**: Generate PDF reports with charts, send as attachments with text summary.

**Rationale**:
- PDF provides structured, printable format for financial reports
- Text summary allows reading without downloading
- WhatsApp supports PDF attachments up to 16MB
- Split into multiple PDFs if size exceeds limit

**Alternatives Considered**:
- Images only: Less structured, harder to print
- Text only: No visual charts, less professional

**Implementation Notes**:
- Use PDFKit or Puppeteer for PDF generation with charts
- Validate file size before sending (split if >16MB)
- Include text summary alongside PDF for quick reading
- Retry logic for failed attachment delivery (3 retries at 5-min intervals)

**References**:
- https://wwebjs.dev/guide/creating-your-bot/handling-attachments.html

### Rate Limiting & Message Delivery

**Decision**: Implement rate limiting (1 message per 3 seconds per chat) and batch delivery for automated reports.

**Rationale**:
- WhatsApp enforces rate limits (15-20 messages/minute per chat)
- Exceeding limits can result in account blocking
- Batch delivery prevents throttling during automated report generation
- Rate limiting ensures sustainable operation

**Alternatives Considered**:
- No rate limiting: Risk of account blocking
- Aggressive rate limiting (>5 seconds): Slower user experience

**Implementation Notes**:
- Use message queue (Bull.js) for rate-limited delivery
- Track delivery status and retry failed messages
- Monitor delivery success rate (target: 99%)
- Alert Dev role if delivery failures exceed threshold

## Azure Deployment Best Practices

### Container Deployment

**Decision**: Deploy to Azure Container Apps (ACA) or Azure App Service with Docker containers.

**Rationale**:
- Container Apps provide auto-scaling, built-in load balancing, and managed infrastructure
- App Service offers simpler deployment for single-instance scenarios
- Docker ensures consistent environment across dev/staging/production
- Supports zero-downtime deployments

**Alternatives Considered**:
- Azure Functions: Not suitable for long-running WhatsApp session
- Azure Kubernetes Service (AKS): Overkill for 10-50 user scale
- Virtual Machines: Higher operational overhead

**Implementation Notes**:
- Use Managed Identity for Azure service authentication (no hardcoded credentials)
- Configure health check endpoints for container health monitoring
- Set up auto-scaling rules based on CPU/memory metrics
- Use Azure Key Vault for secrets management (database passwords, API keys)
- Enable Application Insights for monitoring and logging

**References**:
- Azure MCP best practices for Node.js deployment
- Azure Container Apps documentation

### Database & Storage

**Decision**: Use Azure Database for PostgreSQL (Flexible Server) with TimescaleDB extension, Azure Cache for Redis.

**Rationale**:
- Managed PostgreSQL reduces operational overhead
- TimescaleDB optimizes time-series transaction queries
- Azure Cache for Redis provides managed Redis with high availability
- Automatic backups and point-in-time recovery

**Alternatives Considered**:
- Self-managed PostgreSQL: Higher operational overhead
- Azure Cosmos DB: Overkill for relational financial data
- In-memory session storage: No persistence across restarts

**Implementation Notes**:
- Enable SSL/TLS for all database connections
- Configure connection pooling (min 5, max 50 connections)
- Set up automated backups (daily full, hourly incremental)
- Use read replicas for report queries (if scaling to 100+ users)
- Enable encryption at rest (Azure managed encryption)

### Security & Authentication

**Decision**: Use Managed Identity for Azure services, JWT tokens in Redis for user sessions, parameterized queries (Prisma).

**Rationale**:
- Managed Identity eliminates credential management overhead
- JWT tokens provide stateless authentication with Redis persistence
- Prisma ORM prevents SQL injection via parameterized queries
- Follows Azure security best practices

**Alternatives Considered**:
- Service Principal with secrets: Requires credential rotation
- Session cookies: Not applicable for WhatsApp bot
- Raw SQL queries: SQL injection risk

**Implementation Notes**:
- Never hardcode credentials (use Key Vault or Managed Identity)
- Implement RBAC at application layer (role-based data filtering)
- Encrypt sensitive data in logs (amounts, phone numbers masked)
- Enable audit logging for all sensitive operations
- Regular security scanning (Snyk, Dependabot)

**References**:
- Azure MCP security best practices
- OWASP Top 10 guidelines

### Monitoring & Observability

**Decision**: Use Application Insights for logging, Prometheus + Grafana for metrics, Winston for structured logging.

**Rationale**:
- Application Insights provides Azure-native monitoring and alerting
- Prometheus + Grafana offer flexible metrics visualization
- Winston structured logging (JSON) enables log aggregation and analysis
- Comprehensive observability enables faster incident resolution

**Alternatives Considered**:
- Console logging only: Insufficient for production
- Single monitoring tool: Less flexibility

**Implementation Notes**:
- Configure Application Insights for automatic dependency tracking
- Export Prometheus metrics from Node.js application
- Set up Grafana dashboards for system health, performance, business metrics
- Configure alert rules: >5% error rate, uptime <99%, delivery success <99%
- Structured logging with correlation IDs for request tracing

## Node.js & TypeScript Best Practices

### Type Safety

**Decision**: Use TypeScript strict mode with no `any` types, comprehensive type definitions.

**Rationale**:
- Type safety prevents runtime errors and improves IDE support
- Strict mode catches more potential bugs at compile time
- Type definitions serve as inline documentation
- Aligns with constitution principle CQ-001

**Implementation Notes**:
- Enable `strict: true` in tsconfig.json
- Use ESLint rule `@typescript-eslint/no-explicit-any` (error level)
- Type coverage minimum 95%
- All public APIs have explicit return types

### Error Handling

**Decision**: Comprehensive error handling with structured logging, user-friendly messages, and automatic retries.

**Rationale**:
- Prevents system crashes and improves user experience
- Structured logging enables effective debugging
- User-friendly messages (Bahasa Indonesia) reduce support burden
- Automatic retries handle transient failures

**Implementation Notes**:
- Global error handler catches unhandled exceptions
- Error codes mapped to user-friendly messages
- Retry logic with exponential backoff for transient errors
- Circuit breaker pattern for WhatsApp session failures
- Health check endpoints for service status

### Testing Strategy

**Decision**: Test pyramid (70% unit, 20% integration, 10% E2E) with TDD approach, 80%+ code coverage.

**Rationale**:
- Balanced test distribution optimizes speed and coverage
- TDD ensures testability and improves design
- 80% coverage target ensures critical paths are tested
- Aligns with constitution principles TS-001 and TS-002

**Implementation Notes**:
- Unit tests: business logic, validation, calculations (<2min execution)
- Integration tests: database, Redis, wwebjs interactions (<10min execution)
- E2E tests: critical user paths with Playwright (<30min execution)
- Mock external services (WhatsApp, database) in tests
- Test data factories for consistent test data

## Performance Optimization

### Database Query Optimization

**Decision**: Use TimescaleDB for time-series optimization, indexes on frequently queried fields, connection pooling.

**Rationale**:
- TimescaleDB optimizes time-series queries (daily reports, trend analysis)
- Indexes improve query performance (phone_number, timestamp, user_id, role)
- Connection pooling reduces connection overhead
- Prepared statements avoid parsing overhead

**Implementation Notes**:
- Create indexes on: phone_number (unique), timestamp (for date range queries), user_id (transaction lookups), role (permission checks)
- Use Prisma query optimization (select only needed fields)
- Monitor slow query log and optimize queries >500ms
- Use read replicas for report queries (if scaling)

### Caching Strategy

**Decision**: Redis caching for user roles, category lists, daily totals, with TTL-based invalidation.

**Rationale**:
- Reduces database load for frequently accessed data
- Improves response time for button menu generation
- TTL-based invalidation ensures data freshness
- Event-driven cache invalidation on updates

**Implementation Notes**:
- Cache user roles/permissions (30-min TTL)
- Cache category lists (1-day TTL)
- Cache yesterday's totals (24-hour TTL)
- Invalidate cache immediately on updates (event-driven)
- Button menu templates cached in-memory (no DB hits)

### Message Delivery Optimization

**Decision**: Batch message sending with rate limiting, async delivery with status tracking, message queue for bursts.

**Rationale**:
- Prevents WhatsApp rate limiting and account blocking
- Async delivery improves user experience (non-blocking)
- Status tracking enables retry logic and monitoring
- Message queue handles burst traffic (>20 concurrent messages)

**Implementation Notes**:
- Use Bull.js message queue for rate-limited delivery
- Batch messages: 1 per 3 seconds per chat
- Track delivery status in database
- Retry failed deliveries (3 retries at 5-min intervals)
- Alert Dev if delivery success rate <99%

## Summary

All research areas have been addressed with concrete decisions, rationale, and implementation notes. The approach follows best practices from:
- WhatsApp Web.js documentation (site.md references)
- Azure deployment guidelines (Azure MCP)
- Node.js/TypeScript industry standards
- Constitution principles (code quality, testing, performance)

No unresolved clarifications remain. Ready to proceed to Phase 1 (Design & Contracts).

