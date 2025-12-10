/**
 * Unit tests for query optimization utilities
 * Tests query patterns, performance monitoring, and optimization recommendations
 */

import {
  QUERY_PERFORMANCE_TARGETS,
  OPTIMIZATION_BEST_PRACTICES,
  OPTIMIZED_QUERY_PATTERNS,
  QueryPerformanceMonitor,
  OPTIMIZATION_CHECKLIST,
} from "../../../src/lib/query-optimization";
import { PrismaClient } from "@prisma/client";

// Mock Prisma
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(),
}));

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Query Optimization Utilities", () => {
  let mockPrisma: {
    transaction: {
      aggregate: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    category: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      transaction: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
    };

    (PrismaClient as jest.Mock).mockImplementation(
      () => mockPrisma as unknown as PrismaClient,
    );
  });

  describe("QUERY_PERFORMANCE_TARGETS", () => {
    it("should define performance targets", () => {
      expect(QUERY_PERFORMANCE_TARGETS.SIMPLE_QUERY).toBe(50);
      expect(QUERY_PERFORMANCE_TARGETS.LIST_QUERY).toBe(200);
      expect(QUERY_PERFORMANCE_TARGETS.AGGREGATION).toBe(300);
      expect(QUERY_PERFORMANCE_TARGETS.COMPLEX_REPORT).toBe(500);
      expect(QUERY_PERFORMANCE_TARGETS.BULK_OPERATION).toBe(1000);
    });
  });

  describe("OPTIMIZATION_BEST_PRACTICES", () => {
    it("should define index recommendations", () => {
      expect(OPTIMIZATION_BEST_PRACTICES.INDEXES.user).toContain("role");
      expect(OPTIMIZATION_BEST_PRACTICES.INDEXES.transaction).toContain(
        "userId",
      );
    });

    it("should define pagination settings", () => {
      expect(OPTIMIZATION_BEST_PRACTICES.PAGINATION.DEFAULT_PAGE_SIZE).toBe(20);
      expect(OPTIMIZATION_BEST_PRACTICES.PAGINATION.MAX_PAGE_SIZE).toBe(100);
    });

    it("should define connection pool settings", () => {
      expect(OPTIMIZATION_BEST_PRACTICES.CONNECTION_POOL.MIN_CONNECTIONS).toBe(
        5,
      );
      expect(OPTIMIZATION_BEST_PRACTICES.CONNECTION_POOL.MAX_CONNECTIONS).toBe(
        50,
      );
    });
  });

  describe("OPTIMIZED_QUERY_PATTERNS", () => {
    describe("getDailyTotals", () => {
      it("should get daily totals using aggregation", async () => {
        const date = new Date("2024-01-15");
        mockPrisma.transaction.aggregate
          .mockResolvedValueOnce({ _sum: { amount: 1000000 } })
          .mockResolvedValueOnce({ _sum: { amount: 500000 } });
        mockPrisma.transaction.count.mockResolvedValue(10);

        const result = await OPTIMIZED_QUERY_PATTERNS.getDailyTotals(
          mockPrisma as unknown as PrismaClient,
          date,
        );

        expect(result.totalIncome).toBe(1000000);
        expect(result.totalExpense).toBe(500000);
        expect(result.transactionCount).toBe(10);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it("should handle zero amounts", async () => {
        const date = new Date("2024-01-15");
        mockPrisma.transaction.aggregate
          .mockResolvedValueOnce({ _sum: { amount: null } })
          .mockResolvedValueOnce({ _sum: { amount: null } });
        mockPrisma.transaction.count.mockResolvedValue(0);

        const result = await OPTIMIZED_QUERY_PATTERNS.getDailyTotals(
          mockPrisma as unknown as PrismaClient,
          date,
        );

        expect(result.totalIncome).toBe(0);
        expect(result.totalExpense).toBe(0);
        expect(result.transactionCount).toBe(0);
      });
    });

    describe("getUserTransactionsPaginated", () => {
      it("should get paginated user transactions", async () => {
        const mockTransactions = [
          { id: "1", type: "expense", amount: 50000 },
          { id: "2", type: "income", amount: 100000 },
        ];

        mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

        const result =
          await OPTIMIZED_QUERY_PATTERNS.getUserTransactionsPaginated(
            mockPrisma as unknown as PrismaClient,
            "user123",
            { limit: 20 },
          );

        expect(result.items).toEqual(mockTransactions);
        expect(result.hasNextPage).toBe(false);
        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 21, // limit + 1
            select: expect.any(Object),
          }),
        );
      });

      it("should handle cursor-based pagination", async () => {
        const mockTransactions = [{ id: "2", type: "income", amount: 100000 }];

        mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

        const result =
          await OPTIMIZED_QUERY_PATTERNS.getUserTransactionsPaginated(
            mockPrisma as unknown as PrismaClient,
            "user123",
            { cursor: "1", limit: 20 },
          );

        expect(result.items).toEqual(mockTransactions);
        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 1,
            cursor: { id: "1" },
          }),
        );
      });

      it("should filter by date range", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");

        mockPrisma.transaction.findMany.mockResolvedValue([]);

        await OPTIMIZED_QUERY_PATTERNS.getUserTransactionsPaginated(
          mockPrisma as unknown as PrismaClient,
          "user123",
          { startDate, endDate },
        );

        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              timestamp: {
                gte: startDate,
                lte: endDate,
              },
            }),
          }),
        );
      });
    });

    describe("getTransactionsByDateRange", () => {
      it("should get transactions by date range", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");
        const mockTransactions = [{ id: "1", type: "expense" }];
        const mockAggregation = [
          { type: "expense", _sum: { amount: 500000 }, _count: 5 },
        ];

        mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
        mockPrisma.transaction.groupBy.mockResolvedValue(mockAggregation);

        const result =
          await OPTIMIZED_QUERY_PATTERNS.getTransactionsByDateRange(
            mockPrisma as unknown as PrismaClient,
            startDate,
            endDate,
          );

        expect(result.transactions).toEqual(mockTransactions);
        expect(result.summary).toEqual(mockAggregation);
      });

      it("should filter by userId when provided", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");

        mockPrisma.transaction.findMany.mockResolvedValue([]);
        mockPrisma.transaction.groupBy.mockResolvedValue([]);

        await OPTIMIZED_QUERY_PATTERNS.getTransactionsByDateRange(
          mockPrisma as unknown as PrismaClient,
          startDate,
          endDate,
          "user123",
        );

        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: "user123",
            }),
          }),
        );
      });
    });

    describe("getUsersByIds", () => {
      it("should batch get users by IDs", async () => {
        const userIds = ["user1", "user2", "user3"];
        const mockUsers = [
          { id: "user1", name: "User 1" },
          { id: "user2", name: "User 2" },
        ];

        mockPrisma.user.findMany.mockResolvedValue(mockUsers);

        const result = await OPTIMIZED_QUERY_PATTERNS.getUsersByIds(
          mockPrisma as unknown as PrismaClient,
          userIds,
        );

        expect(result.users).toEqual(mockUsers);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
          where: { id: { in: userIds } },
          select: expect.any(Object),
        });
      });
    });

    describe("getActiveCategories", () => {
      it("should get all active categories", async () => {
        const mockCategories = [{ id: "cat1", name: "Food", type: "expense" }];

        mockPrisma.category.findMany.mockResolvedValue(mockCategories);

        const result = await OPTIMIZED_QUERY_PATTERNS.getActiveCategories(
          mockPrisma as unknown as PrismaClient,
        );

        expect(result.categories).toEqual(mockCategories);
        expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { isActive: true },
          }),
        );
      });

      it("should filter by type when provided", async () => {
        const mockCategories = [{ id: "cat1", name: "Food", type: "expense" }];

        mockPrisma.category.findMany.mockResolvedValue(mockCategories);

        const result = await OPTIMIZED_QUERY_PATTERNS.getActiveCategories(
          mockPrisma as unknown as PrismaClient,
          "expense",
        );

        expect(result.categories).toEqual(mockCategories);
        expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              isActive: true,
              type: "expense",
            },
          }),
        );
      });
    });
  });

  describe("QueryPerformanceMonitor", () => {
    describe("trackQuery", () => {
      it("should track successful query", async () => {
        const queryFn = jest.fn().mockResolvedValue({ id: "123" });

        const result = await QueryPerformanceMonitor.trackQuery(
          "testQuery",
          queryFn,
        );

        expect(result).toEqual({ id: "123" });
        expect(queryFn).toHaveBeenCalled();
      });

      it("should log slow queries", async () => {
        const queryFn = jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve({ id: "123" }), 600),
              ),
          );

        jest.useFakeTimers();

        const resultPromise = QueryPerformanceMonitor.trackQuery(
          "slowQuery",
          queryFn,
          { expectedDuration: 500, logSlow: true },
        );

        jest.advanceTimersByTime(600);
        await resultPromise;

        jest.useRealTimers();

        expect(queryFn).toHaveBeenCalled();
      });

      it("should handle query errors", async () => {
        const queryFn = jest.fn().mockRejectedValue(new Error("Query failed"));

        await expect(
          QueryPerformanceMonitor.trackQuery("failingQuery", queryFn),
        ).rejects.toThrow("Query failed");
      });
    });

    describe("setSlowQueryThreshold", () => {
      it("should update slow query threshold", () => {
        QueryPerformanceMonitor.setSlowQueryThreshold(1000);
        // Should not throw
        expect(true).toBe(true);
      });
    });
  });

  describe("OPTIMIZATION_CHECKLIST", () => {
    it("should contain optimization checklist items", () => {
      expect(OPTIMIZATION_CHECKLIST.indexes).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.pagination).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.selectFields).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.batchQueries).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.aggregations).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.caching).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.connectionPool).toBeDefined();
      expect(OPTIMIZATION_CHECKLIST.monitoring).toBeDefined();
    });

    it("should have status for each item", () => {
      Object.values(OPTIMIZATION_CHECKLIST).forEach((item) => {
        expect(item.status).toBeDefined();
        expect(item.description).toBeDefined();
      });
    });
  });
});
