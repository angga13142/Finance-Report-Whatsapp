#!/usr/bin/env node

/**
 * Pre-lint check: Validates ESLint configuration and runs linting
 * Exit codes:
 *   0: Success
 *   7: Lint check failed
 *   1: General error
 */

const { execSync } = require("child_process");
const { exists, getPackageJson } = require("./utils");

function checkESLintConfig() {
  console.log("📦 Checking ESLint configuration...");

  const eslintConfigPaths = [
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    "eslint.config.js",
    "eslint.config.mjs",
    "package.json", // ESLint config can be in package.json
  ];

  const hasESLintConfig = eslintConfigPaths.some((configPath) => {
    if (configPath === "package.json") {
      const pkg = getPackageJson();
      return pkg.eslintConfig !== undefined;
    }
    return exists(configPath);
  });

  if (!hasESLintConfig) {
    console.warn("⚠️  ESLint configuration not found");
    console.warn("   Linting may not work correctly");
    // Don't fail, just warn
  } else {
    console.log("✅ ESLint configuration found");
  }
  return true;
}

function checkESLintInstalled() {
  console.log("📦 Checking ESLint installation...");

  try {
    const pkg = getPackageJson();
    const hasESLint =
      (pkg.dependencies && pkg.dependencies.eslint) ||
      (pkg.devDependencies && pkg.devDependencies.eslint);

    if (!hasESLint) {
      console.error("❌ ESLint not found in dependencies");
      console.error("   Run: npm install --save-dev eslint");
      return false;
    }

    console.log("✅ ESLint is installed");
    return true;
  } catch (error) {
    console.error("❌ Error checking ESLint installation");
    return false;
  }
}

function checkLintScript() {
  console.log("📦 Checking lint script in package.json...");

  try {
    const pkg = getPackageJson();
    if (!pkg.scripts || !pkg.scripts.lint) {
      console.warn("⚠️  'lint' script not found in package.json");
      console.warn('   Add: "lint": "eslint src --ext .ts"');
      // Don't fail, just warn
    } else {
      console.log("✅ Lint script found");
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking lint script");
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
  console.log("🔍 Running pre-lint checks...\n");

  let allPassed = true;

  // Basic checks (non-blocking warnings)
  checkESLintConfig();
  checkLintScript();

  // Critical checks (blocking)
  if (!checkESLintInstalled()) {
    allPassed = false;
  }

  if (allPassed && !runLint()) {
    allPassed = false;
  }

  if (!allPassed) {
    console.error("\n❌ Pre-lint checks failed. Please fix the errors above.");
    process.exit(7);
  }

  console.log("\n✅ All pre-lint checks passed!");
  process.exit(0);
}

// Allow bypass with SKIP_PRELINT environment variable
if (process.env.SKIP_PRELINT === "true") {
  console.log("⚠️  SKIP_PRELINT=true, skipping pre-lint checks");
  process.exit(0);
}

main();
