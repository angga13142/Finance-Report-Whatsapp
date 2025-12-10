# GitHub Copilot Setup & Usage Guide for WhatsApp Cashflow Bot

**Last Updated**: December 10, 2025

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [VS Code Configuration](#vs-code-configuration)
3. [Copilot Features & Capabilities](#copilot-features--capabilities)
4. [Usage Examples](#usage-examples)
5. [Available Prompts & Agents](#available-prompts--agents)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Development Workflow Integration](#development-workflow-integration)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 20.x LTS (verified by preflight checks)
- **VS Code**: Latest version
- **GitHub Account**: With Copilot subscription
- **Extensions Installed**:
  - GitHub Copilot (official)
  - GitHub Copilot Chat (official)

### First-Time Setup (5 minutes)

1. **Install Extensions**
   ```bash
   # Open VS Code extensions (Ctrl+Shift+X / Cmd+Shift+X)
   # Search and install:
   # - GitHub Copilot (id: GitHub.copilot)
   # - GitHub Copilot Chat (id: GitHub.copilot-chat)
   ```

2. **Sign In to GitHub**
   ```
   Click the "Sign in with GitHub" button in Copilot Chat
   ```

3. **Verify Setup**
   ```bash
   # Run preflight checks to ensure environment is ready
   npm run preflight
   ```

4. **Open Copilot Chat**
   ```
   Press: Ctrl+Shift+I (Windows/Linux) or Cmd+Shift+I (Mac)
   ```

---

## ⚙️ VS Code Configuration

### Essential Settings

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "plaintext": true,
    "markdown": true
  },
  "github.copilot.chat.scopeSelection": true,
  "editor.inlineSuggest.enabled": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    }
  }
}
```

### Recommended Extensions

Beyond Copilot, these extensions enhance the development experience:

```json
{
  "recommendations": [
    "GitHub.copilot",
    "GitHub.copilot-chat",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright",
    "ms-vscode.makefile-tools",
    "eamodio.gitlens",
    "ms-vscode.docker"
  ]
}
```

### Keyboard Shortcuts

Create `.vscode/keybindings.json` for faster access:

```json
[
  {
    "key": "ctrl+shift+i",
    "command": "github.copilot.openSymbolFromReferences"
  },
  {
    "key": "ctrl+shift+j",
    "command": "workbench.action.chat.open"
  }
]
```

---

## 🎯 Copilot Features & Capabilities

### 1. **Inline Code Suggestions**

Copilot provides context-aware code completions as you type:

```typescript
// Start typing and suggestions appear automatically
async function create(createUserDto: CreateUserDto) {
  // Copilot suggests:
  // const user = this.userRepository.create(createUserDto);
  // return this.userRepository.save(user);
}
```

**Accepting Suggestions**:
- `Tab` - Accept full suggestion
- `Ctrl+Right` - Accept next word
- `Escape` - Dismiss suggestion

### 2. **Chat Assistance (Ctrl+Shift+I)**

Have conversations with Copilot about your code:

```
User: "Help me implement error handling for this service"
Copilot: [Provides implementation with best practices]
```

### 3. **Code Actions & Fixes**

Right-click on code to access Copilot actions:
- "Explain this code"
- "Generate tests"
- "Refactor this code"
- "Generate documentation"

### 4. **Custom Agents**

Use specialized chat modes for specific tasks (see [Available Agents](#available-agents)).

### 5. **Prompt Templates**

Reusable prompts optimized for common development tasks (see [Available Prompts](#available-prompts)).

---

## 💡 Usage Examples

### Example 1: Generate a NestJS Service

**Scenario**: Need to create a new transaction processing service.

**Steps**:

1. Open Copilot Chat: `Ctrl+Shift+I`
2. Type:
   ```
   Use the nestjs-service-generator prompt to create a TransactionProcessingService 
   with methods: calculateTotal, validateTransaction, and recordAudit
   ```
3. Copilot generates the service with:
   - Proper NestJS decorators (`@Injectable()`)
   - Dependency injection
   - Type-safe DTOs
   - Error handling
   - Logging

4. Copy the generated code and adjust imports as needed

### Example 2: Write Comprehensive Tests

**Scenario**: Need tests for a complex business logic service.

**Steps**:

1. Select the service code in editor
2. Open Copilot Chat: `Ctrl+Shift+I`
3. Type:
   ```
   Generate comprehensive Jest tests for the selected service including:
   - Unit tests for each method
   - Mocked dependencies
   - Edge cases and error scenarios
   - Database transaction tests
   ```

4. Copilot generates tests following your project's patterns

### Example 3: Security Review

**Scenario**: Need security review of authentication logic.

**Steps**:

1. Open Copilot Chat
2. Switch to **security-focused-code-review** agent
3. Paste your authentication code
4. Request: "Review this for OWASP vulnerabilities and suggest fixes"
5. Copilot provides detailed security analysis

### Example 4: Performance Optimization

**Scenario**: Database query is slow.

**Steps**:

1. Open Copilot Chat
2. Type:
   ```
   Review this Prisma query for performance optimization opportunities
   ```
2. Include the query from your code
3. Copilot suggests:
   - Query optimization strategies
   - Caching opportunities
   - Index recommendations
   - References relevant to your PostgreSQL setup

### Example 5: Implement Architecture Decision

**Scenario**: Need to implement a new architectural pattern.

**Steps**:

1. Open Copilot Chat
2. Switch to **high-level-big-picture-architect** agent
3. Describe the requirement:
   ```
   I need to implement event-driven notification system for transactions.
   Current tech: NestJS, Redis, PostgreSQL. Should integrate with WhatsApp.
   ```
4. Agent provides:
   - Architecture diagram (textual)
   - Component breakdown
   - Implementation steps
   - Code examples
   - Testing strategy

---

## 📚 Available Prompts & Agents

### Core Prompts for Your Project

#### 🔧 Development Prompts

| Prompt | Use Case | Trigger |
|--------|----------|---------|
| `nestjs-service-generator.prompt.md` | Create NestJS services/modules | @nestjs-service |
| `javascript-typescript-jest.prompt.md` | Generate Jest tests | @jest-tests |
| `test-generation.prompt.md` | Full test suite generation | @test-generation |
| `create-implementation-plan.prompt.md` | Plan feature implementation | @implementation-plan |
| `create-technical-spike.prompt.md` | Research & spike tasks | @technical-spike |

#### 📋 Documentation Prompts

| Prompt | Use Case |
|--------|----------|
| `create-specification.prompt.md` | Create detailed specs |
| `create-architectural-decision-record.prompt.md` | Document ADRs |
| `conventional-commit.prompt.md` | Format commit messages |

#### 🛡️ Security & Performance

| Prompt | Use Case |
|--------|----------|
| `postgresql-optimization.prompt.md` | Optimize Prisma/PostgreSQL |
| `postgresql-code-review.prompt.md` | Review database code |
| `sql-optimization.prompt.md` | Optimize SQL queries |

### Specialized Agents

#### 🏗️ Architecture & Planning

| Agent | Description |
|-------|-------------|
| `high-level-big-picture-architect.agent.md` | System design & architecture decisions |
| `principal-software-engineer.agent.md` | Technical guidance & mentoring |
| `plan-mode-strategic-planning.agent.md` | Feature planning & breakdown |
| `implementation-plan-generation-mode.agent.md` | Detailed implementation planning |

#### 🧪 Testing & Quality

| Agent | Description |
|-------|-------------|
| `playwright-tester.agent.md` | E2E test generation & debugging |
| `tdd-red.tdd-green.tdd-refactor.agent.md` | TDD workflow assistance |
| `security-focused-code-review.agent.md` | Security audit & fixes |

#### 📊 Database & Infrastructure

| Agent | Description |
|-------|-------------|
| `postgresql-dba.agent.md` | PostgreSQL optimization expert |
| `neon-optimization-analyzer.agent.md` | Neon-specific optimization |
| `ms-sql-database-administrator.agent.md` | SQL performance tuning |

#### 🔍 Specialized

| Agent | Description |
|-------|-------------|
| `debug.agent.md` | Complex debugging assistance |
| `research.agent.md` | Technical research & exploration |
| `typescript-mcp-expert.agent.md` | MCP server development |

---

## 🎓 Best Practices

### 1. **Provide Context for Better Suggestions**

❌ **Poor**:
```
Generate a service
```

✅ **Good**:
```
Generate a NestJS service for processing financial transactions with:
- Validation using class-validator
- Database persistence via Prisma
- Audit logging for compliance
- Error handling for invalid amounts
- Following our RBAC patterns
```

### 2. **Use Agents for Specialized Tasks**

Instead of asking Copilot directly, use specialized agents:

```
Switch to "security-focused-code-review" agent
Review this authentication code for OWASP vulnerabilities
```

### 3. **Iterate & Refine**

Don't settle for the first response. Ask follow-up questions:

```
User: "Generate a service for transactions"
Copilot: [Generates service]
User: "Can you add pagination support?"
Copilot: [Updates with pagination]
User: "Add caching for frequently accessed data"
Copilot: [Adds Redis caching]
```

### 4. **Reference Project Standards**

Point Copilot to your guidelines:

```
Based on our coding standards in .github/copilot-instructions.md,
generate a controller that handles transaction approvals
```

### 5. **Test Generated Code**

Always test Copilot-generated code:

```bash
npm run type-check
npm run lint
npm test
```

### 6. **Security-First Mindset**

For financial code, always ask for security review:

```
Generate this function with:
- Input validation
- SQL injection prevention (Prisma parameterization)
- RBAC checks
- Audit logging
- Error handling with no sensitive data exposure
```

---

## 🐛 Troubleshooting

### Issue: Copilot Chat Not Opening

**Solution**:
1. Verify GitHub Copilot Chat extension is installed and enabled
2. Restart VS Code
3. Check GitHub authentication: `GitHub: Sign Out` then sign back in
4. Try alternative shortcut: Click Copilot icon in sidebar

### Issue: Copilot Suggestions Seem Off-Topic

**Solution**:
1. Provide more context and project details
2. Reference specific files or patterns
3. Use agents for specialized tasks
4. Clear chat history and start fresh

### Issue: Generated Code Has Compilation Errors

**Solution**:
1. Run `npm run type-check` to identify issues
2. Ask Copilot: "Fix these TypeScript errors: [error list]"
3. Reference specific instruction files for your tech stack
4. Request Copilot to follow strict mode TypeScript

### Issue: Copilot Not Following Project Conventions

**Solution**:
1. Point to `.github/copilot-instructions.md`
2. Specify file naming conventions (e.g., "use `.service.ts` suffix")
3. Reference specific instruction files
4. Provide example code that follows conventions

### Issue: Chat Performance is Slow

**Solution**:
1. Close unnecessary tabs/files
2. Reduce context window (select less code before chat)
3. Check internet connection
4. Sign out and sign back in to GitHub

---

## 🔄 Development Workflow Integration

### Daily Development Flow

```
1. Read Task from Issue/PR
   ↓
