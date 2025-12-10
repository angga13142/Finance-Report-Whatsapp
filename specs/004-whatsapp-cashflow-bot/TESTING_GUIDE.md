# Jest Testing Guide for WhatsApp Cashflow Bot

## Overview

This project uses Jest as the primary testing framework with TypeScript support via ts-jest. Tests are organized by type (unit, integration, e2e) and mirror the source directory structure.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run specific test file
npm test -- validator.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="validateAmount"
```

## Test Structure

### Directory Organization

```
tests/
├── setup.ts                 # Global test configuration
├── unit/                    # Unit tests (isolated, fast)
│   ├── lib/
│   │   └── currency.test.ts
│   ├── models/
│   └── services/
│       └── transaction/
│           └── validator.test.ts
├── integration/            # Integration tests (with dependencies)
│   ├── database/
│   ├── redis/
│   └── wwebjs/
└── e2e/                   # End-to-end tests (full workflows)
    └── workflows/
```

### File Naming Conventions

- Unit tests: `*.test.ts` or `*.spec.ts`
- Place test files next to code they test OR in `tests/` directory
- Use descriptive names: `currency.test.ts`, `validator.test.ts`

## Writing Tests

### Basic Test Structure

```typescript
import { functionToTest } from "../src/myModule";

describe("MyModule", () => {
  describe("functionToTest", () => {
    it("should do something specific", () => {
      // Arrange
      const input = "test";

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe("expected");
    });
  });
});
```

### Test Organization Best Practices

1. **Use descriptive test names** - Explain what should happen

```typescript
// ❌ Bad
it("works", () => {});

// ✅ Good
it('should format 500000 to "Rp500.000"', () => {});
```

2. **Group related tests** with nested `describe` blocks

```typescript
describe("TransactionValidator", () => {
  describe("validateAmount", () => {
    it("should accept valid amounts", () => {});
    it("should reject negative amounts", () => {});
  });

  describe("validateCategory", () => {
    it("should accept active categories", () => {});
    it("should reject inactive categories", () => {});
  });
});
```

3. **Follow AAA pattern** - Arrange, Act, Assert

```typescript
it("should calculate total correctly", () => {
  // Arrange - Setup test data
  const transactions = [{ amount: 100 }, { amount: 200 }];

  // Act - Execute the function
  const total = calculateTotal(transactions);

  // Assert - Verify the result
  expect(total).toBe(300);
});
```

## Mocking

### Mocking Modules

```typescript
// Mock entire module
jest.mock("../../src/lib/logger");

// Mock specific functions
jest.mock("../../src/lib/currency", () => ({
  formatCurrency: jest.fn(),
  parseAmount: jest.fn(),
}));
```

### Mocking Function Implementations

```typescript
import { parseAmount } from "../../src/lib/currency";

// Mock return value
(parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));

// Mock implementation
(parseAmount as jest.Mock).mockImplementation((input: string) => {
  if (input === "invalid") throw new Error("Invalid");
  return new Decimal(input);
});

// Mock resolved value (for async)
(fetchData as jest.Mock).mockResolvedValue({ data: "test" });

// Mock rejected value (for async errors)
(fetchData as jest.Mock).mockRejectedValue(new Error("Failed"));
```

### Mocking Prisma Client

```typescript
// Mock Prisma model
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));
```

### Spying on Functions

```typescript
// Spy on function without changing implementation
const spy = jest.spyOn(myObject, "myMethod");

// Spy and mock implementation
const spy = jest.spyOn(myObject, "myMethod").mockImplementation(() => "mocked");

