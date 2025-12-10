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
  static async handleConfirm(user: any, message: Message): Promise<void> {
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
    const dailyTotal = await TransactionProcessor.getDailyTotalMessage(user.id);

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

    // Clear session
    await SessionManager.clearSession(user.id);
  }
}

export default TransactionHandler;
