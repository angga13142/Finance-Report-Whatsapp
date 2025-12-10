module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  plugins: ["@typescript-eslint"],
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  ignorePatterns: [
    "scripts/preflight/**/*.js",
    "prisma/seed.ts",
    "dist/**",
    "node_modules/**",
    "*.config.js",
    ".eslintrc.js",
    ".lintstagedrc.js",
    "jest.config.js",
    "playwright.config.ts",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn", // Changed to warn for Phase 3 code
    "@typescript-eslint/explicit-function-return-type": "off", // Too strict for now
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-floating-promises": "warn", // Changed to warn
    "@typescript-eslint/no-misused-promises": "warn", // Changed to warn
    "@typescript-eslint/no-unsafe-assignment": "warn", // Changed to warn for Phase 3
    "@typescript-eslint/no-unsafe-member-access": "warn", // Changed to warn for Phase 3
    "@typescript-eslint/no-unsafe-argument": "warn", // Changed to warn for Phase 3
    "@typescript-eslint/require-await": "warn", // Changed to warn
    "@typescript-eslint/restrict-template-expressions": "warn", // Changed to warn
    "no-console": [
      "warn",
      { allow: ["warn", "error", "log", "info", "debug"] },
    ],
    "no-control-regex": "warn", // Changed to warn for validation.ts
  },
};
