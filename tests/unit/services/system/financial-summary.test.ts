/**
 * Unit tests for financial summary service
 * Tests financial data aggregation, role-based filtering, and caching
 */

import { FinancialSummaryService } from "../../../../src/services/system/financial-summary";
import { getRedisClient } from "../../../../src/lib/redis";
import { getPrismaClient } from "../../../../src/lib/database";
import { USER_ROLES } from "../../../../src/config/constants";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis
jest.mock("../../../../src/lib/redis", () => ({
  getRedisClient: jest.fn(),
  disconnectRedis: jest.fn(),
}));

// Mock Prisma
jest.mock("../../../../src/lib/database", () => ({
  getPrismaClient: jest.fn(),
}));

describe("Financial Summary Service", () => {
  let mockRedisClient: {
    get: jest.Mock;
    setEx: jest.Mock;
    del: jest.Mock;
  };
  let mockPrismaClient: {
    transaction: {
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  beforeEach(() => {
    // Setup Redis mock
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    // Setup Prisma mock
    mockPrismaClient = {
      transaction: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(mockPrismaClient);

    jest.clearAllMocks();
  });

  describe("T026: Financial summary with role-based filtering", () => {
    it("should filter Employee data to own transactions only", async () => {
      const userId = "user1";
      const role = USER_ROLES.EMPLOYEE;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrismaClient.transaction.findMany.mockResolvedValue([
        {
          id: "tx1",
          userId: "user1",
          type: "income",
          amount: 500000,
          approvalStatus: "approved",
        },
        {
          id: "tx2",
          userId: "user1",
          type: "expense",
          amount: 200000,
          approvalStatus: "approved",
        },
      ]);

      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 300000 },
        _count: { id: 2 },
      });

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
      );

      expect(summary).not.toBeNull();
      expect(summary.balance).toBe(300000);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: userId,
          }),
        }),
      );
    });

    it("should filter Boss data to all transactions", async () => {
      const userId = "boss1";
      const role = USER_ROLES.BOSS;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrismaClient.transaction.findMany.mockResolvedValue([
        {
          id: "tx1",
          userId: "user1",
          type: "income",
          amount: 500000,
          approvalStatus: "approved",
        },
        {
          id: "tx2",
          userId: "user2",
          type: "expense",
          amount: 200000,
          approvalStatus: "approved",
        },
      ]);

      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 300000 },
        _count: { id: 2 },
      });

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
      );

      expect(summary).not.toBeNull();
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            userId: expect.anything(),
          }),
        }),
      );
    });

    it("should filter Investor data to aggregated only", async () => {
      const userId = "investor1";
      const role = USER_ROLES.INVESTOR;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 1000000 },
        _count: { id: 10 },
      });

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
      );

      expect(summary).not.toBeNull();
      // Investor should not see individual transactions
      expect(mockPrismaClient.transaction.findMany).not.toHaveBeenCalled();
      expect(mockPrismaClient.transaction.aggregate).toHaveBeenCalled();
    });
  });

  describe("T027: Financial data caching", () => {
    it("should return cached data when available (cache hit)", async () => {
      const userId = "user1";
      const role = USER_ROLES.EMPLOYEE;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");
      // Cache key will be generated based on date range
      const cacheKey = `financial:summary:${userId}:custom:2025-01-01:2025-01-31`;

      const cachedData = {
        balance: 500000,
        income: 1000000,
        expenses: 500000,
        cashflow: 500000,
        pendingCount: 0,
        calculatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
        false, // useCache = true by default
      );

      expect(summary).not.toBeNull();
      expect(summary.balance).toBe(500000);
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey);
      // Should not query database on cache hit
      expect(mockPrismaClient.transaction.findMany).not.toHaveBeenCalled();
    });

    it("should query database and cache result when cache miss", async () => {
      const userId = "user1";
      const role = USER_ROLES.EMPLOYEE;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");
      // Cache key will be generated based on date range
      const cacheKey = `financial:summary:${userId}:custom:2025-01-01:2025-01-31`;

      mockRedisClient.get.mockResolvedValue(null); // Cache miss
      mockPrismaClient.transaction.findMany.mockResolvedValue([]);
      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      });

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
      );

      expect(summary).not.toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalled();
      // Should cache the result with TTL
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Number), // TTL (30-60 seconds)
        expect.stringContaining('"balance"'),
      );
    });

    it("should bypass cache when refresh flag is true", async () => {
      const userId = "user1";
      const role = USER_ROLES.EMPLOYEE;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrismaClient.transaction.findMany.mockResolvedValue([]);
      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      });

      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
        true, // refresh = true, bypass cache
      );

      expect(summary).not.toBeNull();
      // Should not check cache when refresh is true
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      // Should query database
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalled();
      // Should still cache the fresh result
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it("should use TTL between 30-60 seconds for cache", async () => {
      const userId = "user1";
      const role = USER_ROLES.EMPLOYEE;
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockRedisClient.get.mockResolvedValue(null);
      mockPrismaClient.transaction.findMany.mockResolvedValue([]);
      mockPrismaClient.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      });

      await FinancialSummaryService.getFinancialSummary(
        userId,
        role,
        startDate,
        endDate,
      );

      const setExCall = mockRedisClient.setEx.mock.calls[0];
      const ttl = setExCall[1]; // Second parameter is TTL

      expect(ttl).toBeGreaterThanOrEqual(30);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });
});
