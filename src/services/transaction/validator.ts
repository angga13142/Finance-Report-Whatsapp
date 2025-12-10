import { TransactionType, Transaction } from "@prisma/client";
import { parseAmount, validateAmountRange } from "../../lib/currency";
import { validateStringLength } from "../../lib/validation";
import { CategoryModel } from "../../models/category";
import { TransactionModel } from "../../models/transaction";
import { logger } from "../../lib/logger";
import {
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "../../config/constants";

/**
 * Transaction validation service
 */
export class TransactionValidator {
  /**
   * Validate transaction amount
   */
  static validateAmount(amount: string | number): {
    valid: boolean;
    error?: string;
    parsed?: number;
  } {
    try {
      const parsed = parseAmount(String(amount));
      validateAmountRange(
        parsed,
        MIN_TRANSACTION_AMOUNT,
        MAX_TRANSACTION_AMOUNT,
      );
      return { valid: true, parsed: parsed.toNumber() };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid amount format",
      };
    }
  }

  /**
   * Validate category exists and matches transaction type
   */
  static async validateCategory(
    categoryName: string,
    transactionType: TransactionType,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const category = await CategoryModel.findByName(categoryName);

      if (!category) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak ditemukan`,
        };
      }

      if (!category.isActive) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak aktif`,
        };
      }

      if (category.type !== transactionType) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak cocok dengan tipe transaksi ${transactionType}`,
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error("Error validating category", {
        error,
        categoryName,
        transactionType,
      });
      return {
        valid: false,
        error: "Error memvalidasi category",
      };
    }
  }

  /**
   * Check for duplicate transaction
   */
  static async checkDuplicate(
    userId: string,
    category: string,
    amount: string | number,
    timeWindowMinutes: number = 1,
  ): Promise<{ isDuplicate: boolean; existingTransaction?: Transaction }> {
    try {
      const parsedAmount = parseAmount(String(amount));
      const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      // Check for similar transaction within time window
      const transactions = await TransactionModel.findByUserId(userId, {
        startDate: timeWindow,
        limit: 10,
      });

      const duplicate = transactions.find(
        (txn) => txn.category === category && txn.amount.equals(parsedAmount),
      );

      return {
        isDuplicate: !!duplicate,
        existingTransaction: duplicate || undefined,
      };
    } catch (error) {
      logger.error("Error checking duplicate", {
        error,
        userId,
        category,
        amount,
      });
      // Don't fail on duplicate check error, just log it
      return { isDuplicate: false };
    }
  }

  /**
   * Validate transaction description
   */
  static validateDescription(description?: string): {
    valid: boolean;
    error?: string;
  } {
    if (!description) {
      return { valid: true }; // Description is optional
    }

    try {
      validateStringLength(description, 1, 100, "Transaction description");
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Invalid description format",
      };
    }
  }

  /**
   * Validate complete transaction data
   */
  static async validateTransaction(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: string | number;
    description?: string;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate amount
    const amountValidation = this.validateAmount(data.amount);
    if (!amountValidation.valid) {
      errors.push(amountValidation.error || "Invalid amount");
    }

    // Validate category
    const categoryValidation = await this.validateCategory(
      data.category,
      data.type,
    );
    if (!categoryValidation.valid) {
      errors.push(categoryValidation.error || "Invalid category");
    }

    // Validate description
    const descriptionValidation = this.validateDescription(data.description);
    if (!descriptionValidation.valid) {
      errors.push(descriptionValidation.error || "Invalid description");
    }

    // Check for duplicates
    if (amountValidation.valid) {
      const duplicateCheck = await this.checkDuplicate(
        data.userId,
        data.category,
        data.amount,
      );
      if (duplicateCheck.isDuplicate) {
        errors.push("Transaksi serupa sudah ada dalam 1 menit terakhir");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default TransactionValidator;
