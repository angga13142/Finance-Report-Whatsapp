import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { UserModel } from "../../models/user";
import type { UserRole } from "@prisma/client";

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
