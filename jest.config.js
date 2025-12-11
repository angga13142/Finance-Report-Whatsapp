module.exports = {
  // Use ts-jest for TypeScript support
  preset: "ts-jest",

  // Configure ts-jest
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },

  // Look for tests in the tests directory
  roots: ["<rootDir>/tests"],

  // Match test files with .test.ts or .spec.ts extension
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],

  // Collect coverage from source files
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/**/*.interface.ts",
    "!src/**/*.type.ts",
    "!src/**/*.types.ts",
  ],

  // T080: Coverage thresholds - fail if coverage drops below these values
  // Constitution requirements: 80% lines, 90% branches for business logic
  coverageThreshold: {
    global: {
      branches: 70, // Overall threshold
      functions: 70,
      lines: 80, // Meets constitution requirement
      statements: 80,
    },
    // Business logic files require 90% branch coverage
    "src/bot/handlers/command.ts": {
      branches: 90,
      lines: 80,
    },
    "src/bot/handlers/command.parser.ts": {
      branches: 90,
      lines: 80,
    },
    "src/services/system/financial-summary.ts": {
      branches: 90,
      lines: 80,
    },
    "src/bot/ui/message.formatter.ts": {
      branches: 90,
      lines: 80,
    },
  },

  // Coverage reporters
  coverageReporters: ["text", "lcov", "html", "json-summary"],

  // Module path aliases (matches tsconfig.json paths)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Setup file to run before each test suite
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Global test timeout (10 seconds)
  testTimeout: 10000,

  // Force exit after tests complete to prevent hanging
  forceExit: true,

  // Detect open handles to help identify leaks
  detectOpenHandles: true,

  // Clear mocks automatically between tests
  clearMocks: true,

  // Restore mocks automatically between tests
  restoreMocks: true,

  // Reset mocks automatically between tests
  resetMocks: true,

  // Verbose output for better debugging
  verbose: true,

  // Display individual test results
  displayName: {
    name: "WhatsApp Cashflow Bot",
    color: "blue",
  },

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Ignore patterns
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/.husky/"],

  // Watch plugins for better developer experience
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ].filter((plugin) => {
    try {
      require.resolve(plugin);
      return true;
    } catch {
      return false;
    }
  }),

  // Global setup/teardown
  // globalSetup: '<rootDir>/tests/globalSetup.ts',
  // globalTeardown: '<rootDir>/tests/globalTeardown.ts',
};
