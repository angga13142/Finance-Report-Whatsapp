import { UserRole } from "@prisma/client";
import { RoleReportData } from "./generator";
import { formatCurrency } from "../../lib/currency";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Text report formatter service
 * Formats report data into WhatsApp-friendly text messages with Indonesian formatting
 */
export class ReportFormatter {
  /**
   * Format complete daily report for WhatsApp message
   */
  static formatDailyReport(reportData: RoleReportData, date: Date): string {
    const header = this.formatHeader(date);
    const summary = this.formatSummary(reportData);
    const categoryBreakdown = this.formatCategoryBreakdown(reportData);
    const topTransactions = this.formatTopTransactions(reportData);
    const trends = this.formatTrends(reportData);
    const footer = this.formatFooter(reportData.role);

    return [header, summary, categoryBreakdown, topTransactions, trends, footer]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Format report header with date
   */
  private static formatHeader(date: Date): string {
    const dateStr = date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `📊 *LAPORAN HARIAN CASHFLOW*\n📅 ${dateStr}\n${"=".repeat(35)}`;
  }

  /**
   * Format summary section
   */
  private static formatSummary(reportData: RoleReportData): string {
    const { summary } = reportData;

    const lines = [
      "💰 *RINGKASAN*",
      `├─ Pemasukan: ${formatCurrency(summary.totalIncome)} (${summary.incomeCount}x)`,
      `├─ Pengeluaran: ${formatCurrency(summary.totalExpense)} (${summary.expenseCount}x)`,
      `└─ *Cashflow: ${formatCurrency(summary.netCashflow)}*`,
    ];

    // Add average transaction if applicable
    if (summary.transactionCount > 0) {
      lines.push(`\n📈 Rata-rata: ${formatCurrency(summary.avgTransaction)}`);
    }

    return lines.join("\n");
  }

  /**
   * Format category breakdown section
   */
  private static formatCategoryBreakdown(reportData: RoleReportData): string {
    const { categoryBreakdown } = reportData;

    if (categoryBreakdown.length === 0) {
      return "";
    }

    const lines = ["📂 *KATEGORI TERATAS*"];

    // Show top 5 categories
    const topCategories = categoryBreakdown.slice(0, 5);

    topCategories.forEach((cat, index) => {
      const emoji = index === topCategories.length - 1 ? "└─" : "├─";
      const bar = this.generateProgressBar(cat.percentage);
      lines.push(
        `${emoji} ${cat.category}: ${formatCurrency(cat.amount)} (${cat.percentage}%) ${bar}`,
      );
    });

    return lines.join("\n");
  }

  /**
   * Format top transactions section
   */
  private static formatTopTransactions(reportData: RoleReportData): string {
    const { topTransactions, role } = reportData;

    if (topTransactions.length === 0) {
      return "";
    }

    const lines = ["🔝 *TRANSAKSI TERBESAR*"];

    // Show top 5 transactions
    const top5 = topTransactions.slice(0, 5);

    top5.forEach((txn, index) => {
      const emoji = index === top5.length - 1 ? "└─" : "├─";
      const typeIcon = txn.type === "income" ? "💵" : "💸";
      const amount = formatCurrency(txn.amount);

      // Role-based visibility
      let line = `${emoji} ${typeIcon} ${amount} - ${txn.category}`;

      // Boss and Dev can see employee attribution
      if ((role === "boss" || role === "dev") && txn.userName) {
        line += ` (${txn.userName})`;
      }

      // Add description if available
      if (txn.description) {
        line += `\n   ${txn.description}`;
      }

      lines.push(line);
    });

    return lines.join("\n");
  }

  /**
   * Format trends section with comparisons
   */
  private static formatTrends(reportData: RoleReportData): string {
    const { trends } = reportData;

    if (!trends) {
      return "";
    }

    const lines = ["📊 *PERBANDINGAN*"];

    // Yesterday comparison
    if (trends.vsYesterday) {
      const cashflowChange = trends.vsYesterday.cashflow;
      const changeIcon = cashflowChange >= 0 ? "📈" : "📉";
      const changeText = cashflowChange >= 0 ? "naik" : "turun";
      const changePercent = Math.abs(cashflowChange).toFixed(1);

      lines.push(
        `${changeIcon} vs Kemarin: Cashflow ${changeText} ${changePercent}%`,
      );
    }

    // 7-day average comparison
    if (trends.vs7DayAvg) {
      const avgCashflow = trends.vs7DayAvg.cashflow;
      const avgIcon = avgCashflow >= 0 ? "📈" : "📉";
      const avgText = avgCashflow >= 0 ? "di atas" : "di bawah";
      const avgPercent = Math.abs(avgCashflow).toFixed(1);

      lines.push(
        `${avgIcon} vs Rata-rata 7 Hari: ${avgPercent}% ${avgText} rata-rata`,
      );
    }

    // Monthly target (if role has access)
    if (trends.vsMonthlyTarget) {
      const revenuePercent = trends.vsMonthlyTarget.revenue.toFixed(1);
      const expensePercent = trends.vsMonthlyTarget.expense.toFixed(1);

      lines.push(`\n🎯 *Progress Bulanan*`);
      lines.push(`├─ Target Pemasukan: ${revenuePercent}%`);
      lines.push(`└─ Budget Pengeluaran: ${expensePercent}%`);
    }

    return lines.join("\n");
  }

  /**
   * Format footer with role-specific actions
   */
  private static formatFooter(role: UserRole): string {
    const lines = [`${"=".repeat(35)}`];

    // Role-specific footer messages
    switch (role) {
      case "boss":
      case "dev":
        lines.push("💡 Gunakan [📊 Detail Lengkap] untuk laporan PDF");
        lines.push("📧 Gunakan [📤 Export Excel] untuk analisis lanjut");
        break;
      case "employee":
        lines.push("💡 Gunakan [📊 Detail Lengkap] untuk melihat PDF");
        break;
      case "investor":
        lines.push("💡 Laporan lengkap tersedia dalam format PDF");
        break;
    }

    lines.push(
      `\n_Dibuat: ${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" })}_`,
    );

    return lines.join("\n");
  }

  /**
   * Generate progress bar for percentages
   */
  private static generateProgressBar(percentage: number): string {
    const barLength = 10;
    const filledLength = Math.round((percentage / 100) * barLength);
    const emptyLength = barLength - filledLength;

    return "▓".repeat(filledLength) + "░".repeat(emptyLength);
  }

  /**
   * Format short summary for quick notifications
   */
  static formatShortSummary(reportData: RoleReportData): string {
    const { summary } = reportData;

    const cashflowIcon = summary.netCashflow.greaterThan(0) ? "✅" : "⚠️";
    const cashflow = formatCurrency(summary.netCashflow);

    return [
      `${cashflowIcon} *Cashflow Hari Ini: ${cashflow}*`,
      `💰 Pemasukan: ${formatCurrency(summary.totalIncome)}`,
      `💸 Pengeluaran: ${formatCurrency(summary.totalExpense)}`,
    ].join("\n");
  }

  /**
   * Format alert message for negative cashflow trends
   */
  static formatNegativeCashflowAlert(
    consecutiveDays: number,
    totalDeficit: Decimal,
  ): string {
    return [
      "⚠️ *PERINGATAN CASHFLOW*",
      `${"=".repeat(35)}`,
      `🔴 Cashflow negatif selama ${consecutiveDays} hari berturut-turut`,
      `📉 Total defisit: ${formatCurrency(totalDeficit)}`,
      "",
      "💡 *Rekomendasi:*",
      "├─ Tinjau pengeluaran tidak penting",
      "├─ Tingkatkan strategi penjualan",
      "└─ Pertimbangkan penyesuaian budget",
      "",
      "📊 Gunakan [📊 Detail Lengkap] untuk analisis mendalam",
    ].join("\n");
  }

  /**
   * Format drill-down report with detailed transactions
   */
  static formatDetailedReport(reportData: RoleReportData, date: Date): string {
    const header = this.formatHeader(date);
    const summary = this.formatSummary(reportData);

    // Show all transactions (not just top 5)
    const allTransactions = this.formatAllTransactions(reportData);

    const categoryBreakdown = this.formatCategoryBreakdown(reportData);
    const trends = this.formatTrends(reportData);

    return [header, summary, allTransactions, categoryBreakdown, trends]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Format all transactions for detailed view
   */
  private static formatAllTransactions(reportData: RoleReportData): string {
    const { topTransactions, role } = reportData;

    if (topTransactions.length === 0) {
      return "📝 Tidak ada transaksi hari ini";
    }

    const lines = [`📝 *SEMUA TRANSAKSI (${topTransactions.length})*`];

    topTransactions.forEach((txn, index) => {
      const emoji = index === topTransactions.length - 1 ? "└─" : "├─";
      const typeIcon = txn.type === "income" ? "💵" : "💸";
      const amount = formatCurrency(txn.amount);
      const time = txn.timestamp.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });

      let line = `${emoji} ${typeIcon} ${amount} - ${txn.category} (${time})`;

      // Role-based visibility
      if ((role === "boss" || role === "dev") && txn.userName) {
        line += ` - ${txn.userName}`;
      }

      if (txn.description) {
        line += `\n   📌 ${txn.description}`;
      }

      lines.push(line);
    });

    return lines.join("\n");
  }

  /**
   * Format error message for report generation failure
   */
  static formatErrorMessage(error: Error): string {
    return [
      "❌ *GAGAL MEMBUAT LAPORAN*",
      `${"=".repeat(35)}`,
      `⚠️ ${error.message}`,
      "",
      "💡 Silakan coba lagi dengan [🔄 Coba Lagi]",
      "Atau hubungi admin jika masalah berlanjut",
    ].join("\n");
  }
}
