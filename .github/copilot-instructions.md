---
applyTo: "**/*"
description: "GitHub Copilot instructions for WhatsApp Cashflow Bot - Node.js, TypeScript, NestJS, PostgreSQL financial application with RBAC"
---

# WhatsApp Cashflow Bot - GitHub Copilot Instructions

This document contains organization-wide coding standards and best practices for the WhatsApp Cashflow Bot project.

## Project Overview

- **Name**: WhatsApp Cashflow Reporting Chatbot
- **Type**: Financial bot API with role-based access control
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x (ES2022)
- **Framework**: NestJS with Express
- **Database**: PostgreSQL 15+ with TimescaleDB extension
- **Team**: Small team with strict standards
- **Scope**: Financial transaction processing, reporting, RBAC enforcement

## Technology Stack

- **Backend**: NestJS with dependency injection and middleware
- **ORM**: Prisma with PostgreSQL
- **Testing**: Jest (unit/integration), Playwright (e2e)
- **Messaging**: WhatsApp Web.js (wwebjs)
- **Session**: Redis 7.x for session management
- **Monitoring**: Prometheus metrics
- **Container**: Docker with multi-stage builds

## Core Principles

1. **Security First**: Financial data requires maximum security - always validate, sanitize, and encrypt
2. **Type Safety**: Strict TypeScript with noImplicitAny and strict null checks
3. **Performance**: Optimize queries, use caching, monitor resource usage
4. **Reliability**: ACID transactions, proper error handling, audit trails
5. **Code Quality**: Comprehensive testing, clear documentation, peer review

## Language and Framework Standards

- **TypeScript Strict Mode**: All code must compile with `strict: true`
- **NestJS Patterns**: Use dependency injection, guards, interceptors, pipes
- **Async/Await**: Prefer async/await over Promise chains
- **Error Handling**: Use NestJS exception filters and custom HttpException
- **Logging**: Use NestJS Logger service with structured logs

## Key References

Refer to the following specialized instruction files for specific areas:

- **Security & OWASP**: See [`security-and-owasp.instructions.md`](./instructions/security-and-owasp.instructions.md)
- **TypeScript Guidelines**: See [`typescript-5-es2022.instructions.md`](./instructions/typescript-5-es2022.instructions.md)
- **NestJS Patterns**: See [`nestjs.instructions.md`](./instructions/nestjs.instructions.md)
- **Testing Standards**: See [`nodejs-javascript-vitest.instructions.md`](./instructions/nodejs-javascript-vitest.instructions.md)
- **Docker Best Practices**: See [`containerization-docker-best-practices.instructions.md`](./instructions/containerization-docker-best-practices.instructions.md)
- **CI/CD**: See [`github-actions-ci-cd-best-practices.instructions.md`](./instructions/github-actions-ci-cd-best-practices.instructions.md)

## Code Organization

```
src/
├── index.ts                 # Application entry point
├── bot/                     # WhatsApp bot logic
│   ├── client/             # Bot client and connection
│   ├── handlers/           # Message and event handlers
│   ├── middleware/         # Authentication, session
│   └── ui/                 # Message templates, buttons
├── config/                 # Configuration and constants
├── lib/                    # Utility libraries and helpers
├── models/                 # Data models and types
├── services/               # Business logic services
│   ├── audit/             # Audit trail logging
│   ├── data/              # Data processing
│   ├── notification/      # Notification service
│   ├── recommendation/    # ML/recommendation logic
│   ├── report/            # Reporting engine
│   ├── scheduler/         # Job scheduling
│   ├── system/            # System utilities
│   ├── transaction/       # Transaction processing
│   └── user/              # User management, RBAC
```

## Development Workflow

1. **Feature Branch**: Create feature branch from main
2. **Type Check**: Run `npm run type-check` before commit
3. **Lint & Format**: Run `npm run lint:fix && npm run format`
4. **Unit Tests**: Write tests alongside code, maintain >80% coverage
5. **Integration Tests**: Test service interactions and database operations
6. **E2E Tests**: Test critical user workflows with Playwright
7. **Code Review**: All PRs require peer review with security focus
8. **Merge**: Squash and merge to main after approval

