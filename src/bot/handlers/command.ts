import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { UserModel } from "../../models/user";
import type { UserRole, TransactionType } from "@prisma/client";
import { parseCommand, getCommandSuggestions } from "./command.parser";
import { COMMANDS } from "../../config/constants";
import {
  getContext,
  setContext,
  updateContext,
  clearContext,
  type ConversationContext,
} from "../../lib/redis";
import {
  formatBalanceMessage,
  formatTransactionConfirmation,
  formatCategoryList,
  formatErrorMessage,
} from "../ui/message.formatter";
import { CategoryModel } from "../../models/category";
import { TransactionProcessor } from "../../services/transaction/processor";
import { TransactionValidator } from "../../services/transaction/validator";
import { TransactionModel } from "../../models/transaction";

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  command: string; // The command name (e.g., 'start', 'help', 'menu')
  args: string[]; // Command arguments
  rawText: string; // Original message text
}

/**
 * Command handler function signature
 */
export type CommandHandlerFn = (
  message: Message,
  userId: string,
  userRole: UserRole,
  args: string[],
) => Promise<void>;

/**
 * Text Command Parser and Router
 * Handles text-based commands as fallback for button interactions
 */
export class CommandHandler {
  private static aliasMap: Map<string, string> = new Map();

  /**
   * Initialize command mappings
   */
  static initialize(): void {
    // Register command aliases (Indonesian and English)
    this.aliasMap.set("mulai", "start");
    this.aliasMap.set("bantuan", "help");
    this.aliasMap.set("tolong", "help");
    this.aliasMap.set("laporan", "report");
    this.aliasMap.set("catat", "record");
    this.aliasMap.set("transaksi", "record");
    this.aliasMap.set("detail", "detail");
    this.aliasMap.set("dismiss", "dismiss");
    this.aliasMap.set("diskusi", "discuss");
    this.aliasMap.set("discuss", "discuss");
    this.aliasMap.set("rekomendasi", "recommendations");
    this.aliasMap.set("alerts", "recommendations");
    this.aliasMap.set("pending", "pending");
    this.aliasMap.set("approve", "approve");
    this.aliasMap.set("reject", "reject");
    this.aliasMap.set("setujui", "approve");
    this.aliasMap.set("tolak", "reject");
    this.aliasMap.set("profile", "profile");
    this.aliasMap.set("profil", "profile");
    this.aliasMap.set("akun", "profile");
    this.aliasMap.set("delete-account", "delete-account");
    this.aliasMap.set("hapus-akun", "delete-account");
    this.aliasMap.set("edit", "edit");
    this.aliasMap.set("ubah", "edit");
    this.aliasMap.set("delete", "delete");
    this.aliasMap.set("hapus", "delete");
    this.aliasMap.set("admin", "admin");
    this.aliasMap.set("users", "users");
    this.aliasMap.set("user-activity", "user-activity");
    this.aliasMap.set("aktivitas", "user-activity");
    this.aliasMap.set("generate-report", "generate-report");
    this.aliasMap.set("report-manual", "generate-report");
    this.aliasMap.set("bulk", "bulk");
    this.aliasMap.set("bulk-help", "bulk-help");
    this.aliasMap.set("batch", "bulk");
    this.aliasMap.set("receipt", "receipt");
    this.aliasMap.set("receipt-on", "receipt-on");
    this.aliasMap.set("receipt-off", "receipt-off");

    logger.info("Command handler initialized", {
      aliases: Array.from(this.aliasMap.keys()),
    });
  }

  /**
   * Parse text command from message
   */
  static parseCommand(text: string): ParsedCommand | null {
    const trimmed = text.trim();

    // Check for number shortcuts (1-9)
    const numberShortcut = this.parseNumberShortcut(trimmed);
    if (numberShortcut) {
      return numberShortcut;
    }

    // Check if it starts with / or is a known command
    if (!trimmed.startsWith("/") && !this.isKnownCommand(trimmed)) {
      return null;
    }

    // Remove leading slash if present
    const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;

    // Split by whitespace
    const parts = withoutSlash.split(/\s+/);

    if (parts.length === 0) {
      return null;
    }

    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Resolve alias to actual command
    const resolvedCommand = this.aliasMap.get(command) || command;

    return {
      command: resolvedCommand,
      args,
      rawText: text,
    };
  }

  /**
   * Parse number shortcuts (1-9)
   * Maps to menu selections based on context
   */
  private static parseNumberShortcut(text: string): ParsedCommand | null {
    const match = text.match(/^([1-9])$/);
    if (!match) {
      return null;
    }

    const number = parseInt(match[1], 10);

    // Map numbers to common menu items
    // This provides quick access shortcuts
    const shortcutMap: Record<number, string> = {
      1: "record", // Catat Transaksi
      2: "report", // Lihat Laporan
      3: "menu", // Menu Utama
      4: "help", // Bantuan
      5: "profile", // Profil
      6: "pending", // Pending Approvals (Boss)
      7: "recommendations", // Rekomendasi
      8: "admin", // Admin Menu (Dev)
      9: "start", // Start Over
    };

    const command = shortcutMap[number];
    if (!command) {
      return null;
    }

    return {
      command,
      args: [],
      rawText: text,
    };
  }

