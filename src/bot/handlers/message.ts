import { Message } from "whatsapp-web.js";
import { User } from "@prisma/client";
import { logger } from "../../lib/logger";
import { AuthMiddleware } from "../middleware/auth";
import { SessionManager } from "../middleware/session";
import { ButtonHandler } from "./button";
import { TransactionHandler } from "./transaction";
import { ButtonMenu } from "../ui/buttons";
import { MessageFormatter } from "../ui/messages";
import { getWhatsAppClient } from "../client/client";
import { MENU_STATES } from "../../config/constants";

/**
 * Text message routing handler
 */
export class MessageHandler {
  /**
   * Route incoming message
   */
  static async routeMessage(message: Message): Promise<void> {
    try {
      // Ignore messages from bot itself
      if (message.fromMe) {
        return;
      }

      // Ignore media messages (for now)
      if (message.hasMedia) {
        await this.handleMediaMessage(message);
        return;
      }

      // Authenticate user
      const authMessage = await AuthMiddleware.attachUser(message);
      if (!authMessage.user) {
        await this.handleUnauthorized(message);
        return;
      }

      const user = authMessage.user;
      const body = message.body?.trim().toLowerCase() || "";

      // Check if it's a button callback (button responses come as text)
      if (this.isButtonResponse(message, user)) {
        await ButtonHandler.handleButton(message);
        return;
      }

      // Handle text commands
      if (body.startsWith("/")) {
        await this.handleCommand(user, body, message);
        return;
      }

      // Check for recovery context first (before anything else)
      const hasRecoverable = await SessionManager.hasRecoverableContext(
        user.id,
      );
      if (hasRecoverable) {
        const handled = await TransactionHandler.handleRecoveryDecision(
          user,
          body,
          message,
        );
        if (handled) {
          return;
        }
      }

      // Handle transaction input workflow
      const session = await SessionManager.getSession(user.id);

      // Check if user is in editing mode
      if (session?.isEditing) {
        await TransactionHandler.handleEditInput(user, body, message);
        return;
      }

      if (session?.menu === MENU_STATES.AMOUNT) {
        await TransactionHandler.handleAmountInput(user, body, message);
        return;
      }

      if (session?.menu === MENU_STATES.CATEGORY) {
        await TransactionHandler.handleCategoryInput(user, body, message);
        return;
      }

      // Check for retry command
      if (body === "coba lagi" || body === "retry") {
        await TransactionHandler.handleRetry(user, message);
        return;
      }

      // Default: check for recovery offer, then show main menu
      const offered = await TransactionHandler.checkAndOfferRecovery(
        user,
        message,
      );
      if (!offered) {
        await this.handleWelcome(user, message);
      }
    } catch (error) {
      logger.error("Error routing message", {
        error,
        messageId: message.id._serialized,
      });
    }
  }

