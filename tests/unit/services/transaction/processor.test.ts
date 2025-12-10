/**
 * Unit tests for TransactionProcessor
 * Tests transaction processing logic (processTransaction, editTransaction, deleteTransaction)
 */

import { TransactionProcessor } from "../../../../src/services/transaction/processor";
import { TransactionModel } from "../../../../src/models/transaction";
import { TransactionValidator } from "../../../../src/services/transaction/validator";
import { ApprovalService } from "../../../../src/services/transaction/approval";
import { AuditLogger } from "../../../../src/services/audit/logger";
import { logger } from "../../../../src/lib/logger";
import { TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Mock dependencies
jest.mock("../../../../src/models/transaction");
jest.mock("../../../../src/services/transaction/validator");
jest.mock("../../../../src/services/transaction/approval");
jest.mock("../../../../src/services/audit/logger");
jest.mock("../../../../src/lib/logger");
jest.mock("../../../../src/lib/currency");

describe("TransactionProcessor", () => {
  const mockUserId = "test-user-id";
  const mockTransactionId = "test-transaction-id";

  const mockTransaction = {
    id: mockTransactionId,
    userId: mockUserId,
    categoryId: null,
    category: "Test Category",
    amount: new Decimal(100000),
    type: "income" as TransactionType,
    description: "Test transaction",
    timestamp: new Date(),
    approvalStatus: "approved" as const,
    approvalBy: null,
    approvedAt: null,
    version: 1,
    archivedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processTransaction", () => {
    it("should process valid transaction successfully", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (ApprovalService.analyzeTransaction as jest.Mock).mockResolvedValue({
        approved: true,
        approvalStatus: "approved",
        flaggedReason: null,
      });

      (TransactionModel.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await TransactionProcessor.processTransaction({
        userId: mockUserId,
        type: "income",
        category: "Test Category",
        amount: 100000,
        description: "Test transaction",
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual(mockTransaction);
      expect(TransactionValidator.validateTransaction).toHaveBeenCalled();
      expect(ApprovalService.analyzeTransaction).toHaveBeenCalled();
      expect(TransactionModel.create).toHaveBeenCalled();
    });

    it("should reject invalid transaction data", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue({
        valid: false,
        errors: ["Invalid amount", "Category required"],
      });

      const result = await TransactionProcessor.processTransaction({
        userId: mockUserId,
        type: "income",
        category: "",
        amount: -1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid amount");
      expect(TransactionModel.create).not.toHaveBeenCalled();
    });

    it("should handle flagged transactions for approval", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (ApprovalService.analyzeTransaction as jest.Mock).mockResolvedValue({
        approved: false,
        approvalStatus: "pending",
        flaggedReason: "Suspicious amount pattern",
      });

      (TransactionModel.create as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        approvalStatus: "pending",
      });

      const result = await TransactionProcessor.processTransaction({
        userId: mockUserId,
        type: "expense",
        category: "Test Category",
        amount: 1000000000,
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.approvalStatus).toBe("pending");
    });

    it("should handle database errors gracefully", async () => {
      (TransactionValidator.validateTransaction as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (ApprovalService.analyzeTransaction as jest.Mock).mockResolvedValue({
        approved: true,
        approvalStatus: "approved",
      });

      (TransactionModel.create as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await TransactionProcessor.processTransaction({
        userId: mockUserId,
        type: "income",
        category: "Test Category",
        amount: 100000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("deleteTransaction", () => {
    it("should soft delete transaction successfully", async () => {
      (TransactionModel.findById as jest.Mock).mockResolvedValue(mockTransaction);
      (TransactionModel.softDelete as jest.Mock).mockResolvedValue(true);

      const result = await TransactionProcessor.deleteTransaction(
        mockTransactionId,
        mockUserId,
        "boss"
      );

      expect(result.success).toBe(true);
      expect(TransactionModel.softDelete).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
        undefined
      );
      expect(AuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "transaction_deleted",
        })
      );
    });

    it("should prevent employee from deleting transactions", async () => {
      (TransactionModel.findById as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await TransactionProcessor.deleteTransaction(
        mockTransactionId,
        mockUserId,
        "employee"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Boss dan Dev");
      expect(TransactionModel.softDelete).not.toHaveBeenCalled();
    });

    it("should prevent deleting non-existent transaction", async () => {
      (TransactionModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await TransactionProcessor.deleteTransaction(
        "non-existent-id",
        mockUserId,
        "boss"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("tidak ditemukan");
    });
  });

});
