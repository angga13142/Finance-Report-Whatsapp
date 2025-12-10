import { TransactionType, Transaction, UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { TransactionModel } from "../../models/transaction";
import { TransactionValidator } from "./validator";
import { ApprovalService } from "./approval";
import { logger } from "../../lib/logger";
import { parseAmount } from "../../lib/currency";
import { formatCurrency } from "../../lib/currency";
import { formatDateWITA } from "../../lib/date";
import { AuditLogger } from "../audit/logger";

/**
 * Transaction processing service
 */
export class TransactionProcessor {
  /**
   * Process and create transaction
   */
  static async processTransaction(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: string | number;
    description?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      // Validate transaction data
      const validation = await TransactionValidator.validateTransaction(data);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(", "),
        };
      }

      // Parse amount
      const amount = parseAmount(String(data.amount));

      // Analyze transaction for suspicious patterns
      const approvalDecision = await ApprovalService.analyzeTransaction(
        data.userId,
        data.type,
        amount,
        data.category,
        data.description,
      );

      logger.info("Transaction approval decision", {
        userId: data.userId,
        status: approvalDecision.status,
        requiresManualApproval: approvalDecision.requiresManualApproval,
        confidenceScore: approvalDecision.confidenceScore,
      });

      // Create transaction with approval status
      const transaction = await TransactionModel.create({
        userId: data.userId,
        type: data.type,
        category: data.category,
        amount,
        description: data.description,
        approvalStatus: approvalDecision.status,
      });

      // Log audit
      await AuditLogger.logTransactionCreated(data.userId, transaction.id, {
        type: data.type,
        category: data.category,
        amount: transaction.amount.toNumber(),
        description: data.description,
      });

      logger.info("Transaction created successfully", {
        transactionId: transaction.id,
        userId: data.userId,
        type: data.type,
        amount: transaction.amount.toString(),
      });

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      logger.error("Error processing transaction", { error, data });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process transaction",
      };
    }
  }

  /**
   * Get transaction success message
   */
  static getSuccessMessage(transaction: {
    amount: string | number | Decimal;
    type: string;
    category: string;
    timestamp: Date | string;
  }): string {
    const amount = formatCurrency(transaction.amount);
    const timestamp =
      transaction.timestamp instanceof Date
        ? transaction.timestamp
        : new Date(transaction.timestamp);
    const date = formatDateWITA(timestamp);
    const typeLabel =
      transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

    return (
      `✅ Transaksi berhasil disimpan!\n\n` +
      `${typeLabel}: ${transaction.category}\n` +
      `Jumlah: ${amount}\n` +
      `Tanggal: ${date}\n` +
      `\nTerima kasih!`
    );
  }

  /**
   * Get daily total message
   */
  static async getDailyTotalMessage(userId: string): Promise<string> {
    try {
      const totals = await TransactionModel.getDailyTotals(userId);
      const income = formatCurrency(totals.income);
      const expense = formatCurrency(totals.expense);
      const net = formatCurrency(totals.net);

      return (
        `\n📊 Total Hari Ini:\n` +
        `💰 Pemasukan: ${income}\n` +
        `💸 Pengeluaran: ${expense}\n` +
        `💵 Net: ${net}\n` +
        `📝 Jumlah Transaksi: ${totals.count}`
      );
    } catch (error) {
      logger.error("Error getting daily totals", { error, userId });
      return "";
    }
  }

  /**
   * Delete transaction (soft delete with Boss/Dev permission)
   */
  static async deleteTransaction(
    transactionId: string,
    userId: string,
    userRole: UserRole,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Only Boss and Dev can delete transactions
      if (userRole !== "boss" && userRole !== "dev") {
        return {
          success: false,
          error: "Hanya Boss dan Dev yang dapat menghapus transaksi",
        };
      }

      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        return { success: false, error: "Transaksi tidak ditemukan" };
      }

      // Check if already deleted
      if (transaction.description?.startsWith("[DELETED")) {
        return { success: false, error: "Transaksi sudah dihapus" };
      }

      // Soft delete
      await TransactionModel.softDelete(transactionId, userId, reason);

      // Log audit trail
      await AuditLogger.log(
        "transaction_deleted",
        {
          transactionId,
          originalAmount: transaction.amount.toString(),
          category: transaction.category,
          type: transaction.type,
          deletedBy: userId,
          reason: reason || "No reason provided",
        },
        userId,
        transactionId,
        "Transaction",
      );

      logger.info("Transaction deleted", {
        transactionId,
        userId,
        userRole,
      });

      return { success: true };
    } catch (error) {
      logger.error("Error deleting transaction", { error, transactionId });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menghapus transaksi",
      };
    }
  }
}

export default TransactionProcessor;
