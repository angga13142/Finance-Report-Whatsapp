#!/usr/bin/env node

/**
 * Pre-install check: Validates Node.js version and prerequisites
 * Exit codes:
 *   0: Success
 *   2: Node version mismatch
 *   1: General error
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MIN_NODE_VERSION = "20.0.0";
const MIN_NPM_VERSION = "9.0.0";

function getPackageJson() {
  const packagePath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packagePath)) {
    console.error("❌ package.json not found");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

function parseVersion(version) {
  return version.replace(/^v/, "").split(".").map(Number);
}

function compareVersions(version1, version2) {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function checkNodeVersion() {
  const nodeVersion = process.version;
  console.log(`📦 Checking Node.js version: ${nodeVersion}`);

  if (compareVersions(nodeVersion, MIN_NODE_VERSION) < 0) {
    console.error(
      `❌ Node.js version ${nodeVersion} is below minimum required version ${MIN_NODE_VERSION}`,
    );
    console.error(`   Please upgrade Node.js to ${MIN_NODE_VERSION} or higher`);
    process.exit(2);
  }

  console.log(
    `✅ Node.js version ${nodeVersion} meets requirement (>= ${MIN_NODE_VERSION})`,
  );
  return true;
}

function checkNpmVersion() {
  try {
    const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim();
    console.log(`📦 Checking npm version: ${npmVersion}`);

    if (compareVersions(npmVersion, MIN_NPM_VERSION) < 0) {
      console.warn(
        `⚠️  npm version ${npmVersion} is below recommended version ${MIN_NPM_VERSION}`,
      );
      console.warn(`   Consider upgrading npm: npm install -g npm@latest`);
      // Don't exit, just warn
    } else {
      console.log(
        `✅ npm version ${npmVersion} meets requirement (>= ${MIN_NPM_VERSION})`,
      );
    }
    return true;
  } catch (error) {
    console.warn(`⚠️  Could not check npm version: ${error.message}`);
    return false;
  }
}

function checkPlatform() {
  const platform = process.platform;
  const supportedPlatforms = ["linux", "darwin", "win32"];

  console.log(`📦 Checking platform: ${platform}`);

  if (!supportedPlatforms.includes(platform)) {
    console.warn(`⚠️  Platform ${platform} may not be fully supported`);
    console.warn(`   Supported platforms: ${supportedPlatforms.join(", ")}`);
    // Don't exit, just warn
  } else {
    console.log(`✅ Platform ${platform} is supported`);
  }
  return true;
}

function checkEngines() {
  const packageJson = getPackageJson();
  const engines = packageJson.engines;

  if (engines && engines.node) {
    console.log(`📦 Checking engines.node requirement: ${engines.node}`);
    const requiredVersion = engines.node.replace(/[>=<]/g, "").trim();

    if (compareVersions(process.version, requiredVersion) < 0) {
      console.error(
        `❌ Node.js version ${process.version} does not meet engines.node requirement: ${engines.node}`,
      );
      process.exit(2);
    }

    console.log(`✅ Node.js version meets engines.node requirement`);
  }
  return true;
}

function main() {
  console.log("🔍 Running pre-install checks...\n");

  try {
    checkNodeVersion();
    checkNpmVersion();
    checkPlatform();
    checkEngines();

    console.log("\n✅ All pre-install checks passed!");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Pre-install check failed: ${error.message}`);
    process.exit(1);
  }
}

// Allow bypass with SKIP_PREINSTALL environment variable
if (process.env.SKIP_PREINSTALL === "true") {
  console.log("⚠️  SKIP_PREINSTALL=true, skipping pre-install checks");
  process.exit(0);
}

main();
