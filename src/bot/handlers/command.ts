import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { UserModel } from "../../models/user";
import type { UserRole, TransactionType } from "@prisma/client";
import { parseCommand, getCommandSuggestions } from "./command.parser";
import {
  COMMANDS,
  ROLE_COMMANDS,
  USER_ROLES,
  CONFIDENCE_THRESHOLD,
  type CommandName,
} from "../../config/constants";
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
  formatFinancialReport,
  formatHelpMessage,
} from "../ui/message.formatter";
import { CategoryModel } from "../../models/category";
import { TransactionProcessor } from "../../services/transaction/processor";
import { TransactionValidator } from "../../services/transaction/validator";
import { TransactionModel } from "../../models/transaction";
import { FinancialSummaryService } from "../../services/system/financial-summary";
import {
  getDayRangeWITA,
  getWeekRangeWITA,
  getMonthRangeWITA,
  formatDateWITA,
} from "../../lib/date";

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
    // Admin sub-commands
    this.aliasMap.set("config", "config");
    this.aliasMap.set("template", "template");
    this.aliasMap.set("role", "role");
    this.aliasMap.set("system", "system");
    this.aliasMap.set("cache", "cache");
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

        // Admin sub-commands (Dev only)
        case "config":
          await this.handleConfigCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "template":
          await this.handleTemplateCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "role":
          await this.handleRoleCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "system":
          await this.handleSystemCommand(
            message,
            user.id,
            user.role,
            parsed.args,
          );
          break;

        case "cache":
          await this.handleCacheCommand(
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
   * T046: Handle help command with role-filtered command list
   */
  private static async handleHelpCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    _args: string[],
  ): Promise<void> {
    logger.info("Handling help command", { userId, userRole });

    // Get available commands for this role
    const availableCommands = ROLE_COMMANDS[userRole] || [];

    // Build help commands list with descriptions
    const helpCommands: Array<{
      command: string;
      description: string;
      roleRestricted?: boolean;
      roleLabel?: string;
    }> = [];

    // Command descriptions mapping
    const commandDescriptions: Partial<Record<CommandName, string>> = {
      [COMMANDS.RECORD_SALE]: "Catat penjualan baru",
      [COMMANDS.RECORD_EXPENSE]: "Catat pengeluaran baru",
      [COMMANDS.VIEW_REPORT_TODAY]: "Lihat laporan hari ini",
      [COMMANDS.VIEW_REPORT_WEEK]: "Lihat laporan minggu ini",
      [COMMANDS.VIEW_REPORT_MONTH]: "Lihat laporan bulan ini",
      [COMMANDS.VIEW_BALANCE]: "Lihat saldo saat ini",
      [COMMANDS.CHECK_BALANCE]: "Cek saldo",
      [COMMANDS.HELP]: "Tampilkan bantuan",
      [COMMANDS.MENU]: "Tampilkan menu utama",
    };

    // Command display names (user-friendly)
    const commandDisplayNames: Partial<Record<CommandName, string>> = {
      [COMMANDS.RECORD_SALE]: "catat penjualan",
      [COMMANDS.RECORD_EXPENSE]: "catat pengeluaran",
      [COMMANDS.VIEW_REPORT_TODAY]: "lihat laporan hari ini",
      [COMMANDS.VIEW_REPORT_WEEK]: "lihat laporan minggu ini",
      [COMMANDS.VIEW_REPORT_MONTH]: "lihat laporan bulan ini",
      [COMMANDS.VIEW_BALANCE]: "lihat saldo",
      [COMMANDS.CHECK_BALANCE]: "cek saldo",
      [COMMANDS.HELP]: "bantu",
      [COMMANDS.MENU]: "menu",
    };

    // Build help commands list
    for (const cmd of availableCommands) {
      // Check if command is restricted to specific roles
      const isRestricted =
        userRole === USER_ROLES.BOSS &&
        (cmd === COMMANDS.RECORD_SALE || cmd === COMMANDS.RECORD_EXPENSE);

      const displayName = commandDisplayNames[cmd] || cmd;
      const description = commandDescriptions[cmd] || cmd;

      helpCommands.push({
        command: displayName,
        description,
        roleRestricted: isRestricted,
        roleLabel: isRestricted ? "Boss only" : undefined,
      });
    }

    // Format and send help message
    const helpMessage = formatHelpMessage(helpCommands);
    await message.reply(helpMessage);

    // Log help command usage
    this.logCommand(userId, message.body || "help", COMMANDS.HELP, 1.0);
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

    // Transaction creation handled by TransactionProcessor in handleTransactionWorkflow
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
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    // If no sub-command, show menu
    if (args.length === 0) {
      await AdminHandler.handleAdminMenu(message, userId, userRole);
      return;
    }

    // Route to appropriate sub-command handler
    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "menu":
        await AdminHandler.handleAdminMenu(message, userId, userRole);
        break;
      default:
        await message.reply(
          `❌ Admin sub-command tidak dikenal: \`${subCommand}\`\n\nGunakan /admin untuk melihat menu admin.`,
        );
    }
  }

  /**
   * Handle /config command - Configuration management (Dev only)
   */
  private static async handleConfigCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/config view <key>` atau `/config set <key> <value>`\n\n" +
          "Contoh:\n" +
          "`/config view REPORT_DELIVERY_TIME`\n" +
          "`/config set REPORT_DELIVERY_TIME 23:00`",
      );
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "view":
        if (args.length < 2) {
          await message.reply(
            "❌ Format: `/config view <key>`\n\nContoh: `/config view REPORT_DELIVERY_TIME`",
          );
          return;
        }
        await AdminHandler.handleConfigView(message, userId, userRole, args[1]);
        break;

      case "set":
        if (args.length < 3) {
          await message.reply(
            "❌ Format: `/config set <key> <value>`\n\nContoh: `/config set REPORT_DELIVERY_TIME 23:00`",
          );
          return;
        }
        await AdminHandler.handleConfigSet(
          message,
          userId,
          userRole,
          args[1],
          args.slice(2).join(" "),
        );
        break;

      default:
        await message.reply(
          `❌ Config sub-command tidak dikenal: \`${subCommand}\`\n\nGunakan: view atau set`,
        );
    }
  }

  /**
   * Handle /template command - Template management (Dev only)
   */
  private static async handleTemplateCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/template list`, `/template preview <name>`, atau `/template edit <name> <content>`\n\n" +
          "Contoh:\n" +
          "`/template list`\n" +
          "`/template preview welcome_message`\n" +
          "`/template edit welcome_message Hello {{name}}`",
      );
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "list":
        await AdminHandler.handleTemplateList(message, userId, userRole);
        break;

      case "preview":
        if (args.length < 2) {
          await message.reply(
            "❌ Format: `/template preview <name>`\n\nContoh: `/template preview welcome_message`",
          );
          return;
        }
        await AdminHandler.handleTemplatePreview(
          message,
          userId,
          userRole,
          args[1],
        );
        break;

      case "edit":
        if (args.length < 3) {
          await message.reply(
            "❌ Format: `/template edit <name> <content>`\n\nContoh: `/template edit welcome_message Hello {{name}}`",
          );
          return;
        }
        await AdminHandler.handleTemplateEdit(
          message,
          userId,
          userRole,
          args[1],
          args.slice(2).join(" "),
        );
        break;

      default:
        await message.reply(
          `❌ Template sub-command tidak dikenal: \`${subCommand}\`\n\nGunakan: list, preview, atau edit`,
        );
    }
  }

  /**
   * Handle /role command - Role management (Dev only)
   */
  private static async handleRoleCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    if (args.length < 3) {
      await message.reply(
        "❌ Format: `/role grant <phone> <role>` atau `/role revoke <phone> <role>`\n\n" +
          "Contoh:\n" +
          "`/role grant +6281234567890 boss`\n" +
          "`/role revoke +6281234567890 boss`",
      );
      return;
    }

    const subCommand = args[0].toLowerCase();
    const phoneNumber = args[1];
    const role = args[2] as UserRole;

    switch (subCommand) {
      case "grant":
        await AdminHandler.handleRoleGrant(
          message,
          userId,
          userRole,
          phoneNumber,
          role,
        );
        break;

      case "revoke":
        await AdminHandler.handleRoleRevoke(
          message,
          userId,
          userRole,
          phoneNumber,
          role,
        );
        break;

      default:
        await message.reply(
          `❌ Role sub-command tidak dikenal: \`${subCommand}\`\n\nGunakan: grant atau revoke`,
        );
    }
  }

  /**
   * Handle /system command - System diagnostics (Dev only)
   */
  private static async handleSystemCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    if (args.length === 0) {
      await message.reply(
        "❌ Format: `/system status` atau `/system logs [limit]`\n\n" +
          "Contoh:\n" +
          "`/system status`\n" +
          "`/system logs 50`",
      );
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "status":
        await AdminHandler.handleSystemStatus(message, userId, userRole);
        break;

      case "logs": {
        const limit = args.length > 1 ? parseInt(args[1], 10) : 50;
        await AdminHandler.handleSystemLogs(message, userId, userRole, limit);
        break;
      }

      default:
        await message.reply(
          `❌ System sub-command tidak dikenal: \`${subCommand}\`\n\nGunakan: status atau logs`,
        );
    }
  }

  /**
   * Handle /cache command - Cache management (Dev only)
   */
  private static async handleCacheCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    args: string[],
  ): Promise<void> {
    const { AdminHandler } = await import("./admin");

    if (args.length === 0 || args[0].toLowerCase() !== "clear") {
      await message.reply(
        "❌ Format: `/cache clear [pattern]`\n\n" +
          "Contoh:\n" +
          "`/cache clear` (clear all)\n" +
          "`/cache clear user:*` (clear by pattern)",
      );
      return;
    }

    const pattern = args.length > 1 ? args[1] : undefined;
    await AdminHandler.handleCacheClear(message, userId, userRole, pattern);
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
   * T068: Add performance monitoring for response times (simple <2s, data retrieval <5s)
   * Maps parsed intents from command.parser.ts to handler functions
   */
  static async routeCommandWithParser(
    message: Message,
    userId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    const startTime = Date.now();
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

        case COMMANDS.VIEW_REPORT_TODAY:
        case COMMANDS.VIEW_REPORT_WEEK:
        case COMMANDS.VIEW_REPORT_MONTH:
          await this.handleViewReportCommand(
            message,
            userId,
            userRole,
            parsed.recognizedIntent,
          );
          return true;

        case COMMANDS.HELP:
        case COMMANDS.MENU:
          await this.handleHelpCommand(message, userId, userRole, []);
          return true;

        default:
          // T045: Confidence-based error handling
          // ≥70% auto-execute (already handled above), <70% show suggestions
          if (parsed.confidence < CONFIDENCE_THRESHOLD) {
            const suggestions = getCommandSuggestions(rawText, 3);

            // T051: Log unrecognized command for analytics
            this.logCommand(userId, rawText, "unrecognized", parsed.confidence);

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

          // T051: Log unrecognized command even if confidence is high but command not found
          this.logCommand(userId, rawText, "unrecognized", parsed.confidence);

          // T068: Performance monitoring
          {
            const responseTime = Date.now() - startTime;
            logger.info("Command executed", {
              userId,
              command: "unrecognized",
              rawText,
              confidence: parsed.confidence,
              responseTime,
              result: "not_found",
            });
          }

          return false;
      }

      // T068: Performance monitoring for successful command execution
      // parsed is guaranteed to be non-null here due to early return check above
      {
        const responseTime = Date.now() - startTime;
        const dataRetrievalCommands = [
          COMMANDS.VIEW_REPORT_TODAY,
          COMMANDS.VIEW_REPORT_WEEK,
          COMMANDS.VIEW_REPORT_MONTH,
          COMMANDS.VIEW_BALANCE,
          COMMANDS.CHECK_BALANCE,
        ] as string[];
        const isDataRetrieval = dataRetrievalCommands.includes(
          parsed!.recognizedIntent,
        );

        const targetTime = isDataRetrieval ? 5000 : 2000; // 5s for data retrieval, 2s for simple

        // T070: Structured logging with context (userId, command, result, latency)
        logger.info("Command executed", {
          userId,
          command: parsed!.recognizedIntent,
          rawText,
          confidence: parsed!.confidence,
          responseTime,
          targetTime,
          isDataRetrieval,
          result: "success",
        });

        if (responseTime > targetTime) {
          logger.warn("Command response time exceeds target", {
            userId,
            command: parsed!.recognizedIntent,
            responseTime,
            targetTime,
            isDataRetrieval,
          });
        }
      }

      return true;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      // T070: Structured logging with context for errors
      logger.error("Error routing command with parser", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        command: parsed?.recognizedIntent || "unknown",
        rawText,
        responseTime,
        result: "error",
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

      default: {
        // T049: Provide contextual suggestion based on conversation context
        const suggestion = this._getContextualSuggestion(context);
        const errorMsg = suggestion
          ? `❌ Sesi tidak valid. ${suggestion}`
          : "❌ Sesi tidak valid. Silakan mulai lagi dengan perintah baru.";
        await message.reply(errorMsg);
        await clearContext(userId);
        break;
      }
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
      // T050: Command syntax error handling with examples
      await message.reply(
        this.formatSyntaxErrorMessage(
          "Format jumlah tidak valid",
          ["500000", "500.000", "500,000", "Rp 500000", "500000 rupiah"],
          "Masukkan jumlah dalam format angka",
        ),
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
      // T050: Command syntax error handling with examples
      // T049: Contextual suggestion for category selection
      const categoryNames = categories
        .slice(0, 5)
        .map((cat, idx) => `${idx + 1}. ${cat.name}`)
        .join("\n");
      await message.reply(
        this.formatSyntaxErrorMessage(
          "Kategori tidak valid",
          categoryNames.split("\n"),
          "Pilih nomor atau nama kategori yang tersedia",
        ) +
          `\n\n*Kategori tersedia:*\n${categoryNames}\n\nKetik 'batal' untuk membatalkan.`,
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
   * T035: Handle view report command for date ranges
   * T038: Integrate financial summary service with report command handlers
   */
  private static async handleViewReportCommand(
    message: Message,
    userId: string,
    userRole: UserRole,
    command: string,
  ): Promise<void> {
    try {
      // Determine date range from command
      let dateRange: string;
      let startDate: Date;
      let endDate: Date;

      if (command === COMMANDS.VIEW_REPORT_TODAY) {
        ({ start: startDate, end: endDate } = getDayRangeWITA());
        dateRange = formatDateWITA(startDate, "dd MMMM yyyy");
      } else if (command === COMMANDS.VIEW_REPORT_WEEK) {
        ({ start: startDate, end: endDate } = getWeekRangeWITA());
        dateRange = `${formatDateWITA(startDate, "dd MMM")} - ${formatDateWITA(endDate, "dd MMM yyyy")}`;
      } else if (command === COMMANDS.VIEW_REPORT_MONTH) {
        ({ start: startDate, end: endDate } = getMonthRangeWITA());
        dateRange = formatDateWITA(startDate, "MMMM yyyy");
      } else {
        // Default to today
        ({ start: startDate, end: endDate } = getDayRangeWITA());
        dateRange = formatDateWITA(startDate, "dd MMMM yyyy");
      }

      // Check for refresh flag in message body
      const messageBody = message.body.toLowerCase().trim();
      const refresh =
        messageBody.includes("refresh") || messageBody.includes("update");

      // Get financial summary
      const summary = await FinancialSummaryService.getFinancialSummary(
        userId,
        userRole,
        startDate,
        endDate,
        refresh, // T039: On-demand cache refresh mechanism
      );

      // Format and send report
      const reportMessage = formatFinancialReport({
        balance: summary.balance,
        income: summary.income,
        expenses: summary.expenses,
        cashflow: summary.cashflow,
        pendingCount: summary.pendingCount,
        categoryBreakdown: summary.categoryBreakdown, // T074: Category breakdown
        savingsGoal: summary.savingsGoal, // T073: Savings goals
        dateRange,
        trends: summary.trendData
          ? {
              incomeChange: summary.trendData.incomeChange,
              expenseChange: summary.trendData.expenseChange,
              cashflowChange: summary.trendData.cashflowChange,
            }
          : undefined,
      });

      await message.reply(reportMessage);

      // Log command execution
      this.logCommand(userId, message.body, command, 1.0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error handling view report command", {
        error: errorMessage,
        userId,
        command,
      });
      await message.reply(
        "❌ Terjadi kesalahan saat mengambil laporan. Silakan coba lagi.",
      );
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

      // Command logging: Currently logs to Winston. CommandLog table to be added in future data model update.
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
   * T049: Provide contextual suggestions based on conversation context
   * This method can be used to provide contextual help during multi-step workflows
   * Currently available for future use in error messages or help prompts
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _getContextualSuggestion(
    context: ConversationContext,
  ): string | null {
    const step = context.currentStep || 1;
    const transactionType = context.pendingTransaction?.type;

    switch (step) {
      case 1:
        // Step 1: Amount input
        return "Masukkan jumlah transaksi (contoh: 500000 atau 500.000)";
      case 2: {
        // Step 2: Category selection
        const typeLabel =
          transactionType === "income" ? "penjualan" : "pengeluaran";
        return `Pilih kategori ${typeLabel} dengan mengetik nomor atau nama kategori`;
      }
      case 3:
        // Step 3: Confirmation
        return 'Ketik "ya" atau "setuju" untuk menyimpan, atau "batal" untuk membatalkan';
      default:
        return null;
    }
  }

  /**
   * T050: Format syntax error message with examples and rephrase suggestions
   */
  private static formatSyntaxErrorMessage(
    errorMessage: string,
    examples: string[],
    suggestion?: string,
  ): string {
    let message = `❌ *${errorMessage}*\n\n`;

    if (suggestion) {
      message += `💡 *Saran:* ${suggestion}\n\n`;
    }

    if (examples.length > 0) {
      message += `*Contoh yang benar:*\n`;
      examples.forEach((example, index) => {
        message += `${index + 1}. ${example}\n`;
      });
      message += `\n`;
    }

    message += `_Ketik 'batal' untuk membatalkan._`;

    return message;
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
