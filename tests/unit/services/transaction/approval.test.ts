/**
 * Unit tests for ApprovalService
 * Tests transaction approval workflow, suspicious pattern detection, and auto-approval logic
 */

import { TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Prisma client - must be before importing services
jest.mock("@prisma/client", () => {
  const mockPrismaInstance = {
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
    TransactionType: {
      income: "income",
      expense: "expense",
    },
    ApprovalStatus: {
      pending: "pending",
      approved: "approved",
      rejected: "rejected",
    },
  };
});

// Import after mocks are set up
import { ApprovalService } from "../../../../src/services/transaction/approval";
import { PrismaClient } from "@prisma/client";

// Get the mocked Prisma instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = new PrismaClient();

describe("ApprovalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("analyzeTransaction", () => {
    it("should auto-approve normal transaction with no suspicious flags", async () => {
      // Mock no duplicates (for checkForDuplicates)
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      // Mock low daily stats (for getDailyUserStats)
      mockPrisma.transaction.findMany.mockResolvedValue([
        { amount: new Decimal(100000) },
        { amount: new Decimal(200000) },
      ]);
      // Mock recent count (for getRecentTransactionCount)
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Lunch at restaurant",
      );

      expect(result.status).toBe("approved");
      expect(result.requiresManualApproval).toBe(false);
      expect(result.confidenceScore).toBe(0);
      expect(result.flags.isDuplicate).toBe(false);
      expect(result.flags.isUnrealisticAmount).toBe(false);
    });

    it("should flag unrealistic amount for manual approval", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(150000000), // 150 million - unrealistic
        "Office Supplies",
        "Office renovation",
      );

      expect(result.status).toBe("pending");
      expect(result.requiresManualApproval).toBe(true);
      expect(result.flags.isUnrealisticAmount).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(40);
    });

    it("should detect duplicate transaction", async () => {
      // Mock duplicate transaction - must match the exact query structure
      const recentTransaction = {
        id: "txn1",
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: new Decimal(50000),
        timestamp: new Date(Date.now() - 4 * 60 * 1000), // 4 minutes ago (within 5 min threshold)
      };

      // Setup mocks in order of calls:
      // 1. First call: checkForDuplicates (findMany with userId, type, category, timestamp filter)
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        recentTransaction,
      ]);
      // 2. Second call: getDailyUserStats (findMany with userId, timestamp filter)
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
      ]);
      // 3. Third call: getRecentTransactionCount (count with userId, timestamp filter)
      mockPrisma.transaction.count.mockResolvedValueOnce(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Lunch at restaurant",
      );

      expect(result.flags.isDuplicate).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(30);
    });

    it("should flag transaction exceeding daily transaction limit", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats - 51 transactions
      const mockTransactions = Array(51).fill({ amount: new Decimal(10000) });
      mockPrisma.transaction.findMany.mockResolvedValueOnce(mockTransactions);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Lunch",
      );

      expect(result.flags.exceedsDailyLimit).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(20);
    });

    it("should flag transaction exceeding daily amount limit", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats - total 51 million
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(30000000) },
        { amount: new Decimal(21000000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Lunch",
      );

      expect(result.flags.exceedsDailyAmountLimit).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(25);
    });

    it("should flag rapid successive transactions", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
        { amount: new Decimal(200000) },
      ]);
      // Mock for recent count - 4 transactions in 5 minutes
      mockPrisma.transaction.count.mockResolvedValue(4);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Lunch",
      );

      expect(result.flags.rapidSuccessiveTransactions).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(15);
    });

    it("should flag suspicious keywords in description", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "Testing payment", // Contains "testing" keyword
      );

      expect(result.flags.hasSuspiciousKeywords).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(10);
    });

    it("should flag missing or short description", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "ab", // Too short (< MIN_DESCRIPTION_LENGTH of 3)
      );

      expect(result.flags.lacksDescription).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(5);
    });

    it("should require manual approval for large amount", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(1000000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(15000000), // 15 million - over MAX_AUTO_APPROVE_AMOUNT (10 million)
        "Office Equipment",
        "New computers for office",
      );

      expect(result.status).toBe("pending");
      expect(result.requiresManualApproval).toBe(true);
    });

    it("should accumulate suspicion score from multiple flags", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats - 52 transactions, 51 million total
      const mockTransactions = Array(52).fill({ amount: new Decimal(1000000) });
      mockPrisma.transaction.findMany.mockResolvedValueOnce(mockTransactions);
      // Mock for recent count - rapid transactions
      mockPrisma.transaction.count.mockResolvedValue(4);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        "test", // Suspicious keyword + short description
      );

      // Should accumulate scores: 20 (daily limit) + 25 (daily amount) + 15 (rapid) + 10 (keywords) + 5 (description)
      expect(result.confidenceScore).toBeGreaterThanOrEqual(50);
      expect(result.status).toBe("pending");
      expect(result.requiresManualApproval).toBe(true);
    });

    it("should handle missing description gracefully", async () => {
      // Mock for duplicate check
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      // Mock for daily stats
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: new Decimal(100000) },
      ]);
      // Mock for recent count
      mockPrisma.transaction.count.mockResolvedValue(2);

      const result = await ApprovalService.analyzeTransaction(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
        undefined, // No description
      );

      expect(result.flags.lacksDescription).toBe(true);
    });
  });

  describe("checkForDuplicates", () => {
    it("should return false when no similar transactions found", async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).checkForDuplicates(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
      );

      expect(result).toBe(false);
    });

    it("should return true for similar amount within time window", async () => {
      const recentTransaction = {
        amount: new Decimal(51000), // 95%+ similar to 50000
        timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      };
      mockPrisma.transaction.findMany.mockResolvedValue([recentTransaction]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).checkForDuplicates(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
      );

      expect(result).toBe(true);
    });

    it("should return false for similar amount outside time window", async () => {
      const oldTransaction = {
        amount: new Decimal(51000),
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (outside TIME_SIMILARITY_THRESHOLD)
      };
      mockPrisma.transaction.findMany.mockResolvedValue([oldTransaction]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).checkForDuplicates(
        "user123",
        "expense" as TransactionType,
        new Decimal(50000),
        "Food",
      );

      expect(result).toBe(false);
    });
  });

  describe("getDailyUserStats", () => {
    it("should return daily transaction count and total amount", async () => {
      const mockTransactions = [
        { amount: new Decimal(1000000) },
        { amount: new Decimal(2000000) },
        { amount: new Decimal(2000000) },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).getDailyUserStats(
        "user123",
      );

      expect(result.transactionCount).toBe(3);
      expect(result.totalAmount).toEqual(new Decimal(5000000));
    });

    it("should handle zero transactions", async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).getDailyUserStats(
        "user123",
      );

      expect(result.transactionCount).toBe(0);
      expect(result.totalAmount).toEqual(new Decimal(0));
    });
  });

  describe("getRecentTransactionCount", () => {
    it("should count recent transactions within specified minutes", async () => {
      mockPrisma.transaction.count.mockResolvedValue(3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ApprovalService as any).getRecentTransactionCount(
        "user123",
        5,
      );

      expect(result).toBe(3);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user123",
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
