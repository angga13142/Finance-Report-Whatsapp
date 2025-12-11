# Quick Start: Button Deprecation & Command-Based UI

**Feature**: Button Deprecation & Command-Based UI Replacement  
**Date**: December 17, 2025

## Overview

This guide provides quick setup instructions for implementing the command-based UI feature. The feature adds text command processing while maintaining backward compatibility with button interfaces.

## Prerequisites

- Node.js 20.0.0+
- PostgreSQL 15+ (existing)
- Redis 7.x (existing)
- WhatsApp Web.js v1.34.2+ installed
- Existing bot infrastructure running

## Installation Steps

### 1. Install Dependencies

```bash
npm install fuse.js@^7.1.0
```

**Note**: `zod@^3.22.4` already installed, `redis@^4.6.0` already installed

### 2. Add Environment Variable

Add to `.env`:

```bash
# Button deprecation feature flag (default: true for backward compatibility)
ENABLE_LEGACY_BUTTONS=true
```

### 3. Configuration Setup

Update `src/config/env.ts`:

```typescript
ENABLE_LEGACY_BUTTONS: z.boolean().default(true),
```

### 4. Create Command Constants

Create `src/config/constants.ts`:

```typescript
export const COMMANDS = {
  // Transaction commands
  RECORD_SALE: "catat_penjualan",
  RECORD_EXPENSE: "catat_pengeluaran",

  // Report commands
  VIEW_REPORT_TODAY: "lihat_laporan_hari_ini",
  VIEW_REPORT_WEEK: "lihat_laporan_minggu_ini",
  VIEW_REPORT_MONTH: "lihat_laporan_bulan_ini",

  // Balance commands
  VIEW_BALANCE: "lihat_saldo",
  CHECK_BALANCE: "cek_saldo",

  // Help commands
  HELP: "bantu",
  MENU: "menu",
} as const;

export const COMMAND_SYNONYMS = {
  tambah: COMMANDS.RECORD_SALE,
  input: COMMANDS.RECORD_SALE,
  masukkan: COMMANDS.RECORD_SALE,
  // ... more synonyms
} as const;

export const CONFIDENCE_THRESHOLD = 0.7;
```

## Quick Implementation Checklist

### Phase 1: Command Parser (Foundation)

- [ ] Create `src/bot/handlers/command.ts`
  - [ ] Implement command recognition with fuse.js
  - [ ] Add synonym mapping
  - [ ] Add confidence scoring
  - [ ] Create command validation

- [ ] Update `src/config/env.ts`
  - [ ] Add `ENABLE_LEGACY_BUTTONS` flag

- [ ] Create `src/config/constants.ts`
  - [ ] Define command constants
  - [ ] Define synonyms
  - [ ] Define confidence thresholds

### Phase 2: Message Formatting

- [ ] Create `src/bot/ui/message.formatter.ts`
  - [ ] Implement balance message formatting
  - [ ] Implement report message formatting
  - [ ] Implement help message formatting
  - [ ] Add emoji indicators
  - [ ] Add pagination support (4096 char limit)

### Phase 3: Integration

- [ ] Update `src/bot/handlers/message.ts`
  - [ ] Add command path (if button mode disabled or text detected)
  - [ ] Route to command handler
  - [ ] Maintain button fallback logic

- [ ] Create `src/services/system/financial-summary.ts`
  - [ ] Implement financial data aggregation
  - [ ] Add Redis caching (30-60s TTL)
  - [ ] Support on-demand refresh

### Phase 4: Context Management

- [ ] Update `src/lib/redis.ts`
  - [ ] Add conversation context storage
  - [ ] Add TTL management (30 minutes)
  - [ ] Add context retrieval/update/clear

### Phase 5: Testing

- [ ] Unit tests: Command recognition
- [ ] Unit tests: Message formatting
- [ ] Integration tests: Command → handler → response flow
- [ ] E2E tests: WhatsApp message scenarios

