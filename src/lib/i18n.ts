import { logger } from "./logger";

/**
 * Internationalization (i18n) support
 * Primary language: Indonesian (id)
 * Fallback: English (en)
 */

export type SupportedLanguage = "id" | "en";

export interface TranslationKey {
  id: string;
  en: string;
}

/**
 * Translation dictionary
 */
const translations: Record<string, TranslationKey> = {
  // General
  "general.welcome": {
    id: "Selamat datang di WhatsApp Cashflow Bot!",
    en: "Welcome to WhatsApp Cashflow Bot!",
  },
  "general.help": {
    id: "Bantuan",
    en: "Help",
  },
  "general.cancel": {
    id: "Batal",
    en: "Cancel",
  },
  "general.confirm": {
    id: "Konfirmasi",
    en: "Confirm",
  },
  "general.retry": {
    id: "Coba Lagi",
    en: "Retry",
  },
  "general.back": {
    id: "Kembali",
    en: "Back",
  },
  "general.next": {
    id: "Lanjut",
    en: "Next",
  },
  "general.done": {
    id: "Selesai",
    en: "Done",
  },
  "general.loading": {
    id: "Memuat...",
    en: "Loading...",
  },
  "general.error": {
    id: "Terjadi kesalahan",
    en: "An error occurred",
  },
  "general.success": {
    id: "Berhasil",
    en: "Success",
  },

  // Menu buttons
  "menu.record_income": {
    id: "💰 Catat Penjualan",
    en: "💰 Record Income",
  },
  "menu.record_expense": {
    id: "💸 Catat Pengeluaran",
    en: "💸 Record Expense",
  },
  "menu.view_report": {
    id: "📊 Lihat Laporan",
    en: "📊 View Report",
  },
  "menu.settings": {
    id: "⚙️ Pengaturan",
    en: "⚙️ Settings",
  },
  "menu.main_menu": {
    id: "🏠 Menu Utama",
    en: "🏠 Main Menu",
  },

  // Transaction flow
  "transaction.select_category": {
    id: "Pilih kategori transaksi:",
    en: "Select transaction category:",
  },
  "transaction.enter_amount": {
    id: "Masukkan jumlah (Rp):",
    en: "Enter amount (Rp):",
  },
  "transaction.enter_notes": {
    id: "Masukkan catatan (opsional):",
    en: "Enter notes (optional):",
  },
  "transaction.confirm_details": {
    id: "Konfirmasi detail transaksi:",
    en: "Confirm transaction details:",
  },
  "transaction.saved_success": {
    id: "✅ Transaksi berhasil disimpan!",
    en: "✅ Transaction saved successfully!",
  },
  "transaction.save_failed": {
    id: "❌ Gagal menyimpan transaksi",
    en: "❌ Failed to save transaction",
  },
  "transaction.invalid_amount": {
    id: "❌ Jumlah tidak valid. Masukkan angka positif.",
    en: "❌ Invalid amount. Enter a positive number.",
  },
  "transaction.duplicate_detected": {
    id: "⚠️ Transaksi serupa sudah ada. Lanjutkan?",
    en: "⚠️ Similar transaction exists. Continue?",
  },
  "transaction.edit_amount": {
    id: "✏️ Edit Jumlah",
    en: "✏️ Edit Amount",
  },
  "transaction.edit_category": {
    id: "✏️ Edit Kategori",
    en: "✏️ Edit Category",
  },
  "transaction.edit_notes": {
    id: "✏️ Edit Catatan",
    en: "✏️ Edit Notes",
  },

  // Reports
  "report.daily_title": {
    id: "📊 Laporan Harian",
    en: "📊 Daily Report",
  },
  "report.weekly_title": {
    id: "📊 Laporan Mingguan",
    en: "📊 Weekly Report",
  },
  "report.monthly_title": {
    id: "📊 Laporan Bulanan",
    en: "📊 Monthly Report",
  },
  "report.total_income": {
    id: "Pemasukan",
    en: "Income",
  },
  "report.total_expense": {
    id: "Pengeluaran",
    en: "Expenses",
  },
  "report.net_cashflow": {
    id: "Arus Kas Bersih",
    en: "Net Cashflow",
  },
  "report.generating": {
    id: "🔄 Membuat laporan...",
    en: "🔄 Generating report...",
  },
  "report.no_data": {
    id: "📭 Tidak ada data untuk periode ini",
    en: "📭 No data for this period",
  },
  "report.view_details": {
    id: "📊 Lihat Detail",
    en: "📊 View Details",
  },

  // Recommendations
  "recommendation.expense_spike": {
    id: "⚠️ Pengeluaran meningkat {percent}% dari rata-rata 7 hari",
    en: "⚠️ Expenses increased {percent}% from 7-day average",
  },
  "recommendation.revenue_decline": {
    id: "⚠️ Pendapatan menurun {percent}% dari minggu lalu",
    en: "⚠️ Revenue declined {percent}% from last week",
  },
  "recommendation.negative_cashflow": {
    id: "🚨 Arus kas negatif selama {days} hari berturut-turut",
    en: "🚨 Negative cashflow for {days} consecutive days",
  },
  "recommendation.insight": {
    id: "💡 Insight",
    en: "💡 Insight",
  },
  "recommendation.view_details": {
    id: "📊 Lihat Detail",
    en: "📊 View Details",
  },
  "recommendation.dismiss": {
    id: "❌ Abaikan",
    en: "❌ Dismiss",
  },

  // User management
  "user.role_employee": {
    id: "Karyawan",
    en: "Employee",
  },
  "user.role_boss": {
    id: "Boss",
    en: "Boss",
  },
  "user.role_investor": {
    id: "Investor",
    en: "Investor",
  },
  "user.role_dev": {
    id: "Developer",
    en: "Developer",
  },
  "user.active": {
    id: "Aktif",
    en: "Active",
  },
  "user.inactive": {
    id: "Tidak Aktif",
    en: "Inactive",
  },
  "user.last_active": {
    id: "Terakhir aktif",
    en: "Last active",
  },

  // Admin/Dev
  "admin.system_health": {
    id: "🏥 Kesehatan Sistem",
    en: "🏥 System Health",
  },
  "admin.user_management": {
    id: "👥 Manajemen User",
    en: "👥 User Management",
  },
  "admin.audit_log": {
    id: "📋 Log Audit",
    en: "📋 Audit Log",
  },
  "admin.backup_restore": {
    id: "💾 Backup & Restore",
    en: "💾 Backup & Restore",
  },
  "admin.uptime": {
    id: "Uptime",
    en: "Uptime",
  },
  "admin.memory_usage": {
    id: "Penggunaan Memori",
    en: "Memory Usage",
  },
  "admin.error_rate": {
    id: "Tingkat Error",
    en: "Error Rate",
  },

  // Errors
  "error.unauthorized": {
    id: "❌ Anda tidak memiliki akses untuk tindakan ini",
    en: "❌ You don't have access to this action",
  },
  "error.session_expired": {
    id: "⏱️ Sesi Anda telah berakhir. Silakan mulai lagi.",
    en: "⏱️ Your session has expired. Please start again.",
  },
  "error.network": {
    id: "🌐 Terjadi kesalahan jaringan. Coba lagi.",
    en: "🌐 Network error occurred. Try again.",
  },
  "error.validation": {
    id: "❌ Data tidak valid",
    en: "❌ Invalid data",
  },
  "error.unknown": {
    id: "❌ Terjadi kesalahan yang tidak diketahui",
    en: "❌ An unknown error occurred",
  },

  // Help messages
  "help.commands": {
    id: "Perintah yang tersedia:",
    en: "Available commands:",
  },
  "help.contact_dev": {
    id: "Hubungi developer untuk bantuan lebih lanjut",
    en: "Contact developer for further assistance",
  },

  // Time periods
  "time.today": {
    id: "Hari ini",
    en: "Today",
  },
  "time.yesterday": {
    id: "Kemarin",
    en: "Yesterday",
  },
  "time.this_week": {
    id: "Minggu ini",
    en: "This week",
  },
  "time.last_week": {
    id: "Minggu lalu",
    en: "Last week",
  },
  "time.this_month": {
    id: "Bulan ini",
    en: "This month",
  },
  "time.last_month": {
    id: "Bulan lalu",
    en: "Last month",
  },

  // Currency
  "currency.format": {
    id: "Rp {amount}",
    en: "Rp {amount}",
  },
};

