/**
 * Message formatter utility
 * Formats command responses with emoji indicators, Markdown formatting, and pagination
 * Supports WhatsApp message limit of 4096 characters (per FR-017)
 */

import { FontFormatter, FontStyle } from "../../lib/font-formatter";

const WHATSAPP_MESSAGE_LIMIT = 4096;
const PAGINATION_HEADER_LENGTH = 50; // Approximate length for "[1/3]" header

/**
 * T064: Split long messages into paginated chunks with continuation indicators
 * Returns PaginatedMessage object with pages array and totalPages count
 */

/**
 * Format currency amount in Indonesian Rupiah format with enhanced formatting
 * Uses FontFormatter for consistent currency formatting
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return "Rp 0";
  }

  // Use FontFormatter for consistent formatting
  return FontFormatter.formatCurrency(numAmount);
}

/**
 * Format balance message with emoji indicator and enhanced formatting
 */
export interface BalanceMessageData {
  balance: number;
  pendingCount?: number;
  pendingAmount?: number;
}

export function formatBalanceMessage(data: BalanceMessageData): string {
  const header = FontFormatter.convert("💰 Saldo Saat Ini", FontStyle.BOLD);
  const balanceFormatted = formatCurrency(data.balance);
  const balanceMonospace = FontFormatter.convert(
    balanceFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );

  let message = `${header}\n\n`;
  message += `Saldo: Rp ${balanceMonospace}\n`;

  if (data.pendingCount && data.pendingCount > 0) {
    const pendingLabel = FontFormatter.convert("⏳ Pending", FontStyle.BOLD);
    message += `\n${pendingLabel}: ${data.pendingCount} transaksi`;
    if (data.pendingAmount) {
      const pendingAmountFormatted = formatCurrency(data.pendingAmount);
      const pendingAmountMonospace = FontFormatter.convert(
        pendingAmountFormatted.replace("Rp ", ""),
        FontStyle.MONOSPACE,
      );
      message += ` (Rp ${pendingAmountMonospace})`;
    }
  }

  return applyMessageLengthLimit(message);
}

/**
 * Format transaction confirmation message with enhanced formatting
 */
export interface TransactionConfirmationData {
  amount: number;
  category: string;
  type: "income" | "expense";
  newBalance: number;
}

export function formatTransactionConfirmation(
  data: TransactionConfirmationData,
): string {
  const typeLabel = data.type === "income" ? "Penjualan" : "Pengeluaran";
  const emoji = data.type === "income" ? "✅" : "💸";
  const typeLabelFormatted = FontFormatter.convert(
    `${emoji} ${typeLabel} Berhasil Dicatat!`,
    FontStyle.BOLD,
  );

  const amountFormatted = formatCurrency(data.amount);
  const amountMonospace = FontFormatter.convert(
    amountFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );
  const balanceFormatted = formatCurrency(data.newBalance);
  const balanceMonospace = FontFormatter.convert(
    balanceFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );

  let message = `${typeLabelFormatted}\n\n`;
  message += `Jumlah: Rp ${amountMonospace}\n`;
  message += `Kategori: ${data.category}\n`;
  message += `Saldo baru: Rp ${balanceMonospace}`;

  return applyMessageLengthLimit(message);
}

/**
 * Format category list message with numbered options and enhanced formatting
 */
export interface CategoryOption {
  id: string | number;
  name: string;
  emoji?: string;
}

export function formatCategoryList(
  categories: CategoryOption[],
  title: string = "Pilih Kategori:",
): string {
  const header = FontFormatter.convert(`📋 ${title}`, FontStyle.BOLD);
  let message = `${header}\n\n`;

  categories.forEach((category, index) => {
    const emoji = category.emoji || "•";
    const indexMonospace = FontFormatter.convert(
      (index + 1).toString(),
      FontStyle.MONOSPACE,
    );
    message += `${indexMonospace}. ${emoji} ${category.name}\n`;
  });

  return applyMessageLengthLimit(message);
}

/**
 * Format help message with role-filtered commands and enhanced formatting
 */
export interface HelpCommand {
  command: string;
  description: string;
  roleRestricted?: boolean;
  roleLabel?: string;
}

