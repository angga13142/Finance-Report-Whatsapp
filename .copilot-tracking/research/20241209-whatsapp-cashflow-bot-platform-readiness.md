<!-- markdownlint-disable-file -->

# Task Research Notes: WhatsApp Cashflow Bot - Platform Readiness Analysis

## Research Executed

### File Analysis

- `/home/senarokalie/Desktop/Finance/specs/004-whatsapp-cashflow-bot/spec.md`
  - Comprehensive technical specification with 8 user stories, 100 functional requirements, 20 success criteria
  - 5 core P1 requirements identified (critical for MVP)
  - 40+ P2 requirements supporting advanced features
  - Requires button-based UI, multi-step state management, session persistence, file attachments (PDF), concurrent user handling (50 users)

### Code Search Results

- **whatsapp-web.js library features** (v1.34.2)
  - ✅ Send messages, receive messages, media handling (images/audio/documents/video)
  - ✅ Multi-device support, contact management, group operations
  - ✅ Message reactions, polls, channels support
  - ❌ **Send buttons - DEPRECATED** (official README: "Send buttons ❌ (DEPRECATED)")
  - ❌ **Send lists - DEPRECATED** (official README: "Send lists ❌ (DEPRECATED)")
  - ⚠️ **IMPORTANT CLARIFICATION**: Buttons CLASS EXISTS in code (`Buttons.js`), but feature is marked DEPRECATED in supported features table (WhatsApp Web protocol no longer supports sending buttons)
  - ✅ LocalAuth session persistence strategy available
  - ✅ Polls and channel support for alternative UI patterns

### External Research

- #fetch:"https://docs.wwebjs.dev/" "button interface, message handling, session persistence"
  - **Buttons class exists in codebase** (`src/structures/Buttons.js`) with full implementation
  - **BUT**: "Send buttons" feature marked ❌ DEPRECATED in official supported features table
  - **Root Cause**: WhatsApp Web protocol changed - WhatsApp no longer supports sending interactive buttons via Web client
  - **Status Clarification**: Class can be instantiated but sending buttons will FAIL at WhatsApp protocol level
  - Session persistence via LocalAuth strategy: ✅ Fully supported
  - File attachments (PDF documents): ✅ Supported via MessageMedia
  - Multi-user handling: ✅ Concurrent connections supported but rate-limiting required (max 15-20 messages/min per chat)

- #fetch:"https://wwebjs.dev/guide/creating-your-bot/" "QR authentication, message routing, button implementation"
  - QR code authentication: ✅ Fully supported with qrcode-terminal
  - Message event handling: ✅ message_create and message events available
  - Button implementation: ❌ **Not currently documented/supported - requires custom workaround**
  - Text command fallbacks: ✅ Supported via message body parsing

