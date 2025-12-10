# Husky Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Hooks

### pre-commit

Runs before each commit:

- **lint-staged**: Formats and lints only staged files (ESLint + Prettier)
- **Type check**: Validates TypeScript types on staged files

### pre-push

Runs before pushing to remote:

- **Type check**: Full TypeScript type checking
- **Lint**: Full ESLint check
- **Unit tests**: Runs unit tests (fast, excludes E2E)

### commit-msg

Validates commit message format:

- Enforces [Conventional Commits](https://www.conventionalcommits.org/) format
- Format: `type(scope): subject`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

## Examples

### Valid commit messages:

```
feat(transaction): add validation for amount input
fix(auth): resolve JWT token expiration issue
docs(readme): update installation instructions
refactor(models): simplify user model operations
test(transaction): add unit tests for validator
chore(deps): update dependencies
```

### Invalid commit messages:

```
added new feature
fix bug
update
WIP
```

## Bypassing Hooks (Not Recommended)

If you need to bypass hooks in emergency situations:

```bash
# Skip pre-commit hook
git commit --no-verify -m "emergency fix"

# Skip pre-push hook
git push --no-verify
```

**Warning**: Only use `--no-verify` in genuine emergencies. All code should pass hooks before being committed/pushed.

## Configuration

- **lint-staged**: Configured in `package.json` under `lint-staged` key
- **Husky**: Configured via `prepare` script in `package.json`

## Troubleshooting

### Hooks not running

1. Ensure Husky is installed: `npm install`
2. Reinstall hooks: `npm run prepare`
3. Check hook permissions: `ls -la .husky/`

### Type check fails

- Run `npm run type-check` to see all errors
- Fix TypeScript errors before committing

### Lint fails

- Run `npm run lint:fix` to auto-fix issues
- Manually fix remaining issues

### Tests fail

- Run `npm run test:unit` to see failing tests
- Fix tests before pushing
