# GitHub Copilot Troubleshooting & FAQ

**Project**: WhatsApp Cashflow Bot  
**Updated**: December 10, 2025

---

## 🔍 Troubleshooting Guide

### Opening & Connectivity Issues

#### ❌ Copilot Chat Won't Open

**Symptoms**:
- `Ctrl+Shift+I` doesn't open chat
- Chat icon missing from sidebar
- "GitHub Copilot Chat not found" error

**Solutions** (in order):
1. **Verify extension is installed**
   ```
   VS Code → Extensions (Ctrl+Shift+X)
   Search: "GitHub Copilot Chat"
   Status: Should show "Installed"
   ```

2. **Enable the extension**
   ```
   If showing "Install" button, click it
   Then reload VS Code (Ctrl+R)
   ```

3. **Restart VS Code**
   ```
   Close all VS Code windows
   Reopen VS Code
   Try Ctrl+Shift+I again
   ```

4. **Clear VS Code cache**
   ```bash
   # Linux/Mac
   rm -rf ~/.config/Code
   
   # Windows
   rmdir %APPDATA%\Code
   
   # Then restart VS Code
   ```

5. **Reinstall extensions**
   ```
   Uninstall both: GitHub Copilot, GitHub Copilot Chat
   Restart VS Code
   Reinstall from marketplace
   ```

6. **Check VS Code version**
   ```
   Help → About
   Should be v1.95 or newer
   If older, update VS Code
   ```

---

#### ❌ "You are not authenticated"

**Symptoms**:
- Chat shows "Sign in with GitHub" button
- Can't authenticate
- Auth flow fails

**Solutions**:
1. **Sign out completely**
   ```
   Click GitHub Copilot icon in sidebar
   Select: GitHub > Sign Out
   Close VS Code completely
   Reopen VS Code
   ```

2. **Use GitHub authentication**
   ```
   Click Copilot icon
   Click "Sign in with GitHub"
   Complete browser flow
   Allow all requested permissions
   ```

3. **Check GitHub account**
   ```
   Go to: github.com/settings/copilot
   Verify: Subscription is active
   If inactive, renew subscription
   ```

4. **Verify internet connection**
   ```
   Check network connectivity
   Try accessing github.com in browser
   Disable VPN temporarily if using
   ```

5. **Clear browser cache**
   ```
   If auth fails in browser:
   Clear browser cookies/cache
   Try authentication again
   ```

---

#### ❌ Network/Timeout Errors

**Symptoms**:
- "Network error"
- "Request timeout"
- Chat freezes

**Solutions**:
1. **Check internet**
   ```bash
   # Verify connectivity
   ping github.com
   # Or open github.com in browser
   ```

2. **Check firewall/proxy**
   ```
   If behind corporate proxy:
   VS Code → Settings
   Search: "proxy"
   Configure proxy settings
   ```

3. **Reduce context size**
   ```
   Don't select huge code blocks
   Keep selection <1000 lines
   Try chat without code context
   ```

4. **Close other extensions**
   ```
   Disable other heavy extensions temporarily
   Reload VS Code
   Try chat again
   ```

5. **Restart VS Code**
   ```
   Close and reopen VS Code
   Try chat again
   ```

---

### Code Generation Issues

#### ❌ Generated Code Has Errors

**Symptoms**:
- TypeScript compilation errors
- "Cannot find module" errors
- Import path errors

**Solutions**:
1. **Run type checking**
   ```bash
   npm run type-check
   # Shows exact errors
   ```

2. **Fix imports**
   ```
   Copy error list from type-check
   Ask Copilot: "Fix these TypeScript errors: [errors]"
   Reference project structure
   ```

3. **Provide more context**
   ```
   Next time, tell Copilot:
   "Generate code following our project structure in src/"
   "Use relative imports like ../services/user"
   "Include proper error handling"
   ```

4. **Reference examples**
   ```
   Show Copilot similar working code
   Ask: "Generate similar code for [new class]"
   ```

5. **Run tests**
   ```bash
   npm test
   # Shows runtime errors
   ```

---

#### ❌ Code Doesn't Follow Conventions

**Symptoms**:
- Wrong file naming (e.g., `User.service.ts` instead of `user.service.ts`)
- Missing decorators
- Wrong directory structure
- Inconsistent styling

