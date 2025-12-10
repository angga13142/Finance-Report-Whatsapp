import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { AuthMiddleware } from "../middleware/auth";
import { SessionManager } from "../middleware/session";
import { ButtonMenu } from "../ui/buttons";
import { ListMenu } from "../ui/lists";
import { MessageFormatter } from "../ui/messages";
import { TransactionProcessor } from "../../services/transaction/processor";
import { getWhatsAppClient } from "../client/client";
import { MENU_STATES } from "../../config/constants";

/**
 * Button callback handler
 */
export class ButtonHandler {
  /**
   * Handle button callback
   */
  static async handleButton(message: Message): Promise<void> {
    try {
      const client = getWhatsAppClient();
      if (!client) {
        logger.error("WhatsApp client not initialized");
        return;
      }

      // Authenticate user
      const authMessage = await AuthMiddleware.attachUser(message);
      if (!authMessage.user) {
        await client.sendMessage(
          message.from,
          "❌ Akun Anda tidak terdaftar atau tidak aktif. Hubungi admin.",
        );
        return;
      }

      const user = authMessage.user;
      const buttonId = this.extractButtonId(message);

      if (!buttonId) {
        logger.warn("No button ID found", {
          messageId: message.id._serialized,
        });
        return;
      }

      logger.debug("Button pressed", {
        userId: user.id,
        buttonId,
        from: message.from,
      });

      // Route to appropriate handler
      await this.routeButton(user, buttonId, message);
    } catch (error) {
      logger.error("Error handling button", {
        error,
        messageId: message.id._serialized,
      });
    }
  }

  /**
   * Extract button ID from message
   */
  private static extractButtonId(message: Message): string | null {
    // Button callbacks come as message body with button ID
    // Format may vary, check common patterns
    const body = message.body?.trim();

    if (!body) {
      return null;
    }

    // Try to extract from various formats
    // WhatsApp Web.js button responses may come as text with button ID
    return body;
  }

  /**
   * Route button to appropriate handler
   */
  private static async routeButton(
    user: any,
    buttonId: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Main menu buttons
    if (buttonId === "menu_main" || buttonId.includes("menu_main")) {
      await this.handleMainMenu(user, message);
      return;
    }

    // Transaction type selection
    if (buttonId === "txn_type_income") {
      await this.handleTransactionType(user, "income", message);
      return;
    }

    if (buttonId === "txn_type_expense") {
      await this.handleTransactionType(user, "expense", message);
      return;
    }

    // Category selection (from list)
    if (buttonId.startsWith("category_")) {
      await this.handleCategorySelection(user, buttonId, message);
      return;
    }

    // Transaction confirmation
    if (buttonId === "txn_confirm_yes") {
      await this.handleTransactionConfirm(user, message);
      return;
    }

    // Edit actions
    if (buttonId === "txn_edit_amount") {
      await this.handleEditAmount(user, message);
      return;
    }

    if (buttonId === "txn_edit_category") {
      await this.handleEditCategory(user, message);
      return;
    }

    // Cancel
    if (buttonId === "txn_cancel") {
      await this.handleCancel(user, message);
      return;
    }

    // Navigation
    if (buttonId === "nav_back") {
      await this.handleBack(user, message);
      return;
    }

    // Help
    if (buttonId.includes("bantuan") || buttonId === "help") {
      await this.handleHelp(user, message);
      return;
    }

    // Unknown button
    logger.warn("Unknown button ID", { buttonId, userId: user.id });
    await client.sendMessage(
      message.from,
      "Tombol tidak dikenali. Silakan pilih dari menu utama.",
    );
    await this.handleMainMenu(user, message);
  }

