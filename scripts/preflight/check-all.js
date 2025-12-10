#!/usr/bin/env node

/**
 * Comprehensive preflight check: Runs all validation checks
 * Exit codes:
 *   0: Success
 *   1: One or more checks failed
 */

const { execSync } = require("child_process");
const { formatSuccess, formatError } = require("./utils");

console.log("🚀 Running comprehensive preflight checks...\n");

const checks = [
  {
    name: "Node Version",
    script: "scripts/preflight/check-node-version.js",
    description: "Validating Node.js version",
  },
  {
    name: "Build Prerequisites",
    script: "scripts/preflight/check-build-prerequisites.js",
    description: "Checking TypeScript, Prisma, and build tools",
  },
  {
    name: "Lint Check",
    script: "scripts/preflight/check-lint.js",
    description: "Running ESLint validation",
  },
  {
    name: "Start Prerequisites",
    script: "scripts/preflight/check-start-prerequisites.js",
    description: "Validating environment and database connections",
  },
  {
    name: "Test Suite",
    script: "scripts/preflight/check-test.js",
    description: "Running all tests",
  },
];

let failedChecks = 0;

checks.forEach((check, index) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 CHECK ${index + 1}/${checks.length}: ${check.name}`);
  console.log(`   ${check.description}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    execSync(`node ${check.script}`, { stdio: "inherit" });
    console.log(formatSuccess(`\n✅ ${check.name} check passed`));
  } catch (error) {
    console.error(formatError(`\n❌ ${check.name} check failed`));
    failedChecks++;
  }
});

console.log(`\n${"=".repeat(60)}`);
console.log("📊 PREFLIGHT SUMMARY");
console.log(`${"=".repeat(60)}`);
console.log(`Total checks: ${checks.length}`);
console.log(`Passed: ${checks.length - failedChecks}`);
console.log(`Failed: ${failedChecks}`);
console.log(`${"=".repeat(60)}\n`);

if (failedChecks > 0) {
  console.error(
    formatError(
      `\n❌ ${failedChecks} check(s) failed. Please fix the issues before proceeding.`,
    ),
  );
  process.exit(1);
} else {
  console.log(
    formatSuccess("\n✅ All preflight checks passed! You're ready to proceed."),
  );
  process.exit(0);
}
