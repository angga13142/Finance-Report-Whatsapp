import { Message } from "whatsapp-web.js";
import { User } from "@prisma/client";
import { logger } from "../../lib/logger";
import { SessionManager } from "../middleware/session";
import { ButtonMenu } from "../ui/buttons";
import { ListMenu } from "../ui/lists";
import { MessageFormatter } from "../ui/messages";
import { TransactionProcessor } from "../../services/transaction/processor";
import { TransactionValidator } from "../../services/transaction/validator";
import { getWhatsAppClient } from "../client/client";
import { MENU_STATES } from "../../config/constants";

/**
 * Transaction input workflow handler
 */
export class TransactionHandler {
  /**
   * Handle transaction start (from button or command)
   */
  static async handleTransactionStart(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const menu = ButtonMenu.generateTransactionTypeMenu();
    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.TRANSACTION,
    });

    try {
      await client.sendMessage(message.from, menu);
    } catch (error) {
      logger.error("Error sending transaction type menu", { error });
      await client.sendMessage(
        message.from,
        "Pilih jenis transaksi:\n1. 💰 Penjualan\n2. 💸 Pengeluaran\n3. 🔙 Kembali",
      );
    }
  }

  /**
   * Handle amount input
   */
  static async handleAmountInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    // Check for cancel
    if (input === "batal" || input === "cancel") {
      await SessionManager.clearSession(user.id);
      await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
      return;
    }

    // Validate amount
    const validation = TransactionValidator.validateAmount(input);
    if (!validation.valid) {
      await client.sendMessage(
        message.from,
        MessageFormatter.formatInvalidInputMessage("Jumlah", [
          "500000",
          "500.000",
          "500,000",
        ]),
      );
      return;
    }

    // Store amount in session
    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.CONFIRM,
      amount: input,
    });

    // Show confirmation
    if (!validation.parsed) {
      throw new Error("Invalid amount");
    }
    const confirmMsg = MessageFormatter.formatConfirmationMessage({
      type: session.transactionType ?? "expense",
      category: session.category ?? "",
      amount: validation.parsed,
      description: session.description ?? undefined,
      userName: user.name ?? undefined,
    });

    const confirmButtons = ButtonMenu.generateConfirmationButtons();

    try {
      await client.sendMessage(message.from, confirmMsg);
      await client.sendMessage(message.from, confirmButtons);
    } catch (error) {
      logger.error("Error sending confirmation", { error });
      await client.sendMessage(
        message.from,
        confirmMsg +
          '\n\nKetik "ya" untuk simpan atau "batal" untuk membatalkan.',
      );
    }
  }

  /**
   * Handle category input (text fallback)
   */
  static async handleCategoryInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    // Check for cancel
    if (input === "batal" || input === "cancel") {
      await SessionManager.clearSession(user.id);
      await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
      return;
    }

    // Find category
    const category = await ListMenu.findCategoryBySelection(
      input,
      session.transactionType,
    );

    if (!category) {
      await client.sendMessage(
        message.from,
        "❌ Kategori tidak ditemukan. Silakan pilih lagi.",
      );
      // Show category list again
      const textList = await ListMenu.generateCategoryTextList(
        session.transactionType,
      );
      await client.sendMessage(message.from, textList);
      return;
    }

    // Store category and move to amount input
    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.AMOUNT,
      category: category.name,
    });

    const prompt = MessageFormatter.formatAmountInputPrompt(category.name);
    await client.sendMessage(message.from, prompt);
  }

  /**
   * Handle transaction confirmation (from text input "ya" or button)
   */
  static async handleConfirm(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category || !session?.amount) {
      await client.sendMessage(
        message.from,
        "❌ Data transaksi tidak lengkap. Silakan mulai lagi.",
      );
      return;
    }

    try {
      // Save partial data before processing (for network recovery)
      await SessionManager.savePartialData(user.id, {
        transactionType: session.transactionType,
        category: session.category,
        amount: session.amount,
        description: session.description,
      });

      // Process transaction
      const result = await TransactionProcessor.processTransaction({
        userId: user.id,
        type: session.transactionType,
        category: session.category,
        amount: session.amount,
        description: session.description,
      });

      if (!result.success) {
        await client.sendMessage(
          message.from,
          MessageFormatter.formatErrorMessage(
            result.error || "Gagal menyimpan transaksi",
          ),
        );
        return;
      }

      // Get daily totals
      const dailyTotal = await TransactionProcessor.getDailyTotalMessage(
        user.id,
      );

      // Send success message
      const successMsg = result.transaction
        ? TransactionProcessor.getSuccessMessage({
            amount: result.transaction.amount,
            type: result.transaction.type,
            category: result.transaction.category,
            timestamp: result.transaction.timestamp,
          }) + dailyTotal
        : "Transaksi berhasil disimpan!" + dailyTotal;
      await client.sendMessage(message.from, successMsg);

      // Clear session and partial data after success
      await SessionManager.clearSession(user.id);
      await SessionManager.clearPartialData(user.id);
    } catch (error) {
      logger.error("Error confirming transaction", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        "❌ Terjadi kesalahan jaringan. Data Anda telah disimpan dan akan dicoba lagi.\n\nKetik 'coba lagi' untuk melanjutkan.",
      );
    }
  }

  /**
   * Handle edit amount button click
   */
  static async handleEditAmount(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak ditemukan. Silakan mulai lagi.",
      );
      return;
    }

    // Start editing mode
    await SessionManager.startEditing(user.id, "amount");

    const currentAmount = session.amount || "tidak ada";
    await client.sendMessage(
      message.from,
      `✏️ *Edit Jumlah*\n\nJumlah saat ini: Rp ${currentAmount}\n\nMasukkan jumlah baru atau ketik 'batal' untuk kembali:`,
    );
  }

  /**
   * Handle edit category button click
   */
  static async handleEditCategory(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak ditemukan. Silakan mulai lagi.",
      );
      return;
    }

    // Start editing mode
    await SessionManager.startEditing(user.id, "category");

    const currentCategory = session.category || "tidak ada";
    const transactionType = session.transactionType || "expense";

    await client.sendMessage(
      message.from,
      `✏️ *Edit Kategori*\n\nKategori saat ini: ${currentCategory}`,
    );

    // Show category list
    const categoryList =
      await ListMenu.generateCategoryTextList(transactionType);
    await client.sendMessage(message.from, categoryList);
  }

  /**
   * Handle edit description button click
   */
  static async handleEditDescription(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak ditemukan. Silakan mulai lagi.",
      );
      return;
    }

    // Start editing mode
    await SessionManager.startEditing(user.id, "description");

    const currentDesc = session.description || "tidak ada";
    await client.sendMessage(
      message.from,
      `✏️ *Edit Catatan*\n\nCatatan saat ini: ${currentDesc}\n\nMasukkan catatan baru, ketik 'hapus' untuk menghapus, atau 'batal' untuk kembali:`,
    );
  }

  /**
   * Handle input during editing mode
   */
  static async handleEditInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.isEditing || !session.editingField) {
      return;
    }

    // Check for cancel
    if (input.toLowerCase() === "batal" || input.toLowerCase() === "cancel") {
      await SessionManager.cancelEditing(user.id);
      await this.showConfirmation(user, message);
      return;
    }

    const field = session.editingField;

    // Handle different field types
    switch (field) {
      case "amount": {
        const validation = TransactionValidator.validateAmount(input);
        if (!validation.valid) {
          await client.sendMessage(
            message.from,
            MessageFormatter.formatInvalidInputMessage("Jumlah", [
              "500000",
              "500.000",
              "500,000",
            ]),
          );
          return;
        }

        await SessionManager.updateSession(user.id, { amount: input });
        await SessionManager.finishEditing(user.id);
        await client.sendMessage(message.from, "✅ Jumlah berhasil diubah!");
        break;
      }

      case "category": {
        const category = await ListMenu.findCategoryBySelection(
          input,
          session.transactionType || "expense",
        );

        if (!category) {
          await client.sendMessage(
            message.from,
            "❌ Kategori tidak ditemukan. Silakan pilih lagi.",
          );
          return;
        }

        await SessionManager.updateSession(user.id, {
          category: category.name,
        });
        await SessionManager.finishEditing(user.id);
        await client.sendMessage(message.from, "✅ Kategori berhasil diubah!");
        break;
      }

      case "description": {
        if (input.toLowerCase() === "hapus") {
          await SessionManager.updateSession(user.id, {
            description: undefined,
          });
          await SessionManager.finishEditing(user.id);
          await client.sendMessage(
            message.from,
            "✅ Catatan berhasil dihapus!",
          );
        } else {
          await SessionManager.updateSession(user.id, { description: input });
          await SessionManager.finishEditing(user.id);
          await client.sendMessage(message.from, "✅ Catatan berhasil diubah!");
        }
        break;
      }

      default:
        await client.sendMessage(
          message.from,
          "❌ Field tidak dikenali. Silakan coba lagi.",
        );
        return;
    }

    // Show updated confirmation
    await this.showConfirmation(user, message);
  }

  /**
   * Show confirmation screen with current data
   */
  static async showConfirmation(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category || !session?.amount) {
      await client.sendMessage(
        message.from,
        "❌ Data transaksi tidak lengkap.",
      );
      return;
    }

    const validation = TransactionValidator.validateAmount(session.amount);
    if (!validation.valid || !validation.parsed) {
      await client.sendMessage(message.from, "❌ Jumlah tidak valid.");
      return;
    }

    const confirmMsg = MessageFormatter.formatConfirmationMessage({
      type: session.transactionType,
      category: session.category,
      amount: validation.parsed,
      description: session.description ?? undefined,
      userName: user.name ?? undefined,
    });

    const confirmButtons = ButtonMenu.generateConfirmationButtons();

    try {
      await client.sendMessage(message.from, confirmMsg);
      await client.sendMessage(message.from, confirmButtons);
    } catch (error) {
      logger.error("Error sending confirmation", { error });
      await client.sendMessage(
        message.from,
        confirmMsg +
          '\n\nKetik "ya" untuk simpan atau "batal" untuk membatalkan.',
      );
    }
  }

  /**
   * Handle workflow cancellation
   */
  static async handleCancel(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (session?.isEditing) {
      // Cancel editing - restore snapshot
      await SessionManager.cancelEditing(user.id);
      await client.sendMessage(
        message.from,
        "❌ Edit dibatalkan. Kembali ke data sebelumnya.",
      );
      await this.showConfirmation(user, message);
    } else {
      // Cancel entire workflow
      await SessionManager.clearSession(user.id);
      await SessionManager.clearPartialData(user.id);
      await client.sendMessage(
        message.from,
        "❌ Transaksi dibatalkan. Semua data dihapus.",
      );
    }
  }

  /**
   * Handle retry from partial data (network recovery)
   */
  static async handleRetry(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    try {
      // Check if there's recoverable data
      const hasRecoverable = await SessionManager.hasRecoverableContext(
        user.id,
      );
      if (!hasRecoverable) {
        await client.sendMessage(
          message.from,
          "❌ Tidak ada data untuk dicoba lagi. Silakan mulai transaksi baru.",
        );
        return;
      }

      // Restore session from partial data
      const session = await SessionManager.restoreFromPartialData(user.id);

      // Increment retry count
      const retryCount = await SessionManager.incrementRetryCount(user.id);

      if (retryCount > 3) {
        await client.sendMessage(
          message.from,
          "❌ Terlalu banyak percobaan. Silakan mulai transaksi baru.\n\nData yang tersimpan:\n" +
            `• Jenis: ${session.transactionType === "income" ? "Penjualan" : "Pengeluaran"}\n` +
            `• Kategori: ${session.category || "-"}\n` +
            `• Jumlah: ${session.amount || "-"}\n` +
            `• Catatan: ${session.description || "-"}`,
        );
        await SessionManager.clearPartialData(user.id);
        return;
      }

      // Show recovered data with pre-filled information
      await client.sendMessage(
        message.from,
        `🔄 *Data Dipulihkan* (Percobaan ${retryCount}/3)\n\n` +
          `Jenis: ${session.transactionType === "income" ? "Penjualan" : "Pengeluaran"}\n` +
          `Kategori: ${session.category || "-"}\n` +
          `Jumlah: ${session.amount || "-"}\n` +
          `Catatan: ${session.description || "-"}\n\n` +
          "Melanjutkan ke konfirmasi...",
      );

      // Show confirmation with recovered data
      await SessionManager.updateSession(user.id, {
        menu: MENU_STATES.CONFIRM,
      });
      await this.showConfirmation(user, message);
    } catch (error) {
      logger.error("Error handling retry", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        "❌ Gagal memulihkan data. Silakan mulai transaksi baru.",
      );
    }
  }

  /**
   * Check and offer recovery on user reconnection
   */
  static async checkAndOfferRecovery(
    user: User,
    message: Message,
  ): Promise<boolean> {
    const client = getWhatsAppClient();
    if (!client) {
      return false;
    }

    const hasRecoverable = await SessionManager.hasRecoverableContext(user.id);
    if (!hasRecoverable) {
      return false;
    }

    const partialData = await SessionManager.getPartialData(user.id);
    if (!partialData) {
      return false;
    }

    // Show recovery prompt
    await client.sendMessage(
      message.from,
      `🔄 *Data Transaksi Ditemukan*\n\n` +
        `Anda memiliki transaksi yang belum selesai:\n` +
        `• Jenis: ${partialData.transactionType === "income" ? "Penjualan" : "Pengeluaran"}\n` +
        `• Kategori: ${partialData.category || "-"}\n` +
        `• Jumlah: ${partialData.amount || "-"}\n\n` +
        `Ketik 'lanjut' untuk melanjutkan atau 'hapus' untuk menghapus data.`,
    );

    return true;
  }

  /**
   * Handle recovery decision
   */
  static async handleRecoveryDecision(
    user: User,
    input: string,
    message: Message,
  ): Promise<boolean> {
    const client = getWhatsAppClient();
    if (!client) {
      return false;
    }

    if (
      input.toLowerCase() === "lanjut" ||
      input.toLowerCase() === "continue"
    ) {
      await this.handleRetry(user, message);
      return true;
    } else if (
      input.toLowerCase() === "hapus" ||
      input.toLowerCase() === "delete"
    ) {
      await SessionManager.clearPartialData(user.id);
      await client.sendMessage(
        message.from,
        "✅ Data dihapus. Anda dapat memulai transaksi baru.",
      );
      return true;
    }

    return false;
  }

  /**
   * Handle bulk transaction entry (Dev/Boss only)
   * Format: CSV or line-by-line format
   * Example:
   *   income,Penjualan A,500000,Catatan A
   *   expense,Operasional,250000,Catatan B
   */
  static async handleBulkEntry(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Only Dev and Boss can use bulk entry
    if (user.role !== "dev" && user.role !== "boss") {
      await client.sendMessage(
        message.from,
        "❌ Fitur ini hanya tersedia untuk Dev dan Boss.",
      );
      return;
    }

    try {
      // Parse bulk transaction format
      const lines = input
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        await client.sendMessage(
          message.from,
          "❌ Format tidak valid. Gunakan format:\n\n" +
            "Contoh:\n" +
            "income,Penjualan A,500000,Catatan A\n" +
            "expense,Operasional,250000,Catatan B",
        );
        return;
      }

      const results: Array<{
        line: number;
        success: boolean;
        message: string;
      }> = [];

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];
        const parts = line.split(",").map((p) => p.trim());

        if (parts.length < 3) {
          results.push({
            line: lineNum,
            success: false,
            message: "Format tidak lengkap (minimal: type,category,amount)",
          });
          continue;
        }

        const [type, category, amountStr, description] = parts;

        // Validate transaction type
        if (type !== "income" && type !== "expense") {
          results.push({
            line: lineNum,
            success: false,
            message: `Jenis tidak valid: ${type} (harus income atau expense)`,
          });
          continue;
        }

        // Validate amount
        const validation = TransactionValidator.validateAmount(amountStr);
        if (!validation.valid || !validation.parsed) {
          results.push({
            line: lineNum,
            success: false,
            message: `Jumlah tidak valid: ${amountStr}`,
          });
          continue;
        }

        // Create transaction
        try {
          await TransactionProcessor.processTransaction({
            userId: user.id,
            type,
            category,
            amount: validation.parsed,
            description: description || undefined,
          });

          results.push({
            line: lineNum,
            success: true,
            message: `${type === "income" ? "Penjualan" : "Pengeluaran"} ${category}: Rp ${validation.parsed.toLocaleString("id-ID")}`,
          });
        } catch (error) {
          results.push({
            line: lineNum,
            success: false,
            message: `Gagal menyimpan: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // Send summary
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      let summaryMsg = `📊 *Bulk Entry Summary*\n\n`;
      summaryMsg += `✅ Berhasil: ${successCount}\n`;
      summaryMsg += `❌ Gagal: ${failedCount}\n\n`;

      if (failedCount > 0) {
        summaryMsg += `*Transaksi Gagal:*\n`;
        results
          .filter((r) => !r.success)
          .forEach((r) => {
            summaryMsg += `Line ${r.line}: ${r.message}\n`;
          });
      }

      if (successCount > 0) {
        summaryMsg += `\n*Transaksi Berhasil:*\n`;
        results
          .filter((r) => r.success)
          .forEach((r) => {
            summaryMsg += `✓ ${r.message}\n`;
          });
      }

      await client.sendMessage(message.from, summaryMsg);

      logger.info("Bulk transaction entry completed", {
        userId: user.id,
        total: results.length,
        success: successCount,
        failed: failedCount,
      });
    } catch (error) {
      logger.error("Error handling bulk entry", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        "❌ Terjadi kesalahan saat memproses bulk entry. Silakan coba lagi.",
      );
    }
  }

  /**
   * Show bulk entry help
   */
  static async showBulkEntryHelp(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    if (user.role !== "dev" && user.role !== "boss") {
      await client.sendMessage(
        message.from,
        "❌ Fitur ini hanya tersedia untuk Dev dan Boss.",
      );
      return;
    }

    const helpMsg =
      `📚 *Bulk Transaction Entry*\n\n` +
      `Format CSV (comma-separated):\n` +
      `type,category,amount,description\n\n` +
      `*Fields:*\n` +
      `• type: income atau expense\n` +
      `• category: nama kategori\n` +
      `• amount: jumlah (angka)\n` +
      `• description: catatan (opsional)\n\n` +
      `*Contoh:*\n` +
      `income,Penjualan Produk A,500000,Toko Jakarta\n` +
      `expense,Listrik,250000\n` +
      `income,Penjualan Produk B,750000,Toko Bandung\n\n` +
      `*Tips:*\n` +
      `• Satu transaksi per baris\n` +
      `• Maksimal 50 transaksi per batch\n` +
      `• Gunakan format angka tanpa titik/koma\n` +
      `• Description boleh kosong`;

    await client.sendMessage(message.from, helpMsg);
  }
}

export default TransactionHandler;
