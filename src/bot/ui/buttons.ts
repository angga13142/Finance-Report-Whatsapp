import { Buttons } from "whatsapp-web.js";
import { UserRole } from "@prisma/client";
import { RBACService } from "../../services/user/rbac";
import { USER_ROLES, MAX_BUTTON_LABEL_LENGTH } from "../../config/constants";
import { configService } from "../../services/system/config";

/**
 * Button menu generation utilities
 */
export class ButtonMenu {
  /**
   * T056: Generate main menu buttons based on user role
   * Checks ENABLE_LEGACY_BUTTONS flag before rendering buttons
   */
  static generateMainMenu(role: UserRole, userId?: string): Buttons | null {
    // T056: Check ENABLE_LEGACY_BUTTONS flag before rendering buttons
    const enableLegacyButtons = configService.getEnableLegacyButtons(
      userId,
      role,
    );
    if (!enableLegacyButtons) {
      return null; // Buttons disabled, return null to indicate no buttons should be rendered
    }
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
   * Generate confirmation buttons with edit options
   */
  static generateConfirmationButtons(hasDescription = false): Buttons {
    const buttons = [
      { body: "✅ Ya, Simpan", id: "txn_confirm_yes" },
      { body: "✏️ Edit Jumlah", id: "txn_edit_amount" },
      { body: "✏️ Edit Kategori", id: "txn_edit_category" },
    ];

    // Add edit description button if there's a description
    if (hasDescription) {
      buttons.push({ body: "✏️ Edit Catatan", id: "txn_edit_description" });
    } else {
      buttons.push({ body: "➕ Tambah Catatan", id: "txn_add_description" });
    }

    buttons.push({ body: "❌ Batal", id: "txn_cancel" });

    return new Buttons(
      "Apakah data sudah benar?",
      buttons,
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
  static generateErrorRecoveryButtons(context?: string): Buttons {
    return new Buttons(
      "Silakan coba lagi atau kembali ke menu utama",
      [
        {
          body: "🔄 Coba Lagi",
          id: context ? `retry_${context}` : "error_retry",
        },
        { body: "🏠 Menu Utama", id: "menu_main" },
        { body: "❓ Bantuan", id: "help" },
      ],
      "Terjadi kesalahan",
    );
  }

  /**
   * Generate validation error buttons with examples
   */
  static generateValidationErrorButtons(): Buttons {
    return new Buttons(
      "Perbaiki input Anda",
      [
        { body: "📖 Lihat Contoh", id: "show_examples" },
        { body: "🔄 Coba Lagi", id: "error_retry" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Input tidak valid",
    );
  }

  /**
   * Generate transaction error recovery buttons
   */
  static generateTransactionErrorButtons(): Buttons {
    return new Buttons(
      "Pilih aksi untuk transaksi",
      [
        { body: "🔄 Coba Lagi", id: "retry_transaction" },
        { body: "✏️ Edit Data", id: "edit_transaction" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Transaksi gagal",
    );
  }

  /**
   * Generate report error recovery buttons
   */
  static generateReportErrorButtons(): Buttons {
    return new Buttons(
      "Pilih aksi untuk laporan",
      [
        { body: "🔄 Coba Lagi", id: "retry_report" },
        { body: "📅 Ganti Period", id: "change_period" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Laporan gagal",
    );
  }

  /**
   * Generate session error recovery buttons
   */
  static generateSessionErrorButtons(): Buttons {
    return new Buttons(
      "Sesi berakhir atau terputus",
      [
        { body: "🔄 Reconnect", id: "session_reconnect" },
        { body: "🆕 Mulai Baru", id: "session_restart" },
        { body: "❓ Bantuan", id: "help" },
      ],
      "Session error",
    );
  }

  /**
   * Generate database error recovery buttons
   */
  static generateDatabaseErrorButtons(): Buttons {
    return new Buttons(
      "Masalah koneksi database",
      [
        { body: "🔄 Coba Lagi", id: "retry_database" },
        { body: "⏰ Tunggu & Retry", id: "wait_retry" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Database error",
    );
  }

  /**
   * Generate permission error buttons
   */
  static generatePermissionErrorButtons(): Buttons {
    return new Buttons(
      "Anda tidak memiliki akses",
      [
        { body: "ℹ️ Info Role", id: "show_role_info" },
        { body: "📞 Hubungi Admin", id: "contact_admin" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Akses ditolak",
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
   * Generate numbered text menu with title and footer
   */
  static generateNumberedTextMenu(
    title: string,
    items: Array<{ label: string; id: string }>,
    footer?: string,
  ): string {
    let menu = `📋 *${title}*\n\n`;

    items.forEach((item, index) => {
      menu += `${index + 1}. ${item.label}\n`;
    });

    if (footer) {
      menu += `\n${footer}`;
    } else {
      menu += `\n_Ketik nomor (1-${items.length}) untuk memilih_`;
    }

    return menu;
  }

  /**
   * Generate role-specific text menu as fallback
   */
  static generateRoleTextMenu(role: UserRole): string {
    const items: Array<{ label: string; id: string }> = [];

    // Transaction options
    if (RBACService.canCreateTransaction(role)) {
      items.push({
        label: "💰 Catat Penjualan",
        id: this.getButtonId("💰 Catat Penjualan"),
      });
      items.push({
        label: "💸 Catat Pengeluaran",
        id: this.getButtonId("💸 Catat Pengeluaran"),
      });
    }

    // Report options
    if (RBACService.canViewReports(role)) {
      items.push({
        label: "📊 Lihat Laporan",
        id: this.getButtonId("📊 Lihat Laporan"),
      });
    }

    // Help
    items.push({
      label: "❓ Bantuan",
      id: this.getButtonId("❓ Bantuan"),
    });

    // Admin options
    if (role === USER_ROLES.DEV || role === USER_ROLES.BOSS) {
      items.push({
        label: "⚙️ Pengaturan",
        id: this.getButtonId("⚙️ Pengaturan"),
      });
    }

    return this.generateNumberedTextMenu(
      "Menu Utama",
      items,
      "_Anda juga bisa gunakan command: /menu, /help, /catat, /laporan_",
    );
  }

  /**
   * Generate transaction type text menu
   */
  static generateTransactionTypeTextMenu(): string {
    const items = [
      { label: "💰 Penjualan (Income)", id: "txn_type_income" },
      { label: "💸 Pengeluaran (Expense)", id: "txn_type_expense" },
      { label: "🔙 Kembali ke Menu", id: "menu_main" },
    ];

    return this.generateNumberedTextMenu(
      "Jenis Transaksi",
      items,
      "_Pilih jenis transaksi yang ingin dicatat_",
    );
  }

  /**
   * Generate confirmation text menu
   */
  static generateConfirmationTextMenu(hasDescription = false): string {
    const items = [
      { label: "✅ Ya, Simpan Transaksi", id: "txn_confirm_yes" },
      { label: "✏️ Edit Jumlah", id: "txn_edit_amount" },
      { label: "✏️ Edit Kategori", id: "txn_edit_category" },
    ];

    if (hasDescription) {
      items.push({ label: "✏️ Edit Catatan", id: "txn_edit_description" });
    } else {
      items.push({ label: "➕ Tambah Catatan", id: "txn_add_description" });
    }

    items.push({ label: "❌ Batal Transaksi", id: "txn_cancel" });

    return this.generateNumberedTextMenu(
      "Konfirmasi Transaksi",
      items,
      "_Pastikan data sudah benar sebelum menyimpan_",
    );
  }

  /**
   * Generate report type text menu
   */
  static generateReportTypeTextMenu(): string {
    const items = [
      { label: "📅 Laporan Harian", id: "report_daily" },
      { label: "📆 Laporan Mingguan", id: "report_weekly" },
      { label: "📊 Laporan Bulanan", id: "report_monthly" },
      { label: "📈 Laporan Custom", id: "report_custom" },
      { label: "🔙 Kembali ke Menu", id: "menu_main" },
    ];

    return this.generateNumberedTextMenu(
      "Pilih Jenis Laporan",
      items,
      "_Command: /laporan [daily/weekly/monthly]_",
    );
  }

  /**
   * Parse numbered selection from text
   */
  static parseNumberedSelection(
    text: string,
    items: Array<{ label: string; id: string }>,
  ): string | null {
    const trimmed = text.trim();

    // Check if it's a number
    const num = parseInt(trimmed, 10);

    if (isNaN(num) || num < 1 || num > items.length) {
      return null;
    }

    // Return the ID of the selected item
    return items[num - 1].id;
  }

  /**
   * Send menu with button fallback
   * Tries to send buttons first, falls back to numbered text menu
   */
  static async sendMenuWithFallback(
    message: { reply: (content: string | Buttons) => Promise<void> },
    buttons: Buttons,
    textMenuItems: Array<{ label: string; id: string }>,
    title: string,
  ): Promise<boolean> {
    try {
      // Try to send buttons
      await message.reply(buttons);
      return true;
    } catch {
      // Fallback to numbered text menu
      const textMenu = this.generateNumberedTextMenu(title, textMenuItems);
      await message.reply(textMenu);
      return false;
    }
  }

  /**
   * Validate button label length
   */
  static validateButtonLabel(label: string): boolean {
    return label.length <= MAX_BUTTON_LABEL_LENGTH;
  }

  /**
   * Generate approval action buttons for Boss
   */
  static generateApprovalButtons(transactionId: string): Buttons {
    return new Buttons(
      "Pilih aksi untuk transaksi ini",
      [
        { body: "✅ Setujui", id: `approve_${transactionId}` },
        { body: "❌ Tolak", id: `reject_${transactionId}` },
        { body: "ℹ️ Detail", id: `approval_detail_${transactionId}` },
      ],
      "Approval Transaksi",
    );
  }

  /**
   * Generate approval management menu for Boss
   */
  static generateApprovalMenuButtons(): Buttons {
    return new Buttons(
      "Kelola approval transaksi",
      [
        { body: "⏳ Lihat Pending", id: "approval_pending" },
        { body: "📊 Statistik", id: "approval_stats" },
        { body: "🏠 Menu Utama", id: "menu_main" },
      ],
      "Menu Approval",
    );
  }
}

export default ButtonMenu;
