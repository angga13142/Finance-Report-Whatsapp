# Preflight Checks - Quick Reference

## Available Commands

| Command                     | Purpose                        | When to Use                     |
| --------------------------- | ------------------------------ | ------------------------------- |
| `npm run preflight`         | Run all checks (comprehensive) | Before commits, deployments     |
| `npm run preflight:node`    | Check Node.js version only     | After Node.js updates           |
| `npm run preflight:build`   | Check build prerequisites      | Before building for production  |
| `npm run preflight:start`   | Check environment & database   | Before starting the application |
| `npm run preflight:publish` | Check publish prerequisites    | Before publishing to registry   |

## What Each Check Validates

### 📦 preflight:node

- ✅ Node.js version >= 20.0.0
- ✅ npm version >= 9.0.0
- ✅ Platform compatibility (Linux, macOS, Windows)
- ✅ engines.node requirement from package.json

**Exit codes**: 0 (success), 2 (version mismatch), 1 (error)

### 🔨 preflight:build

- ✅ TypeScript configuration exists (tsconfig.json)
- ✅ Prisma schema is valid
- ✅ Prisma Client is generated
- ✅ Type checking passes (tsc --noEmit)
- ✅ Linting passes (eslint)

**Exit codes**: 0 (success), 5 (build failed), 1 (error)

### 🚀 preflight:start

- ✅ Required environment variables are set:
  - `DATABASE_URL`
  - `REDIS_HOST`
  - `JWT_SECRET`
- ✅ Prisma Client is generated
- ✅ Database connection succeeds
- ⚠️ Redis connection (warning only)

**Exit codes**: 0 (success), 3 (env missing), 4 (database failed), 1 (error)

### 📤 preflight:publish

- ✅ Package version is valid
- ✅ All tests pass
- ✅ No uncommitted changes
- ✅ Build succeeds
- ✅ Security audit passes

**Exit codes**: 0 (success), 6 (publish check failed), 1 (error)

## Quick Usage Examples

### Before Committing

```bash
# Run all checks
npm run preflight

# If all pass, commit safely
git add .
git commit -m "feat: add new feature"
```

### Before Deployment

```bash
# Check build prerequisites
npm run preflight:build

# Build for production
npm run build

# Check start prerequisites
npm run preflight:start

# Start application
npm start
```

### Troubleshooting Failed Checks

#### Node Version Mismatch

```bash
# Check current version
node --version

# Install Node.js 20+ using nvm
nvm install 20
nvm use 20
```

#### Build Prerequisites Failed

```bash
# Fix TypeScript errors
npm run type-check

# Fix linting issues
npm run lint:fix

# Validate Prisma schema
npx prisma validate

# Generate Prisma Client
npm run prisma:generate
```

#### Start Prerequisites Failed

```bash
# Check .env file exists
ls -la .env

# Verify required variables are set
grep -E "DATABASE_URL|REDIS_HOST|JWT_SECRET" .env

# Start infrastructure services
docker-compose -f docker/docker-compose.dev.yml up -d

# Test database connection
npm run prisma:migrate
```

## Bypassing Checks (Emergency Only)

```bash
# Skip preinstall check
SKIP_PREINSTALL=true npm install

# Skip prebuild check
SKIP_PREBUILD=true npm run build

# Skip prestart check
SKIP_PRESTART=true npm start
```

⚠️ **Warning**: Only bypass checks in genuine emergencies. They exist to prevent production issues.

## Automatic Checks (Lifecycle Hooks)

These checks run automatically during npm lifecycle events:

| npm Command     | Automatic Check   | Can Skip With          |
| --------------- | ----------------- | ---------------------- |
| `npm install`   | preflight:node    | `SKIP_PREINSTALL=true` |
| `npm run build` | preflight:build   | `SKIP_PREBUILD=true`   |
| `npm start`     | preflight:start   | `SKIP_PRESTART=true`   |
| `npm publish`   | preflight:publish | Not recommended        |

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run preflight checks
  run: npm run preflight

- name: Build application
  run: npm run build

- name: Run tests
  run: npm test
```

### GitLab CI Example

```yaml
preflight:
  stage: validate
  script:
    - npm run preflight

build:
  stage: build
  script:
    - npm run build
  needs: [preflight]
```

## Common Issues & Solutions

### Issue: "Environment variable DATABASE_URL is not set"

**Solution**: Copy `.env.example` to `.env` and configure database connection:

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
```

### Issue: "Prisma Client not generated"

**Solution**: Generate Prisma Client:

```bash
npm run prisma:generate
```

### Issue: "Type check failed"

**Solution**: Fix TypeScript errors:

```bash
npm run type-check
# Review errors and fix them
```

### Issue: "Lint check failed"

**Solution**: Auto-fix linting issues:

```bash
npm run lint:fix
```

### Issue: "Database connection failed"

**Solution**: Ensure Docker services are running:

```bash
docker-compose -f docker/docker-compose.dev.yml up -d
docker-compose -f docker/docker-compose.dev.yml ps
```

## Best Practices

1. ✅ **Run preflight before every commit**

   ```bash
   npm run preflight && git commit
   ```

2. ✅ **Run preflight before deployment**

   ```bash
   npm run preflight && npm run build && npm start
   ```

3. ✅ **Add preflight to your development workflow**

   ```bash
   # In package.json scripts
   "predev": "npm run preflight:build"
   ```

4. ✅ **Integrate with Git hooks** (Husky already configured)
   - Pre-commit: runs lint and format
   - Pre-push: could run preflight

5. ❌ **Don't bypass checks without good reason**
   - Production incidents only
   - Document why you bypassed

## Support

For detailed documentation, see:

- [Full Preflight Documentation](./NPM_PREFLIGHT_CHECKS.md)
- [Husky Setup Guide](./HUSKY_SETUP.md)
- [Main README](../README.md)

For issues or questions:

- Create a GitHub issue
- Check existing documentation
- Review error messages carefully
