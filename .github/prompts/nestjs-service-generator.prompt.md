---
agent: "agent"
model: "Claude Sonnet 4"
tools: ["codebase", "githubRepo"]
description: "Generate a new NestJS service module with RBAC guards and proper error handling"
---

# NestJS Service Module Generator

You are a NestJS architecture expert. Your task is to generate a new service module following the project's standards for the WhatsApp Cashflow Bot.

## Project Context

- **Framework**: NestJS with Express
- **Database**: Prisma ORM with PostgreSQL
- **Architecture**: Service-oriented with guards and middleware
- **Type Safety**: TypeScript strict mode, ES2022
- **RBAC**: Role-based access control with four roles (dev, boss, employee, investor)

## Module Creation Steps

Ask the user for:

1. **Module Name**: (e.g., "Transaction Approval", "Report Generation")
2. **Module Purpose**: Brief description of functionality
3. **Data Model**: What data does it operate on (Prisma models)
4. **Required Roles**: Who can access this module (dev, boss, employee, investor)
5. **External Dependencies**: Other services it depends on

## Files to Generate

Based on the requirements, generate these files in the appropriate directories:

### 1. Service Implementation (`src/services/${moduleName}/${moduleName}.service.ts`)

Requirements:

- Implement business logic using Prisma for database
- Create method signatures with proper TypeScript types
- Include input validation using class-validator patterns
- Implement error handling with NestJS exceptions
- Log important operations for audit trail
- Handle database transactions for multi-step operations

### 2. DTOs (`src/services/${moduleName}/${moduleName}.dto.ts`)

Requirements:

- Define CreateDTO and UpdateDTO with validators
- Use @IsNotEmpty, @IsEnum, @Min, @Max decorators
- Include validation messages
- Define response DTOs with fields returned to client

### 3. Controller (`src/services/${moduleName}/${moduleName}.controller.ts`)

Requirements:

- Define HTTP endpoints (GET, POST, PUT, DELETE)
- Use @UseGuards decorator for role-based access
- Include @Param, @Body, @Query decorators
- Implement proper error handling
- Return response DTOs (never raw data)

### 4. Module (`src/services/${moduleName}/${moduleName}.module.ts`)

Requirements:

- Declare controller and service
- Import Prisma
- Register providers
- Set up dependency injection

### 5. Tests (`tests/unit/services/${moduleName}/${moduleName}.service.test.ts`)

Requirements:

- Test all public methods
- Mock Prisma calls
- Test error conditions
- Verify business logic
- Target >80% coverage

## Code Standards to Follow

- **Type Safety**: Always provide explicit types, no `any`
- **Error Handling**: Use HttpException with appropriate status codes
- **Logging**: Log operations, failures, and security events
- **Validation**: Validate all inputs with decorators or pipes
- **Security**: Include role checks in guards, never trust user input
- **Transactions**: Wrap multi-step operations in Prisma transactions
- **Naming**: Use clear, descriptive names following conventions (camelCase for functions, PascalCase for classes)
- **Documentation**: JSDoc comments for public methods explaining purpose, params, returns

## Example Structure

```typescript
// Service: business logic with database operations
@Injectable()
export class ApprovalService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger,
  ) {}

  async approveTransaction(id: string, userId: string) {
    // Check permission
    // Update transaction
    // Log action
    // Return updated transaction
  }
}

// Controller: HTTP endpoints with guards
@Controller("approvals")
@UseGuards(AuthGuard)
export class ApprovalController {
  constructor(private service: ApprovalService) {}

  @Post(":id/approve")
  @UseGuards(RoleGuard("boss"))
  async approve(@Param("id") id: string, @Req() req: any) {
    return this.service.approveTransaction(id, req.user.id);
  }
}

// DTO: input validation
export class ApproveTransactionDto {
  @IsNotEmpty()
  reason?: string;
}
```

## Generate the Complete Module

When ready, generate all 5 files with:

- Proper imports and dependencies
- Complete implementation (not just stubs)
- Proper error handling and logging
- Role-based guards for sensitive operations
- Unit tests with good coverage
- Inline documentation explaining complex logic

Then provide:

1. A summary of what was created
2. Instructions for integrating into the main app
3. How to add database migrations if needed
4. Security considerations for this module