/**
 * I18n Service for managing translations
 */
export class I18nService {
  private static instance: I18nService;
  private defaultLanguage: SupportedLanguage = "id";
  private userLanguages: Map<string, SupportedLanguage> = new Map();

  private constructor() {}

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * Set user's preferred language
   */
  setUserLanguage(userId: string, language: SupportedLanguage): void {
    this.userLanguages.set(userId, language);
    logger.info("User language set", { userId, language });
  }

  /**
   * Get user's preferred language
   */
  getUserLanguage(userId: string): SupportedLanguage {
    return this.userLanguages.get(userId) || this.defaultLanguage;
  }

  /**
   * Translate a key for a specific user
   */
  t(
    key: string,
    userId?: string,
    params?: Record<string, string | number>,
  ): string {
    const language = userId
      ? this.getUserLanguage(userId)
      : this.defaultLanguage;

    return this.translate(key, language, params);
  }

  /**
   * Translate a key with specified language
   */
  translate(
    key: string,
    language: SupportedLanguage = "id",
    params?: Record<string, string | number>,
  ): string {
    const translation = translations[key];

    if (!translation) {
      logger.warn(`Missing translation for key: ${key}`);
      return key;
    }

    let text = translation[language] || translation["en"] || key;

    // Replace parameters
    if (params) {
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(`{${param}}`, String(value));
      }
    }

    return text;
  }

  /**
   * Check if a key exists
   */
  hasTranslation(key: string): boolean {
    return key in translations;
  }

  /**
   * Get all translations for a language
   */
  getAllTranslations(
    language: SupportedLanguage = "id",
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, translation] of Object.entries(translations)) {
      result[key] = translation[language] || translation["en"];
    }

    return result;
  }

  /**
   * Add or update a translation
   */
  addTranslation(key: string, id: string, en: string): void {
    translations[key] = { id, en };
    logger.info("Translation added/updated", { key });
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ["id", "en"];
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): SupportedLanguage {
    return this.defaultLanguage;
  }

  /**
   * Set default language
   */
  setDefaultLanguage(language: SupportedLanguage): void {
    this.defaultLanguage = language;
    logger.info("Default language changed", { language });
  }

  /**
   * Format currency with translation
   */
  formatCurrency(amount: number, userId?: string): string {
    const formatted = new Intl.NumberFormat("id-ID").format(amount);
    return this.t("currency.format", userId, { amount: formatted });
  }

  /**
   * Get language name
   */
  getLanguageName(language: SupportedLanguage): string {
    const names: Record<SupportedLanguage, string> = {
      id: "Bahasa Indonesia",
      en: "English",
    };
    return names[language];
  }
}

// Export singleton instance
export const i18n = I18nService.getInstance();

// Helper function for quick translations
export function t(
  key: string,
  userId?: string,
  params?: Record<string, string | number>,
): string {
  return i18n.t(key, userId, params);
}
