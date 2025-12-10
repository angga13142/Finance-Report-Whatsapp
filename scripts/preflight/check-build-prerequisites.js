#!/usr/bin/env node

/**
 * Pre-build check: Validates build prerequisites
 * Exit codes:
 *   0: Success
 *   5: Build prerequisites failed
 *   1: General error
 */

const { execSync } = require("child_process");
const { exists, getPackageJson } = require("./utils");

function checkTypeScriptConfig() {
  console.log("📦 Checking TypeScript configuration...");

  if (!exists("tsconfig.json")) {
    console.error("❌ tsconfig.json not found");
    return false;
  }

  console.log("✅ tsconfig.json exists");
  return true;
}

function checkPrismaSchema() {
  console.log("📦 Checking Prisma schema...");

  if (!exists("prisma/schema.prisma")) {
    console.error("❌ prisma/schema.prisma not found");
    return false;
  }

  try {
    console.log("   Validating Prisma schema...");
    execSync("npx prisma validate", { stdio: "inherit" });
    console.log("✅ Prisma schema is valid");
    return true;
  } catch (error) {
    console.error("❌ Prisma schema validation failed");
    return false;
  }
}

function checkPrismaClient() {
  console.log("📦 Checking Prisma Client...");

  const clientPath = "node_modules/@prisma/client";
  if (!exists(clientPath)) {
    console.warn("⚠️  Prisma Client not found, will be generated during build");
    console.warn("   Run: npm run prisma:generate");
    // Don't fail, just warn
  } else {
    console.log("✅ Prisma Client exists");
  }
  return true;
}

function runTypeCheck() {
  console.log("📦 Running TypeScript type check...");

  try {
    execSync("npm run type-check", { stdio: "inherit" });
    console.log("✅ Type check passed");
    return true;
  } catch (error) {
    console.error("❌ Type check failed");
    return false;
  }
}

function runLint() {
  console.log("📦 Running ESLint...");

  try {
    execSync("npm run lint", { stdio: "inherit" });
    console.log("✅ Lint check passed");
    return true;
  } catch (error) {
    console.error("❌ Lint check failed");
    console.error("   Run: npm run lint:fix");
    return false;
  }
}

function main() {
  console.log("🔍 Running pre-build checks...\n");

  let allPassed = true;

  // Basic checks (non-blocking warnings)
  checkTypeScriptConfig();
  checkPrismaSchema();
  checkPrismaClient();

  // Critical checks (blocking)
  if (!runTypeCheck()) {
    allPassed = false;
  }

  if (!runLint()) {
    allPassed = false;
  }

  if (!allPassed) {
    console.error("\n❌ Pre-build checks failed. Please fix the errors above.");
    process.exit(5);
  }

  console.log("\n✅ All pre-build checks passed!");
  process.exit(0);
}

// Allow bypass with SKIP_PREBUILD environment variable
if (process.env.SKIP_PREBUILD === "true") {
  console.log("⚠️  SKIP_PREBUILD=true, skipping pre-build checks");
  process.exit(0);
}

main();