export function formatHelpMessage(commands: HelpCommand[]): string {
  const header = FontFormatter.convert(
    "❓ Bantuan - Perintah Tersedia",
    FontStyle.BOLD,
  );
  let message = `${header}\n\n`;

  commands.forEach((cmd) => {
    const roleIndicator = cmd.roleRestricted
      ? ` 🔒 (${cmd.roleLabel || "Terbatas"})`
      : "";
    const commandFormatted = FontFormatter.convert(cmd.command, FontStyle.BOLD);
    message += `• ${commandFormatted}${roleIndicator}\n`;
    message += `  ${cmd.description}\n\n`;
  });

  const exampleText = FontFormatter.convert(
    "catat penjualan",
    FontStyle.MONOSPACE,
  );
  const exampleText2 = FontFormatter.convert(
    "lihat laporan hari ini",
    FontStyle.MONOSPACE,
  );
  message += `\n_Contoh: ${exampleText}, ${exampleText2}_`;

  return applyMessageLengthLimit(message);
}

/**
 * Format error message with suggestions and enhanced formatting
 */
export interface ErrorMessageData {
  unrecognizedCommand: string;
  suggestions?: Array<{ command: string; description: string }>;
  showButtonFallback?: boolean;
}

export function formatErrorMessage(data: ErrorMessageData): string {
  const header = FontFormatter.convert(
    "⚠️ Perintah Tidak Dikenal",
    FontStyle.BOLD,
  );
  const commandFormatted = FontFormatter.convert(
    data.unrecognizedCommand,
    FontStyle.ITALIC,
  );
  let message = `${header}\n\n`;
  message += `Tidak yakin dengan: '${commandFormatted}'\n\n`;

  if (data.suggestions && data.suggestions.length > 0) {
    const suggestionsHeader = FontFormatter.convert(
      "Saran perintah",
      FontStyle.BOLD,
    );
    message += `${suggestionsHeader}:\n`;
    data.suggestions.forEach((suggestion, index) => {
      const indexMonospace = FontFormatter.convert(
        (index + 1).toString(),
        FontStyle.MONOSPACE,
      );
      const commandFormatted = FontFormatter.convert(
        suggestion.command,
        FontStyle.BOLD,
      );
      message += `${indexMonospace}. ${commandFormatted}\n`;
      message += `   ${suggestion.description}\n\n`;
    });
  }

  if (data.showButtonFallback) {
    message += `\nGunakan tombol untuk lanjut? (Ya/Tidak)`;
  }

  return applyMessageLengthLimit(message);
}

/**
 * Format financial report message
 */
export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  type: "income" | "expense";
}

export interface SavingsGoalData {
  targetAmount: number;
  currentAmount: number;
  progress: number;
  deadline?: Date;
}

export interface FinancialReportData {
  balance: number;
  income: number;
  expenses: number;
  cashflow: number;
  pendingCount?: number;
  dateRange: string;
  trends?: {
    incomeChange?: number;
    expenseChange?: number;
    cashflowChange?: number;
  };
  categoryBreakdown?: CategoryBreakdownItem[]; // T074: Category breakdown with percentages
  savingsGoal?: SavingsGoalData; // T073: Savings goals (when applicable to role)
}

/**
 * Apply message length limit with truncation
 */
