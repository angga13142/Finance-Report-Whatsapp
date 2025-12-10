# npm Preflight Checks

This project implements comprehensive preflight checks using npm lifecycle hooks to validate environment, dependencies, and code quality before critical operations.

## Overview

Preflight checks ensure that:

- Node.js version meets requirements before installation
- Code quality standards are met before building
- Environment and services are ready before starting
- Package is valid and safe before publishing

## Lifecycle Hooks

### Pre-install Hook (`preinstall`)

**Script**: `scripts/preflight/check-node-version.js`

Runs automatically before `npm install` to validate:

- Node.js version >= 20.0.0 (from `engines.node`)
- npm version >= 9.0.0 (recommended)
- Platform compatibility (Linux, macOS, Windows)

**Exit Codes**:

- `0`: Success
- `2`: Node version mismatch
- `1`: General error

**Bypass**: Set `SKIP_PREINSTALL=true` environment variable

**Example**:

```bash
# Normal install (runs preinstall check)
npm install

# Skip preinstall check (emergency only)
SKIP_PREINSTALL=true npm install
```

### Pre-build Hook (`prebuild`)

**Script**: `scripts/preflight/check-build-prerequisites.js`

Runs automatically before `npm run build` to validate:

- TypeScript configuration exists (`tsconfig.json`)
- Prisma schema is valid
- Type check passes (`npm run type-check`)
- Lint check passes (`npm run lint`)

**Exit Codes**:

- `0`: Success
- `5`: Build prerequisites failed
- `1`: General error

**Bypass**: Set `SKIP_PREBUILD=true` environment variable

**Example**:

```bash
# Normal build (runs prebuild check)
npm run build

# Skip prebuild check (emergency only)
SKIP_PREBUILD=true npm run build
```

### Pre-start Hook (`prestart`)

**Script**: `scripts/preflight/check-start-prerequisites.js`

Runs automatically before `npm start` to validate:

- Required environment variables are set:
  - `DATABASE_URL` (PostgreSQL connection string)
  - `REDIS_HOST` (Redis host)
  - `JWT_SECRET` (JWT secret key)
- Prisma Client is generated
- Database connection is successful
- Redis connection is successful (warning if fails, doesn't block)

**Exit Codes**:

- `0`: Success
- `3`: Environment variable missing
- `4`: Database connection failed
- `1`: General error

**Bypass**: Set `SKIP_PRESTART=true` environment variable

**Example**:

```bash
# Normal start (runs prestart check)
npm start

# Skip prestart check (emergency only)
SKIP_PRESTART=true npm start
```

### Pre-publish Hook (`prepublishOnly`)

**Script**: `scripts/preflight/check-publish-prerequisites.js`

Runs automatically before `npm publish` to validate:

- Required package.json fields (name, version, description, license)
- Version follows semantic versioning
- No sensitive data in package.json
- Build output exists (`dist/` directory)
- Git status (warns about uncommitted changes)
- Full build and test suite

**Exit Codes**:

- `0`: Success
- `1`: General error

**Note**: This hook cannot be easily bypassed as it's part of npm's publish process.

**Example**:

```bash
# Normal publish (runs prepublishOnly check)
npm publish

# The hook will:
# 1. Check package.json fields
# 2. Check for sensitive data
# 3. Check build output
# 4. Run build
# 5. Run tests
```

## Required Environment Variables

### Required (Pre-start)

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis host address
- `JWT_SECRET`: JWT secret key (minimum 32 characters)

### Optional (Pre-start)

- `REDIS_PASSWORD`: Redis password (if required)
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_DB`: Redis database number (default: 0)
- `NODE_ENV`: Environment (development, production, test)
- `PORT`: Application port (default: 3000)

## Error Codes

| Code | Meaning                      | Common Causes                               |
| ---- | ---------------------------- | ------------------------------------------- |
| 0    | Success                      | -                                           |
| 1    | General error                | Unexpected error                            |
| 2    | Node version mismatch        | Node.js version < 20.0.0                    |
| 3    | Environment variable missing | Required env var not set                    |
| 4    | Database connection failed   | PostgreSQL not running or wrong credentials |
| 5    | Build prerequisites failed   | Type check or lint failed                   |

## Best Practices

### 1. Don't Bypass Hooks

Hooks are there for a reason. Only bypass in genuine emergencies:

- Production incident requiring immediate fix
- CI/CD environment with different validation
- Development environment setup

### 2. Fix Issues Early

Run checks manually before committing:

```bash
# Check Node version
node scripts/preflight/check-node-version.js

# Check build prerequisites
node scripts/preflight/check-build-prerequisites.js

# Check start prerequisites
node scripts/preflight/check-start-prerequisites.js
```

### 3. Environment Variables

Always use `.env` file for local development:

```bash
# Copy example
cp .env.example .env

# Edit with your values
nano .env
```

Never commit `.env` file to git (already in `.gitignore`).

### 4. CI/CD Integration

In CI/CD pipelines, you may want to skip certain checks:

```bash
# CI environment
SKIP_PREINSTALL=true npm ci
SKIP_PREBUILD=true npm run build
```

## Troubleshooting

### Pre-install Fails

**Error**: Node.js version mismatch

**Solution**:

```bash
# Check current version
node --version

# Upgrade Node.js (using nvm)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### Pre-build Fails

**Error**: Type check or lint failed

**Solution**:

```bash
# Fix TypeScript errors
npm run type-check

# Auto-fix linting issues
npm run lint:fix

# Then rebuild
npm run build
```

### Pre-start Fails

**Error**: Database connection failed

**Solution**:

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Or start PostgreSQL
docker-compose -f docker/docker-compose.dev.yml up -d postgres

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

**Error**: Redis connection failed

**Solution**:

```bash
# Check Redis is running
docker ps | grep redis

# Or start Redis
docker-compose -f docker/docker-compose.dev.yml up -d redis

# Verify REDIS_HOST in .env
cat .env | grep REDIS_HOST
```

### Pre-publish Fails

**Error**: Missing package.json fields

**Solution**: Update `package.json` with required fields:

- `name`: Package name
- `version`: Semantic version (e.g., 1.0.0)
- `description`: Package description
- `license`: License (e.g., ISC, MIT)

**Error**: Sensitive data detected

**Solution**: Remove sensitive data from `package.json`:

- Use environment variables instead
- Don't hardcode secrets
- Review package.json before publishing

## Integration with Husky

Preflight checks complement Husky hooks:

- **Husky hooks**: Run on git operations (commit, push)
- **npm preflight**: Run on npm operations (install, build, start, publish)

Both ensure code quality at different stages:

- Husky: Before code enters repository
- Preflight: Before code is built/started/published

## Scripts Location

All preflight scripts are located in:

```
scripts/preflight/
├── check-node-version.js          # Pre-install
├── check-build-prerequisites.js   # Pre-build
├── check-start-prerequisites.js   # Pre-start
├── check-publish-prerequisites.js # Pre-publish
└── utils.js                       # Shared utilities
```

## Manual Testing

Test each hook manually:

```bash
# Test pre-install
node scripts/preflight/check-node-version.js

# Test pre-build
node scripts/preflight/check-build-prerequisites.js

# Test pre-start (requires .env)
node scripts/preflight/check-start-prerequisites.js

# Test pre-publish
node scripts/preflight/check-publish-prerequisites.js
```

## References

- [npm Lifecycle Scripts](https://docs.npmjs.com/cli/v9/using-npm/scripts#life-cycle-scripts)
- [npm Scripts Best Practices](https://docs.npmjs.com/cli/v9/using-npm/scripts#best-practices)
- [Semantic Versioning](https://semver.org/)