  /**
   * Handle main menu
   */
  private static async handleMainMenu(
    user: any,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    await SessionManager.clearSession(user.id);
    await SessionManager.setSession(user.id, { menu: MENU_STATES.MAIN });

    const menu = ButtonMenu.generateMainMenu(user.role);
    const welcomeMsg = MessageFormatter.formatWelcomeMessage(
      user.role,
      user.name,
    );

    try {
      await client.sendMessage(message.from, welcomeMsg);
      await client.sendMessage(message.from, menu);
    } catch (error) {
      logger.error("Error sending main menu", { error, userId: user.id });
      // Fallback to text menu
      const textMenu = ButtonMenu.generateTextMenu([
        "💰 Catat Penjualan",
        "💸 Catat Pengeluaran",
        "📊 Lihat Laporan",
        "❓ Bantuan",
      ]);
      await client.sendMessage(message.from, welcomeMsg + "\n\n" + textMenu);
    }
  }

  /**
   * Handle transaction type selection
   */
  private static async handleTransactionType(
    user: any,
    type: "income" | "expense",
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.CATEGORY,
      transactionType: type,
    });

    // Generate category list
    const categoryList = await ListMenu.generateCategoryList(type);

    if (categoryList) {
      try {
        await client.sendMessage(message.from, categoryList);
      } catch (error) {
        logger.error("Error sending category list", { error });
        // Fallback to text
        const textList = await ListMenu.generateCategoryTextList(type);
        await client.sendMessage(message.from, textList);
      }
    } else {
      const textList = await ListMenu.generateCategoryTextList(type);
      await client.sendMessage(message.from, textList);
    }
  }

  /**
   * Handle category selection
   */
  private static async handleCategorySelection(
    user: any,
    buttonId: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType) {
      await this.handleMainMenu(user, message);
      return;
    }

    const categoryId = buttonId.replace("category_", "");
    const category = await ListMenu.findCategoryBySelection(
      categoryId,
      session.transactionType,
    );

    if (!category) {
      await client.sendMessage(
        message.from,
        "❌ Kategori tidak ditemukan. Silakan pilih lagi.",
      );
      await this.handleTransactionType(user, session.transactionType, message);
      return;
    }

    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.AMOUNT,
      category: category.name,
    });

    const prompt = MessageFormatter.formatAmountInputPrompt(category.name);
    await client.sendMessage(message.from, prompt);
  }

  /**
   * Handle transaction confirmation
   */
  private static async handleTransactionConfirm(
    user: any,
    message: Message,
  ): Promise<void> {
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
      await this.handleMainMenu(user, message);
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
    const successMsg =
      TransactionProcessor.getSuccessMessage(result.transaction) + dailyTotal;
    await client.sendMessage(message.from, successMsg);

    // Clear session
    await SessionManager.clearSession(user.id);
  }

  /**
   * Handle edit amount
   */
  private static async handleEditAmount(
    user: any,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.category) {
      await this.handleMainMenu(user, message);
      return;
    }

    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.AMOUNT,
      amount: undefined, // Clear amount
    });

    const prompt = MessageFormatter.formatAmountInputPrompt(
      session.category,
      session.amount,
    );
    await client.sendMessage(message.from, prompt);
  }

  /**
   * Handle edit category
   */
  private static async handleEditCategory(
    user: any,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType) {
      await this.handleMainMenu(user, message);
      return;
    }

    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.CATEGORY,
      category: undefined, // Clear category
    });

    await this.handleTransactionType(user, session.transactionType, message);
  }

  /**
   * Handle cancel
   */
  private static async handleCancel(
    user: any,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    await SessionManager.clearSession(user.id);
    await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
    await this.handleMainMenu(user, message);
  }

  /**
   * Handle back navigation
   */
  private static async handleBack(user: any, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const session = await SessionManager.getSession(user.id);

    // Navigate back based on current menu state
    if (session?.menu === MENU_STATES.AMOUNT) {
      await this.handleTransactionType(
        user,
        session.transactionType || "income",
        message,
      );
    } else if (session?.menu === MENU_STATES.CATEGORY) {
      await this.handleMainMenu(user, message);
    } else {
      await this.handleMainMenu(user, message);
    }
  }

  /**
   * Handle help
   */
  private static async handleHelp(user: any, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const helpMsg = MessageFormatter.formatHelpMessage(user.role);
    await client.sendMessage(message.from, helpMsg);
  }
}

export default ButtonHandler;