**Solutions**:
1. **Reference instructions explicitly**
   ```
   "Following .github/copilot-instructions.md, generate..."
   "Following .github/instructions/typescript-nodejs-nestjs.instructions.md..."
   ```

2. **Point to working examples**
   ```
   "Look at src/services/user/user.service.ts for pattern"
   "Follow the same structure"
   ```

3. **Specify exact requirements**
   ```
   "Use kebab-case filenames: my-service.ts"
   "Add @Injectable() decorator"
   "Place in src/services/[feature]/ directory"
   "Use export class MyService implementation"
   ```

4. **Provide explicit examples**
   ```
   "Paste example and generate similar code"
   Show Copilot a working service
   ```

5. **Run formatter after**
   ```bash
   npm run format
   # Applies Prettier formatting
   ```

---

#### ❌ Tests Won't Run

**Symptoms**:
- `npm test` fails
- "Cannot find test file"
- Import errors in tests
- Assertion syntax wrong

**Solutions**:
1. **Check test file location**
   ```
   Tests should be in:
   - tests/unit/
   - tests/integration/
   - tests/e2e/
   
   Or alongside code in tests/ directory
   ```

2. **Verify Jest config**
   ```bash
   cat jest.config.js
   # Check testMatch patterns
   ```

3. **Tell Copilot the framework**
   ```
   "Generate Jest tests using jest.config.js"
   "Use describe/it blocks"
   "Use expect() assertions"
   ```

4. **Reference existing tests**
   ```
   Show Copilot: tests/unit/lib/cache.test.ts
   Say: "Generate similar tests for [new file]"
   ```

5. **Run with verbose output**
   ```bash
   npm test -- --verbose
   # Shows detailed error info
   ```

---

#### ❌ E2E Tests Not Finding Elements

**Symptoms**:
- "Element not found"
- "Timeout waiting for selector"
- Playwright tests fail

**Solutions**:
1. **Use stable selectors**
   ```typescript
   // ❌ Don't use class selectors (fragile)
   page.click('.button-primary')
   
   // ✅ Use data-testid
   page.click('[data-testid="submit-button"]')
   ```

2. **Use role-based locators**
   ```typescript
   // ✅ Most robust
   page.getByRole('button', { name: 'Submit' })
   page.getByLabel('Email')
   page.getByText('Success')
   ```

3. **Add explicit waits**
   ```typescript
   // Wait for element to be visible
   await expect(page.locator('#message')).toBeVisible()
   ```

4. **Check test data**
   ```
   Ensure database has test data
   Run migrations before tests
   Check test setup in tests/setup.ts
   ```

5. **Run in headed mode**
   ```bash
   # See what's happening
   npm test -- --headed
   ```

---

### Performance Issues

#### ❌ Chat is Slow / Freezing

**Symptoms**:
- Typing lags
- Responses take >10 seconds
- Chat becomes unresponsive

**Solutions**:
1. **Close unused tabs**
   ```
   Close other VS Code tabs
   Minimize other applications
   Close large files
   ```

2. **Reduce code context**
   ```
   Don't select entire files
   Select <1000 lines max
   Use summary instead of full code
   ```

3. **Clear chat history**
   ```
   Start new chat conversation
   Sometimes old messages slow things down
   ```

4. **Restart VS Code**
   ```
   Close completely
   Reopen
   Try chat again
   ```

5. **Disable extensions**
   ```
   Try disabling heavy extensions temporarily:
   - Remote Development
   - Docker
   - Live Share
   - Database extensions
   ```

6. **Check network**
   ```bash
   ping github.com
   # Should be <50ms
   ```

---

#### ❌ Generation Takes Too Long

**Symptoms**:
- "Generating..." takes >1 minute
- API seems stuck
- Chat shows "Rate limited" error

**Solutions**:
1. **Simplify request**
   ```
   ❌ "Generate entire module with all components"
   ✅ "Generate just the service"
   ```

2. **Break into steps**
   ```
   Instead of one big request:
   1. Generate service
   2. Generate controller
   3. Generate tests
   ```

3. **Use smaller context**
   ```
   Don't reference entire codebase
   Just reference 1-2 similar files
   ```

4. **Check rate limiting**
   ```
   If "Rate limited" appears:
   Wait 5 minutes
   Try again
   Upgrade if hitting limits
   ```

