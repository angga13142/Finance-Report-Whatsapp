/**
 * Unit tests for TransactionValidator
 * Tests validation logic with proper mocking of dependencies
 */

import { TransactionType } from "@prisma/client";
import { TransactionValidator } from "../../../../src/services/transaction/validator";
import { CategoryModel } from "../../../../src/models/category";
import { TransactionModel } from "../../../../src/models/transaction";
import { logger } from "../../../../src/lib/logger";
import * as currencyUtils from "../../../../src/lib/currency";
import * as validationUtils from "../../../../src/lib/validation";
import { Decimal } from "@prisma/client/runtime/library";

// Mock dependencies
jest.mock("../../../../src/models/category");
jest.mock("../../../../src/models/transaction");
jest.mock("../../../../src/lib/logger");
jest.mock("../../../../src/lib/currency");
jest.mock("../../../../src/lib/validation");

describe("TransactionValidator", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateAmount", () => {
    it("should validate correct amount string", () => {
      const mockParsed = new Decimal(50000);
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(mockParsed);
      (currencyUtils.validateAmountRange as jest.Mock).mockReturnValue(true);

      const result = TransactionValidator.validateAmount("50000");

      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(50000);
      expect(result.error).toBeUndefined();
      expect(currencyUtils.parseAmount).toHaveBeenCalledWith("50000");
    });

    it("should validate correct amount number", () => {
      const mockParsed = new Decimal(50000);
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(mockParsed);
      (currencyUtils.validateAmountRange as jest.Mock).mockReturnValue(true);

      const result = TransactionValidator.validateAmount(50000);

      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(50000);
      expect(currencyUtils.parseAmount).toHaveBeenCalledWith("50000");
    });

    it("should reject invalid amount format", () => {
      (currencyUtils.parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid amount format");
      });

      const result = TransactionValidator.validateAmount("invalid");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid amount format");
      expect(result.parsed).toBeUndefined();
    });

    it("should reject amount below minimum", () => {
      const mockParsed = new Decimal(100);
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(mockParsed);
      (currencyUtils.validateAmountRange as jest.Mock).mockImplementation(
        () => {
          throw new Error("Amount must be at least Rp1.000");
        },
      );

      const result = TransactionValidator.validateAmount("100");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least");
    });

    it("should reject amount above maximum", () => {
      const mockParsed = new Decimal(1000000000);
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(mockParsed);
      (currencyUtils.validateAmountRange as jest.Mock).mockImplementation(
        () => {
          throw new Error("Amount cannot exceed Rp500.000.000");
        },
      );

      const result = TransactionValidator.validateAmount("1000000000");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed");
    });
  });

  describe("validateCategory", () => {
    it("should validate existing active category with matching type", async () => {
      const mockCategory = {
        id: "cat-1",
        name: "Food",
        type: TransactionType.expense,
        isActive: true,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "Food",
        TransactionType.expense,
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(CategoryModel.findByName as jest.Mock).toHaveBeenCalledWith(
        "Food",
      );
    });

    it("should reject non-existent category", async () => {
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(null);

      const result = await TransactionValidator.validateCategory(
        "NonExistent",
        TransactionType.expense,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak ditemukan");
    });

    it("should reject inactive category", async () => {
      const mockCategory = {
        id: "cat-1",
        name: "OldCategory",
        type: TransactionType.expense,
        isActive: false,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "OldCategory",
        TransactionType.expense,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak aktif");
    });

    it("should reject category with mismatched transaction type", async () => {
      const mockCategory = {
        id: "cat-1",
        name: "Salary",
        type: TransactionType.income,
        isActive: true,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue(mockCategory);

      const result = await TransactionValidator.validateCategory(
        "Salary",
        TransactionType.expense,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak cocok");
    });

    it("should handle database errors gracefully", async () => {
      (CategoryModel.findByName as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await TransactionValidator.validateCategory(
        "Food",
        TransactionType.expense,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("memvalidasi");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("checkDuplicate", () => {
    it("should not find duplicate when no similar transactions exist", async () => {
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([]);

      const result = await TransactionValidator.checkDuplicate(
        "user-1",
        "Food",
        "50000",
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingTransaction).toBeUndefined();
    });

    it("should find duplicate when similar transaction exists", async () => {
      const mockTransaction = {
        id: "txn-1",
        userId: "user-1",
        type: TransactionType.expense,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user-1",
        "Food",
        "50000",
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingTransaction).toEqual(mockTransaction);
    });

    it("should not find duplicate for different amount", async () => {
      const mockTransaction = {
        id: "txn-1",
        userId: "user-1",
        type: TransactionType.expense,
        category: "Food",
        amount: new Decimal(30000),
        description: "Lunch",
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user-1",
        "Food",
        "50000",
      );

      expect(result.isDuplicate).toBe(false);
    });

    it("should not find duplicate for different category", async () => {
      const mockTransaction = {
        id: "txn-1",
        userId: "user-1",
        type: TransactionType.expense,
        category: "Transport",
        amount: new Decimal(50000),
        description: "Taxi",
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      const result = await TransactionValidator.checkDuplicate(
        "user-1",
        "Food",
        "50000",
      );

      expect(result.isDuplicate).toBe(false);
    });

    it("should handle errors gracefully and not block transaction", async () => {
      (currencyUtils.parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Parse error");
      });

      const result = await TransactionValidator.checkDuplicate(
        "user-1",
        "Food",
        "invalid",
      );

      expect(result.isDuplicate).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should use custom time window", async () => {
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([]);

      await TransactionValidator.checkDuplicate("user-1", "Food", "50000", 5);

      expect(TransactionModel.findByUserId as jest.Mock).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          startDate: expect.any(Date),
          limit: 10,
        }),
      );
    });
  });

  describe("validateDescription", () => {
    it("should validate when description is undefined", () => {
      const result = TransactionValidator.validateDescription(undefined);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should treat empty string as valid (falsy check)", () => {
      // Empty string '' is falsy, so the function returns early with valid: true
      const result = TransactionValidator.validateDescription("");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate correct description", () => {
      (validationUtils.validateStringLength as jest.Mock).mockReturnValue(true);

      const result = TransactionValidator.validateDescription(
        "Lunch at restaurant",
      );

      expect(result.valid).toBe(true);
      expect(validationUtils.validateStringLength).toHaveBeenCalledWith(
        "Lunch at restaurant",
        1,
        100,
        "Transaction description",
      );
    });

    it("should reject description that is too long", () => {
      (validationUtils.validateStringLength as jest.Mock).mockImplementation(
        () => {
          throw new Error("Description is too long");
        },
      );

      const longDescription = "a".repeat(150);
      const result = TransactionValidator.validateDescription(longDescription);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("long");
    });
  });

  describe("validateTransaction", () => {
    const validTransactionData = {
      userId: "user-1",
      type: TransactionType.expense,
      category: "Food",
      amount: "50000",
      description: "Lunch",
    };

    beforeEach(() => {
      // Setup default mocks for happy path
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(
        new Decimal(50000),
      );
      (currencyUtils.validateAmountRange as jest.Mock).mockReturnValue(true);
      (validationUtils.validateStringLength as jest.Mock).mockReturnValue(true);

      (CategoryModel.findByName as jest.Mock).mockResolvedValue({
        id: "cat-1",
        name: "Food",
        type: TransactionType.expense,
        isActive: true,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([]);
    });

    it("should validate complete transaction with all fields correct", async () => {
      const result =
        await TransactionValidator.validateTransaction(validTransactionData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should collect all validation errors", async () => {
      // Make amount validation fail
      (currencyUtils.parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid amount");
      });

      // Make category validation fail
      (CategoryModel.findByName as jest.Mock).mockResolvedValue(null);

      // Make description validation fail
      (validationUtils.validateStringLength as jest.Mock).mockImplementation(
        () => {
          throw new Error("Description too long");
        },
      );

      const result =
        await TransactionValidator.validateTransaction(validTransactionData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("amount"),
          expect.stringContaining("ditemukan"),
          expect.stringContaining("long"),
        ]),
      );
    });

    it("should detect duplicate transactions", async () => {
      const mockDuplicate = {
        id: "txn-1",
        userId: "user-1",
        type: TransactionType.expense,
        category: "Food",
        amount: new Decimal(50000),
        description: "Lunch",
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (TransactionModel.findByUserId as jest.Mock).mockResolvedValue([
        mockDuplicate,
      ]);

      const result =
        await TransactionValidator.validateTransaction(validTransactionData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Transaksi serupa sudah ada dalam 1 menit terakhir",
      );
    });

    it("should validate transaction without description", async () => {
      const dataWithoutDescription = {
        userId: "user-1",
        type: TransactionType.income,
        category: "Salary",
        amount: "5000000",
      };

      (CategoryModel.findByName as jest.Mock).mockResolvedValue({
        id: "cat-2",
        name: "Salary",
        type: TransactionType.income,
        isActive: true,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await TransactionValidator.validateTransaction(
        dataWithoutDescription,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle amount validation errors gracefully", async () => {
      (currencyUtils.parseAmount as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid format");
      });

      const result = await TransactionValidator.validateTransaction({
        ...validTransactionData,
        amount: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (err) =>
            err.includes("Invalid format") || err.includes("Invalid amount"),
        ),
      ).toBe(true);
    });
  });

  describe("Integration with constants", () => {
    it("should use MIN_TRANSACTION_AMOUNT from constants", () => {
      const mockParsed = new Decimal(50000);
      (currencyUtils.parseAmount as jest.Mock).mockReturnValue(mockParsed);
      (currencyUtils.validateAmountRange as jest.Mock).mockReturnValue(true);

      TransactionValidator.validateAmount("50000");

      expect(currencyUtils.validateAmountRange).toHaveBeenCalledWith(
        expect.any(Decimal),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
