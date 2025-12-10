# GitHub Copilot Quick Reference for WhatsApp Cashflow Bot

## 🎯 Quick Commands

### Open Copilot Chat

```
Windows/Linux: Ctrl+Shift+I
Mac: Cmd+Shift+I
```

### Common Shortcuts

| Action               | Shortcut     |
| -------------------- | ------------ |
| Open Chat            | Ctrl+Shift+I |
| Accept Suggestion    | Tab          |
| Next Word Suggestion | Ctrl+Right   |
| Dismiss Suggestion   | Escape       |
| Code Action Menu     | Ctrl+.       |
| Quick Fix            | Ctrl+Shift+. |

---

## 💬 Quick Prompts

### For Your Project (Copy & Paste)

#### Generate NestJS Service

```
@nestjs-service: Create a new [ServiceName] with methods for [functionality]
Following our RBAC and audit logging patterns
```

#### Generate Jest Tests

```
@jest-tests: Generate comprehensive tests for [Service/Class]
Include: unit tests, mocks, edge cases, error scenarios
Follow our Jest configuration in jest.config.js
```

#### Generate E2E Tests

```
@playwright-tester: Generate E2E tests for [User Workflow]
Test from WhatsApp message through database persistence
Include success and error scenarios
```

#### Security Review

Switch to `@security-focused-code-review` agent and paste code:

```
Review this code for:
- OWASP vulnerabilities
- SQL injection prevention
- Authentication/Authorization issues
- Data exposure risks
- Suggest fixes following our security guidelines
```

#### Database Optimization

Switch to `@postgresql-dba` agent:

```
Review this Prisma/SQL query for:
- Performance optimization
- Missing indexes
- N+1 query problems
- Caching opportunities
Suggest improvements with implementation details
```

#### Implementation Plan

```
@implementation-plan: Create an implementation plan for [Feature]
Include: components, files to create, dependencies, testing strategy
Reference .github/copilot-instructions.md patterns
```

---

## 🎓 Best Practices Summary

### ✅ DO

- ✅ Provide context about the task
- ✅ Reference project standards
- ✅ Use agents for specialized tasks
- ✅ Test generated code
- ✅ Iterate and refine
- ✅ Review security implications

### ❌ DON'T

- ❌ Accept code without review
- ❌ Use generic prompts
- ❌ Skip testing generated code
- ❌ Ignore security suggestions
- ❌ Use latest/main for action versions
- ❌ Store secrets in generated code

---

## 📋 Available Agents (Partial List)

### Quick Access

```
@high-level-big-picture-architect - System architecture
@principal-software-engineer - Code guidance
@security-focused-code-review - Security audit
@postgresql-dba - Database optimization
@playwright-tester - E2E testing
@debug - Complex debugging
@research - Technical research
```

---

## 🚀 Workflow Quick Links

### Starting a Feature

1. `@implementation-plan` - Plan the feature
2. `@nestjs-service` - Generate code
3. `@jest-tests` - Generate tests
4. `@security-focused-code-review` - Security check
5. `@conventional-commit` - Format commit

### Fixing a Bug

1. `@debug` - Debug the issue
2. Ask Copilot for fix
3. `@jest-tests` - Add regression test
4. `@security-focused-code-review` - Review fix

### Optimizing Code

1. `@postgresql-dba` - For DB code
2. Ask for optimization
3. `@jest-tests` - Test the optimization
4. Review performance improvements

---

## 📚 Key Files to Reference

- **Main Copilot Config**: `.github/copilot-instructions.md`
- **TypeScript/NestJS**: `.github/instructions/typescript-nodejs-nestjs.instructions.md`
- **Testing Guide**: `.github/instructions/testing-jest-playwright.instructions.md`
- **Security**: `.github/instructions/security-and-owasp.instructions.md`
- **Database**: `.github/instructions/postgresql-performance.instructions.md`
- **Financial RBAC**: `.github/instructions/financial-rbac-security.instructions.md`

---

## 🔍 Example Interactions

### Example 1: Create Transaction Service

```
@nestjs-service: Generate TransactionService with:
- calculateTotal(transactions: Transaction[]): Promise<number>
- validateTransaction(transaction: CreateTransactionDto): Promise<boolean>
- recordAudit(action: string, details: object): Promise<void>

Include dependency injection, error handling, and audit logging.
Follow patterns in src/services/transaction/*
```

### Example 2: Complex Security Review

```
Switch to: @security-focused-code-review

Paste your authentication code and ask:
"Review this authentication code for OWASP vulnerabilities.
Check JWT handling, password validation, session management.
Our tech: NestJS, Passport, JWT, PostgreSQL.
Suggest fixes with implementation details."
```

### Example 3: Database Query Optimization

```
Switch to: @postgresql-dba

Paste your Prisma query and ask:
"Optimize this query. Check for N+1, missing indexes,
caching opportunities. We use TimescaleDB for time-series data.
Suggest improvements with implementation."
```

---

## 📞 Stuck? Try This

| Problem                   | Solution                                            |
| ------------------------- | --------------------------------------------------- |
| Suggestions off-topic     | Add more context and project details                |
| Code has errors           | Run `npm run type-check` then ask Copilot to fix    |
| Not following conventions | Reference `.github/copilot-instructions.md`         |
| Need specialized help     | Switch to relevant agent (security, database, etc.) |
| Chat slow                 | Clear history, reduce context, restart VS Code      |
| Can't open chat           | Check extensions, restart VS Code, re-authenticate  |

---

## 💡 Pro Tips

1. **Select code before chat** - Copilot has better context
2. **Use `#file` in prompts** - Reference current file
3. **Use `#selection`** - Reference selected code
4. **Use `#codebase`** - Reference project structure
5. **Chain prompts** - Ask follow-up questions for refinement
6. **Test immediately** - Run `npm test` after generation
7. **Use version numbers** - Pin GitHub Action versions to SHAs
8. **Security first** - Always ask for security review in financial code

---

## 🔗 Links

- **Full Setup Guide**: [COPILOT_SETUP_GUIDE.md](./COPILOT_SETUP_GUIDE.md)
- **Setup Complete Details**: [COPILOT_SETUP_COMPLETE.md](./COPILOT_SETUP_COMPLETE.md)
- **Main Instructions**: [copilot-instructions.md](./copilot-instructions.md)
- **Awesome Copilot**: https://github.com/github/awesome-copilot

---

**Keep this file open while developing!** 📌

Bookmark: `.github/COPILOT_QUICK_REFERENCE.md`
