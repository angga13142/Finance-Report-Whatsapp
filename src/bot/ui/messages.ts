import { formatDateWITA } from "../../lib/date";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { USER_ROLES } from "../../config/constants";
import { FontFormatter, FontStyle } from "../../lib/font-formatter";

/**
 * Message formatting utilities (Indonesian)
 */
export class MessageFormatter {
  /**
   * Format welcome message with enhanced formatting
   */
  static formatWelcomeMessage(role: UserRole, userName?: string): string {
    const greeting = userName ? `Halo ${userName}!` : "Halo!";
    const roleLabel = this.getRoleLabel(role);
    const roleLabelFormatted = FontFormatter.convert(roleLabel, FontStyle.BOLD);

    const message =
      `${greeting}\n\n` +
      `${FontFormatter.convert("Selamat datang di WhatsApp Cashflow Bot.", FontStyle.BOLD)}\n` +
      `Anda login sebagai: ${roleLabelFormatted}\n\n` +
      `Gunakan tombol di bawah untuk memulai.`;

    return this.applyLengthLimit(message);
  }

  /**
   * Format transaction confirmation message with enhanced formatting
   */
  static formatConfirmationMessage(data: {
    type: "income" | "expense";
    category: string;
    amount: string | number;
    description?: string;
    userName?: string;
  }): string {
    const typeLabel =
      data.type === "income" ? "💰 Penjualan" : "💸 Pengeluaran";
    const date = formatDateWITA(new Date());
    const desc = data.description ? `\nCatatan: ${data.description}` : "";

    // Apply visual hierarchy: bold header, monospace numeric
    const header = FontFormatter.convert(
      "📋 Konfirmasi Transaksi",
      FontStyle.BOLD,
    );
    const typeLabelFormatted = FontFormatter.convert(typeLabel, FontStyle.BOLD);
    const amountFormatted = FontFormatter.formatCurrency(
      typeof data.amount === "string" ? parseFloat(data.amount) : data.amount,
    );
    const amountMonospace = FontFormatter.convert(
      amountFormatted.replace("Rp ", ""),
      FontStyle.MONOSPACE,
    );
    const amountFinal = `Rp ${amountMonospace}`;

    const message =
      `${header}\n\n` +
      `${typeLabelFormatted}\n` +
      `Kategori: ${data.category}\n` +
      `Jumlah: ${amountFinal}\n` +
      `Tanggal: ${date}${desc}\n\n` +
      `Apakah data sudah benar?`;

    // Apply message length limit
    return this.applyLengthLimit(message);
  }

  /**
   * Format success message with enhanced formatting
   */
  static formatSuccessMessage(
    transaction: {
      amount: string | number | Decimal;
      type: string;
      category: string;
      timestamp: Date | string;
    },
    dailyTotal?: string,
  ): string {
    const amountNum =
      transaction.amount instanceof Decimal
        ? transaction.amount.toNumber()
        : typeof transaction.amount === "string"
          ? parseFloat(transaction.amount)
          : transaction.amount;
    const amountFormatted = FontFormatter.formatCurrency(amountNum);
    const amountMonospace = FontFormatter.convert(
      amountFormatted.replace("Rp ", ""),
      FontStyle.MONOSPACE,
    );
    const amountFinal = `Rp ${amountMonospace}`;

    const typeLabel =
      transaction.type === "income" ? "Pemasukan" : "Pengeluaran";
    const typeLabelFormatted = FontFormatter.convert(typeLabel, FontStyle.BOLD);
    const timestamp =
      transaction.timestamp instanceof Date
        ? transaction.timestamp
        : new Date(transaction.timestamp);

    let message =
      `✅ ${FontFormatter.convert("Transaksi berhasil disimpan!", FontStyle.BOLD)}\n\n` +
      `${typeLabelFormatted}: ${transaction.category}\n` +
      `Jumlah: ${amountFinal}\n` +
      `Tanggal: ${formatDateWITA(timestamp)}\n`;

    if (dailyTotal) {
      message += `\n${dailyTotal}`;
    }

    message += `\n\nTerima kasih!`;

    return this.applyLengthLimit(message);
  }

