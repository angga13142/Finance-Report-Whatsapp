#!/usr/bin/env node

/**
 * Pre-publish check: Validates package before publishing to npm
 * Exit codes:
 *   0: Success
 *   1: General error
 */

const fs = require("fs");
const path = require("path");
const {
  getPackageJson,
  exists,
  formatError,
  formatSuccess,
} = require("./utils");

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /api[_-]?key/i,
];

function checkPackageJsonFields() {
  console.log("📦 Checking package.json fields...\n");

  const packageJson = getPackageJson();
  const requiredFields = ["name", "version", "description", "license"];
  const missing = [];

  requiredFields.forEach((field) => {
    if (!packageJson[field] || packageJson[field].trim() === "") {
      missing.push(field);
      console.error(`❌ Missing or empty field: ${field}`);
    } else {
      console.log(`✅ ${field}: ${packageJson[field]}`);
    }
  });

  if (missing.length > 0) {
    console.error(
      `\n❌ Missing required package.json fields: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  // Check version format
  if (!/^\d+\.\d+\.\d+/.test(packageJson.version)) {
    console.error(`❌ Invalid version format: ${packageJson.version}`);
    console.error("   Version must follow semantic versioning (e.g., 1.0.0)");
    process.exit(1);
  }

  console.log("✅ All required package.json fields are valid");
  return true;
}

function checkForSensitiveData() {
  console.log("\n📦 Checking for sensitive data...");

  const packageJson = getPackageJson();
  const packageJsonStr = JSON.stringify(packageJson, null, 2);

  let foundSensitive = false;

  SENSITIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(packageJsonStr)) {
      console.warn(
        `⚠️  Potential sensitive data found matching pattern: ${pattern}`,
      );
      foundSensitive = true;
    }
  });

  if (foundSensitive) {
    console.warn(
      "\n⚠️  Warning: Potential sensitive data detected in package.json",
    );
    console.warn("   Please review before publishing");
    console.warn("   Consider using environment variables instead");
  } else {
    console.log("✅ No sensitive data detected");
  }

  return true;
}

function checkBuildOutput() {
  console.log("\n📦 Checking build output...");

  if (!exists("dist")) {
    console.error("❌ dist/ directory not found");
    console.error("   Run: npm run build");
    process.exit(1);
  }

  const distIndex = path.join(process.cwd(), "dist", "index.js");
  if (!exists("dist/index.js")) {
    console.error("❌ dist/index.js not found");
    console.error("   Run: npm run build");
    process.exit(1);
  }

  console.log("✅ Build output exists");
  return true;
}

function checkGitStatus() {
  console.log("\n📦 Checking git status...");

  try {
    const { execSync } = require("child_process");
    const status = execSync("git status --porcelain", { encoding: "utf8" });

    if (status.trim() !== "") {
      console.warn("⚠️  Uncommitted changes detected:");
      console.warn(status);
      console.warn("   Consider committing changes before publishing");
    } else {
      console.log("✅ No uncommitted changes");
    }

    return true;
  } catch (error) {
    console.warn("⚠️  Could not check git status (not a git repo?)");
    return true; // Don't fail if not a git repo
  }
}

function main() {
  console.log("🔍 Running pre-publish checks...\n");

  try {
    checkPackageJsonFields();
    checkForSensitiveData();
    checkBuildOutput();
    checkGitStatus();

    console.log("\n✅ All pre-publish checks passed!");
    console.log("   Ready to publish to npm");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Pre-publish check failed: ${error.message}`);
    process.exit(1);
  }
}

main();
