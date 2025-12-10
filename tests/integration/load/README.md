# Load Testing for WhatsApp Cashflow Bot

This directory contains load testing scenarios to validate system performance under concurrent user load.

## Test Scenarios

### 1. Concurrent Transaction Entry (50 Users)

**File**: `concurrent-transactions.k6.js`
**Goal**: Validate 50 concurrent users can enter transactions simultaneously without conflicts
**Duration**: 5 minutes
**Expected**: All transactions saved correctly, <2s response time

### 2. Button Debouncing Test

**File**: `button-debounce.k6.js`
**Goal**: Validate button debouncing prevents duplicate submissions
**Duration**: 2 minutes
**Expected**: Duplicate clicks within 3 seconds are ignored

### 3. Rate Limiting Test

**File**: `rate-limiting.k6.js`
**Goal**: Validate rate limiting prevents WhatsApp throttling
**Duration**: 3 minutes
**Expected**: No more than 15-20 messages per minute per chat

### 4. Database Connection Pool Test

**File**: `db-connection-pool.k6.js`
**Goal**: Validate connection pool handles 50 concurrent writes
**Duration**: 5 minutes
**Expected**: No connection timeouts, ACID integrity maintained

### 5. Session Isolation Test

**File**: `session-isolation.k6.js`
**Goal**: Validate concurrent users have isolated sessions
**Duration**: 3 minutes
**Expected**: No session cross-contamination or data leaks

## Running Load Tests

### Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or via Docker
docker pull grafana/k6
```

### Run Single Test

```bash
# Run concurrent transactions test
k6 run tests/integration/load/concurrent-transactions.k6.js

# With custom VUs and duration
k6 run --vus 50 --duration 5m tests/integration/load/concurrent-transactions.k6.js
```

### Run All Tests

```bash
# Run all load tests sequentially
npm run test:load

# Or manually
for test in tests/integration/load/*.k6.js; do
  echo "Running $test..."
  k6 run "$test"
done
```

### View Results

```bash
# Output to JSON for analysis
k6 run --out json=results.json tests/integration/load/concurrent-transactions.k6.js

# Send metrics to InfluxDB (optional)
k6 run --out influxdb=http://localhost:8086/k6 tests/integration/load/concurrent-transactions.k6.js
```

## Success Criteria

### Performance Metrics

- **Response Time**: p95 < 2 seconds
- **Throughput**: 50 transactions/second
- **Error Rate**: < 1%
- **Connection Pool**: No timeouts or exhaustion

### Functional Metrics

- **Data Integrity**: All transactions saved correctly
- **No Duplicates**: Button debouncing prevents duplicate entries
- **Session Isolation**: No cross-user data contamination
- **ACID Compliance**: Database maintains consistency

## Test Data Cleanup

After running load tests:

```bash
# Clean up test transactions
npm run test:cleanup

# Or via SQL
psql $DATABASE_URL -c "DELETE FROM transactions WHERE description LIKE 'LOAD_TEST%';"
```

## Monitoring During Tests

Monitor these metrics during load tests:

1. **Database**:

   ```sql
   -- Active connections
   SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();

   -- Lock waits
   SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';
   ```

2. **Redis**:

   ```bash
   # Connected clients
   redis-cli info clients

   # Memory usage
   redis-cli info memory
   ```

3. **Application**:
   - Check logs for errors: `tail -f logs/app.log | grep ERROR`
   - Monitor response times: `tail -f logs/app.log | grep "duration"`

## Troubleshooting

### Connection Pool Exhausted

```
Error: Can't reach database server
```

**Solution**: Increase `connection_limit_max` in `src/lib/database.ts`

### Rate Limit Exceeded

```
Error: Rate limit exceeded
```

**Solution**: Expected behavior, adjust test VUs or message frequency

### Session Conflicts

```
Error: Version mismatch
```

**Solution**: Optimistic locking working correctly, retry should handle this

### Memory Issues

```
Error: Cannot allocate memory
```

**Solution**: Increase Docker/system memory limits or reduce concurrent VUs
