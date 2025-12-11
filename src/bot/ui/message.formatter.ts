/**
 * Message formatter utility
 * Formats command responses with emoji indicators, Markdown formatting, and pagination
 * Supports WhatsApp message limit of 4096 characters (per FR-017)
 */

const WHATSAPP_MESSAGE_LIMIT = 4096;
const PAGINATION_HEADER_LENGTH = 50; // Approximate length for "[1/3]" header

/**
 * Format currency amount in Indonesian Rupiah format
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return "Rp 0";
  }

  // Format with thousand separators
  const formatted = Math.abs(numAmount)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const sign = numAmount < 0 ? "-" : "";
  return `${sign}Rp ${formatted}`;
}

/**
 * Format balance message with emoji indicator
 */
export interface BalanceMessageData {
  balance: number;
  pendingCount?: number;
  pendingAmount?: number;
}

export function formatBalanceMessage(data: BalanceMessageData): string {
  let message = `💰 *Saldo Saat Ini*\n\n`;
  message += `Saldo: ${formatCurrency(data.balance)}\n`;

  if (data.pendingCount && data.pendingCount > 0) {
    message += `\n⏳ *Pending:* ${data.pendingCount} transaksi`;
    if (data.pendingAmount) {
      message += ` (${formatCurrency(data.pendingAmount)})`;
    }
  }

  return message;
}

/**
 * Format transaction confirmation message
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

  let message = `${emoji} *${typeLabel} Berhasil Dicatat!*\n\n`;
  message += `Jumlah: ${formatCurrency(data.amount)}\n`;
  message += `Kategori: ${data.category}\n`;
  message += `Saldo baru: ${formatCurrency(data.newBalance)}`;

  return message;
}

/**
 * Format category list message with numbered options
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
  let message = `📋 *${title}*\n\n`;

  categories.forEach((category, index) => {
    const emoji = category.emoji || "•";
    message += `${index + 1}. ${emoji} ${category.name}\n`;
  });

  return message;
}

/**
 * Format help message with role-filtered commands
 */
export interface HelpCommand {
  command: string;
  description: string;
  roleRestricted?: boolean;
  roleLabel?: string;
}

export function formatHelpMessage(commands: HelpCommand[]): string {
  let message = `❓ *Bantuan - Perintah Tersedia*\n\n`;

  commands.forEach((cmd) => {
    const roleIndicator = cmd.roleRestricted
      ? ` 🔒 (${cmd.roleLabel || "Terbatas"})`
      : "";
    message += `• *${cmd.command}*${roleIndicator}\n`;
    message += `  ${cmd.description}\n\n`;
  });

  message += `\n_Contoh: catat penjualan, lihat laporan hari ini_`;

  return message;
}

/**
 * Format error message with suggestions
 */
export interface ErrorMessageData {
  unrecognizedCommand: string;
  suggestions?: Array<{ command: string; description: string }>;
  showButtonFallback?: boolean;
}

export function formatErrorMessage(data: ErrorMessageData): string {
  let message = `⚠️ *Perintah Tidak Dikenal*\n\n`;
  message += `Tidak yakin dengan: '*${data.unrecognizedCommand}*'\n\n`;

  if (data.suggestions && data.suggestions.length > 0) {
    message += `*Saran perintah:*\n`;
    data.suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. *${suggestion.command}*\n`;
      message += `   ${suggestion.description}\n\n`;
    });
  }

  if (data.showButtonFallback) {
    message += `\nGunakan tombol untuk lanjut? (Ya/Tidak)`;
  }

  return message;
}

/**
 * Format financial report message
 */
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
}

export function formatFinancialReport(data: FinancialReportData): string {
  let message = `📊 *Laporan Keuangan*\n`;
  message += `Periode: ${data.dateRange}\n\n`;

  message += `💰 Saldo: ${formatCurrency(data.balance)}\n`;
  message += `📈 Pendapatan: ${formatCurrency(data.income)}\n`;
  message += `📉 Pengeluaran: ${formatCurrency(data.expenses)}\n`;
  message += `💵 Arus Kas: ${formatCurrency(data.cashflow)}\n`;

  if (data.pendingCount && data.pendingCount > 0) {
    message += `\n⏳ *Pending:* ${data.pendingCount} transaksi`;
  }

  if (data.trends) {
    message += `\n\n*Trend:*\n`;
    if (data.trends.incomeChange !== undefined) {
      const trendEmoji = data.trends.incomeChange >= 0 ? "📈" : "📉";
      message += `${trendEmoji} Pendapatan: ${data.trends.incomeChange >= 0 ? "+" : ""}${data.trends.incomeChange.toFixed(1)}%\n`;
    }
    if (data.trends.expenseChange !== undefined) {
      const trendEmoji = data.trends.expenseChange >= 0 ? "📈" : "📉";
      message += `${trendEmoji} Pengeluaran: ${data.trends.expenseChange >= 0 ? "+" : ""}${data.trends.expenseChange.toFixed(1)}%\n`;
    }
    if (data.trends.cashflowChange !== undefined) {
      const trendEmoji = data.trends.cashflowChange >= 0 ? "📈" : "📉";
      message += `${trendEmoji} Arus Kas: ${data.trends.cashflowChange >= 0 ? "+" : ""}${data.trends.cashflowChange.toFixed(1)}%\n`;
    }
  }

  return message;
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
  if (message.length <= maxLength) {
    return {
      pages: [message],
      totalPages: 1,
    };
  }

  const pages: string[] = [];
  const effectiveMaxLength = maxLength - PAGINATION_HEADER_LENGTH;
  let remaining = message;
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

    // Add pagination header
    const totalPages = Math.ceil(message.length / effectiveMaxLength);
    const paginatedChunk = `[${pageNumber}/${totalPages}]\n\n${chunk}`;

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
  let message = `📝 *Langkah ${data.currentStep}/${data.totalSteps}*\n\n`;
  message += `${data.stepDescription}\n`;

  if (data.instructions) {
    message += `\n${data.instructions}`;
  }

  return message;
}

/**
 * Add visual separator to message
 */
export function addSeparator(message: string): string {
  return `${message}\n\n---\n\n`;
}
