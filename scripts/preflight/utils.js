/**
 * Shared utilities for preflight checks
 */

const fs = require("fs");
const path = require("path");

/**
 * Read and parse package.json
 */
function getPackageJson() {
  const packagePath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error("package.json not found");
  }
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

/**
 * Check if file or directory exists
 */
function exists(filePath) {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

/**
 * Read environment variables from .env file
 */
function readEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });

  return env;
}

/**
 * Check if required environment variable is set
 */
function checkEnvVar(name, env = process.env) {
  const value = env[name];
  if (!value || value.trim() === "") {
    return {
      valid: false,
      error: `Environment variable ${name} is not set or empty`,
    };
  }
  return { valid: true, value };
}

/**
 * Format error message with suggestions
 */
function formatError(message, suggestions = []) {
  let formatted = `❌ ${message}`;
  if (suggestions.length > 0) {
    formatted += "\n\nSuggestions:";
    suggestions.forEach((suggestion) => {
      formatted += `\n  - ${suggestion}`;
    });
  }
  return formatted;
}

/**
 * Format success message
 */
function formatSuccess(message) {
  return `✅ ${message}`;
}

/**
 * Format warning message
 */
function formatWarning(message) {
  return `⚠️  ${message}`;
}

module.exports = {
  getPackageJson,
  exists,
  readEnvFile,
  checkEnvVar,
  formatError,
  formatSuccess,
  formatWarning,
};