  /**
   * Check if text starts with a known command (without slash)
   */
  private static isKnownCommand(text: string): boolean {
    const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
    const knownCommands = [
      "start",
      "help",
      "menu",
      "laporan",
      "catat",
      "mulai",
      "bantuan",
    ];
    return knownCommands.includes(firstWord);
  }

  /**
   * Route command to appropriate handler
   */
  static async routeCommand(
    message: Message,
    parsed: ParsedCommand,
  ): Promise<void> {
    logger.info("Routing command", {
      command: parsed.command,
      args: parsed.args,
    });

    // Get user info
    const phoneNumber = message.from;
    const user = await UserModel.findByPhoneNumber(phoneNumber);

    if (!user) {
      await message.reply(
        "❌ User tidak ditemukan. Silakan registrasi terlebih dahulu dengan /start",
      );
      return;
    }

    try {
      switch (parsed.command) {
        case "start":
          await this.handleStartCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "help":
          await this.handleHelpCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "menu":
          await this.handleMenuCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "report":
          await this.handleReportCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "record":
          await this.handleRecordCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "detail":
          await this.handleDetailCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "dismiss":
          await this.handleDismissCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "discuss":
          await this.handleDiscussCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "recommendations":
          await this.handleRecommendationsCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "pending":
          await this.handlePendingCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "approve":
          await this.handleApproveCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "reject":
          await this.handleRejectCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "profile":
          await this.handleProfileCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "delete-account":
          await this.handleDeleteAccountCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "edit":
          await this.handleEditCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "delete":
          await this.handleDeleteCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "admin":
          await this.handleAdminCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "user-activity":
          await this.handleUserActivityCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "generate-report":
          await this.handleGenerateReportCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "bulk":
          await this.handleBulkCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "bulk-help":
          await this.handleBulkHelpCommand(message, user.id, user.role);
          break;

        case "receipt":
          await this.handleReceiptCommand(message, user.id, user.role);
          break;

        case "receipt-on":
          await this.handleReceiptToggleCommand(
            message,
            user.id,
            user.role,
            true,
          );
          break;

        case "receipt-off":
          await this.handleReceiptToggleCommand(
            message,
            user.id,
            user.role,
            false,
          );
          break;

        default:
          await message.reply(
            `❌ Command tidak dikenal: \`${parsed.command}\`\n\nKetik /help untuk melihat daftar command yang tersedia.`,
          );
      }
    } catch (error) {
      logger.error("Command execution failed", {
        command: parsed.command,
        error,
      });
      await message.reply(
        "❌ Terjadi kesalahan saat menjalankan command. Silakan coba lagi.",
      );
    }
  }

  /**
   * Handle /start command
   */
  private static async handleStartCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    logger.info("Handling /start command", { userId, userRole });

    let response = `👋 *Selamat datang di WhatsApp Cashflow Bot!*\n\n`;
    response += `Saya adalah asisten keuangan Anda yang akan membantu:\n`;
    response += `• 📝 Catat transaksi income/expense\n`;
    response += `• 📊 Generate laporan keuangan\n`;
    response += `• 💡 Berikan rekomendasi finansial\n`;
    response += `• 🚨 Alert anomali keuangan\n\n`;

    response += `🎯 *Role Anda:* ${this.formatRole(userRole)}\n\n`;

    // Role-specific features
    switch (userRole) {
      case "dev":
        response += `👨‍💻 *Fitur Dev:*\n`;
        response += `• Full access ke semua menu\n`;
        response += `• User management\n`;
        response += `• System monitoring\n`;
        response += `• Configuration\n`;
        break;

      case "boss":
        response += `👔 *Fitur Boss:*\n`;
        response += `• Dashboard dan insights\n`;
        response += `• Approval transaksi\n`;
        response += `• Full reporting\n`;
        response += `• Team performance\n`;
        break;

      case "employee":
        response += `👤 *Fitur Employee:*\n`;
        response += `• Catat transaksi\n`;
        response += `• View laporan terbatas\n`;
        response += `• Daily summary\n`;
        break;

      case "investor":
        response += `💼 *Fitur Investor:*\n`;
        response += `• Aggregated reports\n`;
        response += `• Trend analysis\n`;
        response += `• Investment insights\n`;
        response += `• No individual transactions\n`;
        break;
    }

    response += `\n📖 Ketik /help untuk panduan lengkap\n`;
    response += `🔘 Ketik /menu untuk menampilkan menu utama\n`;

