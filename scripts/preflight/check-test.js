#!/usr/bin/env node

/**
 * Pre-test check: Validates test prerequisites and runs all tests
 * Exit codes:
 *   0: Success
 *   6: Test prerequisites failed
 *   1: General error
 */

const { execSync } = require("child_process");
const { exists, getPackageJson } = require("./utils");

function checkJestConfig() {
  console.log("📦 Checking Jest configuration...");

  const jestConfigPaths = [
    "jest.config.js",
    "jest.config.ts",
    "jest.config.json",
    "package.json", // Jest config can be in package.json
  ];

  const hasJestConfig = jestConfigPaths.some((path) => {
    if (path === "package.json") {
      const pkg = getPackageJson();
      return pkg.jest !== undefined;
    }
    return exists(path);
  });

  if (!hasJestConfig) {
    console.warn("⚠️  Jest configuration not found");
    console.warn("   Tests may not run correctly");
    // Don't fail, just warn
  } else {
    console.log("✅ Jest configuration found");
  }
  return true;
}

function checkTestDirectory() {
  console.log("📦 Checking test directory...");

  if (!exists("tests")) {
    console.warn("⚠️  tests/ directory not found");
    console.warn("   No tests to run");
    // Don't fail, just warn
  } else {
    console.log("✅ Test directory exists");
  }
  return true;
}

function runUnitTests() {
  console.log("📦 Running unit tests...");

  try {
    execSync("npm run test:unit", { stdio: "inherit" });
    console.log("✅ Unit tests passed");
    return true;
  } catch (error) {
    console.error("❌ Unit tests failed");
    return false;
  }
}

function runIntegrationTests() {
  console.log("📦 Running integration tests...");

  try {
    execSync("npm run test:integration", { stdio: "inherit" });
    console.log("✅ Integration tests passed");
    return true;
  } catch (error) {
    console.error("❌ Integration tests failed");
    return false;
  }
}

function runAllTests() {
  console.log("📦 Running all tests...");

  try {
    execSync("npm test", { stdio: "inherit" });
    console.log("✅ All tests passed");
    return true;
  } catch (error) {
    console.error("❌ Tests failed");
    return false;
  }
}

function main() {
  console.log("🔍 Running pre-test checks...\n");

  let allPassed = true;

  // Basic checks (non-blocking warnings)
  checkJestConfig();
  checkTestDirectory();

  // Critical checks (blocking)
  if (!runAllTests()) {
    allPassed = false;
  }

  if (!allPassed) {
    console.error("\n❌ Pre-test checks failed. Please fix the errors above.");
    process.exit(6);
  }

  console.log("\n✅ All pre-test checks passed!");
  process.exit(0);
}

// Allow bypass with SKIP_PRETEST environment variable
if (process.env.SKIP_PRETEST === "true") {
  console.log("⚠️  SKIP_PRETEST=true, skipping pre-test checks");
  process.exit(0);
}

main();
