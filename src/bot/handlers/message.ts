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

    await client.sendMessage(
      message.from,
      "Maaf, saya hanya memproses teks. Silakan gunakan tombol di atas atau ketik /menu.",
    );
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
