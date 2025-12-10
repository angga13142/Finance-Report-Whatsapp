/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

import { jest } from "@jest/globals";

// Increase default timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log for debugging purposes
  log: console.log,
  info: console.info,
  debug: console.debug,
};

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.REDIS_DB = "0";
process.env.JWT_SECRET = "test-secret-key-for-jwt-tokens-min-32-chars";
process.env.JWT_EXPIRES_IN = "24h";
process.env.WHATSAPP_SESSION_PATH = ".wwebjs_auth_test";
process.env.WHATSAPP_QR_CODE_TIMEOUT = "60000";
process.env.PORT = "3000";
process.env.TZ = "Asia/Makassar";
process.env.LOG_LEVEL = "error";
process.env.LOG_FORMAT = "simple";
process.env.REPORT_DELIVERY_TIME = "24:00";

// Global test utilities
export const testUtils = {
  /**
   * Wait for a specific amount of time
   * Useful for testing async operations
   */
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   */
  randomString: (length: number = 10): string => {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  },

  randomNumber: (min: number = 0, max: number = 1000): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Create a mock user for testing
   */
  createMockUser: (overrides = {}) => ({
    id: testUtils.randomString(),
    phoneNumber: "+62812345678",
    name: "Test User",
    role: "USER",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock transaction for testing
   */
  createMockTransaction: (overrides = {}) => ({
    id: testUtils.randomString(),
    type: "EXPENSE",
    amount: testUtils.randomNumber(10000, 1000000),
    description: "Test transaction",
    categoryId: testUtils.randomString(),
    userId: testUtils.randomString(),
    transactionDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
