/**
 * Unit tests for TransactionValidator
 * Tests transaction validation logic including amount, category, description, and duplicates
 */

import { TransactionValidator } from "../../../../src/services/transaction/validator";
import { CategoryModel } from "../../../../src/models/category";
import { TransactionModel } from "../../../../src/models/transaction";
import { parseAmount, validateAmountRange } from "../../../../src/lib/currency";
import { TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Mock dependencies
jest.mock("../../../../src/models/category");
jest.mock("../../../../src/models/transaction");
jest.mock("../../../../src/lib/currency");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("TransactionValidator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateAmount", () => {
    it("should validate valid amount", () => {
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (validateAmountRange as jest.Mock).mockReturnValue(true);

      const result = TransactionValidator.validateAmount("50000");

      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(50000);
    });

    it("should return error for invalid amount format", () => {
      (parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid amount format");
      });

      const result = TransactionValidator.validateAmount("invalid");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid amount format");
    });

    it("should return error for amount out of range", () => {
      // Use amount that exceeds MAX_TRANSACTION_AMOUNT (500_000_000)
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(600000000));
      (validateAmountRange as jest.Mock).mockImplementation(() => {
        throw new Error("Amount cannot exceed Rp 500.000.000");
      });

      const result = TransactionValidator.validateAmount("600000000");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("validateCategory", () => {
    it("should validate existing and active category", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "Food",
        "expense",
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error for non-existent category", async () => {
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(null);

      const result = await TransactionValidator.validateCategory(
        "NonExistent",
        "expense",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak ditemukan");
    });

    it("should return error for inactive category", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: false,
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "Food",
        "expense",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak aktif");
    });

    it("should return error for category type mismatch", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "Food",
        "income",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak cocok");
    });
  });

  describe("checkDuplicate", () => {
    it("should detect duplicate transaction", async () => {
      const mockTransaction = {
        id: "txn1",
        category: "Food",
        amount: new Decimal(50000),
        timestamp: new Date(),
      };

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user123",
        "Food",
        "50000",
        1,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingTransaction).toEqual(mockTransaction);
    });

    it("should not detect duplicate for different category", async () => {
      const mockTransaction = {
        id: "txn1",
        category: "Transport",
        amount: new Decimal(50000),
        timestamp: new Date(),
      };

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user123",
        "Food",
        "50000",
        1,
      );

      expect(result.isDuplicate).toBe(false);
    });

    it("should not detect duplicate for different amount", async () => {
      const mockTransaction = {
        id: "txn1",
        category: "Food",
        amount: new Decimal(60000),
        timestamp: new Date(),
      };

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user123",
        "Food",
        "50000",
        1,
      );

      expect(result.isDuplicate).toBe(false);
    });

    it("should return false on error", async () => {
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (TransactionModel.findByUserId as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await TransactionValidator.checkDuplicate(
        "user123",
        "Food",
        "50000",
        1,
      );

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe("validateDescription", () => {
    it("should validate valid description", () => {
      const result =
        TransactionValidator.validateDescription("Valid description");

      expect(result.valid).toBe(true);
    });

    it("should allow empty description", () => {
      const result = TransactionValidator.validateDescription();

      expect(result.valid).toBe(true);
    });

    it("should return error for description too long", () => {
      const longDescription = "a".repeat(101);

      const result = TransactionValidator.validateDescription(longDescription);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("validateTransaction", () => {
    it("should validate complete valid transaction", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
      };

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([]);

      const result = await TransactionValidator.validateTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
        description: "Lunch",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for invalid amount", async () => {
      (parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid amount");
      });

      const result = await TransactionValidator.validateTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return errors for invalid category", async () => {
      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(null);

      const result = await TransactionValidator.validateTransaction({
        userId: "user123",
        type: "expense",
        category: "NonExistent",
        amount: "50000",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tidak ditemukan"))).toBe(
        true,
      );
    });

    it("should return errors for duplicate transaction", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
      };

      const mockDuplicate = {
        id: "txn1",
        category: "Food",
        amount: new Decimal(50000),
        timestamp: new Date(),
      };

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockDuplicate,
      ]);

      const result = await TransactionValidator.validateTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("serupa sudah ada"))).toBe(
        true,
      );
    });

    it("should return errors for invalid description", async () => {
      const mockCategory = {
        id: "cat1",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
      };

      const longDescription = "a".repeat(101);

      (parseAmount as jest.Mock).mockReturnValue(new Decimal(50000));
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([]);

      const result = await TransactionValidator.validateTransaction({
        userId: "user123",
        type: "expense",
        category: "Food",
        amount: "50000",
        description: longDescription,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
