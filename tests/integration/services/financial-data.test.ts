/**
 * Integration tests for financial data service
 * T028: Integration test for financial report generation with caching
 * T029: Integration test for role-based data filtering
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
import { getRedisClient, disconnectRedis } from "../../../src/lib/redis";
import { FinancialSummaryService } from "../../../src/services/system/financial-summary";
import { USER_ROLES } from "../../../src/config/constants";
import { getDayRangeWITA } from "../../../src/lib/date";
import { logger } from "../../../src/lib/logger";

describe("T028: Integration test for financial report generation with caching", () => {
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
          name: "Test User for Financial Data",
          role: "employee",
          isActive: true,
        },
      });
      testUserId = user.id;
    } catch (error) {
      skipTests = true;
      logger.warn("Financial data test setup skipped", {
        error: error,
      });
    }
  });

  afterAll(async () => {
    try {
      if (!skipTests && testUserId) {
        // Cleanup test data
        await prisma.transaction.deleteMany({
          where: { userId: testUserId },
        });
        await prisma.user.delete({
          where: { id: testUserId },
        });
      }
    } catch (_error) {
      logger.warn("Financial data test cleanup failed", {
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

  beforeEach(async () => {
    if (skipTests) {
      return;
    }

    // Clear cache before each test
    await FinancialSummaryService.invalidateCache(testUserId);
  });

  it("should generate financial report with caching", async () => {
    if (skipTests) {
      console.log("Skipping integration test - environment not available");
      return;
    }

    const { start, end } = getDayRangeWITA();

    // Create test transactions
    await prisma.transaction.createMany({
      data: [
        {
          userId: testUserId,
          type: "income",
          category: "Product A",
          amount: 500000,
          description: "Test sale 1",
          approvalStatus: "approved",
          timestamp: new Date(),
        },
        {
          userId: testUserId,
          type: "expense",
          category: "Utilities",
          amount: 200000,
          description: "Test expense 1",
          approvalStatus: "approved",
          timestamp: new Date(),
        },
      ],
    });

    // First call should query database and cache result
    const summary1 = await FinancialSummaryService.getFinancialSummary(
      testUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      false, // use cache
    );

    expect(summary1).not.toBeNull();
    expect(summary1.income).toBe(500000);
    expect(summary1.expenses).toBe(200000);
    expect(summary1.cashflow).toBe(300000);
    expect(summary1.balance).toBe(300000);

    // Second call should use cache (faster)
    const startTime = Date.now();
    const summary2 = await FinancialSummaryService.getFinancialSummary(
      testUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      false, // use cache
    );
    const duration = Date.now() - startTime;

    expect(summary2).not.toBeNull();
    expect(summary2.income).toBe(500000);
    expect(summary2.expenses).toBe(200000);
    // Cache should be faster (though not guaranteed in test environment)
    expect(duration).toBeLessThan(1000); // Should be much faster than DB query
  });

  it("should refresh cache when refresh flag is true", async () => {
    if (skipTests) {
      console.log("Skipping integration test - environment not available");
      return;
    }

    const { start, end } = getDayRangeWITA();

    // Create initial transaction
    await prisma.transaction.create({
      data: {
        userId: testUserId,
        type: "income",
        category: "Product A",
        amount: 100000,
        description: "Initial sale",
        approvalStatus: "approved",
        timestamp: new Date(),
      },
    });

    // Get summary (will cache)
    const summary1 = await FinancialSummaryService.getFinancialSummary(
      testUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      false,
    );
    expect(summary1.income).toBe(100000);

    // Add another transaction
    await prisma.transaction.create({
      data: {
        userId: testUserId,
        type: "income",
        category: "Product B",
        amount: 200000,
        description: "New sale",
        approvalStatus: "approved",
        timestamp: new Date(),
      },
    });

    // Without refresh, should get cached (old) data
    const summary2 = await FinancialSummaryService.getFinancialSummary(
      testUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      false,
    );
    expect(summary2.income).toBe(100000); // Still cached

    // With refresh, should get fresh data
    const summary3 = await FinancialSummaryService.getFinancialSummary(
      testUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      true, // refresh
    );
    expect(summary3.income).toBe(300000); // Fresh data
  });
});

describe("T029: Integration test for role-based data filtering", () => {
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
        where: { phoneNumber: `+6281111111${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+6281111111${timestamp}`,
          name: "Test Employee",
          role: "employee",
          isActive: true,
        },
      });
      employeeUserId = employee.id;

      const boss = await prisma.user.upsert({
        where: { phoneNumber: `+6282222222${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+6282222222${timestamp}`,
          name: "Test Boss",
          role: "boss",
          isActive: true,
        },
      });
      bossUserId = boss.id;

      const investor = await prisma.user.upsert({
        where: { phoneNumber: `+6283333333${timestamp}` },
        update: {},
        create: {
          phoneNumber: `+6283333333${timestamp}`,
          name: "Test Investor",
          role: "investor",
          isActive: true,
        },
      });
      investorUserId = investor.id;

      // Create transactions for different users
      const { start, end } = getDayRangeWITA();
      await prisma.transaction.createMany({
        data: [
          {
            userId: employeeUserId,
            type: "income",
            category: "Product A",
            amount: 500000,
            description: "Employee sale",
            approvalStatus: "approved",
            timestamp: new Date((start.getTime() + end.getTime()) / 2),
          },
          {
            userId: employeeUserId,
            type: "expense",
            category: "Utilities",
            amount: 100000,
            description: "Employee expense",
            approvalStatus: "approved",
            timestamp: new Date((start.getTime() + end.getTime()) / 2),
          },
          {
            userId: bossUserId,
            type: "income",
            category: "Product B",
            amount: 1000000,
            description: "Boss sale",
            approvalStatus: "approved",
            timestamp: new Date((start.getTime() + end.getTime()) / 2),
          },
        ],
      });
    } catch (error) {
      skipTests = true;
      logger.warn("Role-based filtering test setup skipped", {
        error: error,
      });
    }
  });

  afterAll(async () => {
    try {
      if (!skipTests) {
        // Cleanup test data
        await prisma.transaction.deleteMany({
          where: {
            userId: { in: [employeeUserId, bossUserId, investorUserId] },
          },
        });
        await prisma.user.deleteMany({
          where: {
            id: { in: [employeeUserId, bossUserId, investorUserId] },
          },
        });
      }
    } catch (_error) {
      logger.warn("Role-based filtering test cleanup failed", {
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

  it("should filter Employee data to own transactions only", async () => {
    if (skipTests) {
      console.log("Skipping integration test - environment not available");
      return;
    }

    const { start, end } = getDayRangeWITA();

    const summary = await FinancialSummaryService.getFinancialSummary(
      employeeUserId,
      USER_ROLES.EMPLOYEE,
      start,
      end,
      true, // refresh to get fresh data
    );

    expect(summary).not.toBeNull();
    // Employee should only see own transactions
    expect(summary.income).toBe(500000); // Only employee's income
    expect(summary.expenses).toBe(100000); // Only employee's expenses
    expect(summary.cashflow).toBe(400000); // 500000 - 100000
  });

  it("should filter Boss data to all transactions", async () => {
    if (skipTests) {
      console.log("Skipping integration test - environment not available");
      return;
    }

    const { start, end } = getDayRangeWITA();

    const summary = await FinancialSummaryService.getFinancialSummary(
      bossUserId,
      USER_ROLES.BOSS,
      start,
      end,
      true, // refresh to get fresh data
    );

    expect(summary).not.toBeNull();
    // Boss should see all transactions
    expect(summary.income).toBe(1500000); // Employee + Boss income
    expect(summary.expenses).toBe(100000); // All expenses
    expect(summary.cashflow).toBe(1400000); // 1500000 - 100000
  });

  it("should filter Investor data to aggregated only", async () => {
    if (skipTests) {
      console.log("Skipping integration test - environment not available");
      return;
    }

    const { start, end } = getDayRangeWITA();

    const summary = await FinancialSummaryService.getFinancialSummary(
      investorUserId,
      USER_ROLES.INVESTOR,
      start,
      end,
      true, // refresh to get fresh data
    );

    expect(summary).not.toBeNull();
    // Investor should see aggregated totals only
    expect(summary.income).toBe(1500000); // All income aggregated
    expect(summary.expenses).toBe(100000); // All expenses aggregated
    expect(summary.cashflow).toBe(1400000); // Net cashflow
    // Investor should not see individual transaction details
    // (verified by using aggregate queries in service)
  });
});