  /**
   * Format error message with enhanced formatting
   */
  static formatErrorMessage(error: string): string {
    const header = FontFormatter.convert(
      "❌ Terjadi kesalahan",
      FontStyle.BOLD,
    );
    const message = `${header}\n\n${error}\n\nSilakan coba lagi atau hubungi admin.`;
    return this.applyLengthLimit(message);
  }

  /**
   * Format help message with enhanced formatting
   */
  static formatHelpMessage(role: UserRole): string {
    const roleHelp = this.getRoleHelp(role);

    const header = FontFormatter.convert("❓ Bantuan", FontStyle.BOLD);
    const sectionHeader = FontFormatter.convert(
      "Cara menggunakan bot:",
      FontStyle.BOLD,
    );
    const exampleAmount = FontFormatter.convert("500000", FontStyle.MONOSPACE);
    const exampleAmount2 = FontFormatter.convert(
      "500.000",
      FontStyle.MONOSPACE,
    );

    const message =
      `${header}\n\n` +
      `${sectionHeader}\n\n` +
      `1. Gunakan tombol untuk navigasi\n` +
      `2. Pilih kategori dari daftar\n` +
      `3. Masukkan jumlah (contoh: ${exampleAmount} atau ${exampleAmount2})\n` +
      `4. Konfirmasi transaksi\n\n` +
      `${roleHelp}\n\n` +
      `Untuk bantuan lebih lanjut, hubungi admin.`;

    return this.applyLengthLimit(message);
  }

  /**
   * Format amount input prompt with enhanced formatting
   */
  static formatAmountInputPrompt(
    category: string,
    lastAmount?: string,
  ): string {
    const header = FontFormatter.convert("💰 Masukkan Jumlah", FontStyle.BOLD);
    let message = `${header}\n\n` + `Kategori: ${category}\n\n`;

    if (lastAmount) {
      const lastAmountNum =
        typeof lastAmount === "string" ? parseFloat(lastAmount) : lastAmount;
      const lastAmountFormatted = FontFormatter.formatCurrency(lastAmountNum);
      const lastAmountMonospace = FontFormatter.convert(
        lastAmountFormatted.replace("Rp ", ""),
        FontStyle.MONOSPACE,
      );
      message += `Jumlah terakhir: Rp ${lastAmountMonospace}\n\n`;
    }

    const example1 = FontFormatter.convert("500000", FontStyle.MONOSPACE);
    const example2 = FontFormatter.convert("500.000", FontStyle.MONOSPACE);
    message +=
      `Masukkan jumlah (contoh: ${example1} atau ${example2})\n` +
      `Atau ketik "batal" untuk membatalkan.`;

    return this.applyLengthLimit(message);
  }

  /**
   * Format category selection prompt
   */
  static formatCategoryPrompt(type: "income" | "expense"): string {
    const typeLabel = type === "income" ? "penjualan" : "pengeluaran";
    return `Pilih kategori ${typeLabel}:\n\nGunakan daftar di atas atau ketik nama kategori.`;
  }