## Development Workflow

### 1. Enable Command Mode (Testing)

```bash
# Set environment variable
export ENABLE_LEGACY_BUTTONS=false

# Restart bot
npm run dev
```

### 2. Test Command Recognition

```typescript
// Example test
const result = parseCommand("catat penjualan", userId, userRole);
expect(result.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
expect(result.confidence).toBeGreaterThan(0.9);
```

### 3. Test Message Formatting

```typescript
// Example test
const message = formatBalanceMessage({
  balance: 5000000,
  pendingCount: 2,
});
expect(message).toContain("💰");
expect(message).toContain("Rp 5.000.000");
```

### 4. Test Financial Summary Cache

```typescript
// First request (cache miss)
const summary1 = await getFinancialSummary(userId, "today");
expect(summary1.isCached).toBe(false);

// Second request (cache hit)
const summary2 = await getFinancialSummary(userId, "today");
expect(summary2.isCached).toBe(true);
expect(summary2.cacheAge).toBeLessThan(60);
```

## Example Usage

### User Command Flow

```
User: "catat penjualan"
  ↓
System: "💰 *Catat Penjualan*\n\nMasukkan jumlah penjualan:\nSaldo saat ini: Rp 10.000.000"
  ↓
User: "500000"
  ↓
System: "Pilih kategori:\n1. Product A\n2. Product B\n..."
  ↓
User: "1"
  ↓
System: "✅ Penjualan berhasil dicatat!\n\nJumlah: Rp 500.000\nKategori: Product A\nSaldo baru: Rp 10.500.000"
```

### Button Fallback Flow

```
User: [clicks button]
  ↓
System checks ENABLE_LEGACY_BUTTONS
  ↓
If true: Process button callback (existing flow)
If false: Show message "Silakan gunakan perintah teks. Contoh: catat penjualan"
```

## Configuration Options

### Enable/Disable Buttons

```typescript
// Runtime configuration (via ConfigService)
await configService.set("ENABLE_LEGACY_BUTTONS", false);

// Takes effect within 60 seconds (FR-035)
```

### Adjust Confidence Threshold

```typescript
// In constants.ts
export const CONFIDENCE_THRESHOLD = 0.7; // Default
// Lower = more suggestions, Higher = more auto-execution
```

### Cache TTL Configuration

```typescript
// In financial-summary.ts
const CACHE_TTL = 45; // seconds (30-60 range)
```

## Troubleshooting

### Commands Not Recognized

1. Check command synonyms in `constants.ts`
2. Verify fuzzy matching threshold (default: 0.6 for suggestions)
3. Review command logs: `CommandLog` entries show confidence scores

### Financial Data Stale

1. Force refresh: User types "refresh" or "update" command
2. Check cache TTL: Should be 30-60 seconds
3. Verify Redis connection: `redis.isReady`

### Context Expiring Too Quickly

1. Check context TTL: Should be 1800 seconds (30 minutes)
2. Verify activity updates: Each user message should refresh TTL
3. Check Redis key expiration: `TTL conversation:{userId}`

### Buttons Still Showing When Disabled

1. Verify environment variable: `ENABLE_LEGACY_BUTTONS=false`
2. Check ConfigService: Runtime updates may take up to 60 seconds
3. Restart bot if configuration not updating

## Next Steps

1. Complete Phase 1-5 implementation checklist
2. Run test suite: `npm test`
3. Enable command mode for testing: Set `ENABLE_LEGACY_BUTTONS=false`
4. Gather user feedback on command interface
5. Monitor command recognition accuracy via logs
6. Gradually migrate users from buttons to commands

## References

- [Specification](./spec.md) - Full feature specification
- [Data Model](./data-model.md) - Entity definitions and relationships
- [API Contracts](./contracts/command-api.yaml) - Internal API specifications
- [Research](./research.md) - Technical decisions and rationale
