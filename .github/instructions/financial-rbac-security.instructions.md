---
applyTo: "src/services/user/**/*,src/services/transaction/**/*,src/middleware/**/*"
description: "Financial application security, RBAC, and transaction processing standards"
---

# Financial RBAC and Security Standards

## Role-Based Access Control (RBAC)

### User Roles

Four distinct roles defined in the system:

- **dev**: Developer access, full system visibility, debugging capabilities
- **boss**: Business owner, full financial visibility, approval authority
- **employee**: Regular user, limited transaction creation and viewing
- **investor**: Read-only access, investment portfolio visibility

### Access Control Patterns

- Always check user role before sensitive operations
- Use NestJS Guards to enforce authorization
- Implement fine-grained permissions beyond roles
- Log all authorization failures for audit trail
- Never trust user input for role/permission

### Guard Implementation

```typescript
// Use @UseGuards decorator on controllers
@UseGuards(AuthGuard, RoleGuard)
@Post('transactions/approve')
async approveTransaction() { }

// Create custom guards for specific permissions
@UseGuards(ApprovalGuard)
@Post('transactions/:id/approve')
async approveTransaction(@Param('id') id: string) { }
```

## Transaction Security

### Transaction Types

- **Income**: Money received
- **Expense**: Money spent
- Both require proper authorization and audit trail

### Approval Workflow

- Pending transactions require approval by authorized roles
- Approval status tracked: approved, pending, rejected
- Each status change is logged with timestamp and approver
- Reversals/corrections documented with reason
- No direct modification of transaction status

### Transaction Isolation

- Wrap multi-step operations in database transactions
- Ensure atomicity: all or nothing execution
- Use Prisma transaction blocks
- Verify balance before execution
- Handle concurrent modifications

## Financial Data Protection

### Data Classification

- **Public**: Role hierarchy, transaction types
- **Internal**: Employee names, transaction summaries
- **Confidential**: Amounts, personal info, approval decisions
- **Secret**: Credentials, API keys, encryption keys

### Encryption

- Encrypt sensitive fields at rest (Prisma middleware)
- Use HTTPS for all API communication
- Never log plaintext sensitive data
- Rotate encryption keys periodically
- Use industry-standard algorithms (AES-256)

### Access Logging

- Log all data access with user, timestamp, action
- Maintain immutable audit trail
- Include request/response summary
- Flag suspicious access patterns
- Retain logs for compliance period

## Input Validation

### All Inputs Must Be Validated

- Transaction amounts: positive, within limits
- User IDs: valid format, authorization check
- Dates: valid ranges, logical ordering
- Strings: length limits, character validation
- Enums: valid values only

### Validation Approach

- Use NestJS Pipes for automatic validation
- Use class-validator for declarative validation
- Validate at API boundary (pipes)
- Validate in service layer for internal calls
- Sanitize all inputs before processing

### Common Validations

```typescript
// Amount validation
export class CreateTransactionDto {
  @IsNumber()
  @Min(0.01)
  @Max(1000000)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  date: string;
}
```

## Authentication & Authorization

### Authentication

- Use bearer token authentication
- Verify token validity and expiration
- Include user context in request
- Log authentication attempts
- Implement token refresh mechanism

### Authorization

- Always verify user has permission
- Check both role and specific permissions
- Deny by default, allow explicitly
- Verify resource ownership (user can only see own transactions)
- Check approval authority for approvals

### Guard Pattern

```typescript
// Authentication guard verifies token and user
@UseGuards(AuthGuard)

// Role guard verifies user role
@UseGuards(RoleGuard('boss', 'admin'))

// Custom guard for specific logic
@UseGuards(ApprovalGuard)
```

## Error Handling

### Security-Conscious Error Messages

- Don't reveal system implementation details
- Don't indicate which resources exist/don't exist
- Use generic messages for permission errors
- Log detailed errors internally only
- Return appropriate HTTP status codes

### Error Logging

```typescript
// Log detailed error internally
this.logger.error("Transaction approval failed", {
  userId: req.user.id,
  transactionId: id,
  reason: error.message,
  stack: error.stack,
});

// Return generic error to user
throw new BadRequestException("Transaction cannot be approved");
```

## Audit Trail

### What to Log

- User authentication (login, logout)
- Authorization failures
- Transaction creation, modification, approval
- Role/permission changes
- System configuration changes
- Error events

### Log Format

- Timestamp (ISO 8601)
- User ID and role
- Action performed
- Resource affected
- Result (success/failure)
- Context (request ID, session ID)

### Retention

- Keep logs for minimum 7 years (financial compliance)
- Archive old logs to secure storage
- Encrypt archived logs
- Make logs searchable
- Alert on suspicious patterns

## Database Security

### Constraints

- Use database constraints for data integrity
- Foreign key constraints for relationships
- Unique constraints for identifiers
- Check constraints for valid ranges
- Default values for important fields

### Transactions

- Use BEGIN/COMMIT/ROLLBACK
- Lock rows when necessary
- Prevent dirty reads, phantom reads
- Set appropriate isolation levels
- Handle deadlocks gracefully

### Performance & Security

- Index frequently queried columns
- Avoid full table scans
- Use prepared statements (Prisma default)
- Set query timeouts
- Monitor slow queries

## Secret Management

### Never in Code

- API keys, database passwords, encryption keys
- Use environment variables
- Use secret management services
- Rotate secrets regularly
- Audit secret access

### Environment Configuration

```bash
# .env (never commit)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
API_KEY=...
ENCRYPTION_KEY=...
```

## Compliance

### Financial Regulations

- GDPR: Data privacy and right to be forgotten
- PCI DSS: Payment card industry standards if processing cards
- SOX: Financial reporting accuracy and controls
- Local regulations: Depend on jurisdiction

### Required Controls

- Data retention policies
- Access control policies
- Incident response procedures
- Business continuity plans
- Regular security audits

## Security Testing

- Penetration testing for OWASP vulnerabilities
- Authorization bypass attempts
- SQL injection testing
- Input validation testing
- Rate limit testing
- Error handling verification
