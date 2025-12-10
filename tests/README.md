# Tests Directory

This directory contains all automated tests for the WhatsApp Cashflow Bot project.

## Directory Structure

```
tests/
├── setup.ts                    # Global Jest configuration and test utilities
├── unit/                       # Unit tests (fast, isolated)
│   ├── lib/                   # Tests for utility libraries
│   │   └── currency.test.ts
│   ├── models/                # Tests for data models
│   │   └── __examples__/      # Example test patterns
│   └── services/              # Tests for business logic services
│       └── transaction/
│           └── validator.test.ts
├── integration/               # Integration tests (with dependencies)
│   ├── database/             # Database integration tests
│   ├── redis/                # Redis cache tests
│   ├── scheduler/            # Cron job tests
│   └── wwebjs/               # WhatsApp client tests
└── e2e/                      # End-to-end tests
    ├── roles/                # Role-based access tests
    ├── user-stories/         # User story validation
    └── workflows/            # Complete user workflows
```

## Running Tests

### All Tests

```bash
npm test
```

### By Test Type

```bash
# Unit tests only (fast, no external dependencies)
npm run test:unit

# Integration tests (with database, Redis, etc.)
npm run test:integration

# End-to-end tests (full application workflows)
npm run test:e2e
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Specific Tests

```bash
# Run specific file
npm test currency.test.ts

# Run tests matching a name pattern
npm test -- --testNamePattern="validateAmount"

# Run only failed tests
npm test -- --onlyFailures
```

## Test Types

### Unit Tests (`tests/unit/`)

**Purpose:** Test individual functions, classes, or modules in isolation.

**Characteristics:**

- Fast execution (< 1 second per test)
- No external dependencies (mocked)
- Test single responsibility
- High code coverage target (>80%)

**Example:**

```typescript
describe("formatCurrency", () => {
  it('should format 50000 to "Rp50.000"', () => {
    const result = formatCurrency(50000);
    expect(result).toBe("Rp50.000");
  });
});
```

**When to use:**

- Testing utility functions
- Testing business logic
- Testing data transformations
- Testing validation rules

### Integration Tests (`tests/integration/`)

**Purpose:** Test how multiple components work together.

**Characteristics:**

- Slower than unit tests (1-5 seconds per test)
- Use real dependencies (database, Redis)
- Test component interactions
- Validate integration points

**Example:**

```typescript
describe("TransactionService with Database", () => {
  it("should create and retrieve transaction", async () => {
    const created = await transactionService.create(data);
    const retrieved = await transactionService.findById(created.id);
    expect(retrieved).toEqual(created);
  });
});
```

**When to use:**

- Testing database operations
- Testing cache interactions
- Testing service-to-service communication
- Testing API endpoints

### End-to-End Tests (`tests/e2e/`)

**Purpose:** Test complete user workflows from start to finish.

**Characteristics:**

- Slowest tests (5-30 seconds per test)
- Use entire system
- Simulate real user behavior
- Test critical paths

**Example:**

```typescript
describe("User Transaction Workflow", () => {
  it("should complete full transaction flow", async () => {
    await user.sendMessage("add expense");
    await user.selectCategory("Food");
    await user.enterAmount("50000");
    await user.confirmTransaction();
    expect(await getLastTransaction()).toBeDefined();
  });
});
```

**When to use:**

- Testing user stories
- Testing role-based access
- Testing complete workflows
- Testing critical business scenarios

## Test Files

### `setup.ts`

Global configuration for all tests:

- Environment variables setup
- Mock console methods
- Test utilities and helpers
- Automatic mock cleanup

**Available utilities:**

```typescript
import { testUtils } from "./setup";

// Generate random test data
testUtils.randomString();
testUtils.randomNumber(min, max);

// Create mock objects
testUtils.createMockUser(overrides);
testUtils.createMockTransaction(overrides);

