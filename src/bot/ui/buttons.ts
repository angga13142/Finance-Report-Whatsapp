import { Buttons } from "whatsapp-web.js";
import { UserRole } from "@prisma/client";
import { RBACService } from "../../services/user/rbac";
import { USER_ROLES, MAX_BUTTON_LABEL_LENGTH } from "../../config/constants";

/**
 * Button menu generation utilities
 */
export class ButtonMenu {
  /**
   * Generate main menu buttons based on user role
   */
  static generateMainMenu(role: UserRole): Buttons {
    const buttonSpecs: Array<{ id?: string; body: string }> = [];

    // Transaction buttons (for users who can create transactions)
    if (RBACService.canCreateTransaction(role)) {
      buttonSpecs.push({
        body: "💰 Catat Penjualan",
        id: this.getButtonId("💰 Catat Penjualan"),
      });
      buttonSpecs.push({
        body: "💸 Catat Pengeluaran",
        id: this.getButtonId("💸 Catat Pengeluaran"),
      });
    }

    // Report button (for all roles)
    if (RBACService.canViewReports(role)) {
      buttonSpecs.push({
        body: "📊 Lihat Laporan",
        id: this.getButtonId("📊 Lihat Laporan"),
      });
    }

    // Help button (for all roles)
    buttonSpecs.push({
      body: "❓ Bantuan",
      id: this.getButtonId("❓ Bantuan"),
    });

    // Admin buttons (for Dev/Boss)
    if (role === USER_ROLES.DEV || role === USER_ROLES.BOSS) {
      buttonSpecs.push({
        body: "⚙️ Pengaturan",
        id: this.getButtonId("⚙️ Pengaturan"),
      });
    }

    return new Buttons(
      "Apa yang ingin Anda lakukan?",
      buttonSpecs,
      "Selamat datang! Pilih menu:",
    );
  }

  /**
   * Generate transaction type selection buttons
   */
  static generateTransactionTypeMenu(): Buttons {
    return new Buttons(
      "Jenis transaksi apa yang ingin Anda catat?",
      [
        { body: "💰 Penjualan", id: "txn_type_income" },
        { body: "💸 Pengeluaran", id: "txn_type_expense" },
        { body: "🔙 Kembali", id: "menu_main" },
      ],
      "Pilih jenis transaksi:",
    );
  }

  /**
   * Generate confirmation buttons
   */
  static generateConfirmationButtons(): Buttons {
    return new Buttons(
      "Apakah data sudah benar?",
      [
        { body: "✅ Ya, Simpan", id: "txn_confirm_yes" },
        { body: "✏️ Edit Jumlah", id: "txn_edit_amount" },
        { body: "✏️ Edit Kategori", id: "txn_edit_category" },
        { body: "❌ Batal", id: "txn_cancel" },
      ],
      "Konfirmasi transaksi:",
    );
  }

  /**
   * Generate navigation buttons
   */
  static generateNavigationButtons(): Buttons {
    return new Buttons("", [
      { body: "🔙 Kembali", id: "nav_back" },
      { body: "🏠 Menu Utama", id: "menu_main" },
    ]);
  }

  /**
   * Generate error recovery buttons
   */
  static generateErrorRecoveryButtons(): Buttons {
    return new Buttons(
      "Silakan coba lagi atau kembali ke menu utama",
      [
        { body: "🔄 Coba Lagi", id: "error_retry" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Terjadi kesalahan",
    );
  }

  /**
   * Get button ID from label
   */
  static getButtonId(label: string): string {
    // Remove emoji and convert to lowercase with underscores
    const cleaned = label
      .replace(/[^\w\s]/g, "") // Remove emojis and special chars
      .toLowerCase()
      .replace(/\s+/g, "_")
      .substring(0, 50); // Limit length

    return cleaned;
  }

  /**
   * Fallback to numbered text menu if buttons fail
   */
  static generateTextMenu(items: string[]): string {
    let menu = "Pilih menu:\n\n";
    items.forEach((item, index) => {
      menu += `${index + 1}. ${item}\n`;
    });
    return menu;
  }

  /**
   * Validate button label length
   */
  static validateButtonLabel(label: string): boolean {
    return label.length <= MAX_BUTTON_LABEL_LENGTH;
  }
}

export default ButtonMenu;