2. Ask Copilot for Implementation Plan
   (Use: @implementation-plan prompt)
   ↓
3. Generate Code with Copilot
   (Use: @nestjs-service or @test-generation)
   ↓
4. Review Code with Copilot
   (Use: @security-focused-code-review agent)
   ↓
5. Write Tests with Copilot
   (Use: @jest-tests or @playwright-tester)
   ↓
6. Optimize with Copilot
   (Use: @postgresql-optimization for DB code)
   ↓
7. Commit with Convention
   (Use: @conventional-commit prompt)
   ↓
8. Create PR
```

### Feature Development Checklist

When starting a new feature, use this workflow:

- [ ] **Plan**: Ask Copilot for feature breakdown
  ```
  @implementation-plan: Break down [Feature Name] into implementation steps
  ```

- [ ] **Design**: Request architecture review
  ```
  @high-level-big-picture-architect: Design the system for [Feature]
  ```

- [ ] **Implement**: Generate code with best practices
  ```
  @nestjs-service: Generate [ServiceName] with [requirements]
  ```

- [ ] **Test**: Generate comprehensive tests
  ```
  @jest-tests: Generate unit tests for [Service]
  @playwright-tester: Generate E2E tests for [Feature]
  ```

- [ ] **Secure**: Security review
  ```
  @security-focused-code-review: Review [code] for security
  ```

- [ ] **Optimize**: Database/performance review
  ```
  @postgresql-dba: Optimize this query
  ```

- [ ] **Document**: Generate documentation
  ```
  Create ADR for [Decision] with reasoning
  ```

### Common Workflows

#### 🆕 Creating a New Module

1. **Plan the module**
   ```
   @implementation-plan: Break down UserModule into components
   ```

2. **Generate service**
   ```
   @nestjs-service: Generate UserService with CRUD operations
   ```

3. **Generate controller**
   ```
   @nestjs-service: Generate UserController for UserService
   ```

4. **Generate tests**
   ```
   @jest-tests: Generate tests for UserService and UserController
   ```

5. **Add to module**
   ```
   Ask Copilot to update user.module.ts with the new services
   ```

#### 🐛 Fixing a Bug

1. **Understand the issue**
   ```
   @debug: Help me debug [error message and code location]
   ```

2. **Get fix suggestion**
   ```
   Ask Copilot for the fix with context
   ```

3. **Add test for the fix**
   ```
   @jest-tests: Generate test that would catch this bug
   ```

4. **Code review**
   ```
   @security-focused-code-review: Review this bug fix
   ```

#### 📈 Performance Optimization

1. **Identify bottlenecks**
   ```
   @postgresql-dba: Analyze this query for performance
   ```

2. **Get optimization suggestions**
   ```
   Ask Copilot for optimization strategies
   ```

3. **Implement optimization**
   ```
   Request code implementation for the optimization
   ```

4. **Test improvements**
   ```
   @jest-tests: Generate tests to verify performance improvements
   ```

---

## 📞 Getting Help

### Within VS Code

1. **Copilot Chat Help**: `Ctrl+Shift+I` → Type your question
2. **Right-click on code** → "Explain this code"
3. **Select code** → "Generate tests" or "Refactor"

### In Prompts

When using prompts, Copilot can reference:
- `#file` - Current file
- `#selection` - Selected code
- `#codebase` - Your project structure
- `#git` - Git history