// Wait for async operations
await testUtils.wait(1000);
```

### Example Tests

- `tests/unit/lib/currency.test.ts` - Comprehensive currency utility tests
- `tests/unit/services/transaction/validator.test.ts` - Service validation with mocking
- `tests/unit/models/__examples__/user-model-example.test.ts` - Model testing patterns

## Writing Tests

### Test Structure

Follow the **Arrange-Act-Assert (AAA)** pattern:

```typescript
it("should do something", () => {
  // Arrange - Set up test data
  const input = "test";

  // Act - Execute the function
  const result = functionUnderTest(input);

  // Assert - Verify the result
  expect(result).toBe("expected");
});
```

### Naming Conventions

✅ **Good test names:**

```typescript
it('should format 50000 to "Rp50.000"', () => {});
it("should reject amounts below minimum", () => {});
it("should handle database connection errors", () => {});
```

❌ **Bad test names:**

```typescript
it("works", () => {});
it("test1", () => {});
it("should work correctly", () => {});
```

### Organizing Tests

Use nested `describe` blocks:

```typescript
describe("TransactionValidator", () => {
  describe("validateAmount", () => {
    it("should accept valid amounts", () => {});
    it("should reject negative amounts", () => {});
  });

  describe("validateCategory", () => {
    it("should accept active categories", () => {});
  });
});
```

## Mocking

### Mock External Modules

```typescript
jest.mock("../../src/lib/logger");
jest.mock("../../src/models/category");
```

### Mock Function Implementations

```typescript
(mockFunction as jest.Mock).mockReturnValue(value);
(mockFunction as jest.Mock).mockResolvedValue(value);
(mockFunction as jest.Mock).mockRejectedValue(error);
```

### Clear Mocks

```typescript
beforeEach(() => {
  jest.clearAllMocks(); // Clear call history
  jest.resetMocks(); // Reset implementations
});
```

## Code Coverage

### Current Thresholds

- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 80%
- **Statements:** 80%

### View Coverage Report

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### What to Cover

✅ **High priority:**

- Business logic
- Validation functions
- Data transformations
- Error handling
- Security-critical code

❌ **Low priority:**

- Simple getters/setters
- Type definitions
- Configuration files
- Third-party code

## Best Practices

1. **Keep tests independent** - Each test should run in isolation
2. **Test one thing** - Each test should verify a single behavior
3. **Use descriptive names** - Test name should explain what it tests
4. **Mock external dependencies** - Don't call real APIs or databases in unit tests
5. **Test edge cases** - Zero, negative, null, undefined, very large numbers
6. **Clean up after tests** - Use `afterEach` hooks
7. **Don't test implementation details** - Test behavior, not internal logic
8. **Use AAA pattern** - Arrange, Act, Assert

## Common Issues

### Tests Timing Out

Increase timeout:

```typescript
jest.setTimeout(30000);
```

### Mocks Not Working

Ensure mocks are cleared:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### TypeScript Errors

Import types correctly:

```typescript
import { jest } from "@jest/globals";
const mockFn = myFunction as jest.Mock;
```

### Async Issues

Use async/await properly:

```typescript
it("should handle async", async () => {
  await expect(asyncFn()).resolves.toBe(value);
});
```

## Continuous Integration

Tests run automatically on:

- Every commit (pre-commit hook)
- Every push (pre-push hook)
- Every pull request (GitHub Actions)

### Pre-commit Checks

- Format staged files
- Lint staged files
- Type check staged TypeScript files

### Pre-push Checks

- Run preflight checks
- Full type check
- Full lint
- Run unit tests

## Documentation

For detailed testing guide, see:

- [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) - Comprehensive testing documentation
- [Jest Configuration](../jest.config.js) - Jest setup
- [JavaScript/TypeScript Jest Prompt](.github/prompts/javascript-typescript-jest.prompt.md) - Testing standards

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript Jest Guide](https://kulshekhar.github.io/ts-jest/)

---

**Last Updated:** December 10, 2025
