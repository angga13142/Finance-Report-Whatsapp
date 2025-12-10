import { TransactionType, ApprovalStatus, Transaction } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { TransactionModel } from "../../models/transaction";
import { TransactionValidator } from "./validator";
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

      // Determine approval status (Employee transactions auto-approve)
      // Suspicious transactions will be flagged in approval service (Phase 4)
      const approvalStatus: ApprovalStatus = "approved";

      // Create transaction
      const transaction = await TransactionModel.create({
        userId: data.userId,
        type: data.type,
        category: data.category,
        amount,
        description: data.description,
        approvalStatus,
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
}

export default TransactionProcessor;