function applyMessageLengthLimit(
  message: string,
  maxLength: number = WHATSAPP_MESSAGE_LIMIT,
): string {
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
 * T036: Format financial report message with 📊 emoji, financial metrics, and trend indicators
 * T037: Format financial summary display with Indonesian Rupiah formatting (Rp 500.000), thousand separators
 */
export function formatFinancialReport(data: FinancialReportData): string {
  const header = FontFormatter.convert("📊 Laporan Keuangan", FontStyle.BOLD);
  let message = `${header}\n`;
  message += `Periode: ${data.dateRange}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Financial metrics with emoji indicators and monospace formatting for numbers
  const balanceFormatted = formatCurrency(data.balance);
  const balanceMonospace = FontFormatter.convert(
    balanceFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );
  const incomeFormatted = formatCurrency(data.income);
  const incomeMonospace = FontFormatter.convert(
    incomeFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );
  const expensesFormatted = formatCurrency(data.expenses);
  const expensesMonospace = FontFormatter.convert(
    expensesFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );
  const cashflowFormatted = formatCurrency(data.cashflow);
  const cashflowMonospace = FontFormatter.convert(
    cashflowFormatted.replace("Rp ", ""),
    FontStyle.MONOSPACE,
  );

  message += `${FontFormatter.convert("💰 Saldo", FontStyle.BOLD)}: Rp ${balanceMonospace}\n`;
  message += `${FontFormatter.convert("📈 Pendapatan", FontStyle.BOLD)}: Rp ${incomeMonospace}\n`;
  message += `${FontFormatter.convert("📉 Pengeluaran", FontStyle.BOLD)}: Rp ${expensesMonospace}\n`;
  message += `${FontFormatter.convert("💵 Arus Kas", FontStyle.BOLD)}: Rp ${cashflowMonospace}\n`;

  // Pending transactions (separated from balance/trends per T033)
  if (data.pendingCount && data.pendingCount > 0) {
    const pendingLabel = FontFormatter.convert("⏳ Pending", FontStyle.BOLD);
    const countMonospace = FontFormatter.convert(
      data.pendingCount.toString(),
      FontStyle.MONOSPACE,
    );
    message += `\n${pendingLabel}: ${countMonospace} transaksi`;
  }

  // Trend indicators (T034: percentage changes, period comparisons)
  if (data.trends) {
    const trendHeader = FontFormatter.convert(
      "📊 Trend vs Periode Sebelumnya",
      FontStyle.BOLD,
    );
    message += `\n\n${trendHeader}:\n`;
    if (data.trends.incomeChange !== undefined) {
      const trendEmoji = data.trends.incomeChange >= 0 ? "📈" : "📉";
      const sign = data.trends.incomeChange >= 0 ? "+" : "";
      const percentageMonospace = FontFormatter.convert(
        sign + data.trends.incomeChange.toFixed(1) + "%",
        FontStyle.MONOSPACE,
      );
      message += `${trendEmoji} Pendapatan: ${percentageMonospace}\n`;
    }
    if (data.trends.expenseChange !== undefined) {
      const trendEmoji = data.trends.expenseChange >= 0 ? "📈" : "📉";
      const sign = data.trends.expenseChange >= 0 ? "+" : "";
      const percentageMonospace = FontFormatter.convert(
        sign + data.trends.expenseChange.toFixed(1) + "%",
        FontStyle.MONOSPACE,
      );
      message += `${trendEmoji} Pengeluaran: ${percentageMonospace}\n`;
    }
    if (data.trends.cashflowChange !== undefined) {
      const trendEmoji = data.trends.cashflowChange >= 0 ? "📈" : "📉";
      const sign = data.trends.cashflowChange >= 0 ? "+" : "";
      const percentageMonospace = FontFormatter.convert(
        sign + data.trends.cashflowChange.toFixed(1) + "%",
        FontStyle.MONOSPACE,
      );
      message += `${trendEmoji} Arus Kas: ${percentageMonospace}\n`;
    }
  }

  // T074: Category breakdown display with percentages
  if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
    const breakdownHeader = FontFormatter.convert(
      "📋 Breakdown Kategori",
      FontStyle.BOLD,
    );
    message += `\n\n${breakdownHeader}:\n`;

    // Group by type
    const incomeCategories = data.categoryBreakdown.filter(
      (c) => c.type === "income",
    );
    const expenseCategories = data.categoryBreakdown.filter(
      (c) => c.type === "expense",
    );

    if (incomeCategories.length > 0) {
      message += `\n${FontFormatter.convert("Pendapatan", FontStyle.BOLD)}:\n`;
      for (const cat of incomeCategories.slice(0, 5)) {
        // Top 5 categories
        const amountFormatted = formatCurrency(cat.amount);
        const amountMonospace = FontFormatter.convert(
          amountFormatted.replace("Rp ", ""),
          FontStyle.MONOSPACE,
        );
        const percentageMonospace = FontFormatter.convert(
          cat.percentage.toFixed(1) + "%",
          FontStyle.MONOSPACE,
        );
        message += `• ${cat.category}: Rp ${amountMonospace} (${percentageMonospace})\n`;
      }
    }

    if (expenseCategories.length > 0) {
      message += `\n${FontFormatter.convert("Pengeluaran", FontStyle.BOLD)}:\n`;
      for (const cat of expenseCategories.slice(0, 5)) {
        // Top 5 categories
        const amountFormatted = formatCurrency(cat.amount);
        const amountMonospace = FontFormatter.convert(
          amountFormatted.replace("Rp ", ""),
          FontStyle.MONOSPACE,
        );
        const percentageMonospace = FontFormatter.convert(
          cat.percentage.toFixed(1) + "%",
          FontStyle.MONOSPACE,
        );
        message += `• ${cat.category}: Rp ${amountMonospace} (${percentageMonospace})\n`;
      }
    }
  }

  // T073: Savings goals display (when applicable to role)
  if (data.savingsGoal) {
    const progressBar =
      "█".repeat(Math.floor(data.savingsGoal.progress / 10)) +
      "░".repeat(10 - Math.floor(data.savingsGoal.progress / 10));
    const savingsHeader = FontFormatter.convert(
      "🎯 Target Tabungan",
      FontStyle.BOLD,
    );
    message += `\n\n${savingsHeader}:\n`;
    const progressMonospace = FontFormatter.convert(
      data.savingsGoal.progress.toFixed(1) + "%",
      FontStyle.MONOSPACE,
    );
    message += `${progressBar} ${progressMonospace}\n`;

    const currentFormatted = formatCurrency(data.savingsGoal.currentAmount);
    const currentMonospace = FontFormatter.convert(
      currentFormatted.replace("Rp ", ""),
      FontStyle.MONOSPACE,
    );
    const targetFormatted = formatCurrency(data.savingsGoal.targetAmount);
    const targetMonospace = FontFormatter.convert(
      targetFormatted.replace("Rp ", ""),
      FontStyle.MONOSPACE,
    );
    message += `Terkumpul: Rp ${currentMonospace} / Rp ${targetMonospace}\n`;
    if (data.savingsGoal.deadline) {
      const deadlineStr = new Date(
        data.savingsGoal.deadline,
      ).toLocaleDateString("id-ID");
      message += `Target: ${deadlineStr}\n`;
    }
  }

  return applyMessageLengthLimit(message);
}

/**
 * Paginate long messages (per FR-017)
 * Splits message into chunks of max 4096 characters with continuation indicators
 */
export interface PaginatedMessage {
  pages: string[];
  totalPages: number;
}

export function paginateMessage(
  message: string,
  maxLength: number = WHATSAPP_MESSAGE_LIMIT,
): PaginatedMessage {
  // Apply length limit first
  const limitedMessage = applyMessageLengthLimit(message, maxLength);

  if (limitedMessage.length <= maxLength) {
    return {
      pages: [limitedMessage],
      totalPages: 1,
    };
  }

  const pages: string[] = [];
  const effectiveMaxLength = maxLength - PAGINATION_HEADER_LENGTH;
  let remaining = limitedMessage;
  let pageNumber = 1;

  while (remaining.length > 0) {
    let chunk = remaining.substring(0, effectiveMaxLength);

    // Try to break at newline if possible
    if (remaining.length > effectiveMaxLength) {
      const lastNewline = chunk.lastIndexOf("\n");
      if (lastNewline > effectiveMaxLength * 0.8) {
        // Break at newline if it's not too early
        chunk = remaining.substring(0, lastNewline);
      }
    }

    // Add pagination header with monospace formatting
    const totalPages = Math.ceil(limitedMessage.length / effectiveMaxLength);
    const pageHeader = FontFormatter.convert(
      `[${pageNumber}/${totalPages}]`,
      FontStyle.MONOSPACE,
    );
    const paginatedChunk = `${pageHeader}\n\n${chunk}`;

    pages.push(paginatedChunk);
    remaining = remaining.substring(chunk.length);
    pageNumber++;
  }

  return {
    pages,
    totalPages: pages.length,
  };
}

/**
 * Format multi-step workflow progress message
 */
export interface WorkflowProgressData {
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
  instructions?: string;
}

export function formatWorkflowProgress(data: WorkflowProgressData): string {
  const stepMonospace = FontFormatter.convert(
    `${data.currentStep}/${data.totalSteps}`,
    FontStyle.MONOSPACE,
  );
  const header = FontFormatter.convert(
    `📝 Langkah ${stepMonospace}`,
    FontStyle.BOLD,
  );
  let message = `${header}\n\n`;
  message += `${data.stepDescription}\n`;

  if (data.instructions) {
    message += `\n${data.instructions}`;
  }

  return applyMessageLengthLimit(message);
}

/**
 * Add visual separator to message
 */
export function addSeparator(message: string): string {
  return `${message}\n\n---\n\n`;
}
