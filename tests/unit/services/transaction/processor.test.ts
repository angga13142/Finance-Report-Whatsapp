/**
 * Unit tests for TransactionProcessor
 * Tests transaction processing, approval flow, and success messages
 */

import { TransactionProcessor } from "../../../../src/services/transaction/processor";
import { TransactionValidator } from "../../../../src/services/transaction/validator";
import { ApprovalService } from "../../../../src/services/transaction/approval";
import { TransactionModel } from "../../../../src/models/transaction";
import { AuditLogger } from "../../../../src/services/audit/logger";
import { parseAmount, formatCurrency } from "../../../../src/lib/currency";
import { formatDateWITA } from "../../../../src/lib/date";
import { TransactionType, Transaction, ApprovalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Mock dependencies
jest.mock("../../../../src/services/transaction/validator");
jest.mock("../../../../src/services/transaction/approval");
jest.mock("../../../../src/models/transaction");
jest.mock("../../../../src/services/audit/logger");
jest.mock("../../../../src/lib/currency");
jest.mock("../../../../src/lib/date");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TransactionProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processTransaction", () => {
    it("should process valid transaction successfully", async () => {
      const mockTransaction: Transaction = {
        id: "txn123",
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date(),
        version: 1,
        approvalBy: null,
        approvedAt: null,
        categoryId: null,
        archivedAt: null,
      };

      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue(
        {
          valid: true,
          errors: [],
        },
      );
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (ApprovalService.analyzeTransaction as jest.Mock).mockResolvedValue({
        status: "approved" as ApprovalStatus,
        requiresManualApproval: false,
        confidenceScore: 95,
      });
      (TransactionModel.create as jest.Mock).mockResolvedValue(mockTransaction);
      (AuditLogger.logTransactionCreated as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await TransactionProcessor.processTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
        description: "Lunch",
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual(mockTransaction);
      expect(TransactionModel.create).toHaveBeenCalled();
      expect(AuditLogger.logTransactionCreated).toHaveBeenCalled();
    });

    it("should return error for invalid transaction", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue(
        {
          valid: false,
          errors: ["Invalid amount", "Invalid category"],
        },
      );

      const result = await TransactionProcessor.processTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid amount");
      expect(TransactionModel.create).not.toHaveBeenCalled();
    });

    it("should handle approval decision", async () => {
      const mockTransaction: Transaction = {
        id: "txn123",
        userId: "user123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "pending" as ApprovalStatus,
        timestamp: new Date(),
        version: 1,
        approvalBy: null,
        approvedAt: null,
        categoryId: null,
      };

      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue(
        {
          valid: true,
          errors: [],
        },
      );
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (ApprovalService.analyzeTransaction as jest.Mock).mockResolvedValue({
        status: "pending" as ApprovalStatus,
        requiresManualApproval: true,
        confidenceScore: 60,
      });
      (TransactionModel.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await TransactionProcessor.processTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.approvalStatus).toBe("pending");
    });

    it("should handle processing errors", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await TransactionProcessor.processTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getSuccessMessage", () => {
    it("should generate success message for approved transaction", () => {
      const mockTransaction = {
        id: "txn123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "approved" as ApprovalStatus,
        timestamp: new Date("2024-01-15T12:00:00Z"),
      };

      (formatCurrency as jest.Mock).mockReturnValue("Rp 50.000");
      (formatDateWITA as jest.Mock).mockReturnValue("15 Januari 2024, 12:00");

      const result = TransactionProcessor.getSuccessMessage(mockTransaction);

      expect(result).toContain("Transaksi berhasil");
      expect(result).toContain("Rp 50.000");
      expect(result).toContain("Food");
    });

    it("should generate message for pending approval", () => {
      const mockTransaction = {
        id: "txn123",
        type: "expense" as TransactionType,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        approvalStatus: "pending" as ApprovalStatus,
        timestamp: new Date("2024-01-15T12:00:00Z"),
      };

      (formatCurrency as jest.Mock).mockReturnValue("Rp 50.000");
      (formatDateWITA as jest.Mock).mockReturnValue("15 Januari 2024, 12:00");

      const result = TransactionProcessor.getSuccessMessage(mockTransaction);

      expect(result).toContain("Transaksi berhasil disimpan");
      expect(result).toContain("Rp 50.000");
      expect(result).toContain("Food");
    });
  });
});