  /**
   * Get role label in Indonesian
   */
  static getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      [USER_ROLES.DEV]: "Developer",
      [USER_ROLES.BOSS]: "Boss/Manager",
      [USER_ROLES.EMPLOYEE]: "Karyawan",
      [USER_ROLES.INVESTOR]: "Investor",
    };
    return labels[role] || role;
  }

  /**
   * Get role-specific help text
   */
  static getRoleHelp(role: UserRole): string {
    const helpTexts: Record<UserRole, string> = {
      [USER_ROLES.DEV]:
        "Sebagai Developer, Anda memiliki akses penuh ke semua fitur sistem.",
      [USER_ROLES.BOSS]:
        "Sebagai Boss, Anda dapat melihat semua transaksi, laporan, dan mengelola karyawan.",
      [USER_ROLES.EMPLOYEE]:
        "Sebagai Karyawan, Anda dapat mencatat transaksi dan melihat laporan pribadi.",
      [USER_ROLES.INVESTOR]:
        "Sebagai Investor, Anda dapat melihat laporan agregat dan analisis keuangan.",
    };
    return helpTexts[role] || "";
  }

  /**
   * Format invalid input message
   */
  static formatInvalidInputMessage(field: string, examples: string[]): string {
    return (
      `❌ Input tidak valid: ${field}\n\n` +
      `Contoh format yang benar:\n` +
      examples.map((ex) => `• ${ex}`).join("\n") +
      `\n\nSilakan coba lagi.`
    );
  }

  /**
   * Format session expired message
   */
  static formatSessionExpiredMessage(): string {
    return (
      `⏰ Sesi Anda telah berakhir.\n\n` + `Silakan mulai lagi dari menu utama.`
    );
  }

  /**
   * Format numbered menu selection help
   */
  static formatNumberedMenuHelp(): string {
    return (
      `💡 *Cara Menggunakan Menu:*\n\n` +
      `1️⃣ Ketik nomor menu yang ingin dipilih (1, 2, 3, dst)\n` +
      `2️⃣ Atau gunakan command dengan / (contoh: /menu, /help)\n` +
      `3️⃣ Atau klik button jika tersedia\n\n` +
      `_Ketik /help untuk panduan lengkap_`
    );
  }

  /**
   * Format button fallback notice
   */
  static formatButtonFallbackNotice(): string {
    return (
      `ℹ️ Button tidak tersedia di device Anda.\n` +
      `Gunakan nomor (1, 2, 3, dst) atau command (/) untuk navigasi.\n\n` +
      `Ketik /help untuk panduan.`
    );
  }

  /**
   * Format invalid selection message
   */
  static formatInvalidSelectionMessage(maxOptions: number): string {
    return (
      `❌ Pilihan tidak valid.\n\n` +
      `Silakan ketik nomor 1-${maxOptions} atau gunakan command.\n` +
      `Ketik /menu untuk kembali ke menu utama.`
    );
  }

  /**
   * Error message catalog (Indonesian)
   */
  static getErrorMessage(
    errorType: string,
    context?: Record<string, unknown>,
  ): string {
    const errors: Record<string, string> = {
      // General errors
      unknown:
        "❌ *Terjadi Kesalahan*\n\nMaaf, terjadi kesalahan yang tidak terduga.\nSilakan coba lagi atau hubungi admin jika masalah berlanjut.",

      network:
        "🌐 *Koneksi Bermasalah*\n\nTidak dapat terhubung ke server.\nPeriksa koneksi internet Anda dan coba lagi.",

      timeout:
        "⏱️ *Request Timeout*\n\nPermintaan memakan waktu terlalu lama.\nSilakan coba lagi dengan koneksi yang lebih stabil.",

      // Authentication errors
      unauthorized:
        "🔒 *Akses Ditolak*\n\nAnda tidak memiliki izin untuk operasi ini.\nSilakan hubungi admin untuk bantuan.",

      session_expired:
        "⏰ *Sesi Berakhir*\n\nSesi Anda telah berakhir.\nSilakan mulai lagi dengan mengetik /start atau /menu.",

      user_not_found:
        "👤 *User Tidak Ditemukan*\n\nAkun Anda tidak terdaftar dalam sistem.\nSilakan registrasi terlebih dahulu atau hubungi admin.",

      // Input validation errors
      invalid_input:
        "❌ *Input Tidak Valid*\n\nFormat input Anda tidak sesuai.\nPeriksa kembali dan pastikan format sudah benar.",

      invalid_amount: `💰 *Jumlah Tidak Valid*\n\nJumlah harus berupa angka positif.\n\n*Contoh yang benar:*\n• 50000\n• 1000000\n• 250000.50`,

      invalid_category:
        "📁 *Kategori Tidak Valid*\n\nKategori harus diisi dan tidak boleh kosong.\n\n*Contoh kategori:*\n• Sales\n• Transport\n• Office Supplies\n• Marketing",

      invalid_date:
        "📅 *Format Tanggal Salah*\n\nFormat tanggal tidak valid.\n\n*Format yang benar:*\n• DD/MM/YYYY (contoh: 10/12/2025)\n• YYYY-MM-DD (contoh: 2025-12-10)",

      invalid_command:
        "❓ *Command Tidak Dikenal*\n\nCommand yang Anda ketik tidak ditemukan.\n\nKetik /help untuk melihat daftar command.",

      // Transaction errors
      transaction_failed:
        "💸 *Transaksi Gagal*\n\nGagal menyimpan transaksi.\nSilakan coba lagi atau hubungi admin.",

      duplicate_transaction:
        "⚠️ *Transaksi Duplikat*\n\nTransaksi serupa baru saja dicatat.\nApakah Anda yakin ingin mencatat transaksi ini lagi?",

      transaction_not_found:
        "🔍 *Transaksi Tidak Ditemukan*\n\nTransaksi yang Anda cari tidak ada dalam sistem.",

      approval_failed:
        "⏳ *Approval Gagal*\n\nGagal memproses approval transaksi.\nSilakan coba lagi.",

      // Report errors
      report_generation_failed:
        "📊 *Gagal Generate Laporan*\n\nTerjadi kesalahan saat membuat laporan.\nSilakan coba lagi dalam beberapa saat.",

      no_data_available:
        "📭 *Tidak Ada Data*\n\nTidak ada data untuk periode yang dipilih.\nCoba pilih periode lain.",

      export_failed:
        "📄 *Export Gagal*\n\nGagal export laporan ke Excel.\nSilakan coba lagi.",

      // Database errors
      database_error:
        "💾 *Database Error*\n\nTerjadi kesalahan pada database.\nSilakan coba lagi atau hubungi admin.",

      connection_failed:
        "🔌 *Koneksi Database Gagal*\n\nTidak dapat terhubung ke database.\nSilakan coba lagi.",

      // WhatsApp errors
      message_send_failed:
        "📱 *Gagal Kirim Pesan*\n\nTidak dapat mengirim pesan.\nPeriksa koneksi WhatsApp Anda.",

      button_not_supported:
        "🔘 *Button Tidak Didukung*\n\nDevice Anda tidak mendukung button.\nGunakan nomor (1, 2, 3) atau command (/) untuk navigasi.",

      media_not_supported:
        "🖼️ *Media Tidak Didukung*\n\nMaaf, bot ini hanya menerima pesan teks.\n\nGunakan format teks untuk mencatat transaksi:\n`/catat [type] [amount] [category] [description]`",

      // Rate limiting
      rate_limit_exceeded:
        "⏸️ *Terlalu Banyak Request*\n\nAnda mengirim terlalu banyak pesan dalam waktu singkat.\nTunggu beberapa detik sebelum mencoba lagi.",

      // System errors
      service_unavailable:
        "🚧 *Layanan Sedang Maintenance*\n\nSistem sedang dalam maintenance.\nSilakan coba lagi nanti.",

      feature_disabled:
        "🔒 *Fitur Dinonaktifkan*\n\nFitur ini sedang dinonaktifkan oleh admin.\nHubungi admin untuk informasi lebih lanjut.",
    };

    let message = errors[errorType] || errors.unknown;

    // Add context-specific information
    if (context) {
      if (context.field && typeof context.field === "string") {
        message += `\n\n*Field:* ${context.field}`;
      }
      if (context.value && typeof context.value === "string") {
        message += `\n*Value:* ${context.value}`;
      }
      if (context.hint && typeof context.hint === "string") {
        message += `\n\n💡 *Tip:* ${context.hint}`;
      }
    }

    return message;
  }

  /**
   * Format error with recovery options
   */
  static formatErrorWithRecovery(
    errorType: string,
    context?: Record<string, unknown>,
  ): string {
    let message = this.getErrorMessage(errorType, context);

    message += `\n\n_Pilih aksi selanjutnya dengan button di bawah_`;
    message += `\n_atau ketik /menu untuk kembali ke menu utama_`;

    return message;
  }

  /**
   * Format validation error with examples
   */
  static formatValidationError(
    field: string,
    value: string,
    examples: string[],
  ): string {
    let message = `❌ *Input Tidak Valid: ${field}*\n\n`;
    message += `Value yang Anda masukkan: \`${value}\`\n\n`;
    message += `*Contoh format yang benar:*\n`;
    examples.forEach((example, index) => {
      message += `${index + 1}. ${example}\n`;
    });
    message += `\nSilakan coba lagi dengan format yang benar.`;

    return message;
  }

  /**
   * Format WhatsApp session error
   */
  static formatSessionError(status: string): string {
    const statusMessages: Record<string, string> = {
      disconnected:
        "🔌 *WhatsApp Terputus*\n\nKoneksi WhatsApp terputus.\nSistem sedang mencoba reconnect otomatis...",

      reconnecting:
        "🔄 *Reconnecting...*\n\nSedang mencoba terhubung kembali ke WhatsApp.\nMohon tunggu sebentar...",

      reconnected:
        "✅ *Berhasil Terhubung*\n\nKoneksi WhatsApp berhasil dipulihkan.\nAnda dapat melanjutkan aktivitas.",

      failed:
        "❌ *Koneksi Gagal*\n\nGagal terhubung ke WhatsApp setelah beberapa percobaan.\nSilakan restart bot atau hubungi admin.",

      qr_required:
        "📱 *Scan QR Required*\n\nSilakan scan QR code untuk login ke WhatsApp.\nCek terminal untuk melihat QR code.",
    };

    return statusMessages[status] || statusMessages.failed;
  }

  /**
   * Apply message length limit (4096 characters) with truncation
   * Preserves formatting structure while truncating
   */
  static applyLengthLimit(message: string, maxLength: number = 4096): string {
    if (message.length <= maxLength) {
      return message;
    }

    // Try to truncate at a newline to preserve formatting
    const truncated = message.substring(0, maxLength - 3);
    const lastNewline = truncated.lastIndexOf("\n");

    if (lastNewline > maxLength * 0.8) {
      // Truncate at newline if it's not too early
      return message.substring(0, lastNewline) + "\n...";
    }

    // Otherwise truncate and add ellipsis
    return truncated + "...";
  }

  /**
   * Format retry suggestion
   */
  static formatRetryMessage(
    attemptNumber: number,
    maxAttempts: number,
  ): string {
    const header = FontFormatter.convert(
      `🔄 Mencoba Ulang (${attemptNumber}/${maxAttempts})`,
      FontStyle.BOLD,
    );
    const message =
      `${header}\n\n` +
      `Operasi gagal, mencoba ulang otomatis...\n` +
      `Mohon tunggu sebentar.`;
    return this.applyLengthLimit(message);
  }

  /**
   * Format success recovery message
   */
  static formatRecoverySuccessMessage(): string {
    const header = FontFormatter.convert(
      "✅ Berhasil Dipulihkan",
      FontStyle.BOLD,
    );
    const message =
      `${header}\n\n` +
      `Operasi berhasil setelah retry.\n` +
      `Terima kasih atas kesabaran Anda.`;
    return this.applyLengthLimit(message);
  }
}

export default MessageFormatter;
