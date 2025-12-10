/**
 * Unit tests for TransactionModel
 * Tests transaction CRUD operations, daily totals, optimistic locking, etc.
 */

import type { TransactionType, ApprovalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Create shared mock Prisma instance
const mockPrismaInstance = {
  transaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $use: jest.fn(),
  $on: jest.fn(),
  $extends: jest.fn(),
};

// Mock Prisma before importing TransactionModel
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    TransactionType: {
      INCOME: "income",
      EXPENSE: "expense",
    },
    ApprovalStatus: {
      APPROVED: "approved",
      PENDING: "pending",
      REJECTED: "rejected",
    },
  };
});

// Import after mock setup
import { TransactionModel } from "../../../src/models/transaction";
import { getDayRangeWITA } from "../../../src/lib/date";

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock date utilities
jest.mock("../../../src/lib/date", () => ({
  getDayRangeWITA: jest.fn(() => ({
    start: new Date("2024-01-15T00:00:00Z"),
    end: new Date("2024-01-15T23:59:59Z"),
  })),
}));

// Mock currency utilities
jest.mock("../../../src/lib/currency", () => ({
  parseAmount: jest.fn((amount: string) => new Decimal(amount)),
  validateAmountRange: jest.fn(),
}));

describe("TransactionModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to return default values
    (getDayRangeWITA as jest.Mock).mockReturnValue({
      start: new Date("2024-01-15T00:00:00Z"),
      end: new Date("2024-01-15T23:59:59Z"),
    });
  });

  describe("findById", () => {
    it("should find transaction by ID", async () => {
      const mockTransaction = {
        id: "txn123",
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        user: { id: "user123", name: "Test User" },
        approver: null,
      };

      mockPrismaInstance.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );

      const result = await TransactionModel.findById("txn123");

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaInstance.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: "txn123" },
        include: {
          user: true,
          approver: true,
        },
      });
    });

    it("should return null when transaction not found", async () => {
      mockPrismaInstance.transaction.findUnique.mockResolvedValue(null);

      const result = await TransactionModel.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find transactions by user ID", async () => {
      const mockTransactions = [
        {
          id: "txn1",
          userId: "user123",
          type: "expense" as TransactionType,
          category: "Food",
          amount: new Decimal(50000),
          timestamp: new Date(),
        },
      ];

      mockPrismaInstance.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );

      const result = await TransactionModel.findByUserId("user123");

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalled();
    });

    it("should filter by transaction type", async () => {
      mockPrismaInstance.transaction.findMany.mockResolvedValue([]);

      await TransactionModel.findByUserId("user123", { type: "income" });

      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user123",
            type: "income",
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockPrismaInstance.transaction.findMany.mockResolvedValue([]);

      await TransactionModel.findByUserId("user123", {
        startDate,
        endDate,
      });

      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalledWith(
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

    it("should apply limit and offset", async () => {
      mockPrismaInstance.transaction.findMany.mockResolvedValue([]);

      await TransactionModel.findByUserId("user123", {
        limit: 10,
        offset: 20,
      });

      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });

  describe("findTodayTransactions", () => {
    it("should find today's transactions", async () => {
      const mockTransactions = [
        {
          id: "txn1",
          userId: "user123",
          type: "expense" as TransactionType,
          category: "Food",
          amount: new Decimal(50000),
          timestamp: new Date(),
        },
      ];

      mockPrismaInstance.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );

      const result = await TransactionModel.findTodayTransactions();

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalled();
    });

    it("should filter by user ID when provided", async () => {
      mockPrismaInstance.transaction.findMany.mockResolvedValue([]);

      await TransactionModel.findTodayTransactions("user123");

      expect(mockPrismaInstance.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user123",
          }),
        }),
      );
    });
  });

  describe("create", () => {
    it("should create new transaction", async () => {
      const mockTransaction = {
        id: "txn123",
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        user: { id: "user123", name: "Test User" },
      };

      mockPrismaInstance.transaction.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaInstance.transaction.create.mockResolvedValue(mockTransaction);

      const result = await TransactionModel.create({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
        description: "Lunch",
      });

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaInstance.transaction.create).toHaveBeenCalled();
    });

    it("should throw error for duplicate transaction", async () => {
      const duplicateTransaction = {
        id: "txn1",
        userId: "user123",
        category: "Food",
        amount: new Decimal(50000),
        timestamp: new Date(),
      };

      mockPrismaInstance.transaction.findFirst.mockResolvedValue(
        duplicateTransaction,
      );

      await expect(
        TransactionModel.create({
          userId: "user123",
          type: "expense",
          category: "Food",
          amount: "50000",
        }),
      ).rejects.toThrow("Duplicate transaction detected");
    });
  });

  describe("update", () => {
    it("should update transaction", async () => {
      const mockTransaction = {
        id: "txn123",
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(60000),
        description: "Updated lunch",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2,
        user: { id: "user123", name: "Test User" },
        approver: null,
      };

      mockPrismaInstance.transaction.update.mockResolvedValue(mockTransaction);

      const result = await TransactionModel.update("txn123", {
        category: "Food",
        amount: "60000",
        description: "Updated lunch",
      });

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaInstance.transaction.update).toHaveBeenCalled();
    });

    it("should increment version on update", async () => {
      const mockTransaction = {
        id: "txn123",
        version: 2,
      };

      mockPrismaInstance.transaction.update.mockResolvedValue(mockTransaction);

      await TransactionModel.update("txn123", {
        description: "Updated",
      });

      expect(mockPrismaInstance.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe("getDailyTotals", () => {
    it("should calculate daily totals", async () => {
      const mockTransactions = [
        {
          type: "income" as TransactionType,
          amount: new Decimal(100000),
        },
        {
          type: "income" as TransactionType,
          amount: new Decimal(50000),
        },
        {
          type: "expense" as TransactionType,
          amount: new Decimal(30000),
        },
      ];

      mockPrismaInstance.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );

      const result = await TransactionModel.getDailyTotals("user123");

      expect(result.income.toNumber()).toBe(150000);
      expect(result.expense.toNumber()).toBe(30000);
      expect(result.net.toNumber()).toBe(120000);
      expect(result.count).toBe(3);
    });

    it("should handle empty transactions", async () => {
      mockPrismaInstance.transaction.findMany.mockResolvedValue([]);

      const result = await TransactionModel.getDailyTotals("user123");

      expect(result.income.toNumber()).toBe(0);
      expect(result.expense.toNumber()).toBe(0);
      expect(result.net.toNumber()).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe("getLastCategory", () => {
    it("should return last used category for transaction type", async () => {
      const mockTransaction = {
        category: "Food",
      };

      mockPrismaInstance.transaction.findFirst.mockResolvedValue(
        mockTransaction,
      );

      const result = await TransactionModel.getLastCategory(
        "user123",
        "expense",
      );

      expect(result).toBe("Food");
    });

    it("should return null when no previous transaction", async () => {
      mockPrismaInstance.transaction.findFirst.mockResolvedValue(null);

      const result = await TransactionModel.getLastCategory(
        "user123",
        "expense",
      );

      expect(result).toBeNull();
    });
  });

  describe("updateWithOptimisticLock", () => {
    it("should update transaction with version check", async () => {
      const mockTransaction = {
        id: "txn123",
        version: 2,
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(60000),
        description: "Updated",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user123", name: "Test User" },
        approver: null,
      };

      mockPrismaInstance.transaction.findUnique
        .mockResolvedValueOnce({ version: 1 }) // Current version check
        .mockResolvedValueOnce(mockTransaction); // After update
      mockPrismaInstance.transaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await TransactionModel.updateWithOptimisticLock(
        "txn123",
        1,
        {
          amount: "60000",
          description: "Updated",
        },
      );

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaInstance.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "txn123",
            version: 1,
          },
        }),
      );
    });

    it("should throw error on version mismatch", async () => {
      mockPrismaInstance.transaction.findUnique.mockResolvedValue({
        version: 2,
      });

      await expect(
        TransactionModel.updateWithOptimisticLock("txn123", 1, {
          description: "Updated",
        }),
      ).rejects.toThrow("Version mismatch");
    });

    it("should throw error when update count is 0", async () => {
      mockPrismaInstance.transaction.findUnique
        .mockResolvedValueOnce({ version: 1 })
        .mockResolvedValueOnce(null);
      mockPrismaInstance.transaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        TransactionModel.updateWithOptimisticLock("txn123", 1, {
          description: "Updated",
        }),
      ).rejects.toThrow("Failed to update transaction");
    });
  });

  describe("updateWithRetry", () => {
    it("should retry on version mismatch", async () => {
      const mockTransaction = {
        id: "txn123",
        version: 2,
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Updated",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user123", name: "Test User" },
        approver: null,
      };

      // First attempt: version mismatch (updateMany returns 0), second attempt: success
      // First retry attempt - version mismatch
      const firstAttemptTransaction = {
        id: "txn123",
        version: 1,
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Original",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First attempt flow:
      // 1. updateWithRetry calls findById (findUnique)
      mockPrismaInstance.transaction.findUnique.mockResolvedValueOnce(
        firstAttemptTransaction,
      ); // findById in updateWithRetry
      // 2. updateWithOptimisticLock calls findUnique with select: { version: true }
      mockPrismaInstance.transaction.findUnique.mockResolvedValueOnce({
        version: 1,
      }); // Version check in updateWithOptimisticLock
      // 3. updateMany returns 0 (version mismatch - transaction was updated by another process)
      mockPrismaInstance.transaction.updateMany.mockResolvedValueOnce({
        count: 0,
      }); // Version mismatch - no rows updated (will throw error)

      // Second retry attempt - success
      const secondAttemptTransaction = {
        ...firstAttemptTransaction,
        version: 2, // Version updated by another process
      };

      // Second attempt flow:
      // 1. updateWithRetry calls findById (findUnique)
      mockPrismaInstance.transaction.findUnique.mockResolvedValueOnce(
        secondAttemptTransaction,
      ); // findById in updateWithRetry
      // 2. updateWithOptimisticLock calls findUnique with select: { version: true }
      mockPrismaInstance.transaction.findUnique.mockResolvedValueOnce({
        version: 2,
      }); // Version check in updateWithOptimisticLock
      // 3. updateMany returns 1 (success)
      mockPrismaInstance.transaction.updateMany.mockResolvedValueOnce({
        count: 1,
      }); // Success - 1 row updated
      // 4. updateWithOptimisticLock calls findUnique with include to get updated transaction
      mockPrismaInstance.transaction.findUnique.mockResolvedValueOnce(
        mockTransaction,
      ); // findUnique after update in updateWithOptimisticLock

      const result = await TransactionModel.updateWithRetry("txn123", {
        description: "Updated",
      });

      expect(result).toEqual(mockTransaction);
    });
  });

  describe("softDelete", () => {
    it("should soft delete transaction by marking description", async () => {
      const existingTransaction = {
        id: "txn123",
        description: "Original description",
        amount: new Decimal(50000),
      };

      const mockTransaction = {
        ...existingTransaction,
        description: "[DELETED by user123: Test reason] Original description",
        amount: new Decimal(0),
        version: 2,
      };

      mockPrismaInstance.transaction.findUnique.mockResolvedValue(
        existingTransaction,
      );
      mockPrismaInstance.transaction.update.mockResolvedValue(mockTransaction);

      const result = await TransactionModel.softDelete(
        "txn123",
        "user123",
        "Test reason",
      );

      expect(result.description).toContain("[DELETED by user123");
      expect(result.description).toContain("Test reason");
      expect(result.amount.toNumber()).toBe(0);
    });

    it("should throw error when transaction not found", async () => {
      mockPrismaInstance.transaction.findUnique.mockResolvedValue(null);

      await expect(
        TransactionModel.softDelete("nonexistent", "user123"),
      ).rejects.toThrow("Transaction not found");
    });
  });
});
