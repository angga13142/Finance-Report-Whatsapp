import { Transaction, UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../../lib/logger";
import { TransactionModel } from "../../models/transaction";
import { parseAmount } from "../../lib/currency";
import { AuditLogger } from "../audit/logger";

/**
 * Transaction editing rules and permissions
 */
export class TransactionEditor {
  /**
   * Check if user can edit transaction
   */
  static canEdit(
    transaction: Transaction,
    userId: string,
    userRole: UserRole,
  ): {
    allowed: boolean;
    reason?: string;
  } {
    // Check if transaction belongs to user
    const isOwner = transaction.userId === userId;

    // Check transaction age
    const now = new Date();
    const txDate = new Date(transaction.timestamp);
    const daysDiff = Math.floor(
      (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Same-day edits allowed for owner
    if (isOwner && daysDiff === 0) {
      return { allowed: true };
    }

    // Previous day edits only for Boss/Dev
    if (daysDiff === 1 && (userRole === "boss" || userRole === "dev")) {
      return { allowed: true };
    }

    // Older edits only for Dev
    if (daysDiff > 1 && userRole === "dev") {
      return { allowed: true };
    }

    // Boss can edit any transaction from last 7 days
    if (daysDiff <= 7 && userRole === "boss") {
      return { allowed: true };
    }

    // Denied
    if (!isOwner) {
      return {
        allowed: false,
        reason: "Anda hanya bisa mengedit transaksi pribadi",
      };
    }

    if (daysDiff > 0) {
      return {
        allowed: false,
        reason: `Transaksi sudah ${daysDiff} hari. Hanya Boss/Dev yang bisa mengedit transaksi lama`,
      };
    }

    return {
      allowed: false,
      reason: "Tidak dapat mengedit transaksi ini",
    };
  }

  /**
   * Edit transaction amount
   */
  static async editAmount(
    transactionId: string,
    newAmount: string | number | Decimal,
    userId: string,
    userRole: UserRole,
  ): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    try {
      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        return { success: false, error: "Transaksi tidak ditemukan" };
      }

      // Check permission
      const permission = this.canEdit(transaction, userId, userRole);
      if (!permission.allowed) {
        return { success: false, error: permission.reason };
      }

      // Parse and validate amount
      const amount = parseAmount(String(newAmount));

      // Update transaction
      const oldAmount = transaction.amount;
      const updated = await TransactionModel.update(transactionId, { amount });

      // Log audit trail
      await AuditLogger.log(
        "transaction_edited",
        {
          transactionId,
          field: "amount",
          oldValue: oldAmount.toString(),
          newValue: amount.toString(),
          editedBy: userId,
        },
        userId,
        transactionId,
        "Transaction",
      );

      logger.info("Transaction amount edited", {
        transactionId,
        userId,
        oldAmount: oldAmount.toString(),
        newAmount: amount.toString(),
      });

      return { success: true, transaction: updated };
    } catch (error) {
      logger.error("Error editing transaction amount", {
        error,
        transactionId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengedit jumlah",
      };
    }
  }

  /**
   * Edit transaction category
   */
  static async editCategory(
    transactionId: string,
    newCategory: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    try {
      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        return { success: false, error: "Transaksi tidak ditemukan" };
      }

      // Check permission
      const permission = this.canEdit(transaction, userId, userRole);
      if (!permission.allowed) {
        return { success: false, error: permission.reason };
      }

      // Update transaction
      const oldCategory = transaction.category;
      const updated = await TransactionModel.update(transactionId, {
        category: newCategory,
      });

      // Log audit trail
      await AuditLogger.log(
        "transaction_edited",
        {
          transactionId,
          field: "category",
          oldValue: oldCategory,
          newValue: newCategory,
          editedBy: userId,
        },
        userId,
        transactionId,
        "Transaction",
      );

      logger.info("Transaction category edited", {
        transactionId,
        userId,
        oldCategory,
        newCategory,
      });

      return { success: true, transaction: updated };
    } catch (error) {
      logger.error("Error editing transaction category", {
        error,
        transactionId,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengedit kategori",
      };
    }
  }

  /**
   * Edit transaction description
   */
  static async editDescription(
    transactionId: string,
    newDescription: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    try {
      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        return { success: false, error: "Transaksi tidak ditemukan" };
      }

      // Check permission
      const permission = this.canEdit(transaction, userId, userRole);
      if (!permission.allowed) {
        return { success: false, error: permission.reason };
      }

      // Update transaction
      const oldDescription = transaction.description || "";
      const updated = await TransactionModel.update(transactionId, {
        description: newDescription,
      });

      // Log audit trail
      await AuditLogger.log(
        "transaction_edited",
        {
          transactionId,
          field: "description",
          oldValue: oldDescription,
          newValue: newDescription,
          editedBy: userId,
        },
        userId,
        transactionId,
        "Transaction",
      );

      logger.info("Transaction description edited", {
        transactionId,
        userId,
      });

      return { success: true, transaction: updated };
    } catch (error) {
      logger.error("Error editing transaction description", {
        error,
        transactionId,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengedit catatan",
      };
    }
  }
}

export default TransactionEditor;
