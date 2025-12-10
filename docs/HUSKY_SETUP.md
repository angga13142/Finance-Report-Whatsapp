# Husky Git Hooks Setup

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality standards through Git hooks.

## Overview

Husky hooks ensure that:

- Code is properly formatted and linted before commit
- TypeScript types are validated
- Tests pass before pushing
- Commit messages follow Conventional Commits format

## Installation

Husky is automatically installed when you run `npm install` via the `prepare` script.

To manually install/update hooks:

```bash
npm run prepare
```

## Hooks Configuration

### Pre-commit Hook

Runs before each commit:

1. **lint-staged**: Formats and lints only staged files
   - ESLint auto-fix
   - Prettier formatting
   - Only processes files that are staged (fast!)
2. **Type check**: Validates TypeScript types on staged files only

**What it does:**

- Formats code with Prettier
- Fixes ESLint issues automatically
- Validates TypeScript types

**Time**: ~5-10 seconds (only processes staged files)

### Pre-push Hook

Runs before pushing to remote:

1. **Type check**: Full TypeScript compilation check
2. **Lint**: Full ESLint check across all files
3. **Unit tests**: Runs unit tests (excludes slow E2E tests)

**What it does:**

- Ensures all code compiles correctly
- Ensures no linting errors exist
- Ensures unit tests pass

**Time**: ~30-60 seconds (full project check)

### Commit-msg Hook

Validates commit message format:

- Enforces [Conventional Commits](https://www.conventionalcommits.org/) format
- Format: `type(scope): subject`

**Valid types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commit

**Examples:**

```
✅ feat(transaction): add validation for amount input
✅ fix(auth): resolve JWT token expiration issue
✅ docs(readme): update installation instructions
✅ refactor(models): simplify user model operations
✅ test(transaction): add unit tests for validator
✅ chore(deps): update dependencies

❌ added new feature
❌ fix bug
❌ update
❌ WIP
```

## Configuration Files

### `.lintstagedrc.js`

Configures which files to process and which commands to run:

- TypeScript/JavaScript: ESLint + Prettier
- JSON/Markdown/YAML: Prettier only
- Prisma schema: Prettier

### `package.json`

- `lint-staged`: Configuration for lint-staged
- `prepare`: Script that installs Husky hooks

## Best Practices

### 1. Commit Frequently

- Commit small, logical changes
- Pre-commit hook is fast (only processes staged files)
- Don't accumulate large changes

### 2. Write Good Commit Messages

- Follow Conventional Commits format
- Be descriptive but concise
- Use present tense ("add" not "added")

### 3. Fix Issues Locally

- Don't bypass hooks with `--no-verify`
- Fix linting/type errors before committing
- Run tests locally before pushing

### 4. Use lint-staged

- Only processes changed files (fast!)
- Auto-fixes issues when possible
- Reduces commit time

## Troubleshooting

### Hook not running

```bash
# Reinstall hooks
npm run prepare

# Check hook permissions
ls -la .husky/
chmod +x .husky/pre-commit
```

### Type check fails

```bash
# See all TypeScript errors
npm run type-check

# Fix errors before committing
```

### Lint fails

```bash
# Auto-fix linting issues
npm run lint:fix

# Or manually fix remaining issues
```

### Tests fail

```bash
# Run tests locally
npm run test:unit

# Fix failing tests before pushing
```

### Commit message rejected

- Ensure message follows format: `type(scope): subject`
- Use valid type (feat, fix, docs, etc.)
- Include descriptive subject

## Bypassing Hooks (Emergency Only)

**⚠️ Warning**: Only use in genuine emergencies!

```bash
# Skip pre-commit hook
git commit --no-verify -m "emergency fix"

# Skip pre-push hook
git push --no-verify
```

**Note**: All code should pass hooks before being committed/pushed. Bypassing hooks should be rare exceptions.

## Integration with CI/CD

These hooks complement (but don't replace) CI/CD checks:

- **Hooks**: Fast, local checks before commit/push
- **CI/CD**: Comprehensive checks on all code in PR

Both are important:

- Hooks catch issues early (before PR)
- CI/CD ensures consistency across team

## References

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [Conventional Commits](https://www.conventionalcommits.org/)