  /**
   * Handle welcome message (first interaction)
   */
  static async handleWelcome(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    await SessionManager.clearSession(user.id);
    await SessionManager.setSession(user.id, { menu: MENU_STATES.MAIN });

    const welcomeMsg = MessageFormatter.formatWelcomeMessage(
      user.role,
      user.name ?? undefined,
    );
    const menu = ButtonMenu.generateMainMenu(user.role);

    try {
      await client.sendMessage(message.from, welcomeMsg);
      await client.sendMessage(message.from, menu);
    } catch (error) {
      logger.error("Error sending welcome message", { error });
      // Fallback to text
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
   * Handle text commands
   */
  private static async handleCommand(
    user: User,
    command: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const cmd = command.split(" ")[0];

    switch (cmd) {
      case "/start":
      case "/menu":
        await this.handleWelcome(user, message);
        break;
      case "/help":
        await this.handleHelp(user, message);
        break;
      case "/catat":
        await TransactionHandler.handleTransactionStart(user, message);
        break;
      case "/laporan":
        await client.sendMessage(
          message.from,
          "📊 Fitur laporan akan tersedia di Phase 4.",
        );
        break;
      default:
        await client.sendMessage(
          message.from,
          "❓ Perintah tidak dikenali. Gunakan /menu untuk melihat menu utama.",
        );
    }
  }

  /**
   * Handle help command
   */
  private static async handleHelp(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    const helpMsg = MessageFormatter.formatHelpMessage(user.role);
    await client.sendMessage(message.from, helpMsg);
  }

  /**
   * Handle unauthorized user
   */
  private static async handleUnauthorized(message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    await client.sendMessage(
      message.from,
      "❌ Akun Anda tidak terdaftar atau tidak aktif.\n\nHubungi admin untuk registrasi.",
    );
  }

  /**
   * Handle media messages (graceful ignore)
   */
  private static async handleMediaMessage(message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    logger.info("Media message received, sending help response", {
      from: message.from,
      type: message.type,
      hasMedia: message.hasMedia,
    });

    // Send user-friendly message about media not being supported
    const mediaMessage = MessageFormatter.getErrorMessage(
      "media_not_supported",
    );
    await client.sendMessage(message.from, mediaMessage);

    // Also send quick access buttons
    const buttons = ButtonMenu.generateErrorRecoveryButtons("media");
    await message.reply(buttons);
  }

  /**
   * Handle invalid input with format examples
   */
  static async handleInvalidInput(
    message: Message,
    field: string,
    value: string,
    examples: string[],
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    logger.warn("Invalid input detected", {
      from: message.from,
      field,
      value,
    });

    // Send validation error with examples
    const errorMessage = MessageFormatter.formatValidationError(
      field,
      value,
      examples,
    );
    await client.sendMessage(message.from, errorMessage);

    // Send validation error buttons
    const buttons = ButtonMenu.generateValidationErrorButtons();
    await message.reply(buttons);
  }

  /**
   * Handle numeric input validation
   */
  static validateNumericInput(
    input: string,
    fieldName: string,
  ): { valid: boolean; value?: number; error?: string } {
    const trimmed = input.trim().replace(/,/g, ""); // Remove commas

    // Check if it's a valid number
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      return {
        valid: false,
        error: `${fieldName} harus berupa angka positif`,
      };
    }

    const value = parseFloat(trimmed);

    // Check if positive
    if (value <= 0) {
      return {
        valid: false,
        error: `${fieldName} harus lebih besar dari 0`,
      };
    }

    // Check reasonable limits (max 1 billion)
    if (value > 1000000000) {
      return {
        valid: false,
        error: `${fieldName} terlalu besar (max 1 miliar)`,
      };
    }

    return { valid: true, value };
  }

  /**
   * Handle date input validation
   */
  static validateDateInput(input: string): {
    valid: boolean;
    date?: Date;
    error?: string;
  } {
    const trimmed = input.trim();

    // Try DD/MM/YYYY format
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmmyyyyMatch = trimmed.match(ddmmyyyyPattern);

    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      if (isNaN(date.getTime())) {
        return { valid: false, error: "Tanggal tidak valid" };
      }

      return { valid: true, date };
    }

    // Try YYYY-MM-DD format
    const yyyymmddPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const yyyymmddMatch = trimmed.match(yyyymmddPattern);

    if (yyyymmddMatch) {
      const [, year, month, day] = yyyymmddMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      if (isNaN(date.getTime())) {
        return { valid: false, error: "Tanggal tidak valid" };
      }

      return { valid: true, date };
    }

    return {
      valid: false,
      error: "Format tanggal salah. Gunakan DD/MM/YYYY atau YYYY-MM-DD",
    };
  }

  /**
   * Handle category input validation
   */
  static validateCategoryInput(input: string): {
    valid: boolean;
    category?: string;
    error?: string;
  } {
    const trimmed = input.trim();

    // Check if empty
    if (!trimmed) {
      return { valid: false, error: "Kategori tidak boleh kosong" };
    }

    // Check minimum length
    if (trimmed.length < 2) {
      return {
        valid: false,
        error: "Kategori terlalu pendek (min 2 karakter)",
      };
    }

    // Check maximum length
    if (trimmed.length > 50) {
      return {
        valid: false,
        error: "Kategori terlalu panjang (max 50 karakter)",
      };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens)
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
      return {
        valid: false,
        error:
          "Kategori hanya boleh mengandung huruf, angka, spasi, dan tanda hubung",
      };
    }

    return { valid: true, category: trimmed };
  }

  /**
   * Check if message is a button response
   */
  private static isButtonResponse(message: Message, _user: User): boolean {
    const body = message.body?.trim() || "";

    // Button responses typically come as text with button ID
    // Check if body matches known button patterns
    const buttonPatterns = [
      "txn_type_",
      "category_",
      "txn_confirm_",
      "txn_edit_",
      "txn_cancel",
      "menu_main",
      "nav_back",
      "help",
    ];

    return buttonPatterns.some((pattern) => body.includes(pattern));
  }
}

export default MessageHandler;
