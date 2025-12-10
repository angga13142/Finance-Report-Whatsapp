---
applyTo: "prisma/**/*,src/services/**/*,src/models/**/*"
description: "PostgreSQL and Prisma optimization for financial transactions with TimescaleDB"
---

# PostgreSQL & Prisma Performance Standards

## Database Design

### Schema Organization

- Use normalized tables for data integrity
- Create appropriate indexes for queries
- Use foreign keys for referential integrity
- Partition large tables if needed (TimescaleDB hypertables for time-series)
- Use constraints to enforce business rules

### Column Selection

- Choose appropriate data types (INT, BIGINT, DECIMAL, UUID)
- Use DECIMAL for monetary values (never FLOAT)
- Use TIMESTAMP for audit fields
- Use UUID for distributed identifiers
- Use ENUM types for fixed sets (transaction types, roles)

## Prisma ORM Best Practices

### Query Optimization

- Select only required fields with `select`
- Use `where` clauses to filter at database level
- Use `orderBy` with indexes
- Use `take` and `skip` for pagination
- Use `include` judiciously (can cause N+1 problems)

### Query Examples

```typescript
// ❌ Bad: Fetch all fields, no filtering
const users = await prisma.user.findMany();

// ✅ Good: Select only required fields, apply filters
const users = await prisma.user.findMany({
  where: { role: "employee", active: true },
  select: { id: true, name: true, email: true },
  orderBy: { createdAt: "desc" },
  take: 10,
  skip: 0,
});
```

### Relationships

- Use select to avoid loading unnecessary related data
- Use `include` only when needed
- Consider query performance with relations
- Use explicit joins in complex queries
- Batch related data loading

### Transactions

```typescript
// Wrap operations in transaction
await prisma.$transaction(async (tx) => {
  // All operations use tx instead of prisma
  const transaction = await tx.transaction.create({ data: {...} });
  await tx.balance.update({ ... });
  // Atomicity guaranteed: all succeed or all fail
});
```

## Indexing Strategy

### Indexes for Queries

- Index columns used in WHERE clauses
- Index columns used in ORDER BY
- Index foreign keys for joins
- Consider composite indexes for common filter combinations
- Avoid too many indexes (slows writes)

### Common Indexes

```prisma
model Transaction {
  id          String   @id @default(cuid())
  userId      String
  type        String
  status      String
  createdAt   DateTime @default(now())

  // Indexes for common queries
  @@index([userId, createdAt(sort: Desc)])
  @@index([status, createdAt])
  @@index([userId, status])
}
```

## Performance Monitoring

### Query Performance

- Use `EXPLAIN ANALYZE` for slow queries
- Monitor query execution plans
- Look for sequential scans (should be index scans)
- Monitor index bloat
- Regular VACUUM and ANALYZE

### Metrics to Track

- Query execution time (P50, P95, P99)
- Connection count and idle connections
- Cache hit ratio
- Table and index sizes
- Lock contention

### Prisma Logging

```typescript
// Enable Prisma logging for debugging
const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});
```

## Connection Pooling

### Configuration

- Use PgBouncer or similar for connection pooling
- Set appropriate pool size (2-4 per CPU core)
- Configure idle timeout
- Use single connection per request
- Implement connection retry logic

### Environment

```env
DATABASE_URL=postgresql://user:password@host:5432/db?schema=public
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Pagination

### Efficient Pagination

```typescript
// ✅ Good: Offset-based for UI
const page = 1;
const pageSize = 20;
const results = await prisma.transaction.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: "desc" },
});

// ✅ Better: Cursor-based for large datasets
const results = await prisma.transaction.findMany({
  take: 20,
  skip: 0,
  cursor: { id: lastId },
  orderBy: { createdAt: "desc" },
});
```

## Aggregation Queries

### Efficient Aggregation

```typescript
// Use aggregation at database level
const summary = await prisma.transaction.aggregate({
  where: { userId: userId, date: { gte: startDate } },
  _sum: { amount: true },
  _count: true,
  _avg: { amount: true },
});
```

## TimescaleDB for Time-Series

### Hypertable Benefits

- Automatic partitioning by time
- Faster queries on time ranges
- Better compression for storage
- Continuous aggregates for summaries

### Time-Series Queries

```typescript
// Query with time ranges (efficient with hypertables)
const dailySummary = await prisma.transaction.groupBy({
  by: [{ date: "day" }],
  where: {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  },
  _sum: { amount: true },
  _count: true,
});
```

## Caching Strategy

### What to Cache

- User roles and permissions (60 sec TTL)
- Transaction summaries (5 min TTL)
- Configuration/settings (15 min TTL)
- Report data (depends on frequency)
- Don't cache: frequently changing balances

### Cache Invalidation

- Invalidate on write operations
- Use TTL for automatic expiration
- Implement cache warming for critical data
- Log cache hits/misses for monitoring

## Bulk Operations

### Batch Inserts

```typescript
// ✅ Good: Batch insert
await prisma.transaction.createMany({
  data: [
    { userId: "1", amount: 100 },
    { userId: "2", amount: 200 },
    // ... more transactions
  ],
});
```

### Bulk Updates

```typescript
// ✅ Good: Batch update
await prisma.transaction.updateMany({
  where: { status: "pending" },
  data: { status: "approved" },
});
```

## Migration Best Practices

- Test migrations on production-like database first
- Use transactions for data migrations
- Write down and rollback procedures
- Schedule migrations during low-traffic windows
- Monitor after migration for performance changes
- Keep migrations in version control

## Common Performance Issues

### N+1 Problem

```typescript
// ❌ Bad: N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  user.transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
  });
}

// ✅ Good: Single query with include
const users = await prisma.user.findMany({
  include: { transactions: true },
});
```

### Missing Indexes

- Monitor EXPLAIN output for sequential scans
- Add indexes to heavily filtered columns
- Regular index analysis and maintenance

### Connection Issues

- Monitor connection count
- Implement connection pooling
- Set appropriate timeouts
- Handle connection errors gracefully