- #fetch:"https://upstash.com/docs/redis/overall/getstarted" "session state management, persistence, REST API"
  - Redis database: ✅ Serverless, auto-scaling, 99.99% uptime
  - REST API support: ✅ Access from any runtime
  - Multi-region replication: ✅ Available for high availability
  - Session TTL/expiration: ✅ Redis EXPIRE command native support
  - User session state: ✅ Can store JSON objects with automatic serialization
  - Concurrent operations: ✅ Atomic operations, transactions supported
  - Audit logging: ⚠️ **Partial - need external logging for compliance (Redis doesn't natively log all operations)**

- #fetch:"https://learn.microsoft.com/en-us/azure/cosmos-db/" "database, document storage, RBAC, scalability"
  - Document storage (NoSQL): ✅ Multiple APIs (SQL, MongoDB, PostgreSQL)
  - Role-based access control: ✅ Entra ID RBAC integration available
  - Multi-region distribution: ✅ Global replication
  - Encryption at rest: ✅ Native support
  - Concurrent writes: ✅ ACID transactions for SQL API
  - Audit logging: ✅ Activity logs available via Azure Monitor
  - Cost at scale: ⚠️ **Potential concern - pricing based on RUs (Request Units), can be expensive for high concurrency**

- #fetch:"https://learn.microsoft.com/en-us/azure/azure-functions/" "scheduled tasks, cron triggers, serverless compute"
  - Scheduled execution: ✅ Timer trigger (CRON format)
  - Serverless architecture: ✅ Pay-per-execution model
  - Node.js support: ✅ JavaScript/TypeScript fully supported
  - 50+ integration connectors: ✅ Including HTTP, database, messaging
  - Deployment: ✅ Infrastructure-as-code via Bicep/Terraform

- #fetch:"https://learn.microsoft.com/en-us/azure/logic-apps/" "scheduled workflows, recurrence schedules, automation"
  - Recurrence schedules: ✅ Native support for recurring tasks at specific times (24:00 WITA)
  - Workflow orchestration: ✅ Multi-step processes with branching
  - Database integration: ✅ Connectors for SQL, Cosmos DB
  - Message delivery rate limiting: ✅ Can implement rate limiting logic
  - Alternative to Functions: ✅ Better for complex scheduled workflows
  - Monthly reports: ✅ Can schedule different workflows for different dates

## Key Discoveries

### Project Structure & Requirements

**Critical P1 Requirements (MVP Blocking)**:

1. **FR-001 (WhatsApp Session Management)** - QR auth, session persistence
   - Library: ✅ wwebjs.dev fully supports via LocalAuth
   - Impact: **FOUNDATIONAL - blocks all other features**

2. **FR-026 (Button-Based Interface)** - 3 buttons/row, dropdown lists
   - Library: ❌ **CRITICAL BLOCKER - "Send buttons" DEPRECATED per official README**
   - Technical Detail: Buttons class exists in code but WhatsApp Web protocol no longer supports button sending
   - Current wwebjs.dev v1.34.2: Buttons class available but feature will NOT work on WhatsApp protocol
   - Impact: **BLOCKS User Story 1 (transaction input), User Story 2 (report interaction)**

3. **FR-041/042 (Automated Daily Reporting)** - Generate reports at 23:55, deliver at 24:00 WITA
   - Azure Functions: ✅ Timer trigger with CRON support
   - Azure Logic Apps: ✅ Recurrence trigger with timezone awareness
   - Impact: **IMPLEMENTABLE with serverless options**

4. **FR-004 (Multi-Step State Management)** - Preserve conversation context across messages
   - Upstash Redis: ✅ Persistent session store with TTL
   - PostgreSQL: ✅ Alternative persistent store
   - Impact: **FULLY SUPPORTED**

5. **FR-047/048 (PDF Report Generation)** - Charts, pie charts, trend lines
   - PDFKit: ✅ Available Node.js library
   - Puppeteer: ✅ Can generate charts via HTML-to-PDF
   - Impact: **IMPLEMENTABLE but requires development**

### Implementation Patterns

**Button Interface Alternative Approaches**:

When "Send buttons" feature is DEPRECATED in wwebjs.dev (due to WhatsApp Web protocol limitation), there are 4 possible workarounds:

1. **Text-Based Menu (Most Compatible)** ✅ RECOMMENDED
   - Send numbered options: "1. Catat Penjualan\n2. Catat Pengeluaran"
   - User replies with number (text message)
   - Fallback mechanism already spec'd in FR-032
   - **Status**: Fully functional, tested approach
   - **Limitation**: Less intuitive than buttons, higher friction for non-technical users
   - **Implementation**: 2-3 hours development

2. **Polls API (WhatsApp Native Feature)** ⚠️ PARTIAL
   - Use native WhatsApp polls for category selection
   - wwebjs.dev v1.34.2 supports: `new Poll(name, options)`
   - **Status**: Works but limited use case
   - **Limitation**: Polls are single-select, not ideal for multi-step workflows, users can't easily edit choices
   - **Implementation**: 1-2 hours, but workarounds needed

3. **Custom Emoji/Reaction-Based UI** ❌ NOT RECOMMENDED
   - Use emoji reactions as a voting mechanism
   - **Status**: Experimental, non-standard
   - **Limitation**: Complex to implement, poor discoverability, very non-intuitive
   - **Implementation**: 4-6 hours, likely to confuse users

4. **WhatsApp Business Cloud API (Alternative Path)** ⚠️ FUTURE OPTION
   - Official WhatsApp Cloud API with native button support (https://www.whatsapp.com/business/api)
   - Different library/integration entirely (not wwebjs.dev)
   - **Status**: Official but requires business verification
   - **Limitation**: Requires WhatsApp Business Account verification (2-3 week wait), higher API costs (~$0.01-0.05/msg), different authentication flow
   - **Decision Point**: Evaluate if available during MVP planning, can migrate later
   - **Implementation**: Requires infrastructure change, 5-7 days setup

**Recommended Approach for MVP**: 
Use **Text-based numbered menu** (Approach #1) with spec'd fallback (FR-032) + optional educational onboarding for users. This meets all P1 requirements while buttons are unavailable. Buttons implementation can be added later if WhatsApp Web protocol support is restored, or migrate to WhatsApp Business API for better UX (post-MVP enhancement).

### Complete Examples

**Session State Storage in Upstash Redis**:

```javascript
// User conversation state stored in Upstash Redis
const sessionKey = `session:${phoneNumber}`;
const sessionData = {
  userId: user.id,
  currentMenu: "TRANSACTION_INPUT",
  transactionContext: {
    type: "income", // income | expense
    category: null,
    amount: null,
    notes: null,
    startedAt: Date.now()
  },
  lastActivity: Date.now()
};

// Store with 10-minute expiration (FR-006)
await redis.setex(sessionKey, 600, JSON.stringify(sessionData));

// Retrieve and validate
const stored = await redis.get(sessionKey);
const session = JSON.parse(stored);
```

**Daily Report Generation with Azure Functions**:

```javascript
// Timer trigger function (23:55 WITA daily)
module.exports = async function (context, myTimer) {
  const now = new Date();
  const wita = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  // Query transactions for 00:00-23:59 WITA
  const startOfDay = new Date(wita);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(wita);
  endOfDay.setHours(23, 59, 59, 999);
  
  const transactions = await db.query(
    `SELECT * FROM transactions WHERE timestamp BETWEEN $1 AND $2`,
    [startOfDay, endOfDay]
  );
  
  // Generate reports per role
  const devReport = generateDevReport(transactions, allMetrics);
  const bossReport = generateBossReport(transactions);
  const investorReport = generateInvestorReport(transactions);
  const employeeReports = generateEmployeeReports(transactions);
  
  // Queue delivery for 00:00 (midnight)
  await scheduleReportDelivery({
    deliveryTime: new Date(endOfDay.getTime() + 1000), // 00:00 next day
    reports: { devReport, bossReport, investorReport, employeeReports }
  });
};
```

**Role-Based Access Control with Cosmos DB**:

```javascript
// User document in Cosmos DB NoSQL
{
  "id": "user_+62812345678",
  "phoneNumber": "+62812345678",
  "name": "Budi Santoso",
  "role": "employee", // dev | boss | employee | investor
  "permissions": [
    "transaction:create",
    "transaction:read:own",
    "report:read:daily"
  ],
  "createdAt": "2025-01-15T10:30:00Z",
  "lastActive": "2025-01-15T14:45:00Z",
  "isActive": true
}

// Query with role-based filtering
async function getUserTransactions(userId, userRole) {
  if (userRole === 'dev' || userRole === 'boss') {
    // Return all transactions
    return db.container('transactions').items.query(
      'SELECT * FROM c ORDER BY c.timestamp DESC'
    ).fetchAll();
  } else if (userRole === 'employee') {
    // Return only own transactions + company totals
    return db.container('transactions').items.query(
      `SELECT * FROM c WHERE c.userId = @userId OR c.isAggregate = true`,
      { parameters: [{ name: '@userId', value: userId }] }
    ).fetchAll();
  } else if (userRole === 'investor') {
    // Return only aggregated views
    return db.container('aggregations').items.query(
      'SELECT * FROM c WHERE c.type = "aggregated"'
    ).fetchAll();
  }
}
```

### API and Schema Documentation

**whatsapp-web.js Supported Features (v1.34.2)**:

| Feature | Status | Notes |
|---------|--------|-------|
| QR Code Authentication | ✅ | `client.on('qr', qr => {})` |
| Session Persistence | ✅ | `new LocalAuth()` strategy |
| Receive Messages | ✅ | `client.on('message_create', msg => {})` |
| Send Text Messages | ✅ | `msg.reply('text')` or `client.sendMessage(chatId, 'text')` |
| Send Images/Documents | ✅ | `MessageMedia.fromFilePath()` |
| Send Buttons | ❌ | DEPRECATED - Class exists but WhatsApp Web protocol doesn't support |
| Send Lists | ❌ | DEPRECATED - Class exists but WhatsApp Web protocol doesn't support |
| Polls | ✅ | `new Poll(name, options)` |
| Message Reactions | ✅ | `msg.react('😊')` |
| Session Events | ✅ | QR, ready, auth_failure, disconnected |

**Upstash Redis Capabilities**:

```
GET key              - Retrieve session data
SET key value EX 600 - Store with 10-min expiration
INCR key             - Atomic counter for rate limiting
HSET key field value - Hash storage for complex objects
LPUSH/RPUSH key val  - List operations for queues
SADD key member      - Set operations for user collections
ZADD key score val   - Sorted sets for leaderboards
EXPIRE key 600       - Set expiration on existing key
TTL key              - Check remaining time-to-live
MGET key1 key2       - Batch retrieval
PIPELINE             - Batch operations for atomicity
```

**Azure Cosmos DB Schema (NoSQL - SQL API)**:

```json
// Transactions collection
{
  "id": "txn_20250115_001",
  "userId": "user_+62812345678",
  "type": "income",
  "category": "Produk A",
  "amount": 500000,
  "currency": "IDR",
  "description": "Sale to customer XYZ",
  "timestamp": "2025-01-15T14:30:00Z",
  "approvalStatus": "approved",
  "approvedBy": null,
  "ttl": -1
}

// Indexes recommended for performance
{
  "indexingPolicy": {
    "compositeIndexes": [
      [
        { "path": "/userId", "order": "ascending" },
        { "path": "/timestamp", "order": "descending" }
      ],
      [
        { "path": "/timestamp", "order": "descending" },
        { "path": "/type", "order": "ascending" }
      ]
    ]
  }
}
```

### Technical Requirements

**WhatsApp Library Compatibility**:
- Node.js 18+ (LTS): ✅ wwebjs.dev requires Node 18+
- Puppeteer Browser: ✅ wwebjs.dev handles automatically
- QR Code Display: ✅ qrcode-terminal library available
- Session Persistence: ✅ LocalAuth strategy with file storage

**Upstash Infrastructure**:
- REST API Access: ✅ No TCP connections needed, HTTP/HTTPS only
- TTL/Expiration: ✅ Native Redis EXPIRE support
- Atomicity for Concurrent Operations: ✅ WATCH/MULTI/EXEC transactions
- Data Encryption: ✅ TLS in transit, optional encryption at rest

**Azure Services Availability**:
- Functions Timer Trigger: ✅ Supports cron expressions and timezone
- Cosmos DB Multi-region: ✅ Global distribution, automatic failover
- Entra ID RBAC: ✅ Native Azure AD integration
- Azure Monitor: ✅ Logging, monitoring, alerting

## Recommended Approach

Given findings, the recommended architecture is:

**Technology Selection**:
1. **Frontend/Bot Runtime**: wwebjs.dev v1.34.2 (for WhatsApp integration) + text-based UI fallback
2. **Session State**: Upstash Redis (serverless, low-latency, auto-scaling)
3. **Persistent Database**: Azure Cosmos DB for SQL API (transactional, global distribution)
4. **Scheduled Tasks**: Azure Functions + Timer Trigger (simpler) OR Azure Logic Apps (complex workflows)
5. **Report Generation**: PDFKit + Puppeteer for charts

**Gap Mitigation Strategy**:

| Requirement | Original Approach | Gap | Mitigation | Trade-off |
|---|---|---|---|---|
| Button-based UI (FR-026/027) | wwebjs.dev Buttons class | Deprecated | Text-numbered menu + emoji selection | Slightly lower UX but functional, spec'd fallback |
| Multi-step state mgmt (FR-004) | Redis session store | None | ✅ Direct implementation | None |
| Session persistence (FR-002) | wwebjs.dev LocalAuth | None | ✅ Direct implementation | None |
| PDF w/ charts (FR-047) | PDFKit/Puppeteer | None | ✅ Standard Node.js libs | Puppeteer needs Chromium |
| Scheduled reports 24:00 (FR-041) | node-cron | Timezone issues | Azure Functions Timer + timezone logic | Cleaner than node-cron |
| Concurrent users 50+ (FR-008) | Rate limiting | None | Message queue + rate limiting | Add complexity but scales |
| Role-based access (FR-011) | Cosmos DB RBAC | Partial | Custom permission checks + Entra ID | Hybrid approach required |
| Audit logging (FR-017) | Redis + custom logger | Partial | Winston + Azure Storage | External log aggregation needed |
| Recommendation engine (FR-081) | Rule-based | None | Simple if/else thresholds | Manual scoring, no ML |

## Implementation Guidance

- **Objectives**: 
  - Deploy functional MVP with text-based UI (not buttons) using whatsapp-web.js
  - Establish persistent session management with Upstash Redis
  - Implement automated reporting with Azure Functions
  - Scale to 50 concurrent users with rate limiting
  - Complete within 10-week timeline

- **Key Tasks**:
  1. Migrate from button UI to text-numbered menu (updates UI/UX but spec'd as fallback)
  2. Set up Upstash Redis for session state storage
  3. Configure Azure Functions Timer trigger for 23:55 daily
  4. Build PDF report generation with PDFKit
  5. Implement message rate limiting (1 msg/3 sec) to avoid WhatsApp throttling
  6. Create comprehensive error handling for WhatsApp session disconnections
  7. Load test with 50 concurrent users against rate limiting

- **Dependencies**:
  - whatsapp-web.js v1.34.2 (active community, 20.3k GitHub stars)
  - Upstash Redis account + API keys
  - Azure subscription + Cosmos DB + Functions provisioned
  - PDFKit and Puppeteer npm packages

- **Success Criteria**:
  1. ✅ Transaction input workflow completes without buttons (text-based menu)
  2. ✅ Automated report generated daily at 23:55, delivered at 24:00 WITA
  3. ✅ User session state persists across bot restarts
  4. ✅ 50 concurrent users can input transactions simultaneously (<2s response time)
  5. ✅ PDF reports generated with charts within 15 seconds
  6. ✅ All role-based data filtering works (Employee sees own + totals, Boss sees all, Investor sees aggregated only)
  7. ✅ Message delivery rate limited to avoid WhatsApp blocks

## Blockers & Risks

**P1 Risks** (MVP Timeline Threats):
1. **Button UI Deprecation**: Requires UX redesign to text menus (documented fallback - medium risk)
2. **WhatsApp Session Persistence**: Puppeteer/browser dependency in containers (solvable - low risk)
3. **Rate Limiting Complexity**: 50 users × 3 transactions/min = 150 msg/min (implement queue - medium effort)

**P2 Risks** (Post-MVP):
1. **Recommendation Engine**: Rule-based approach may not scale to complex logic (add ML later)
2. **Audit Trail Compliance**: Need to implement structured logging + retention (external solution)
3. **Multi-Language Support**: Currently Bahasa Indonesia only (add later)

## Additional Findings

- **Upstash Alternative**: For persistence, PostgreSQL on Azure Database for PostgreSQL (Flexible Server) is also viable, trades serverless simplicity for lower cost at scale
- **Cosmos DB Alternative**: Azure SQL Database (relational) cheaper if transactional consistency more important than document flexibility
- **WhatsApp Business API**: Official API (not wwebjs.dev) has native button support but requires business verification (2-3 week wait)
- **Report Delivery**: WhatsApp rate limit is 15-20 messages/min per chat, so batch delivery of reports to 50 users will take ~3-5 min (acceptable for daily report)
- **Session Recovery**: wwebjs.dev has built-in session recovery on QR re-scan, complies with FR-008 requirements