Example:
```
Generate a test for #selection following patterns in #codebase
```

### For Complex Tasks

Use specialized agents:

1. **Architecture questions** → `@high-level-big-picture-architect`
2. **Security concerns** → `@security-focused-code-review`
3. **Database optimization** → `@postgresql-dba`
4. **Testing strategy** → `@playwright-tester`
5. **General guidance** → `@principal-software-engineer`

---

## 📊 Monitoring Your Usage

Track Copilot usage effectiveness:

```bash
# Check your recent commits
git log --oneline -20

# Review code quality metrics
npm run lint
npm run test:coverage

# Check build status
npm run build
```

---

## ✅ Verification Checklist

Ensure your Copilot setup is complete:

- [ ] GitHub Copilot extension installed
- [ ] GitHub Copilot Chat extension installed
- [ ] Signed in to GitHub Copilot
- [ ] Can open Copilot Chat (Ctrl+Shift+I)
- [ ] VS Code settings configured
- [ ] Preflight checks pass (`npm run preflight`)
- [ ] Can generate code suggestions
- [ ] Can use prompt templates
- [ ] Can switch between agents
- [ ] Security review agent works

---

## 🔗 Related Resources

- **Main Instructions**: [.github/copilot-instructions.md](../copilot-instructions.md)
- **Instructions Directory**: [.github/instructions/](../instructions/)
- **Prompts Directory**: [.github/prompts/](../prompts/)
- **Agents Directory**: [.github/agents/](../agents/)
- **Awesome Copilot**: https://github.com/github/awesome-copilot
- **Copilot Documentation**: https://github.com/features/copilot
- **Project README**: [README.md](../../README.md)

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-10 | Initial setup guide with comprehensive examples and workflows |

---

**Last Updated**: December 10, 2025  
**Maintainer**: Development Team  
**Questions?** Refer to [COPILOT_SETUP_COMPLETE.md](./COPILOT_SETUP_COMPLETE.md) for setup details
