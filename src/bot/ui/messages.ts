import { formatCurrency } from "../../lib/currency";
import { formatDateWITA } from "../../lib/date";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { USER_ROLES } from "../../config/constants";

/**
 * Message formatting utilities (Indonesian)
 */
export class MessageFormatter {
  /**
   * Format welcome message
   */
  static formatWelcomeMessage(role: UserRole, userName?: string): string {
    const greeting = userName ? `Halo ${userName}!` : "Halo!";
    const roleLabel = this.getRoleLabel(role);

    return (
      `${greeting}\n\n` +
      `Selamat datang di WhatsApp Cashflow Bot.\n` +
      `Anda login sebagai: ${roleLabel}\n\n` +
      `Gunakan tombol di bawah untuk memulai.`
    );
  }

  /**
   * Format transaction confirmation message
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
    const amount = formatCurrency(data.amount);
    const date = formatDateWITA(new Date());
    const desc = data.description ? `\nCatatan: ${data.description}` : "";

    return (
      `📋 Konfirmasi Transaksi\n\n` +
      `${typeLabel}\n` +
      `Kategori: ${data.category}\n` +
      `Jumlah: ${amount}\n` +
      `Tanggal: ${date}${desc}\n\n` +
      `Apakah data sudah benar?`
    );
  }

  /**
   * Format success message
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
    const amount = formatCurrency(transaction.amount);
    const typeLabel =
      transaction.type === "income" ? "Pemasukan" : "Pengeluaran";
    const timestamp =
      transaction.timestamp instanceof Date
        ? transaction.timestamp
        : new Date(transaction.timestamp);

    let message =
      `✅ Transaksi berhasil disimpan!\n\n` +
      `${typeLabel}: ${transaction.category}\n` +
      `Jumlah: ${amount}\n` +
      `Tanggal: ${formatDateWITA(timestamp)}\n`;

    if (dailyTotal) {
      message += `\n${dailyTotal}`;
    }

    message += `\n\nTerima kasih!`;

    return message;
  }

  /**
   * Format error message
   */
  static formatErrorMessage(error: string): string {
    return `❌ Terjadi kesalahan\n\n${error}\n\nSilakan coba lagi atau hubungi admin.`;
  }

  /**
   * Format help message
   */
  static formatHelpMessage(role: UserRole): string {
    const roleHelp = this.getRoleHelp(role);

    return (
      `❓ Bantuan\n\n` +
      `Cara menggunakan bot:\n\n` +
      `1. Gunakan tombol untuk navigasi\n` +
      `2. Pilih kategori dari daftar\n` +
      `3. Masukkan jumlah (contoh: 500000 atau 500.000)\n` +
      `4. Konfirmasi transaksi\n\n` +
      `${roleHelp}\n\n` +
      `Untuk bantuan lebih lanjut, hubungi admin.`
    );
  }

  /**
   * Format amount input prompt
   */
  static formatAmountInputPrompt(
    category: string,
    lastAmount?: string,
  ): string {
    let message = `💰 Masukkan Jumlah\n\n` + `Kategori: ${category}\n\n`;

    if (lastAmount) {
      message += `Jumlah terakhir: ${formatCurrency(lastAmount)}\n\n`;
    }

    message +=
      `Masukkan jumlah (contoh: 500000 atau 500.000)\n` +
      `Atau ketik "batal" untuk membatalkan.`;

    return message;
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
}

export default MessageFormatter;
