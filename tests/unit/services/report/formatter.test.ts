/**
 * Unit tests for ReportFormatter
 */

import { ReportFormatter } from "../../../../src/services/report/formatter";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ReportFormatter", () => {
  const mockReportData = {
    role: UserRole.employee,
    summary: {
      totalIncome: new Decimal("1000000"),
      totalExpense: new Decimal("200000"),
      netCashflow: new Decimal("800000"),
      transactionCount: 10,
      incomeCount: 6,
      expenseCount: 4,
      avgTransaction: new Decimal("100000"),
    },
    categoryBreakdown: [
      {
        category: "Salary",
        amount: new Decimal("900000"),
        count: 1,
        percentage: 90,
      },
      {
        category: "Food",
        amount: new Decimal("100000"),
        count: 5,
        percentage: 10,
      },
    ],
    topTransactions: [
      {
        id: "txn1",
        type: "income",
        category: "Salary",
        amount: new Decimal("900000"),
        description: "Monthly salary",
        timestamp: new Date("2025-12-10"),
        userName: "John Doe",
      },
    ],
  };

  describe("formatDailyReport", () => {
    it("should format daily report with all sections", () => {
      const result = ReportFormatter.formatDailyReport(
        mockReportData,
        new Date("2025-12-10"),
      );

      expect(result).toContain("LAPORAN HARIAN");
      expect(result).toContain("RINGKASAN");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include currency formatting", () => {
      const result = ReportFormatter.formatDailyReport(
        mockReportData,
        new Date("2025-12-10"),
      );

      expect(result).toContain("Rp");
    });

    it("should handle zero transactions", () => {
      const emptyData = {
        ...mockReportData,
        categoryBreakdown: [],
        topTransactions: [],
      };

      const result = ReportFormatter.formatDailyReport(
        emptyData,
        new Date("2025-12-10"),
      );

      expect(typeof result).toBe("string");
    });
  });

  describe("formatShortSummary", () => {
    it("should format short summary", () => {
      const result = ReportFormatter.formatShortSummary(mockReportData);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatDetailedReport", () => {
    it("should format detailed report", () => {
      const result = ReportFormatter.formatDetailedReport(
        mockReportData,
        new Date("2025-12-10"),
      );

      expect(typeof result).toBe("string");
    });
  });

  describe("formatNegativeCashflowAlert", () => {
    it("should format negative cashflow alert", () => {
      const result = ReportFormatter.formatNegativeCashflowAlert(
        3,
        new Decimal("100000"),
      );

      expect(typeof result).toBe("string");
      expect(result).toContain("PERINGATAN");
    });
  });

  describe("formatErrorMessage", () => {
    it("should format error message", () => {
      const error = new Error("Test error");
      const result = ReportFormatter.formatErrorMessage(error);

      expect(typeof result).toBe("string");
      expect(result).toContain("Test error");
    });
  });
});