## Commit Standards

Use conventional commits:

- `feat(scope): description` - New feature
- `fix(scope): description` - Bug fix
- `refactor(scope): description` - Code refactoring
- `perf(scope): description` - Performance improvement
- `security(scope): description` - Security fix
- `test(scope): description` - Test additions
- `docs(scope): description` - Documentation

Example: `feat(rbac): add role-based transaction approval workflow`

## Performance Guidelines

- **Query Optimization**: Use Prisma select/where to limit data transfer
- **Caching**: Cache frequently accessed data in Redis with TTL
- **Connection Pooling**: Use Prisma connection pooling for database
- **Async Processing**: Use Bull or similar for background jobs
- **Monitoring**: Track response times, database queries, error rates

## Security Requirements

- **Never hardcode secrets**: Use environment variables and secret managers
- **Validate all inputs**: Use NestJS pipes and Prisma validators
- **SQL Injection Prevention**: Always use Prisma parameterized queries
- **Authentication**: Verify user identity for all sensitive operations
- **Authorization**: Check user role and permissions in guards
- **Audit Trail**: Log all financial transactions and state changes
- **Data Encryption**: Encrypt sensitive data at rest and in transit

## Database Standards

- **Migrations**: Use Prisma migrations for all schema changes
- **Transactions**: Wrap multi-step operations in database transactions
- **Indexes**: Index frequently queried columns
- **Constraints**: Use database constraints for data integrity
- **Timeouts**: Set appropriate query timeouts to prevent hangs
- **TimescaleDB**: Leverage hypertable features for time-series transaction data

## Testing Strategy

- **Unit Tests**: Test individual functions and services in isolation
- **Integration Tests**: Test service-to-service and service-to-database interactions
- **E2E Tests**: Test complete user workflows from WhatsApp API to database
- **Coverage Target**: Maintain >80% code coverage for critical paths
- **Fixtures**: Use reusable test fixtures for consistent data

## Documentation

- **README**: Clear setup and running instructions
- **API Docs**: Document all service methods and endpoints
- **Architecture**: Keep ADRs (Architecture Decision Records) updated
- **Inline Comments**: Explain why, not what - code should explain itself
- **Specs**: Reference specification files for feature requirements

## Environment Management

- **Development**: Local development with `.env.local`
- **Testing**: Isolated test database with test-specific data
- **Staging**: Production-like environment for integration testing
- **Production**: Secure, monitored, with proper backups

## Dependency Management

- **Node Version**: Lock to Node.js 20.x
- **Package Updates**: Review and test updates before merging
- **Security Audits**: Regular `npm audit` checks in CI/CD
- **Minimal Dependencies**: Avoid unnecessary packages

## When to Use Available Prompts

- **Setup Component**: Use `setup-component.prompt.md` for new service/module creation
- **Write Tests**: Use `write-tests.prompt.md` for test generation
- **Code Review**: Use `code-review.prompt.md` for peer review assistance
- **Refactor**: Use `refactor-code.prompt.md` for code improvements
- **Debug**: Use `debug-issue.prompt.md` for troubleshooting
- **Docs**: Use `generate-docs.prompt.md` for documentation

## When to Use Custom Chat Modes

- **Architecture**: Use `architect.agent.md` for design discussions
- **Security Review**: Use `security-focused-code-review.agent.md` for security analysis
- **Debugging**: Use `debug.agent.md` for complex issue diagnosis
- **Planning**: Use `plan-mode-strategic-planning.agent.md` for feature planning

## Questions or Improvements?

If you have questions about these standards or suggestions for improvement:

1. Create an issue describing the concern
2. Reference the relevant instruction file
3. Provide examples of the issue
4. Suggest improvements with rationale
