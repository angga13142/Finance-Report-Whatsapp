# Implementation Plan: Button Deprecation & Command-Based UI Replacement

**Branch**: `001-deprecate-buttons-command` | **Date**: December 17, 2025 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-deprecate-buttons-command/spec.md`

## Summary

This feature deprecates button-based interactions in favor of text command interfaces for the WhatsApp financial bot, while maintaining backward compatibility during a 6-8 week transition period. The implementation introduces a rule-based command parser with fuzzy matching, formatted text message responses with emoji indicators, real-time financial data caching, and configuration-based button fallback control. The technical approach leverages existing whatsapp-web.js infrastructure (which officially deprecated buttons), implements command recognition using fuse.js for typo tolerance, uses Redis for conversation context management, and maintains 100% backward compatibility when button fallback is enabled.

## Technical Context

**Language/Version**: TypeScript 5.0+, Node.js 20.0.0+  
**Primary Dependencies**: whatsapp-web.js@^1.34.2, fuse.js@^7.0.0 (fuzzy matching), zod@^3.22.0 (validation), redis@^4.6.0 (session context), winston@^3.11.0 (logging)  
**Storage**: PostgreSQL 15+ (transactional data), Redis 7.x (conversation context, financial cache), LocalAuth filesystem (`.wwebjs_auth/` for WhatsApp session)  
**Testing**: Jest 29.x (unit/integration), Playwright 1.4+ (E2E for WhatsApp interactions)  
**Target Platform**: Linux server (Docker container), headless Chromium via Puppeteer for WhatsApp Web automation  
**Project Type**: Single Node.js backend service (WhatsApp bot with command processing layer)  
**Performance Goals**: Command recognition <100ms, simple commands <2s response time, financial data retrieval <5s, 95% first-attempt command recognition accuracy  
**Constraints**: WhatsApp message limit 4096 characters (pagination required), rate limit 1 message/3 seconds per chat, conversation context expires after 30 minutes inactivity, financial data cache TTL 30-60 seconds  
**Scale/Scope**: 50-100 concurrent users, 4 user stories (P1: transaction commands, P1: report commands, P2: help/suggestions, P2: button fallback), 45 functional requirements, 10 success criteria

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify compliance with engineering constitution principles:

**Code Quality**:

- [x] Type safety and static analysis tools configured (TypeScript strict mode, ESLint configured in existing project)
- [x] Documentation plan defined for public APIs (JSDoc for command parser, message formatter APIs)
- [x] Code organization structure aligns with constitution (Feature-based: `src/bot/handlers/command.ts`, `src/bot/ui/message.formatter.ts`)
- [x] Security considerations identified (OWASP Top 10): Input validation (Zod schemas), command injection prevention (whitelist-based), audit logging, sanitization
- [x] Dependency management strategy defined (Pin versions in package.json, security scanning via Dependabot)
- [x] Error handling and observability approach planned (Winston structured logging, error tracking, graceful degradation)

**Testing**:

- [x] Test pyramid strategy defined (70% unit: command parser, formatter, cache; 20% integration: command→handler→response flow; 10% E2E: WhatsApp message scenarios)
- [x] TDD approach confirmed (Write tests first for command recognition, message formatting, error handling)
- [x] Test data management strategy defined (Mock WhatsApp messages, test fixtures for commands, isolated Redis test instance)
- [x] Performance testing plan for critical paths (Command recognition latency, financial data cache hit rate, response time under load)

**User Experience** (if applicable):

- [x] Design system usage confirmed (WhatsApp text formatting standards: Markdown syntax, emoji indicators, visual separators)
- [x] Accessibility requirements identified (Text-only design accessible to screen readers, clear error messages, help commands)
- [x] Responsive design approach defined (Text messages adapt to WhatsApp client screen sizes automatically)
- [x] Error handling and user feedback patterns planned (Role-filtered help, confidence-based suggestions, contextual error messages)

**Performance**:

- [x] API response time targets defined (Simple commands <2s, data retrieval <5s per SC-003, command recognition <100ms)
- [x] Resource consumption limits identified (<512MB memory per instance, <70% CPU under normal load per constitution)
- [x] Scalability approach confirmed (Horizontal scaling via Redis session sharing, stateless command processing, financial cache reduces DB load)
- [x] Monitoring and observability plan defined (Command recognition accuracy, response time percentiles, cache hit rate, error rates via Prometheus/Grafana)

**Exceptions**: None required - all principles can be followed within existing architecture.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── bot/
│   ├── handlers/
│   │   ├── command.ts          # MODIFY: Extend existing CommandHandler with new command-based routing and fuzzy matching integration
│   │   ├── message.ts          # MODIFY: Add command path, button fallback logic
│   │   └── [existing handlers]
│   ├── middleware/
│   │   └── [existing middleware]
│   ├── ui/
│   │   ├── message.formatter.ts  # NEW: Formatted message generation with emoji
│   │   └── buttons.ts            # MODIFY: Conditional rendering based on ENABLE_LEGACY_BUTTONS
│   └── client/
│       └── [existing client code]
├── services/
│   ├── system/
│   │   ├── financial-summary.ts  # NEW: Real-time financial data aggregation with caching
│   │   └── config.ts             # MODIFY: Add ENABLE_LEGACY_BUTTONS flag
│   └── [existing services]
├── lib/
│   ├── cache.ts                  # MODIFY: Add financial summary caching
│   ├── redis.ts                  # MODIFY: Conversation context management
│   └── [existing libs]
├── config/
│   ├── env.ts                    # MODIFY: Add ENABLE_LEGACY_BUTTONS env var
│   └── constants.ts              # NEW: Command definitions, confidence thresholds
└── models/
    └── [existing models]

tests/
├── unit/
│   ├── bot/
│   │   ├── handlers/
│   │   │   ├── command.test.ts       # NEW: Command recognition tests
│   │   │   └── message.test.ts       # MODIFY: Button fallback tests
│   │   └── ui/
│   │       └── message.formatter.test.ts  # NEW: Message formatting tests
│   └── services/
│       └── system/
│           └── financial-summary.test.ts  # NEW: Financial caching tests
├── integration/
│   ├── bot/
│   │   └── command-flow.test.ts     # NEW: Command→handler→response integration
│   └── services/
│       └── financial-data.test.ts   # NEW: Financial data retrieval integration
└── e2e/
    └── whatsapp/
        └── command-interaction.test.ts  # NEW: End-to-end WhatsApp command scenarios
```

**Structure Decision**: Single project structure (Option 1) with feature-based organization. New command handling logic integrated into existing `src/bot/handlers/` directory. Message formatting extracted to `src/bot/ui/message.formatter.ts` following existing UI pattern (`buttons.ts`, `lists.ts`). Financial summary service added to `src/services/system/` alongside existing config and health services. All modifications maintain existing code structure and patterns.

## Complexity Tracking

No violations identified - all constitution principles can be followed within existing architecture.
