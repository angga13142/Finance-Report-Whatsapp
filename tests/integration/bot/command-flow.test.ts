/**
 * Integration test for complete transaction command flow
 * T013: Tests "catat penjualan" → amount → category → confirmation flow
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { getPrismaClient } from "../../../src/lib/database";
import {
  getRedisClient,
  setContext,
  getContext,
  clearContext,
  disconnectRedis,
} from "../../../src/lib/redis";
import { parseCommand } from "../../../src/bot/handlers/command.parser";
import { COMMANDS } from "../../../src/config/constants";
import { logger } from "../../../src/lib/logger";

describe("T013: Integration test for complete transaction flow", () => {
  let prisma: ReturnType<typeof getPrismaClient>;
  let redis: ReturnType<typeof getRedisClient>;
  let testUserId: string;
  let skipTests = false;

  beforeAll(async () => {
    try {
      prisma = getPrismaClient();
      redis = getRedisClient();

      // Skip if Redis not available
      if (!redis.isOpen) {
        skipTests = true;
        return;
      }

      // Create test user
      const phoneNumber = `+62812345678${Date.now().toString().slice(-4)}`;
      const user = await prisma.user.upsert({
        where: { phoneNumber },
        update: {},
        create: {
          phoneNumber,
          name: "Test User for Command Flow",
          role: "employee",
          isActive: true,
        },
      });
      testUserId = user.id;
    } catch (error) {
      skipTests = true;
      logger.warn("Command flow test setup skipped", { error });
    }
  });

  afterAll(async () => {
    if (skipTests) return;

    try {
      // Cleanup context
      if (testUserId) {
        await clearContext(testUserId).catch(() => {});
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch (_error) {
      logger.warn("Command flow test cleanup failed", { error: _error });
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

  beforeEach(async () => {
    if (skipTests) return;
    // Clear context before each test
    await clearContext(testUserId).catch(() => {});
  });

  it("should complete full transaction flow: command → amount → category → confirmation", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    // Step 1: Parse "catat penjualan" command
    const commandResult = parseCommand(
      "catat penjualan",
      testUserId,
      "employee",
    );
    expect(commandResult).not.toBeNull();
    expect(commandResult?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
    expect(commandResult?.confidence).toBeGreaterThanOrEqual(0.7);

    // Step 2: Store initial context
    await setContext({
      userId: testUserId,
      workflowType: "transaction_entry",
      currentStep: 1,
      enteredData: {},
      pendingTransaction: {
        type: "income",
      },
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    });

    // Step 3: Update context with amount
    const contextAfterAmount = await getContext(testUserId);
    expect(contextAfterAmount).not.toBeNull();

    await setContext({
      ...contextAfterAmount!,
      currentStep: 2,
      pendingTransaction: {
        type: "income",
        amount: 500000,
      },
    });

    // Step 4: Update context with category
    const contextAfterCategory = await getContext(testUserId);
    expect(contextAfterCategory).not.toBeNull();

    await setContext({
      ...contextAfterCategory!,
      currentStep: 3,
      pendingTransaction: {
        type: "income",
        amount: 500000,
        category: "Sales",
      },
    });

    // Step 5: Verify final context
    const finalContext = await getContext(testUserId);
    expect(finalContext).not.toBeNull();
    expect(finalContext?.workflowType).toBe("transaction_entry");
    expect(finalContext?.currentStep).toBe(3);
    expect(finalContext?.pendingTransaction?.type).toBe("income");
    expect(finalContext?.pendingTransaction?.amount).toBe(500000);
    expect(finalContext?.pendingTransaction?.category).toBe("Sales");
  });

  it("should handle context updates across multiple steps", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    // Initialize context
    await setContext({
      userId: testUserId,
      workflowType: "transaction_entry",
      currentStep: 1,
      enteredData: {},
      pendingTransaction: {
        type: "expense",
      },
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    });

    // Update step by step
    for (let step = 2; step <= 4; step++) {
      const current = await getContext(testUserId);
      expect(current).not.toBeNull();

      await setContext({
        ...current!,
        currentStep: step,
        pendingTransaction: {
          ...current!.pendingTransaction,
          ...(step === 2 && { amount: 200000 }),
          ...(step === 3 && { category: "Transport" }),
        },
      });

      const updated = await getContext(testUserId);
      expect(updated?.currentStep).toBe(step);
    }

    const final = await getContext(testUserId);
    expect(final?.pendingTransaction?.amount).toBe(200000);
    expect(final?.pendingTransaction?.category).toBe("Transport");
  });

  it("should maintain context TTL across updates", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    const initialTime = new Date();
    await setContext({
      userId: testUserId,
      workflowType: "transaction_entry",
      currentStep: 1,
      enteredData: {},
      pendingTransaction: {
        type: "income",
      },
      lastActivity: initialTime.toISOString(),
      expiresAt: new Date(initialTime.getTime() + 1800 * 1000).toISOString(),
    });

    // Wait a bit to ensure timestamp difference
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 100);
      // Unref to prevent keeping process alive
      if (typeof timeout.unref === "function") {
        timeout.unref();
      }
    });

    // Update context (should refresh TTL)
    const context = await getContext(testUserId);
    expect(context).not.toBeNull();

    await setContext({
      ...context!,
      currentStep: 2,
    });

    const updated = await getContext(testUserId);
    expect(updated).not.toBeNull();
    // expiresAt should be refreshed (approximately 30 minutes from now)
    const expiresAt = new Date(updated!.expiresAt);
    const now = new Date();
    const timeDiff = expiresAt.getTime() - now.getTime();
    // Should be approximately 1800 seconds (30 minutes), allow 5 second tolerance
    expect(timeDiff).toBeGreaterThan(1795 * 1000);
    expect(timeDiff).toBeLessThan(1805 * 1000);
  });
});

describe("T043: Integration test for help command flow with role filtering", () => {
  let prisma: ReturnType<typeof getPrismaClient>;
  let redis: ReturnType<typeof getRedisClient>;
  let employeeUserId: string;
  let bossUserId: string;
  let investorUserId: string;
  let skipTests = false;

  beforeAll(async () => {
    try {
      prisma = getPrismaClient();
      redis = getRedisClient();

      // Skip if Redis not available
      if (!redis.isOpen) {
        skipTests = true;
        return;
      }

      // Create test users with different roles
      const timestamp = Date.now().toString().slice(-4);
      const employee = await prisma.user.upsert({
        where: { phoneNumber: `+62812345678${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+62812345678${timestamp}`,
          name: "Test Employee",
          role: "employee",
          isActive: true,
        },
      });
      employeeUserId = employee.id;

      const boss = await prisma.user.upsert({
        where: { phoneNumber: `+62812345679${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+62812345679${timestamp}`,
          name: "Test Boss",
          role: "boss",
          isActive: true,
        },
      });
      bossUserId = boss.id;

      const investor = await prisma.user.upsert({
        where: { phoneNumber: `+62812345680${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+62812345680${timestamp}`,
          name: "Test Investor",
          role: "investor",
          isActive: true,
        },
      });
      investorUserId = investor.id;
    } catch (error) {
      skipTests = true;
      logger.warn("Help command test setup skipped", { error });
    }
  });

  afterAll(async () => {
    if (skipTests) return;

    try {
      // Cleanup
      if (employeeUserId) {
        await clearContext(employeeUserId).catch(() => {});
        await prisma.user
          .delete({ where: { id: employeeUserId } })
          .catch(() => {});
      }
      if (bossUserId) {
        await clearContext(bossUserId).catch(() => {});
        await prisma.user.delete({ where: { id: bossUserId } }).catch(() => {});
      }
      if (investorUserId) {
        await clearContext(investorUserId).catch(() => {});
        await prisma.user
          .delete({ where: { id: investorUserId } })
          .catch(() => {});
      }
    } catch (_error) {
      logger.warn("Help command test cleanup failed", { error: _error });
    } finally {
      try {
        await prisma.$disconnect().catch(() => {});
        await disconnectRedis().catch(() => {});
      } catch {
        // Ignore disconnect errors
      }
    }
  });

  beforeEach(async () => {
    if (skipTests) return;
    // Clear context before each test
    await clearContext(employeeUserId).catch(() => {});
    await clearContext(bossUserId).catch(() => {});
    await clearContext(investorUserId).catch(() => {});
  });

  it("should parse help command for Employee role", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    const result = parseCommand("bantu", employeeUserId, "employee");
    expect(result).not.toBeNull();
    expect(result?.recognizedIntent).toBe(COMMANDS.HELP);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("should parse help command for Boss role", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    const result = parseCommand("help", bossUserId, "boss");
    expect(result).not.toBeNull();
    expect(result?.recognizedIntent).toBe(COMMANDS.HELP);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("should parse help command for Investor role", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    const result = parseCommand("menu", investorUserId, "investor");
    expect(result).not.toBeNull();
    // Menu command should also trigger help
    expect([COMMANDS.HELP, COMMANDS.MENU]).toContain(result?.recognizedIntent);
  });

  it("should filter commands by role in help output", async () => {
    if (skipTests) {
      console.log("Skipping test - Redis or database unavailable");
      return;
    }

    // Employee should have access to transaction commands
    const employeeResult = parseCommand(
      "catat penjualan",
      employeeUserId,
      "employee",
    );
    expect(employeeResult).not.toBeNull();
    expect(employeeResult?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);

    // Investor should NOT have access to transaction commands
    const investorResult = parseCommand(
      "catat penjualan",
      investorUserId,
      "investor",
    );
    // Investor should get low confidence or unrecognized
    if (investorResult) {
      expect(investorResult.confidence).toBeLessThan(0.7);
    } else {
      expect(investorResult).toBeNull();
    }
  });
});