// Check if spy was called
expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledWith("arg1", "arg2");
expect(spy).toHaveBeenCalledTimes(2);
```

## Testing Async Code

### Using async/await

```typescript
it("should fetch data successfully", async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Using resolves/rejects

```typescript
it("should resolve with data", async () => {
  await expect(fetchData()).resolves.toEqual({ data: "test" });
});

it("should reject with error", async () => {
  await expect(fetchData()).rejects.toThrow("Error message");
});
```

### Testing Callbacks

```typescript
it("should call callback with result", (done) => {
  fetchDataWithCallback((result) => {
    expect(result).toBe("success");
    done();
  });
});
```

## Common Jest Matchers

### Equality

```typescript
expect(value).toBe(expected); // Exact equality (===)
expect(value).toEqual(expected); // Deep equality
expect(value).toStrictEqual(expected); // Strict deep equality
expect(value).not.toBe(other); // Negation
```

### Truthiness

```typescript
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
```

### Numbers

```typescript
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeLessThanOrEqual(5);
expect(value).toBeCloseTo(0.3, 5); // Floating point
```

### Strings

```typescript
expect(string).toMatch(/pattern/);
expect(string).toMatch("substring");
expect(string).toContain("substring");
```

### Arrays and Iterables

```typescript
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(array).toEqual(expect.arrayContaining([item1, item2]));
```

### Objects

```typescript
expect(object).toHaveProperty("key");
expect(object).toHaveProperty("key", value);
expect(object).toMatchObject({ key: value });
```

### Exceptions

```typescript
expect(() => throwError()).toThrow();
expect(() => throwError()).toThrow(Error);
expect(() => throwError()).toThrow("error message");
expect(() => throwError()).toThrow(/error/);
```

### Mock Functions

```typescript
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg1);
expect(mockFn).toHaveReturnedWith(value);
```

## Setup and Teardown

### Before/After Hooks

```typescript
describe("MyTest", () => {
  // Runs once before all tests in this describe block
  beforeAll(() => {
    // Setup shared resources
  });

  // Runs before each test
  beforeEach(() => {
    // Reset state, clear mocks
    jest.clearAllMocks();
  });

  // Runs after each test
  afterEach(() => {
    // Cleanup
  });

  // Runs once after all tests
  afterAll(() => {
    // Teardown shared resources
  });

  it("test 1", () => {});
  it("test 2", () => {});
});
```

### Global Setup (tests/setup.ts)

```typescript
// Automatically runs before all tests
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = "test";

// Global cleanup
afterEach(() => {
  jest.clearAllMocks();
});
```

## Best Practices

### 1. Keep Tests Independent

Each test should be able to run independently and in any order.

```typescript
// ❌ Bad - Tests depend on each other
let userId;
it("should create user", () => {
  userId = createUser();
});
it("should update user", () => {
  updateUser(userId); // Depends on previous test
});

// ✅ Good - Each test is independent
it("should create user", () => {
  const userId = createUser();
  expect(userId).toBeDefined();
});
it("should update user", () => {
  const userId = createUser();
  updateUser(userId);
  expect(getUser(userId).updated).toBe(true);
});
```

### 2. Test One Thing Per Test

```typescript
// ❌ Bad - Testing multiple things
it("should validate and save transaction", () => {
  const isValid = validate(transaction);
  const saved = save(transaction);
  expect(isValid).toBe(true);
  expect(saved).toBe(true);
});

// ✅ Good - Separate tests
it("should validate transaction", () => {
  const isValid = validate(transaction);
  expect(isValid).toBe(true);
});

it("should save valid transaction", () => {
  const saved = save(validTransaction);
  expect(saved).toBe(true);
});
```

### 3. Use Test Utilities

```typescript
import { testUtils } from "./setup";

it("should create transaction with random data", () => {
  const transaction = testUtils.createMockTransaction({
    amount: testUtils.randomNumber(1000, 10000),
  });

  expect(transaction.amount).toBeGreaterThan(1000);
});
```

### 4. Mock External Dependencies

```typescript
// ✅ Good - Mock external services
jest.mock("../../src/services/notification");

it("should not call real notification service", async () => {
  await sendNotification("test");
  // Mock ensures no actual API call is made
});
```

### 5. Test Edge Cases

```typescript
describe("parseAmount", () => {
  it("should handle normal amounts", () => {});
  it("should handle zero", () => {});
  it("should handle negative numbers", () => {});
  it("should handle very large numbers", () => {});
  it("should handle decimal points", () => {});
  it("should throw on invalid input", () => {});
});
```

### 6. Avoid Testing Implementation Details

```typescript
// ❌ Bad - Testing internal implementation
it("should call helper function", () => {
  const spy = jest.spyOn(internal, "helperFunction");
  myFunction();
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - Testing behavior/output
it("should return formatted result", () => {
  const result = myFunction();
  expect(result).toBe("expected output");
});
```

## Code Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

- Branches: 70%
- Functions: 70%
- Lines: 80%
- Statements: 80%

### What to Cover

✅ **Do cover:**

- Business logic
- Validation functions
- Data transformations
- Error handling
- Edge cases

❌ **Don't worry about:**

- Simple getters/setters
- Type definitions
- Configuration files
- Third-party code

## Debugging Tests

### Run Specific Tests

```bash
# Run single file
npm test currency.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="validateAmount"

# Run only failed tests
npm test -- --onlyFailures
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Use `.only` for Focused Testing

```typescript
// Run only this test
it.only("should test this specific case", () => {});

// Run only this describe block
describe.only("MyModule", () => {});
```

⚠️ **Remember to remove `.only` before committing!**

### Use `.skip` to Temporarily Disable

```typescript
// Skip this test
it.skip("not ready yet", () => {});

// Skip this describe block
describe.skip("WIP", () => {});
```

## Examples

### Testing a Service with Dependencies

```typescript
import { TransactionService } from "../../src/services/transaction";
import { prisma } from "../../src/lib/prisma";
import { logger } from "../../src/lib/logger";

jest.mock("../../src/lib/prisma");
jest.mock("../../src/lib/logger");

describe("TransactionService", () => {
  let service: TransactionService;

  beforeEach(() => {
    service = new TransactionService();
    jest.clearAllMocks();
  });

  describe("createTransaction", () => {
    it("should create transaction in database", async () => {
      const mockTransaction = {
        id: "1",
        amount: 50000,
        type: "expense",
      };

      (prisma.transaction.create as jest.Mock).mockResolvedValue(
        mockTransaction,
      );

      const result = await service.createTransaction({
        amount: 50000,
        type: "expense",
      });

      expect(result).toEqual(mockTransaction);
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 50000,
          type: "expense",
        }),
      });
    });

    it("should log errors when creation fails", async () => {
      (prisma.transaction.create as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.createTransaction({ amount: 50000, type: "expense" }),
      ).rejects.toThrow("DB Error");

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript with Jest](https://kulshekhar.github.io/ts-jest/)
- [Mock Functions Guide](https://jestjs.io/docs/mock-functions)

## Troubleshooting

### Tests Timing Out

Increase timeout in `jest.config.js` or per test:

```typescript
jest.setTimeout(30000); // 30 seconds

it("long running test", async () => {
  // test code
}, 30000);
```

### Mocks Not Working

Clear mocks between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks(); // Clear call history
  jest.resetAllMocks(); // Reset implementations
  jest.restoreAllMocks(); // Restore original
});
```

### TypeScript Errors

Ensure types are imported correctly:

```typescript
import { jest } from "@jest/globals";
import type { Mock } from "jest-mock";

const mockFn = parseAmount as jest.Mock;
```

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this guide if introducing new patterns

---

Last Updated: December 10, 2025