5. **Use faster agents**
   ```
   Some agents are slower
   Try simpler requests first
   Use direct prompts instead of chat
   ```

---

### Code Quality Issues

#### ❌ Generated Code Needs Refactoring

**Symptoms**:
- Code works but looks messy
- Too many nested conditionals
- Missing error handling
- Code duplication

**Solutions**:
1. **Ask for refactoring**
   ```
   "Refactor this code for clarity"
   Select the code
   Ask: "Simplify this"
   ```

2. **Use refactor agent**
   ```
   Ask: "@principal-software-engineer: Suggest improvements"
   Paste code
   Get recommendations
   ```

3. **Request specific improvements**
   ```
   "Extract this into a separate method"
   "Reduce nesting in this function"
   "Add error handling"
   "Remove code duplication"
   ```

4. **Apply patterns**
   ```
   "Refactor using the repository pattern"
   "Apply dependency injection"
   "Extract to separate service"
   ```

5. **Run code quality tools**
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   ```

---

#### ❌ Security Concerns in Generated Code

**Symptoms**:
- Potential SQL injection
- Missing input validation
- No authentication checks
- Secrets exposed

**Solutions**:
1. **Use security review agent**
   ```
   Switch to: @security-focused-code-review
   Paste code
   Request security review
   ```

2. **Always ask for security**
   ```
   When generating code:
   "Generate with input validation"
   "Include OWASP protections"
   "Add security checks"
   ```

3. **Reference security guidelines**
   ```
   "Follow .github/instructions/security-and-owasp.instructions.md"
   "Include RBAC checks"
   "Use parameterized queries"
   ```

4. **Test for vulnerabilities**
   ```bash
   npm audit
   # Shows known vulnerabilities
   ```

5. **Manual review**
   ```
   Have security team review financial code
   Ask Copilot for security checklist
   Verify all inputs validated
   ```

---

## ❓ Frequently Asked Questions

### General Questions

**Q: Do I need Copilot to use this setup?**
A: No! All instructions and prompts work without Copilot. But Copilot makes them more powerful by providing AI-assisted code generation and suggestions.

**Q: Is my code secure when using Copilot?**
A: GitHub Copilot doesn't send your code to training. Code sent to Copilot API has enterprise privacy protections. Always review generated code for secrets before committing.

**Q: Can I use Copilot offline?**
A: No, Copilot requires internet connection to GitHub's servers. You can continue coding, but suggestions won't appear.

**Q: How much does Copilot cost?**
A: $10/month for individuals, free for students, enterprise pricing available. Check github.com/features/copilot for current pricing.

---

### Using Instructions & Prompts

**Q: How do I reference instructions in chat?**
A: Link directly:
```
Following .github/instructions/typescript-nodejs-nestjs.instructions.md, 
generate a service with...
```

**Q: Which prompt should I use?**
A: Choose based on your task:
- Creating service → @nestjs-service
- Writing tests → @jest-tests or @playwright-tester
- Planning → @implementation-plan
- Security → @security-focused-code-review
- Database → @postgresql-dba

**Q: Can I create custom prompts?**
A: Yes! Copy existing prompts and modify them. Keep them in `.github/prompts/`.

**Q: How do I use agents?**
A: Type `/` in chat to see agent list, or use @ mentions:
```
@security-focused-code-review: Review this code
```

---

### Best Practices

**Q: Should I trust all Copilot suggestions?**
A: No! Always:
1. Review generated code
2. Run type checking
3. Run tests
4. Get peer review
5. Security review for sensitive code

**Q: How do I improve code generation quality?**
A: Provide better context:
- Point to similar working code
- Reference specific files
- Give detailed requirements
- Ask iteratively instead of all-at-once

**Q: Can Copilot do code reviews?**
A: Yes! Use @security-focused-code-review agent for security review, @principal-software-engineer for general review.

**Q: Should I commit Copilot-generated code as-is?**
A: No! Always:
1. Test thoroughly
2. Run type-check and lint
3. Run full test suite
4. Get peer review
5. Format code

---

### Project-Specific Questions

**Q: How do I generate a financial transaction service?**
A:
```
@nestjs-service: Generate TransactionService with:
- Full RBAC checks (financial-rbac-security.instructions.md)
- Audit logging for every transaction
- Input validation using class-validator
- Error handling with no sensitive data exposure
- Transaction support (database ACID)
- Method: processTransaction(), validateAmount(), recordAudit()
```

**Q: How do I write tests for a database service?**
A:
```
@jest-tests: Generate tests for TransactionService with:
- Unit tests using Jest
- Mocked repository layer
- Tests for success and error scenarios
- Transaction rollback testing
- Audit log verification
- Following jest.config.js patterns
```

**Q: How do I optimize a slow Prisma query?**
A:
```
Switch to: @postgresql-dba
Paste the query
Ask: "Optimize this Prisma query. Check for N+1, missing indexes, 
caching opportunities. We use TimescaleDB for time-series data."
```

**Q: Can Copilot help with WhatsApp integration?**
A: Yes, but limited. For specific wwebjs issues:
```
Ask Copilot general questions
Check wwebjs documentation for specific issues
Use @research agent to explore solutions
```

---

### Troubleshooting Troubleshooting

**Q: I tried all solutions and it still doesn't work**
A: Try:
1. Completely uninstall/reinstall VS Code
2. Check GitHub support: github.com/github/copilot
3. Check VS Code support: code.visualstudio.com/docs
4. Check project docs: `/docs/` directory
5. Ask team members

**Q: Where do I report bugs?**
A: 
- VS Code issues: https://github.com/microsoft/vscode
- Copilot issues: https://github.com/github/feedback
- Project issues: Create GitHub issue in this repo

**Q: How do I get more Copilot help?**
A: Resources:
- Copilot documentation: https://github.com/features/copilot
- Awesome Copilot: https://github.com/github/awesome-copilot
- VS Code docs: https://code.visualstudio.com/docs
- This guide: `.github/COPILOT_SETUP_GUIDE.md`

---

## 🆘 Getting Help

### For Setup Issues
1. Check: `.github/COPILOT_SETUP_VERIFICATION.md`
2. Verify: VS Code extensions installed
3. Run: `npm run preflight`
4. Check: This troubleshooting guide

### For Usage Questions
1. Read: `.github/COPILOT_SETUP_GUIDE.md`
2. Check: `.github/COPILOT_QUICK_REFERENCE.md`
3. Review: Example interactions in this guide
4. Ask: Team members

### For Code Generation Issues
1. Provide context: Reference similar files
2. Be specific: Exact requirements
3. Test: Run type-check and tests
4. Iterate: Ask follow-up questions

### For Security Issues
1. Use: @security-focused-code-review agent
2. Review: `.github/instructions/security-and-owasp.instructions.md`
3. Test: Run npm audit
4. Verify: Manual security review

---

## 📞 Support Channels

| Issue Type | Contact | Response Time |
|-----------|---------|----------------|
| Setup help | Team slack #dev | <1 hour |
| Code generation | Copilot chat | Immediate |
| Security review | @security-focused-code-review | Immediate |
| GitHub issues | github.com issues | 24-48 hours |

---

## 🔗 Related Resources

- **Setup Guide**: [COPILOT_SETUP_GUIDE.md](./COPILOT_SETUP_GUIDE.md)
- **Quick Reference**: [COPILOT_QUICK_REFERENCE.md](./COPILOT_QUICK_REFERENCE.md)
- **Verification Checklist**: [COPILOT_SETUP_VERIFICATION.md](./COPILOT_SETUP_VERIFICATION.md)
- **Main Instructions**: [copilot-instructions.md](./copilot-instructions.md)
- **Awesome Copilot**: https://github.com/github/awesome-copilot
- **GitHub Support**: https://github.com/support

---

**Last Updated**: December 10, 2025  
**File**: `.github/COPILOT_TROUBLESHOOTING.md`

---

## ✅ Still Having Issues?

Try this final checklist:
1. [ ] Restart VS Code completely
2. [ ] Disconnect from VPN (if using)
3. [ ] Check internet connection
4. [ ] Re-authenticate with GitHub
5. [ ] Check GitHub status: https://www.githubstatus.com
6. [ ] Update VS Code to latest
7. [ ] Update Copilot extensions
8. [ ] Clear VS Code cache
9. [ ] Check project setup: `npm run preflight`
10. [ ] Ask in team Slack

**If all else fails**, provide:
- VS Code version
- Extension versions
- Error message (full)
- Steps to reproduce
- Project structure info
- Node version

Post in #dev channel or create GitHub issue with above info.

Good luck! 🚀
