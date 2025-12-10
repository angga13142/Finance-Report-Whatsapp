---
applyTo: "**/*.ts,**/*.tsx"
description: "TypeScript, Node.js 20 LTS, and NestJS development standards"
---

<!-- Based on: https://github.com/github/awesome-copilot/blob/main/instructions/typescript-5-es2022.instructions.md -->
<!-- Based on: https://github.com/github/awesome-copilot/blob/main/instructions/nestjs.instructions.md -->
<!-- Based on: https://github.com/github/awesome-copilot/blob/main/instructions/nodejs-javascript-vitest.instructions.md -->

# TypeScript, Node.js 20, and NestJS Development Standards

## TypeScript Configuration

- **Target**: ES2022 with strict type checking
- **Module System**: CommonJS for Node.js compatibility
- **Strict Mode**: All strict flags enabled (noImplicitAny, strictNullChecks, etc.)
- **Declaration Files**: Generate .d.ts files for library code
- **Source Maps**: Enable for debugging production code

## TypeScript Best Practices

### Type Definitions

- Use explicit type annotations for all function parameters and return types
- Prefer interfaces for object shapes and contracts
- Use type aliases for union types and complex types
- Avoid `any` type - use `unknown` if type is uncertain then narrow with type guards
- Create shared types file for models used across services

### Functional Programming Patterns

- Prefer const and readonly for immutable data structures
- Use destructuring for cleaner code
- Use optional chaining (?.) and nullish coalescing (??) operators
- Avoid direct mutations - return new objects instead
- Use array methods (map, filter, reduce) over imperative loops

### Asynchronous Programming

- Use async/await over Promise chains for readability
- Handle errors with try/catch blocks in async functions
- Use Promise.all() for parallel operations
- Avoid nested promises or deeply nested callbacks
- Set appropriate timeouts on long-running operations

## NestJS Architecture

### Core Patterns

- **Modules**: Organize related controllers, services, and providers
- **Controllers**: Handle HTTP requests and delegate to services
- **Services**: Implement business logic and data operations
- **Guards**: Enforce authentication and authorization
- **Interceptors**: Handle cross-cutting concerns (logging, timing)
- **Pipes**: Transform and validate request data
- **Filters**: Handle exceptions and error responses
- **Middleware**: Process request/response lifecycle

### Dependency Injection

- Declare dependencies in constructor parameters
- Use @Injectable() decorator on services
- Register providers in module declaration
- Leverage circular dependency resolution when needed
- Use @Optional() for optional dependencies

### Error Handling

- Use NestJS HttpException and specific exception classes
- Create custom exception filters for consistent error responses
- Log all errors with sufficient context
- Return meaningful error messages (never internal implementation details)
- Use proper HTTP status codes (400, 401, 403, 404, 500, etc.)

## Node.js 20 LTS Specifics

- Use native Node.js capabilities (crypto, streams, etc.)
- Leverage ES2022+ features (top-level await, optional chaining, etc.)
- Use built-in modules before third-party alternatives
- Handle process signals (SIGTERM, SIGINT) for graceful shutdown
- Monitor memory and CPU usage in production

## Code Style

### Naming Conventions

- **Classes & Interfaces**: PascalCase (UserService, ITransaction)
- **Functions & Variables**: camelCase (getUserById, transactionId)
- **Constants**: UPPER_SNAKE_CASE (MAX_RETRIES, DATABASE_TIMEOUT)
- **Private Members**: camelCase with underscore prefix (\_internalMethod)
- **File Names**: kebab-case for classes (user.service.ts), lower case for utilities

### Code Organization

- Keep functions focused and under 30 lines
- Extract complex logic into separate functions
- Group related functionality in classes
- Use meaningful variable names that indicate purpose
- Comment why, not what - code should explain itself

## Prisma ORM Standards

- Use Prisma for all database access (never raw SQL except migrations)
- Select only required fields to minimize data transfer
- Use where clauses to filter at database level
- Wrap multi-operation transactions in transaction blocks
- Keep database connections pooled and reused
- Use Prisma middleware for logging and performance monitoring

## Testing Standards

- **Unit Tests**: Test individual functions with mocked dependencies
- **Integration Tests**: Test services with database interactions
- **E2E Tests**: Test API endpoints and critical workflows
- **Test Structure**: Arrange-Act-Assert pattern
- **Fixtures**: Use factories and seed data for consistent tests
- **Mocking**: Mock external services and database for unit tests
- **Coverage**: Maintain >80% coverage for critical paths

## Common Patterns for Financial Applications

- **Transaction Isolation**: Use database transactions for multi-step operations
- **Audit Trail**: Log all state changes and financial operations
- **Approval Workflow**: Implement authorization checks at multiple levels
- **Rate Limiting**: Prevent abuse with request rate limiting
- **Validation**: Validate all input before processing
- **Idempotency**: Handle duplicate requests safely
- **Compensation**: Implement rollback for failed operations

## Performance Considerations

- Minimize database queries per request
- Cache frequently accessed data (users, roles, settings)
- Use pagination for large result sets
- Index frequently queried database columns
- Profile code for bottlenecks in development
- Monitor production metrics and set alerts
- Use connection pooling for databases and external services

## Security Practices

- Never log sensitive data (passwords, tokens, API keys)
- Validate and sanitize all inputs
- Use type checking to prevent runtime errors
- Implement role-based access control (RBAC)
- Use environment variables for configuration
- Enable CORS selectively
- Set security headers (helmet.js)
- Use HTTPS in production

## Git and Version Control

- Use feature branches with descriptive names
- Write clear commit messages following conventional commits
- Keep commits atomic and logically grouped
- Create meaningful pull request descriptions
- Require code reviews before merging
- Use squash and merge for cleaner history
