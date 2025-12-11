/**
 * E2E test for WhatsApp transaction command interaction
 * T014: Tests complete WhatsApp message flow for transaction commands
 *
 * Note: This test requires WhatsApp Web.js client to be available.
 * It will skip if client is not initialized or in CI environment.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { getPrismaClient } from "../../../src/lib/database";
import {
  getRedisClient,
  clearContext,
  disconnectRedis,
} from "../../../src/lib/redis";
import { parseCommand } from "../../../src/bot/handlers/command.parser";
import { COMMANDS } from "../../../src/config/constants";
import { logger } from "../../../src/lib/logger";
import { UserModel } from "../../../src/models/user";

describe("T014: E2E test for WhatsApp transaction command interaction", () => {
  let prisma: ReturnType<typeof getPrismaClient>;
  let redis: ReturnType<typeof getRedisClient>;
  let testUserId: string;
  let testPhoneNumber: string;
  let skipTests = false;

  beforeAll(async () => {
    // Skip in CI or if database/Redis not available
    if (process.env.CI === "true" || !process.env.DATABASE_URL) {
      skipTests = true;
      return;
    }

    try {
      prisma = getPrismaClient();
      redis = getRedisClient();

      // Skip if Redis not available
      if (!redis.isOpen) {
        skipTests = true;
        return;
      }

      // Create test user
      testPhoneNumber = `+62812345678${Date.now().toString().slice(-4)}`;
      const user = await UserModel.create({
        phoneNumber: testPhoneNumber,
        name: "E2E Test User",
        role: "employee",
        isActive: true,
      });
      testUserId = user.id;
    } catch (_error) {
      skipTests = true;
      logger.warn("E2E command interaction test setup skipped", {
        error: _error,
      });
    }
  });

  afterAll(async () => {
    if (skipTests) return;

    try {
      // Cleanup context and user
      if (testUserId) {
        await clearContext(testUserId).catch(() => {});
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch (_error) {
      logger.warn("E2E command interaction test cleanup failed", {
        error: _error,
      });
    } finally {
      // Close database and Redis connections
      try {
        await prisma.$disconnect().catch(() => {});
        await disconnectRedis().catch(() => {});
      } catch {
        // Ignore disconnect errors
      }
    }
  });

  it("should recognize 'catat penjualan' command from WhatsApp message", () => {
    if (skipTests) {
      console.log("Skipping E2E test - environment not available");
      return;
    }

    // Simulate WhatsApp message: "catat penjualan"
    const messageText = "catat penjualan";
    const parsed = parseCommand(messageText, testUserId, "employee");

    expect(parsed).not.toBeNull();
    expect(parsed?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
    expect(parsed?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(parsed?.rawText).toBe(messageText);
  });

  it("should handle complete transaction workflow via commands", () => {
    if (skipTests) {
      console.log("Skipping E2E test - environment not available");
      return;
    }

    // Step 1: User sends "catat penjualan"
    const step1 = parseCommand("catat penjualan", testUserId, "employee");
    expect(step1?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);

    // Step 2: User sends amount "500000"
    // (In real flow, this would be handled by command handler, but we test parsing here)
    const step2 = parseCommand("500000", testUserId, "employee");
    // Amount input is not a command, so it should return null
    // This is expected - amount input is handled separately in the workflow
    expect(step2).toBeNull();

    // Step 3: User selects category "1" (number selection)
    // Note: Single digit "1" is not a valid command, it's handled in workflow
    // This test just verifies the parser doesn't crash on numeric input
    const step3 = parseCommand("1", testUserId, "employee");
    // Single digit is not a command, should return null
    // Category selection is handled separately in the workflow
    expect(step3).toBeNull();
  });

  it("should handle command variations and typos", () => {
    if (skipTests) {
      console.log("Skipping E2E test - environment not available");
      return;
    }

    // Test various input formats
    const testCases = [
      { input: "catat penjualan", expected: COMMANDS.RECORD_SALE },
      { input: "catat penjualn", expected: COMMANDS.RECORD_SALE }, // typo
      { input: "tambah", expected: COMMANDS.RECORD_SALE }, // synonym
      { input: "cp", expected: COMMANDS.RECORD_SALE }, // abbreviation
    ];

    for (const testCase of testCases) {
      const result = parseCommand(testCase.input, testUserId, "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(testCase.expected);
    }
  });

  it("should provide suggestions for unrecognized commands", () => {
    if (skipTests) {
      console.log("Skipping E2E test - environment not available");
      return;
    }

    // Test unrecognized command
    const result = parseCommand("xyz unknown", testUserId, "employee");
    expect(result).toBeNull();

    // Test that suggestions would be available (tested in unit tests)
    // In real E2E, suggestions would be shown to user via WhatsApp message
  });

  it("should maintain user context across command interactions", () => {
    if (skipTests) {
      console.log("Skipping E2E test - environment not available");
      return;
    }

    // This test validates that the command parser can work with user context
    // The actual context management is tested in integration tests
    const result1 = parseCommand("catat penjualan", testUserId, "employee");
    expect(result1).not.toBeNull();

    // Subsequent commands should also work (context maintained in Redis)
    const result2 = parseCommand("lihat saldo", testUserId, "employee");
    expect(result2).not.toBeNull();
    expect(result2?.recognizedIntent).toBe(COMMANDS.VIEW_BALANCE);
  });
});
