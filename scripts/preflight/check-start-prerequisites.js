#!/usr/bin/env node

/**
 * Pre-start check: Validates environment and database connections
 * Exit codes:
 *   0: Success
 *   3: Environment variable missing
 *   4: Database connection failed
 *   1: General error
 */

const { execSync } = require("child_process");
const {
  checkEnvVar,
  formatError,
  formatSuccess,
  formatWarning,
  exists,
} = require("./utils");

// Required environment variables
const REQUIRED_ENV_VARS = ["DATABASE_URL", "REDIS_HOST", "JWT_SECRET"];

// Optional environment variables (warn if missing)
const OPTIONAL_ENV_VARS = [
  "REDIS_PASSWORD",
  "REDIS_PORT",
  "REDIS_DB",
  "NODE_ENV",
  "PORT",
];

function checkEnvironmentVariables() {
  console.log("📦 Checking environment variables...\n");

  const missing = [];
  const warnings = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach((varName) => {
    const result = checkEnvVar(varName);
    if (!result.valid) {
      missing.push(varName);
      console.error(`❌ ${result.error}`);
    } else {
      // Mask sensitive values
      const displayValue =
        varName.includes("SECRET") || varName.includes("PASSWORD")
          ? "***"
          : result.value.substring(0, 20) +
            (result.value.length > 20 ? "..." : "");
      console.log(`✅ ${varName}=${displayValue}`);
    }
  });

  // Check optional variables
  OPTIONAL_ENV_VARS.forEach((varName) => {
    const result = checkEnvVar(varName);
    if (!result.valid) {
      warnings.push(varName);
      console.warn(`⚠️  ${varName} is not set (optional, using default)`);
    } else {
      const displayValue =
        varName.includes("SECRET") || varName.includes("PASSWORD")
          ? "***"
          : result.value;
      console.log(`✅ ${varName}=${displayValue}`);
    }
  });

  if (missing.length > 0) {
    console.error(
      `\n❌ Missing required environment variables: ${missing.join(", ")}`,
    );
    console.error("   Please set them in .env file or environment");
    process.exit(3);
  }

  if (warnings.length > 0) {
    console.warn(
      `\n⚠️  Optional environment variables not set: ${warnings.join(", ")}`,
    );
  }

  return true;
}

function checkPrismaClient() {
  console.log("\n📦 Checking Prisma Client...");

  if (!exists("node_modules/@prisma/client")) {
    console.error("❌ Prisma Client not found");
    console.error("   Run: npm run prisma:generate");
    process.exit(1);
  }

  console.log("✅ Prisma Client exists");
  return true;
}

async function checkDatabaseConnection() {
  console.log("\n📦 Checking database connection...");

  try {
    // Try to connect using Prisma
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    // Simple query to test connection
    await prisma.$connect();
    console.log("✅ Database connection successful");

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(`   Error: ${error.message}`);
    console.error("\n   Suggestions:");
    console.error("   - Check DATABASE_URL in .env file");
    console.error("   - Ensure PostgreSQL is running");
    console.error("   - Verify database credentials");
    process.exit(4);
  }
}

async function checkRedisConnection() {
  console.log("\n📦 Checking Redis connection...");

  try {
    const { createClient } = require("redis");
    const redis = createClient({
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    await redis.connect();
    await redis.ping();
    console.log("✅ Redis connection successful");

    await redis.quit();
    return true;
  } catch (error) {
    console.error("❌ Redis connection failed");
    console.error(`   Error: ${error.message}`);
    console.error("\n   Suggestions:");
    console.error("   - Check REDIS_HOST and REDIS_PORT in .env file");
    console.error("   - Ensure Redis is running");
    console.error("   - Verify Redis credentials if password is set");
    // Don't exit for Redis, just warn (might be optional in some setups)
    console.warn(
      "   ⚠️  Continuing despite Redis connection failure (may be optional)",
    );
    return false;
  }
}

async function main() {
  console.log("🔍 Running pre-start checks...\n");

  try {
    checkEnvironmentVariables();
    checkPrismaClient();

    await checkDatabaseConnection();
    await checkRedisConnection();

    console.log("\n✅ All pre-start checks passed!");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Pre-start check failed: ${error.message}`);
    process.exit(1);
  }
}

// Allow bypass with SKIP_PRESTART environment variable
if (process.env.SKIP_PRESTART === "true") {
  console.log("⚠️  SKIP_PRESTART=true, skipping pre-start checks");
  process.exit(0);
}

main();