    await message.reply(response);
  }

  /**
   * Handle /help command
   */
  private static async handleHelpCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    logger.info("Handling /help command", { userId, userRole });

    let response = `📖 *Panduan WhatsApp Cashflow Bot*\n\n`;

    response += `🔘 *Command Utama:*\n`;
    response += `• \`/start\` - Informasi awal\n`;
    response += `• \`/menu\` - Tampilkan menu utama\n`;
    response += `• \`/help\` - Panduan ini\n\n`;

    response += `📝 *Command Transaksi:*\n`;
    response += `• \`/catat\` - Catat transaksi baru\n`;
    response += `• Format: /catat [income/expense] [jumlah] [kategori] [deskripsi]\n`;
    response += `• Contoh: \`/catat income 500000 Sales Pembayaran Client A\`\n\n`;

    response += `📊 *Command Laporan:*\n`;
    response += `• \`/laporan\` - Menu laporan\n`;
    response += `• \`/laporan daily\` - Laporan harian\n`;
    response += `• \`/laporan weekly\` - Laporan mingguan\n`;
    response += `• \`/laporan monthly\` - Laporan bulanan\n\n`;

    response += `💡 *Command Rekomendasi:*\n`;
    response += `• \`/rekomendasi\` - List rekomendasi aktif\n`;
    response += `• \`/detail <ID>\` - Detail rekomendasi\n`;
    response += `• \`/dismiss <ID>\` - Dismiss rekomendasi\n`;
    response += `• \`/discuss <ID>\` - Diskusi dengan tim\n\n`;

    response += `🔢 *Shortcut Angka:*\n`;
    response += `Ketik angka (1, 2, 3, dst) untuk memilih menu\n\n`;

    response += `💬 *Tips:*\n`;
    response += `• Gunakan button untuk navigasi lebih mudah\n`;
    response += `• Command bisa pakai bahasa Indonesia atau English\n`;
    response += `• Ketik /menu untuk kembali ke menu utama\n`;

    await message.reply(response);
  }

  /**
   * Handle /menu command
   */
  private static async handleMenuCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    logger.info("Handling /menu command", { userId, userRole });

    // Import handlers dynamically to avoid circular dependencies
    const { default: ButtonUI } = await import("../ui/buttons");

    // Show role-specific menu
    switch (userRole) {
      case "dev":
      case "boss":
        await message.reply(ButtonUI.generateRoleTextMenu(userRole));
        break;

      case "employee":
        // Employee menu - simplified version
        await message.reply(ButtonUI.generateRoleTextMenu(userRole));
        break;

      case "investor":
        // Investor menu - simplified version
        await message.reply(ButtonUI.generateRoleTextMenu(userRole));
        break;

      default:
        await message.reply("❌ Role tidak dikenal. Silakan hubungi admin.");
    }
  }

  /**
   * Handle /laporan (report) command
   */
  private static async handleReportCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    logger.info("Handling /laporan command", { userId, userRole, args });

    if (args.length === 0) {
      // Show report menu
      let response = `📊 *Menu Laporan*\n\n`;
      response += `Pilih jenis laporan:\n`;
      response += `1. Daily - Laporan harian\n`;
      response += `2. Weekly - Laporan mingguan\n`;
      response += `3. Monthly - Laporan bulanan\n`;
      response += `4. Custom - Laporan custom period\n\n`;
      response += `Contoh: \`/laporan daily\`\n`;

      await message.reply(response);
      return;
    }

    const reportType = args[0].toLowerCase();

    // Report generation implementation

    try {
      switch (reportType) {
        case "daily":
        case "harian":
          await message.reply("📊 Generating daily report...");
          // TODO: Generate and send daily report
          await message.reply(
            "✅ Daily report akan dikirim dalam beberapa saat.",
          );
          break;

        case "weekly":
        case "mingguan":
          await message.reply("📊 Generating weekly report...");
          // TODO: Generate and send weekly report
          await message.reply(
            "✅ Weekly report akan dikirim dalam beberapa saat.",
          );
          break;

        case "monthly":
        case "bulanan":
          await message.reply("📊 Generating monthly report...");
          // TODO: Generate and send monthly report
          await message.reply(
            "✅ Monthly report akan dikirim dalam beberapa saat.",
          );
          break;

        default:
          await message.reply(
            `❌ Jenis laporan tidak dikenal: \`${reportType}\`\n\nGunakan: daily, weekly, atau monthly`,
          );
      }
    } catch (error) {
      logger.error("Failed to generate report", { reportType, error });
      await message.reply("❌ Gagal generate laporan. Silakan coba lagi.");
    }
  }

  /**
   * Handle /catat (record) command
   */
  private static async handleRecordCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    logger.info("Handling /catat command", { userId, userRole, args });

    if (args.length < 3) {
      let response = `📝 *Format Catat Transaksi*\n\n`;
      response += `\`/catat [type] [amount] [category] [description]\`\n\n`;
      response += `*Parameter:*\n`;
      response += `• type: income atau expense\n`;
      response += `• amount: nominal (angka saja)\n`;
      response += `• category: nama kategori\n`;
      response += `• description: keterangan transaksi\n\n`;
      response += `*Contoh:*\n`;
      response += `\`/catat income 500000 Sales Pembayaran dari Client A\`\n`;
      response += `\`/catat expense 150000 Transport Bensin motor\`\n`;

      await message.reply(response);
      return;
    }

    const [type, amountStr, category, ...descParts] = args;
    const description = descParts.join(" ");

    // Validate type
    if (!["income", "expense"].includes(type.toLowerCase())) {
      await message.reply("❌ Tipe transaksi harus 'income' atau 'expense'");
      return;
    }

    // Validate amount
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      await message.reply("❌ Jumlah harus berupa angka positif");
      return;
    }

    await message.reply(
      `✅ Transaksi dicatat:\n• Type: ${type}\n• Amount: Rp ${amount.toLocaleString("id-ID")}\n• Category: ${category}\n• Description: ${description}\n\n_Menunggu approval..._`,
    );

    // TODO: Create transaction via TransactionProcessor
    logger.info("Transaction recorded via command", {
      userId,
      type,
      amount,
      category,
      description,
    });
  }

  /**
   * Handle /detail command
   */
  private static async handleDetailCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/detail <recommendation-id>`\n\nContoh: `/detail abc12345`",
      );
      return;
    }

    const { RecommendationHandler } = await import("./recommendation");
    await RecommendationHandler.handleViewDetail(message, userId, args[0]);
  }

  /**
   * Handle /dismiss command
   */
  private static async handleDismissCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/dismiss <recommendation-id>`\n\nContoh: `/dismiss abc12345`",
      );
      return;
    }

    const { RecommendationHandler } = await import("./recommendation");
    await RecommendationHandler.handleDismiss(message, userId, args[0]);
  }

  /**
   * Handle /discuss command
   */
  private static async handleDiscussCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/discuss <recommendation-id>`\n\nContoh: `/discuss abc12345`",
      );
      return;
    }

    const { RecommendationHandler } = await import("./recommendation");
    await RecommendationHandler.handleDiscussWithTeam(message, userId, args[0]);
  }

  /**
   * Handle /pending command - View pending approvals (Boss only)
   */
  private static async handlePendingCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    // Check role
    if (userRole !== "boss" && userRole !== "dev") {
      await message.reply(
        "❌ Command ini hanya untuk Boss dan Dev.\n\nAnda tidak memiliki akses.",
      );
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const { ApprovalHandler } = await import("./approval");
    await ApprovalHandler.handlePendingApprovals(user, message);
  }

  /**
   * Handle /approve command - Approve transaction (Boss only)
   */
  private static async handleApproveCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    // Check role
    if (userRole !== "boss" && userRole !== "dev") {
      await message.reply(
        "❌ Command ini hanya untuk Boss dan Dev.\n\nAnda tidak memiliki akses.",
      );
      return;
    }

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/approve <transaction-id>`\n\n" +
          "Contoh: `/approve abc12345`\n\n" +
          "Gunakan `/pending` untuk melihat transaksi yang perlu approval.",
      );
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const { ApprovalHandler } = await import("./approval");
    await ApprovalHandler.handleApprove(user, args[0], message);
  }

  /**
   * Handle /reject command - Reject transaction (Boss only)
   */
  private static async handleRejectCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    // Check role
    if (userRole !== "boss" && userRole !== "dev") {
      await message.reply(
        "❌ Command ini hanya untuk Boss dan Dev.\n\nAnda tidak memiliki akses.",
      );
      return;
    }

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/reject <transaction-id> [reason]`\n\n" +
          "Contoh: `/reject abc12345 Jumlah tidak sesuai`\n\n" +
          "Gunakan `/pending` untuk melihat transaksi yang perlu approval.",
      );
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const transactionId = args[0];
    const reason = args.slice(1).join(" ") || undefined;

    const { ApprovalHandler } = await import("./approval");
    await ApprovalHandler.handleReject(user, transactionId, reason, message);
  }

  /**
   * Handle /rekomendasi command
   */
  private static async handleRecommendationsCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    const { RecommendationHandler } = await import("./recommendation");
    await RecommendationHandler.handleListActive(message, userId, userRole);
  }

  /**
   * Handle /edit command - Edit transaction
   */
  private static async handleEditCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    if (args.length < 3) {
      await message.reply(
        "❌ Format: `/edit <transaction-id> <field> <new-value>`\n\n" +
          "Field yang bisa diedit:\n" +
          "• `amount` - Jumlah (contoh: 50000)\n" +
          "• `category` - Kategori (contoh: Transport)\n" +
          "• `description` - Catatan\n\n" +
          "Contoh:\n" +
          "`/edit abc123 amount 75000`\n" +
          "`/edit abc123 category Makan`\n" +
          "`/edit abc123 description Makan siang`\n\n" +
          "Note: Same-day edits untuk owner, previous day untuk Boss/Dev",
      );
      return;
    }

    const transactionId = args[0];
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    const { TransactionEditor } =
      await import("../../services/transaction/editor");

    let result;
    switch (field) {
      case "amount":
      case "jumlah":
        result = await TransactionEditor.editAmount(
          transactionId,
          newValue,
          userId,
          userRole,
        );
        break;

      case "category":
      case "kategori":
        result = await TransactionEditor.editCategory(
          transactionId,
          newValue,
          userId,
          userRole,
        );
        break;

      case "description":
      case "catatan":
      case "keterangan":
        result = await TransactionEditor.editDescription(
          transactionId,
          newValue,
          userId,
          userRole,
        );
        break;

      default:
        await message.reply(
          `❌ Field tidak valid: \`${field}\`\n\n` +
            "Field yang bisa diedit: amount, category, description",
        );
        return;
    }

    if (result.success && result.transaction) {
      const { formatCurrency } = await import("../../lib/currency");
      await message.reply(
        `✅ Transaksi berhasil diupdate!\n\n` +
          `ID: ${transactionId}\n` +
          `Jumlah: ${formatCurrency(result.transaction.amount)}\n` +
          `Kategori: ${result.transaction.category}\n` +
          `Catatan: ${result.transaction.description || "-"}`,
      );
    } else {
      await message.reply(`❌ Gagal mengedit transaksi: ${result.error}`);
    }
  }

  /**
   * Handle /delete command - Delete transaction (Boss/Dev only)
   */
  private static async handleDeleteCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    // Check role
    if (userRole !== "boss" && userRole !== "dev") {
      await message.reply(
        "❌ Command ini hanya untuk Boss dan Dev.\n\n" +
          "Anda tidak memiliki akses untuk menghapus transaksi.",
      );
      return;
    }

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/delete <transaction-id> [reason]`\n\n" +
          "Contoh:\n" +
          "`/delete abc123`\n" +
          "`/delete abc123 Data duplikat`\n\n" +
          "Note: Penghapusan bersifat soft delete (tidak permanen)",
      );
      return;
    }

    const transactionId = args[0];
    const reason = args.slice(1).join(" ") || undefined;

    const { TransactionProcessor } =
      await import("../../services/transaction/processor");

    const result = await TransactionProcessor.deleteTransaction(
      transactionId,
      userId,
      userRole,
      reason,
    );

    if (result.success) {
      await message.reply(
        `✅ Transaksi berhasil dihapus!\n\n` +
          `ID: ${transactionId}\n` +
          `${reason ? `Alasan: ${reason}\n` : ""}` +
          `\nTransaksi telah di-soft delete dan tercatat di audit log.`,
      );
    } else {
      await message.reply(`❌ Gagal menghapus transaksi: ${result.error}`);
    }
  }

  /**
   * Handle /profile command
   */
  private static async handleProfileCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const { ProfileHandler } = await import("./profile");
    await ProfileHandler.handleProfileView(user, message);
  }

  /**
   * Handle /delete-account command
   */
  private static async handleDeleteAccountCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const { ProfileHandler } = await import("./profile");

    // If no args, show confirmation request
    if (args.length === 0) {
      await ProfileHandler.handleAccountDeletionRequest(user, message);
    } else {
      // Handle confirmation
      await ProfileHandler.handleAccountDeletionConfirm(user, args[0], message);
    }
  }

  /**
   * Handle /admin command - Show admin menu (Dev only)
   */
  private static async handleAdminCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");
    await AdminHandler.handleAdminMenu(message, userId, userRole);
  }

  /**
   * Handle /user-activity command - Show user activity summary (Boss/Dev)
   */
  private static async handleUserActivityCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");
    await AdminHandler.handleUserActivitySummary(message, userId, userRole);
  }

  /**
   * Handle /generate-report command - Manual report generation (Dev only)
   */
  private static async handleGenerateReportCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const reportDate = args.length > 0 ? args[0] : undefined;

    const { AdminHandler } = await import("./admin");
    await AdminHandler.handleManualReportGeneration(
      message,
      userId,
      userRole,
      reportDate,
    );
  }

  /**
   * Handle /bulk command - Bulk transaction entry (Dev/Boss only)
   */
  private static async handleBulkCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    // If no args, show help
    if (args.length === 0) {
      const { TransactionHandler } = await import("./transaction");
      await TransactionHandler.showBulkEntryHelp(user, message);
      return;
    }

    // Process bulk entry
    const bulkData = args.join(" ");
    const { TransactionHandler } = await import("./transaction");
    await TransactionHandler.handleBulkEntry(user, bulkData, message);
  }

  /**
   * Handle /bulk-help command - Show bulk entry help
   */
  private static async handleBulkHelpCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      await message.reply("❌ User tidak ditemukan");
      return;
    }

    const { TransactionHandler } = await import("./transaction");
    await TransactionHandler.showBulkEntryHelp(user, message);
  }

  /**
   * Handle /receipt command - Show receipt status (Dev only)
   */
  private static async handleReceiptCommand(
    message: Message,
    _userId: string,
    userRole: UserRole,
  ): Promise<void> {
    if (userRole !== "dev") {
      await message.reply(
        "⛔ Akses ditolak. Hanya Dev yang dapat mengakses pengaturan receipt.",
      );
      return;
    }

    const { receiptService } =
      await import("../../services/notification/receipt");
    const config = await receiptService.getConfig();

    let statusMsg = "🧾 *RECEIPT NOTIFICATION STATUS*\n\n";
    statusMsg += `Status: ${config.enabled ? "✅ Enabled" : "❌ Disabled"}\n`;
    statusMsg += `Send Immediately: ${config.sendImmediately ? "Yes" : "No"}\n`;
    statusMsg += `Include Details: ${config.includeDetails ? "Yes" : "No"}\n`;
    statusMsg += `Include Reference: ${config.includeReference ? "Yes" : "No"}\n\n`;

    statusMsg += "*Commands:*\n";
    statusMsg += "/receipt-on - Enable receipt notifications\n";
    statusMsg += "/receipt-off - Disable receipt notifications";

    await message.reply(statusMsg);
  }

  /**
   * Handle /receipt-on and /receipt-off commands (Dev only)
   */
  private static async handleReceiptToggleCommand(
    message: Message,
    _userId: string,
    userRole: UserRole,
    enable: boolean,
  ): Promise<void> {
    if (userRole !== "dev") {
      await message.reply(
        "⛔ Akses ditolak. Hanya Dev yang dapat mengubah pengaturan receipt.",
      );
      return;
    }

    const { receiptService } =
      await import("../../services/notification/receipt");

    if (enable) {
      await receiptService.updateConfig({ enabled: true }, "dev");
      await message.reply(
        "✅ Receipt notifications telah diaktifkan.\n\n" +
          "User akan menerima konfirmasi otomatis setelah setiap transaksi.",
      );
    } else {
      await receiptService.updateConfig({ enabled: false }, "dev");
      await message.reply(
        "❌ Receipt notifications telah dinonaktifkan.\n\n" +
          "User tidak akan menerima konfirmasi transaksi.",
      );
    }

    logger.info("Receipt notifications toggled", {
      enabled: enable,
      by: userRole,
    });
  }

  /**
   * T016: Route command using new command parser
   * Maps parsed intents from command.parser.ts to handler functions
   */
  static async routeCommandWithParser(
    message: Message,
    userId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    const rawText = message.body?.trim() || "";
    if (!rawText) {
      return false;
    }

    // Parse using new command parser
    const parsed = parseCommand(rawText, userId, userRole);
    if (!parsed) {
      return false;
    }

    // Log command (T024)
    this.logCommand(
      userId,
      rawText,
      parsed.recognizedIntent,
      parsed.confidence,
    );

    // Route based on recognized intent
    try {
      switch (parsed.recognizedIntent) {
        case COMMANDS.RECORD_SALE:
          await this.handleTransactionEntryCommand(
            message,
            userId,
            userRole,
            "income",
          );
          return true;

        case COMMANDS.RECORD_EXPENSE:
          await this.handleTransactionEntryCommand(
            message,
            userId,
            userRole,
            "expense",
          );
          return true;

        case COMMANDS.VIEW_BALANCE:
        case COMMANDS.CHECK_BALANCE:
          await this.handleViewBalanceCommand(message, userId, userRole);
          return true;

        case COMMANDS.HELP:
        case COMMANDS.MENU:
          await this.handleHelpCommand(message, userId, userRole, []);
          return true;

        default:
          // Check if confidence is low, show suggestions
          if (parsed.confidence < 0.7) {
            const suggestions = getCommandSuggestions(rawText, 3);
            await message.reply(
              formatErrorMessage({
                unrecognizedCommand: rawText,
                suggestions: suggestions.map((s) => ({
                  command: s.command,
                  description: s.description,
                })),
                showButtonFallback: true,
              }),
            );
            return true;
          }
          return false;
      }
    } catch (error) {
      logger.error("Error routing command with parser", {
        error,
        userId,
        command: parsed.recognizedIntent,
      });
      await message.reply(
        "❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi.",
      );
      return true;
    }
  }

  /**
   * Handle transaction workflow step (public method for message.ts)
   */
  static async handleTransactionWorkflow(
    message: Message,
    userId: string,
    userRole: UserRole,
    context: ConversationContext,
  ): Promise<void> {
    await this.handleTransactionWorkflowStep(
      message,
      userId,
      userRole,
      context,
    );
  }

  /**
   * T017: Handle transaction entry command
   * Initiates multi-step workflow and stores context
   */
  private static async handleTransactionEntryCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    type: "income" | "expense",
  ): Promise<void> {
    const context = await getContext(userId);

    // Check if user is already in a transaction workflow
    if (context?.workflowType === "transaction_entry") {
      // Continue existing workflow
      await this.handleTransactionWorkflowStep(
        message,
        userId,
        userRole,
        context,
      );
      return;
    }

    // Start new transaction workflow
    await setContext({
      userId,
      workflowType: "transaction_entry",
      currentStep: 1,
      enteredData: {},
      pendingTransaction: {
        type,
      },
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    });

    // Get current balance for display
    const balance = await this.calculateBalance(userId);
    const balanceMsg = formatBalanceMessage({ balance });

    // Send initial prompt
    const typeLabel = type === "income" ? "Penjualan" : "Pengeluaran";
    const emoji = type === "income" ? "💰" : "💸";
    let response = `${emoji} *Catat ${typeLabel}*\n\n`;
    response += `Masukkan jumlah ${typeLabel.toLowerCase()}:\n\n`;
    response += balanceMsg;

    await message.reply(response);
  }

  /**
   * T018: Handle transaction workflow steps
   * Updates context for amount input, category selection, confirmation
   */
  private static async handleTransactionWorkflowStep(
    message: Message,
    userId: string,
    userRole: UserRole,
    context: ConversationContext,
  ): Promise<void> {
    const input = message.body?.trim() || "";
    const step = context.currentStep || 1;

    switch (step) {
      case 1:
        // Step 1: Amount input
        await this.handleAmountInputStep(
          message,
          userId,
          userRole,
          input,
          context,
        );
        break;

      case 2:
        // Step 2: Category selection
        await this.handleCategorySelectionStep(
          message,
          userId,
          userRole,
          input,
          context,
        );
        break;

      case 3:
        // Step 3: Confirmation
        await this.handleConfirmationStep(
          message,
          userId,
          userRole,
          input,
          context,
        );
        break;

      default:
        await message.reply(
          "❌ Sesi tidak valid. Silakan mulai lagi dengan perintah baru.",
        );
        await clearContext(userId);
    }
  }

  /**
   * Handle amount input step
   */
  private static async handleAmountInputStep(
    message: Message,
    userId: string,
    _userRole: UserRole,
    input: string,
    context: ConversationContext,
  ): Promise<void> {
    // Check for cancel
    if (input.toLowerCase() === "batal" || input.toLowerCase() === "cancel") {
      await clearContext(userId);
      await message.reply("❌ Transaksi dibatalkan.");
      return;
    }

    // Validate amount
    const validation = TransactionValidator.validateAmount(input);
    if (!validation.valid || !validation.parsed) {
      await message.reply(
        "❌ Format jumlah tidak valid.\n\nContoh: 500000, 500.000, atau 500,000\n\nKetik 'batal' untuk membatalkan.",
      );
      return;
    }

    // Update context with amount
    // validation.parsed is already a number from TransactionValidator
    await updateContext(userId, {
      currentStep: 2,
      pendingTransaction: {
        ...context.pendingTransaction,
        amount: validation.parsed,
      },
    });

    // Get categories for transaction type
    const transactionType = context.pendingTransaction?.type || "expense";
    const categories = await CategoryModel.findByType(transactionType, true);

    if (categories.length === 0) {
      await message.reply(
        "❌ Tidak ada kategori tersedia. Silakan hubungi admin untuk menambahkan kategori.",
      );
      await clearContext(userId);
      return;
    }

    // Format category list
    const categoryOptions = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      emoji: transactionType === "income" ? "💰" : "💸",
    }));

    const categoryMsg = formatCategoryList(
      categoryOptions,
      `Pilih kategori ${transactionType === "income" ? "penjualan" : "pengeluaran"}:`,
    );

    await message.reply(categoryMsg);
  }

  /**
   * Handle category selection step
   */
  private static async handleCategorySelectionStep(
    message: Message,
    userId: string,
    _userRole: UserRole,
    input: string,
    context: ConversationContext,
  ): Promise<void> {
    // Check for cancel
    if (input.toLowerCase() === "batal" || input.toLowerCase() === "cancel") {
      await clearContext(userId);
      await message.reply("❌ Transaksi dibatalkan.");
      return;
    }

    const transactionType = context.pendingTransaction?.type || "expense";
    const categories = await CategoryModel.findByType(transactionType, true);

    // Try to parse as number (category index)
    const categoryIndex = parseInt(input, 10) - 1;
    let selectedCategory: { id: string; name: string } | null = null;

    if (
      !isNaN(categoryIndex) &&
      categoryIndex >= 0 &&
      categoryIndex < categories.length
    ) {
      selectedCategory = categories[categoryIndex];
    } else {
      // Try to find by name
      const found = categories.find(
        (cat) => cat.name.toLowerCase() === input.toLowerCase(),
      );
      if (found) {
        selectedCategory = found;
      }
    }

    if (!selectedCategory) {
      await message.reply(
        "❌ Kategori tidak valid. Silakan pilih nomor atau nama kategori yang tersedia.\n\nKetik 'batal' untuk membatalkan.",
      );
      return;
    }

    // Update context with category
    await updateContext(userId, {
      currentStep: 3,
      pendingTransaction: {
        ...context.pendingTransaction,
        category: selectedCategory.name,
      },
    });

    // Show confirmation
    const amount = context.pendingTransaction?.amount || 0;
    const typeLabel =
      transactionType === "income" ? "Penjualan" : "Pengeluaran";
    let confirmMsg = `📝 *Konfirmasi ${typeLabel}*\n\n`;
    confirmMsg += `Jumlah: Rp ${amount.toLocaleString("id-ID")}\n`;
    confirmMsg += `Kategori: ${selectedCategory.name}\n\n`;
    confirmMsg += `Ketik "ya" atau "setuju" untuk menyimpan, atau "batal" untuk membatalkan.`;

    await message.reply(confirmMsg);
  }

  /**
   * Handle confirmation step
   */
  private static async handleConfirmationStep(
    message: Message,
    userId: string,
    _userRole: UserRole,
    input: string,
    context: ConversationContext,
  ): Promise<void> {
    const confirmation = input.toLowerCase().trim();
    const confirmKeywords = ["ya", "yes", "setuju", "ok", "confirm", "simpan"];

    if (
      confirmation === "batal" ||
      confirmation === "cancel" ||
      confirmation === "tidak"
    ) {
      await clearContext(userId);
      await message.reply("❌ Transaksi dibatalkan.");
      return;
    }

    if (!confirmKeywords.includes(confirmation)) {
      await message.reply(
        '❌ Konfirmasi tidak valid. Ketik "ya" untuk menyimpan atau "batal" untuk membatalkan.',
      );
      return;
    }

    // T019: Create transaction
    const transactionType = context.pendingTransaction?.type || "expense";
    const amount = context.pendingTransaction?.amount;
    const category = context.pendingTransaction?.category;

    if (!amount || !category) {
      await message.reply(
        "❌ Data transaksi tidak lengkap. Silakan mulai lagi.",
      );
      await clearContext(userId);
      return;
    }

    const result = await TransactionProcessor.processTransaction({
      userId,
      type: transactionType as TransactionType,
      category,
      amount: amount.toString(),
      description: undefined,
    });

    if (result.success && result.transaction) {
      // Calculate new balance
      const newBalance = await this.calculateBalance(userId);

      // Send confirmation message
      const confirmMsg = formatTransactionConfirmation({
        amount,
        category,
        type: transactionType,
        newBalance,
      });

      await message.reply(confirmMsg);

      // Clear context
      await clearContext(userId);
    } else {
      await message.reply(
        `❌ Gagal menyimpan transaksi: ${result.error || "Unknown error"}`,
      );
      await clearContext(userId);
    }
  }

  /**
   * Handle view balance command
   */
  private static async handleViewBalanceCommand(
    message: Message,
    userId: string,
    _userRole: UserRole,
  ): Promise<void> {
    const balance = await this.calculateBalance(userId);
    const pendingCount = await this.getPendingTransactionCount(userId);
    const pendingAmount = await this.getPendingTransactionAmount(userId);

    const balanceMsg = formatBalanceMessage({
      balance,
      pendingCount,
      pendingAmount,
    });

    await message.reply(balanceMsg);
  }

  /**
   * Calculate current balance for user
   * Balance = sum of all income - sum of all expenses
   */
  private static async calculateBalance(userId: string): Promise<number> {
    try {
      const transactions = await TransactionModel.findByUserId(userId);
      let balance = 0;

      for (const tx of transactions) {
        if (tx.type === "income") {
          balance += tx.amount.toNumber();
        } else {
          balance -= tx.amount.toNumber();
        }
      }

      return balance;
    } catch (error) {
      logger.error("Error calculating balance", { error, userId });
      return 0;
    }
  }

  /**
   * Get pending transaction count
   */
  private static async getPendingTransactionCount(
    userId: string,
  ): Promise<number> {
    try {
      const transactions = await TransactionModel.findByUserId(userId, {
        limit: 1000,
      });
      return transactions.filter((tx) => tx.approvalStatus === "pending")
        .length;
    } catch (error) {
      logger.error("Error getting pending count", { error, userId });
      return 0;
    }
  }

  /**
   * Get pending transaction amount
   */
  private static async getPendingTransactionAmount(
    userId: string,
  ): Promise<number> {
    try {
      const transactions = await TransactionModel.findByUserId(userId, {
        limit: 1000,
      });
      const pending = transactions.filter(
        (tx) => tx.approvalStatus === "pending",
      );
      return pending.reduce((sum, tx) => {
        const amount = tx.amount.toNumber();
        return tx.type === "income" ? sum + amount : sum - amount;
      }, 0);
    } catch (error) {
      logger.error("Error getting pending amount", { error, userId });
      return 0;
    }
  }

  /**
   * T024: Log command execution
   */
  private static logCommand(
    userId: string,
    rawText: string,
    intent: string,
    confidence: number,
  ): void {
    try {
      logger.info("Command executed", {
        userId,
        commandText: rawText,
        recognizedIntent: intent,
        confidence,
        timestamp: new Date().toISOString(),
      });

      // TODO: Store in CommandLog table when data model is ready
      // For now, just log to Winston
    } catch (error) {
      logger.error("Error logging command", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        rawText,
      });
    }
  }

  /**
   * Format role name for display
   */
  private static formatRole(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      dev: "Developer/Admin",
      boss: "Boss/Manager",
      employee: "Employee",
      investor: "Investor",
    };
    return roleNames[role] || role;
  }
}

// Initialize command handler
CommandHandler.initialize();

export default CommandHandler;
