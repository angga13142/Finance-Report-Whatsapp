/**
 * Unit tests for Report Generator
 * Tests daily report calculations and formatting
 */

import { ReportGenerator } from "../../../../src/services/report/generator";
import { TransactionModel } from "../../../../src/models/transaction";
import { logger } from "../../../../src/lib/logger";
import { DateTime } from "luxon";

jest.mock("../../../../src/models/transaction");
jest.mock("../../../../src/lib/logger");

describe("ReportGenerator", () => {
  const mockUserId = "test-user-id";
  const mockDate = DateTime.fromISO("2025-12-10").setZone("Asia/Makassar");

  const mockTransactions = [
    {
      id: "tx-1",
      userId: mockUserId,
      type: "income",
      category: "Sales",
      amount: 500000,
      timestamp: mockDate.toJSDate(),
    },
    {
      id: "tx-2",
      userId: mockUserId,
      type: "expense",
      category: "Office Supplies",
      amount: 150000,
      timestamp: mockDate.toJSDate(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateDailyReport", () => {
    it("should generate daily report with correct calculations", async () => {
      (TransactionModel.findByDateRange as jest.Mock).mockResolvedValue(
        mockTransactions
      );

      const result = await ReportGenerator.generateDailyReport(mockUserId, mockDate.toJSDate());

      expect(result.success).toBe(true);
      expect(result.report?.totalIncome).toBe(500000);
      expect(result.report?.totalExpense).toBe(150000);
      expect(result.report?.cashflow).toBe(350000);
    });

    it("should handle empty transaction list", async () => {
      (TransactionModel.findByDateRange as jest.Mock).mockResolvedValue([]);

      const result = await ReportGenerator.generateDailyReport(mockUserId, mockDate.toJSDate());

      expect(result.success).toBe(true);
      expect(result.report?.totalIncome).toBe(0);
      expect(result.report?.totalExpense).toBe(0);
      expect(result.report?.cashflow).toBe(0);
    });
  });

  describe("calculate7DayMovingAverage", () => {
    it("should calculate moving average correctly", () => {
      const dailyTotals = [100, 150, 120, 180, 200, 160, 140];
      
      const result = ReportGenerator.calculate7DayMovingAverage(dailyTotals);

      expect(result).toBeCloseTo(150, 0);
    });

    it("should handle insufficient data", () => {
      const dailyTotals = [100, 150];

      const result = ReportGenerator.calculate7DayMovingAverage(dailyTotals);

      expect(result).toBe(0);
    });
  });

  describe("calculateProfitMargin", () => {
    it("should calculate profit margin percentage", () => {
      const income = 1000000;
      const expense = 600000;

      const result = ReportGenerator.calculateProfitMargin(income, expense);

      expect(result).toBe(40);
    });

    it("should handle zero income", () => {
      const result = ReportGenerator.calculateProfitMargin(0, 50000);

      expect(result).toBe(0);
    });
  });
});
