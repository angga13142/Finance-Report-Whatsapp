import { Message } from "whatsapp-web.js";
import { User, PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { ApprovalService } from "../../services/transaction/approval";
import { getWhatsAppClient } from "../client/client";
import { ButtonMenu } from "../ui/buttons";
import { MessageFormatter } from "../ui/messages";
import { formatCurrency } from "../../lib/currency";
import { AuditLogger } from "../../services/audit/logger";

const prisma = new PrismaClient();

/**
 * Transaction approval handler for Boss role
 */
export class ApprovalHandler {
  /**
   * Handle pending approvals list request
   */
  static async handlePendingApprovals(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify Boss role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss requesting pending approvals", { userId: user.id });

    try {
      // Get pending transactions
      const pending = await ApprovalService.getPendingTransactions(10);

      if (pending.length === 0) {
        await client.sendMessage(
          message.from,
          "✅ *Tidak Ada Transaksi Pending*\n\n" +
            "Semua transaksi sudah disetujui atau tidak ada transaksi yang memerlukan approval.",
        );
        return;
      }

      // Format pending transactions list
      let msg = `⏳ *Transaksi Pending Approval*\n\n`;
      msg += `Total: ${pending.length} transaksi\n\n`;

      for (let i = 0; i < pending.length; i++) {
        const tx = pending[i];
        const icon = tx.type === "income" ? "💰" : "💸";
        msg += `${i + 1}. ${icon} *${formatCurrency(tx.amount)}*\n`;
        msg += `   Kategori: ${tx.category}\n`;
        msg += `   Oleh: ${tx.userName}\n`;
        if (tx.description) {
          msg += `   Keterangan: ${tx.description}\n`;
        }
        msg += `   Waktu: ${tx.timestamp.toLocaleString("id-ID")}\n`;
        msg += `   ID: \`${tx.id.substring(0, 8)}\`\n\n`;
      }

      msg += `_Gunakan /approve <id> atau /reject <id> untuk memproses_\n`;
      msg += `_Atau klik button di bawah untuk melihat detail_`;

      await client.sendMessage(message.from, msg);

      // Send action buttons for first transaction
      if (pending.length > 0) {
        const firstTx = pending[0];
        const buttons = ButtonMenu.generateApprovalButtons(firstTx.id);
        await message.reply(buttons);
      }
    } catch (error) {
      logger.error("Error handling pending approvals", {
        error,
        userId: user.id,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle transaction approval
   */
  static async handleApprove(
    user: User,
    transactionId: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify Boss role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss approving transaction", {
      userId: user.id,
      transactionId,
    });

    try {
      // Get transaction details with relations
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          approver: true,
        },
      });

      if (!transaction) {
        await client.sendMessage(
          message.from,
          MessageFormatter.getErrorMessage("transaction_not_found"),
        );
        return;
      }

      // Check if already processed
      if (transaction.approvalStatus !== "pending") {
        await client.sendMessage(
          message.from,
          `ℹ️ *Transaksi Sudah Diproses*\n\n` +
            `Status saat ini: ${transaction.approvalStatus}\n` +
            `Tidak dapat diubah lagi.`,
        );
        return;
      }

      // Approve transaction
      const success = await ApprovalService.approveTransaction(
        transactionId,
        user.id,
      );

      if (success) {
        // Log audit trail
        await AuditLogger.log(
          "transaction_approved",
          {
            transactionId,
            amount: transaction.amount.toString(),
            type: transaction.type,
            category: transaction.category,
          },
          user.id,
          transactionId,
          "Transaction",
        );

        // Send success message
        const icon = transaction.type === "income" ? "💰" : "💸";
        await client.sendMessage(
          message.from,
          `✅ *Transaksi Disetujui*\n\n` +
            `${icon} ${formatCurrency(transaction.amount)}\n` +
            `Kategori: ${transaction.category}\n` +
            `${transaction.description ? `Keterangan: ${transaction.description}\n` : ""}` +
            `\nTransaksi telah disetujui dan akan masuk dalam laporan.`,
        );

        // Notify the employee who created the transaction
        if (transaction.user.phoneNumber) {
          const employeePhone = `${transaction.user.phoneNumber}@c.us`;
          await client.sendMessage(
            employeePhone,
            `✅ *Transaksi Anda Disetujui*\n\n` +
              `${icon} ${formatCurrency(transaction.amount)}\n` +
              `Kategori: ${transaction.category}\n` +
              `${transaction.description ? `Keterangan: ${transaction.description}\n` : ""}` +
              `\nDisetujui oleh: ${user.name || "Boss"}\n` +
              `Waktu: ${new Date().toLocaleString("id-ID")}`,
          );
        }

        // Check if more pending transactions
        const stats = await ApprovalService.getApprovalStats();
        if (stats.pendingCount > 0) {
          await client.sendMessage(
            message.from,
            `ℹ️ Masih ada ${stats.pendingCount} transaksi pending lainnya.\n` +
              `Ketik /pending untuk melihat daftar.`,
          );
        }
      } else {
        await client.sendMessage(
          message.from,
          MessageFormatter.getErrorMessage("approval_failed"),
        );
      }
    } catch (error) {
      logger.error("Error approving transaction", {
        error,
        userId: user.id,
        transactionId,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle transaction rejection
   */
  static async handleReject(
    user: User,
    transactionId: string,
    reason: string | undefined,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify Boss role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss rejecting transaction", {
      userId: user.id,
      transactionId,
      reason,
    });

    try {
      // Get transaction details with relations
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          approver: true,
        },
      });

      if (!transaction) {
        await client.sendMessage(
          message.from,
          MessageFormatter.getErrorMessage("transaction_not_found"),
        );
        return;
      }

      // Check if already processed
      if (transaction.approvalStatus !== "pending") {
        await client.sendMessage(
          message.from,
          `ℹ️ *Transaksi Sudah Diproses*\n\n` +
            `Status saat ini: ${transaction.approvalStatus}\n` +
            `Tidak dapat diubah lagi.`,
        );
        return;
      }

      // Reject transaction
      const success = await ApprovalService.rejectTransaction(
        transactionId,
        user.id,
        reason,
      );

      if (success) {
        // Log audit trail
        await AuditLogger.log(
          "transaction_rejected",
          {
            transactionId,
            amount: transaction.amount.toString(),
            type: transaction.type,
            category: transaction.category,
            reason: reason || "No reason provided",
          },
          user.id,
          transactionId,
          "Transaction",
        );

        // Send success message
        const icon = transaction.type === "income" ? "💰" : "💸";
        await client.sendMessage(
          message.from,
          `❌ *Transaksi Ditolak*\n\n` +
            `${icon} ${formatCurrency(transaction.amount)}\n` +
            `Kategori: ${transaction.category}\n` +
            `${transaction.description ? `Keterangan: ${transaction.description}\n` : ""}` +
            `${reason ? `\nAlasan: ${reason}\n` : ""}` +
            `\nTransaksi telah ditolak dan tidak akan masuk laporan.`,
        );

        // Notify the employee who created the transaction
        if (transaction.user.phoneNumber) {
          const employeePhone = `${transaction.user.phoneNumber}@c.us`;
          await client.sendMessage(
            employeePhone,
            `❌ *Transaksi Anda Ditolak*\n\n` +
              `${icon} ${formatCurrency(transaction.amount)}\n` +
              `Kategori: ${transaction.category}\n` +
              `${transaction.description ? `Keterangan: ${transaction.description}\n` : ""}` +
              `${reason ? `\nAlasan: ${reason}\n` : ""}` +
              `\nDitolak oleh: ${user.name || "Boss"}\n` +
              `Waktu: ${new Date().toLocaleString("id-ID")}\n\n` +
              `_Silakan perbaiki dan input ulang jika diperlukan_`,
          );
        }

        // Check if more pending transactions
        const stats = await ApprovalService.getApprovalStats();
        if (stats.pendingCount > 0) {
          await client.sendMessage(
            message.from,
            `ℹ️ Masih ada ${stats.pendingCount} transaksi pending lainnya.\n` +
              `Ketik /pending untuk melihat daftar.`,
          );
        }
      } else {
        await client.sendMessage(
          message.from,
          MessageFormatter.getErrorMessage("approval_failed"),
        );
      }
    } catch (error) {
      logger.error("Error rejecting transaction", {
        error,
        userId: user.id,
        transactionId,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle transaction detail view for approval
   */
  static async handleApprovalDetail(
    user: User,
    transactionId: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify Boss role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss viewing transaction detail for approval", {
      userId: user.id,
      transactionId,
    });

    try {
      // Get transaction details with relations
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          approver: true,
        },
      });

      if (!transaction) {
        await client.sendMessage(
          message.from,
          MessageFormatter.getErrorMessage("transaction_not_found"),
        );
        return;
      }

      // Format detail message
      const icon = transaction.type === "income" ? "💰" : "💸";
      const statusIcon =
        transaction.approvalStatus === "approved"
          ? "✅"
          : transaction.approvalStatus === "rejected"
            ? "❌"
            : "⏳";

      let msg = `${icon} *Detail Transaksi*\n\n`;
      msg += `ID: \`${transaction.id}\`\n`;
      msg += `Status: ${statusIcon} ${transaction.approvalStatus}\n\n`;
      msg += `*Informasi Transaksi:*\n`;
      msg += `Tipe: ${transaction.type === "income" ? "Penjualan" : "Pengeluaran"}\n`;
      msg += `Jumlah: ${formatCurrency(transaction.amount)}\n`;
      msg += `Kategori: ${transaction.category}\n`;
      if (transaction.description) {
        msg += `Keterangan: ${transaction.description}\n`;
      }
      msg += `\n*Informasi User:*\n`;
      msg += `Nama: ${transaction.user.name || "-"}\n`;
      msg += `Phone: ${transaction.user.phoneNumber}\n`;
      msg += `Role: ${transaction.user.role}\n`;
      msg += `\n*Waktu:*\n`;
      msg += `Dibuat: ${transaction.timestamp.toLocaleString("id-ID")}\n`;

      if (transaction.approver) {
        msg += `\n*Approval Info:*\n`;
        msg += `Diproses oleh: ${transaction.approver.name || transaction.approver.phoneNumber}\n`;
        if (transaction.approvedAt) {
          msg += `Waktu: ${transaction.approvedAt.toLocaleString("id-ID")}\n`;
        }
      }

      await client.sendMessage(message.from, msg);

      // Send approval buttons if still pending
      if (transaction.approvalStatus === "pending") {
        const buttons = ButtonMenu.generateApprovalButtons(transaction.id);
        await message.reply(buttons);
      }
    } catch (error) {
      logger.error("Error viewing approval detail", {
        error,
        userId: user.id,
        transactionId,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle approval statistics
   */
  static async handleApprovalStats(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify Boss role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss requesting approval stats", { userId: user.id });

    try {
      const stats = await ApprovalService.getApprovalStats();

      let msg = `📊 *Statistik Approval Transaksi*\n\n`;
      msg += `*Hari Ini:*\n`;
      msg += `✅ Disetujui Manual: ${stats.approvedToday}\n`;
      msg += `🤖 Auto-approved: ${stats.autoApprovedToday}\n`;
      msg += `❌ Ditolak: ${stats.rejectedToday}\n`;
      msg += `⏳ Pending: ${stats.pendingCount}\n\n`;

      if (stats.pendingCount > 0) {
        msg += `_Ketik /pending untuk melihat daftar transaksi pending_`;
      } else {
        msg += `_Semua transaksi sudah diproses ✅_`;
      }

      await client.sendMessage(message.from, msg);
    } catch (error) {
      logger.error("Error getting approval stats", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }
}

export default ApprovalHandler;
