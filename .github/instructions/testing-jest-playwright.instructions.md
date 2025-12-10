---
applyTo: "**/*.test.ts,**/*.spec.ts,**/*.e2e.ts,tests/**/*"
description: "Jest unit/integration and Playwright e2e testing standards"
---

<!-- Based on: https://github.com/github/awesome-copilot/blob/main/instructions/nodejs-javascript-vitest.instructions.md -->
<!-- Based on: https://github.com/github/awesome-copilot/blob/main/prompts/javascript-typescript-jest.prompt.md -->

# Testing Standards - Jest and Playwright

## Test Organization

### Directory Structure

```
tests/
├── unit/                    # Unit tests with mocked dependencies
│   ├── lib/                 # Utility and library tests
│   ├── models/              # Model and type tests
│   └── services/            # Service business logic tests
├── integration/             # Database and service integration tests
│   ├── database/           # Database schema and queries
│   ├── redis/              # Cache and session tests
│   ├── scheduler/          # Job scheduler tests
│   ├── system/             # System integration tests
│   └── wwebjs/             # WhatsApp client tests
└── e2e/                     # End-to-end workflow tests
    ├── roles/              # Role-based workflows
    ├── success-criteria/   # Feature validation
    ├── user-stories/       # User story workflows
    └── workflows/          # Complete bot workflows
```

### File Naming

- Unit tests: `${file}.test.ts` or `${file}.spec.ts`
- Integration tests: `${file}.integration.ts`
- E2E tests: `${file}.e2e.ts`
- Test utilities: `${folder}/fixtures/`, `${folder}/helpers/`

## Jest Best Practices

### Test Structure (Arrange-Act-Assert)

```typescript
describe("UserService", () => {
  describe("getUserById", () => {
    it("should return user when user exists", async () => {
      // Arrange: Set up test data and mocks
      const userId = "user-123";
      const expectedUser = { id: userId, name: "John" };

      // Act: Call the function being tested
      const result = await userService.getUserById(userId);

      // Assert: Verify the result
      expect(result).toEqual(expectedUser);
    });
  });
});
```

### Mocking Dependencies

- Mock external services and databases
- Use `jest.mock()` for module mocking
- Use `jest.spyOn()` for tracking calls
- Reset mocks between tests with `jest.clearAllMocks()`
- Verify mock calls with `toHaveBeenCalledWith()`

### Test Coverage

- Target >80% coverage for critical paths
- Focus on business logic coverage first
- Don't chase 100% coverage on trivial code
- Measure with `npm run test:coverage`
- Review coverage reports for gaps

### Test Isolation

- Each test must be independent
- Use `beforeEach()` and `afterEach()` for setup/teardown
- Clean up resources (database, timers, mocks)
- Use unique identifiers to prevent test pollution
- Avoid test interdependencies

## Unit Testing Patterns

### Service Testing

- Mock database/ORM calls
- Mock external service calls
- Test error conditions
- Verify business logic
- Test input validation

### Controller Testing

- Mock services
- Test endpoint routing
- Verify response status codes
- Check response payload structure
- Test authorization/authentication

### Pipe/Guard Testing

- Test validation logic
- Test transformation logic
- Verify error handling
- Test edge cases

## Integration Testing

### Database Testing

- Use test database separate from development
- Use Prisma for consistent ORM interface
- Test queries with actual data structures
- Verify transaction behavior
- Test constraints and relationships

### Service Integration

- Test services with real dependencies
- Use fixtures for consistent data
- Test error scenarios
- Verify state changes
- Check side effects

## Playwright E2E Testing

### Test Structure

```typescript
import { test, expect } from "@playwright/test";

test.describe("User Story: Transaction Approval", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto("http://localhost:3000");
    // Login if needed
    await login(page);
  });

  test("should approve transaction as manager", async ({ page }) => {
    // Navigate to transaction list
    await page.getByRole("link", { name: /transactions/i }).click();

    // Find pending transaction
    const transaction = page.getByRole("row", { name: /pending.*500/i });

    // Click approve button
    await transaction.getByRole("button", { name: /approve/i }).click();

    // Verify success message
    await expect(page.getByText(/approved/i)).toBeVisible();
  });
});
```

### Best Practices

- Use role-based locators (getByRole, getByLabel, getByText)
- Avoid brittle selectors (CSS ids, overly specific paths)
- Wait for visibility instead of hard waits
- Test user workflows, not implementation details
- Group related tests in describe blocks

### Test Scenarios

- Success paths: Happy path user workflows
- Error paths: Invalid input, permission denied
- Edge cases: Boundary conditions, special values
- Performance: Response times under load
- Accessibility: Keyboard navigation, screen reader

## Coverage Goals

- **Critical Business Logic**: >90%
- **Services**: >80%
- **Controllers**: >70%
- **Utilities**: >60%
- **Overall**: >80%

## Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode
npm test -- --watch
```

## Continuous Integration

- Run all tests on pull requests
- Fail CI if coverage drops
- Generate coverage reports
- Archive test results
- Run e2e tests before production deployment
