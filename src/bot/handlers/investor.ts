import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { formatCurrency } from "../../lib/currency";
import { formatDateWITA } from "../../lib/date";
import { ReportGenerator } from "../../services/report/generator";
import TrendAnalysisService from "../../services/report/trend";
import InvestmentInsightsService from "../../services/report/insights";
import PeriodComparisonService from "../../services/report/comparison";

/**
 * Investor role handler
 * Provides aggregated financial analysis without individual transaction details
 * Features: trend analysis, investment insights, period comparisons
 */

/**
 * Main investor menu
 */
export async function handleInvestorMenu(message: Message): Promise<void> {
  logger.info("Displaying investor menu", {
    from: message.from,
    userId: message.from,
  });

  const menuText = `*🎯 Menu Investor*

Selamat datang! Silakan pilih analisis yang ingin Anda lihat:

📊 *ANALISIS TERSEDIA*
1️⃣ 📈 Analisis Trend 90 Hari
2️⃣ 💡 Insight Investasi
3️⃣ 📉 Perbandingan Periode
4️⃣ 📋 Ringkasan Harian
5️⃣ 📑 Laporan Bulanan

ℹ️ *CATATAN*
Semua data ditampilkan dalam bentuk agregat untuk menjaga privasi operasional. Detail transaksi individual tidak ditampilkan.

Ketik nomor pilihan Anda (1-5) atau ketik *menu* untuk kembali ke menu utama.`;

  await message.reply(menuText);
}

/**
 * Handle 90-day trend analysis request
 */
export async function handle90DayTrendAnalysis(
  message: Message,
): Promise<void> {
  logger.info("Generating 90-day trend analysis for investor", {
    from: message.from,
  });

  await message.reply("⏳ Sedang menganalisis trend 90 hari terakhir...");

  try {
    const today = new Date();
    const trendData = await TrendAnalysisService.generate90DayTrend(today);

    // Format response
    let response = `*📈 ANALISIS TREND 90 HARI*\n\n`;

    // Period info
    response += `📅 *Periode:* ${formatDateWITA(trendData.period.start)} - ${formatDateWITA(trendData.period.end)}\n`;
    response += `📊 *Total Hari:* ${trendData.period.days}\n\n`;

    // Summary statistics
    response += `💰 *RINGKASAN FINANSIAL*\n`;
    response += `Revenue: ${formatCurrency(trendData.summary.totalIncome)}\n`;
    response += `Expense: ${formatCurrency(trendData.summary.totalExpense)}\n`;
    response += `Net Profit: ${formatCurrency(trendData.summary.totalNetCashflow)}\n`;
    response += `Rata-rata Harian: ${formatCurrency(trendData.summary.avgDailyNetCashflow)}\n\n`;

    // Growth trends
    response += `📊 *TREND PERTUMBUHAN*\n`;
    response += `Revenue Growth: ${trendData.trends.incomeGrowthRate >= 0 ? "+" : ""}${trendData.trends.incomeGrowthRate.toFixed(2)}%\n`;
    response += `Expense Growth: ${trendData.trends.expenseGrowthRate >= 0 ? "+" : ""}${trendData.trends.expenseGrowthRate.toFixed(2)}%\n`;
    response += `Profit Margin Trend: ${trendData.trends.profitMarginTrend >= 0 ? "+" : ""}${trendData.trends.profitMarginTrend.toFixed(2)}%\n\n`;

    // Volatility
    response += `📉 *VOLATILITAS*\n`;
    response += `Revenue: ${formatCurrency(trendData.trends.volatility.incomeStdDev)} (std dev)\n`;
    response += `Expense: ${formatCurrency(trendData.trends.volatility.expenseStdDev)} (std dev)\n`;
    response += `Cashflow: ${formatCurrency(trendData.trends.volatility.cashflowStdDev)} (std dev)\n\n`;

    // Visual representation
    response += `📊 *VISUALISASI CASHFLOW*\n`;
    response += `${trendData.visualRepresentation.sparkline}\n\n`;

    // Peak and lowest days
    if (trendData.visualRepresentation.peakDay) {
      response += `🔝 *Hari Terbaik:* ${formatDateWITA(trendData.visualRepresentation.peakDay.date)}\n`;
      response += `   ${formatCurrency(trendData.visualRepresentation.peakDay.netCashflow)}\n\n`;
    }

    if (trendData.visualRepresentation.lowestDay) {
      response += `📉 *Hari Terburuk:* ${formatDateWITA(trendData.visualRepresentation.lowestDay.date)}\n`;
      response += `   ${formatCurrency(trendData.visualRepresentation.lowestDay.netCashflow)}\n\n`;
    }

    // Split message if too long
    const messages = splitMessage(response);
    for (const msg of messages) {
      await message.reply(msg);
    }

    // Offer follow-up options
    await message.reply(
      "💡 *Next Steps:*\n\n" +
        "• Ketik *2* untuk melihat Investment Insights\n" +
        "• Ketik *3* untuk perbandingan periode\n" +
        "• Ketik *menu* untuk kembali",
    );
  } catch (error) {
    logger.error("Failed to generate 90-day trend analysis", { error });
    await message.reply(
      "❌ Maaf, terjadi kesalahan saat menganalisis trend. Silakan coba lagi nanti.",
    );
  }
}

/**
 * Handle investment insights request
 */
export async function handleInvestmentInsights(
  message: Message,
): Promise<void> {
  logger.info("Generating investment insights for investor", {
    from: message.from,
  });

  await message.reply(
    "⏳ Sedang menghasilkan investment insights...\n_Proses ini memerlukan waktu beberapa detik._",
  );

  try {
    const today = new Date();
    const insights = await InvestmentInsightsService.generateInsights(
      today,
      90,
    );

    // Format response
    let response = `*💡 INVESTMENT INSIGHTS*\n\n`;

    // Period info
    response += `📅 *Periode Analisis:* ${insights.period.days} hari\n`;
    response += `🕐 *Dihasilkan:* ${formatDateWITA(insights.generatedAt)}\n\n`;

    // Business health score
    const healthEmoji =
      insights.businessHealth.level === "excellent"
        ? "🟢"
        : insights.businessHealth.level === "good"
          ? "🟡"
          : insights.businessHealth.level === "fair"
            ? "🟠"
            : "🔴";

    response += `${healthEmoji} *BUSINESS HEALTH SCORE: ${insights.businessHealth.score}/100*\n`;
    response += `Status: *${insights.businessHealth.level.toUpperCase()}*\n\n`;
    response += `${insights.businessHealth.summary}\n\n`;

    // Health factors breakdown
    response += `📊 *Score Breakdown:*\n`;
    response += `• Profit Margin: ${insights.businessHealth.factors.profitMargin}/30\n`;
    response += `• Cashflow Stability: ${insights.businessHealth.factors.cashflowStability}/25\n`;
    response += `• Growth Rate: ${insights.businessHealth.factors.growthRate}/25\n`;
    response += `• Operational Efficiency: ${insights.businessHealth.factors.operationalEfficiency}/20\n\n`;

    // Financial metrics
    response += `💰 *METRIK FINANSIAL*\n`;
    response += `Revenue: ${formatCurrency(insights.financialMetrics.revenue.total)}\n`;
    response += `  Growth: ${insights.financialMetrics.revenue.growthRate >= 0 ? "+" : ""}${insights.financialMetrics.revenue.growthRate.toFixed(2)}%\n`;
    response += `Expense: ${formatCurrency(insights.financialMetrics.expenses.total)}\n`;
    response += `  Growth: ${insights.financialMetrics.expenses.growthRate >= 0 ? "+" : ""}${insights.financialMetrics.expenses.growthRate.toFixed(2)}%\n`;
    response += `Net Profit: ${formatCurrency(insights.financialMetrics.profitability.netProfit)}\n`;
    response += `Profit Margin: ${insights.financialMetrics.profitability.profitMargin.toFixed(2)}%\n\n`;

    // Send first part
    const messages1 = splitMessage(response);
    for (const msg of messages1) {
      await message.reply(msg);
    }

    // Growth indicators
    let response2 = `*📈 INDIKATOR PERTUMBUHAN*\n`;
    response2 += `Revenue: ${insights.growthIndicators.revenueGrowth.rate >= 0 ? "+" : ""}${insights.growthIndicators.revenueGrowth.rate.toFixed(2)}% (${insights.growthIndicators.revenueGrowth.trend})\n`;
    response2 += `Expense: ${insights.growthIndicators.expenseGrowth.rate >= 0 ? "+" : ""}${insights.growthIndicators.expenseGrowth.rate.toFixed(2)}% (${insights.growthIndicators.expenseGrowth.trend})\n`;
    response2 += `Operating Leverage: ${insights.growthIndicators.operatingLeverage.toFixed(2)}%\n\n`;

    // Risk factors
    response2 += `⚠️ *FAKTOR RISIKO*\n`;
    response2 += `Volatilitas: *${insights.riskFactors.cashflowVolatility.level.toUpperCase()}*\n`;
    response2 += `  Coefficient: ${insights.riskFactors.cashflowVolatility.coefficient.toFixed(2)}\n`;
    response2 += `Negative Flow Days: ${insights.riskFactors.negativeFlowDays.count} hari (${insights.riskFactors.negativeFlowDays.percentage.toFixed(1)}%)\n`;
    response2 += `  Max Consecutive: ${insights.riskFactors.negativeFlowDays.consecutiveMax} hari\n`;
    response2 += `Diversification Score: ${insights.riskFactors.concentrationRisk.diversificationScore.toFixed(0)}/100\n\n`;

    // Send second part
    const messages2 = splitMessage(response2);
    for (const msg of messages2) {
      await message.reply(msg);
    }

    // Recommendations
    if (insights.recommendations.length > 0) {
      let response3 = `*💼 REKOMENDASI*\n\n`;
      insights.recommendations.forEach((rec, idx) => {
        response3 += `${idx + 1}. ${rec}\n\n`;
      });

      const messages3 = splitMessage(response3);
      for (const msg of messages3) {
        await message.reply(msg);
      }
    }

    // Alerts
    if (insights.alerts.length > 0) {
      let response4 = `*🚨 ALERTS*\n\n`;
      insights.alerts.forEach((alert) => {
        const alertEmoji =
          alert.severity === "critical"
            ? "🔴"
            : alert.severity === "warning"
              ? "🟡"
              : "🔵";
        response4 += `${alertEmoji} *${alert.severity.toUpperCase()}*\n`;
        response4 += `${alert.message}\n`;
        response4 += `_Action: ${alert.action}_\n\n`;
      });

      const messages4 = splitMessage(response4);
      for (const msg of messages4) {
        await message.reply(msg);
      }
    }

    // Offer follow-up options
    await message.reply(
      "💡 *Next Steps:*\n\n" +
        "• Ketik *1* untuk melihat trend 90 hari\n" +
        "• Ketik *3* untuk perbandingan periode\n" +
        "• Ketik *menu* untuk kembali",
    );
  } catch (error) {
    logger.error("Failed to generate investment insights", { error });
    await message.reply(
      "❌ Maaf, terjadi kesalahan saat menghasilkan insights. Silakan coba lagi nanti.",
    );
  }
}

/**
 * Handle period comparison request
 */
export async function handlePeriodComparison(message: Message): Promise<void> {
  logger.info("Generating period comparison for investor", {
    from: message.from,
  });

  await message.reply("⏳ Sedang membandingkan performa periode...");

  try {
    const today = new Date();
    const comparison = await PeriodComparisonService.compareVsLastMonth(today);

    // Format response
    let response = `*📉 PERBANDINGAN PERIODE*\n\n`;

    // Current period
    response += `📅 *PERIODE SEKARANG*\n`;
    response += `${formatDateWITA(comparison.currentPeriod.start)} - ${formatDateWITA(comparison.currentPeriod.end)}\n`;
    response += `Revenue: ${formatCurrency(comparison.currentPeriod.income)}\n`;
    response += `Expense: ${formatCurrency(comparison.currentPeriod.expense)}\n`;
    response += `Net Profit: ${formatCurrency(comparison.currentPeriod.netCashflow)}\n`;
    response += `Transaksi: ${comparison.currentPeriod.transactionCount}\n\n`;

    // Previous period
    response += `📅 *PERIODE SEBELUMNYA*\n`;
    response += `${formatDateWITA(comparison.previousPeriod.start)} - ${formatDateWITA(comparison.previousPeriod.end)}\n`;
    response += `Revenue: ${formatCurrency(comparison.previousPeriod.income)}\n`;
    response += `Expense: ${formatCurrency(comparison.previousPeriod.expense)}\n`;
    response += `Net Profit: ${formatCurrency(comparison.previousPeriod.netCashflow)}\n`;
    response += `Transaksi: ${comparison.previousPeriod.transactionCount}\n\n`;

    // Variance analysis
    response += `📊 *VARIANCE ANALYSIS*\n`;

    // Revenue variance
    const revenueIcon =
      comparison.variance.income.percentage >= 0 ? "📈" : "📉";
    const revenueSignificant = comparison.variance.income.significant
      ? " ⚠️ SIGNIFIKAN"
      : "";
    response += `${revenueIcon} Revenue: ${comparison.variance.income.percentage >= 0 ? "+" : ""}${comparison.variance.income.percentage.toFixed(2)}%${revenueSignificant}\n`;

    // Expense variance
    const expenseIcon =
      comparison.variance.expense.percentage >= 0 ? "📈" : "📉";
    const expenseSignificant = comparison.variance.expense.significant
      ? " ⚠️ SIGNIFIKAN"
      : "";
    response += `${expenseIcon} Expense: ${comparison.variance.expense.percentage >= 0 ? "+" : ""}${comparison.variance.expense.percentage.toFixed(2)}%${expenseSignificant}\n`;

    // Net cashflow variance
    const cashflowIcon =
      comparison.variance.netCashflow.percentage >= 0 ? "📈" : "📉";
    const cashflowSignificant = comparison.variance.netCashflow.significant
      ? " ⚠️ SIGNIFIKAN"
      : "";
    response += `${cashflowIcon} Net Profit: ${comparison.variance.netCashflow.percentage >= 0 ? "+" : ""}${comparison.variance.netCashflow.percentage.toFixed(2)}%${cashflowSignificant}\n\n`;

    // Transaction count variance
    response += `📋 Transaksi: ${comparison.variance.transactionCount.percentage >= 0 ? "+" : ""}${comparison.variance.transactionCount.percentage.toFixed(1)}%\n\n`;

    // Trend analysis
    const trendEmoji =
      comparison.analysis.trend === "improving"
        ? "🟢"
        : comparison.analysis.trend === "declining"
          ? "🔴"
          : "🟡";
    response += `${trendEmoji} *TREND: ${comparison.analysis.trend.toUpperCase()}*\n`;
    response += `${comparison.analysis.summary}\n\n`;

    // Highlights
    if (comparison.analysis.highlights.length > 0) {
      response += `*✨ Highlights:*\n`;
      comparison.analysis.highlights.forEach((highlight) => {
        response += `• ${highlight}\n`;
      });
    }

    // Split and send message
    const messages = splitMessage(response);
    for (const msg of messages) {
      await message.reply(msg);
    }

    // Offer follow-up options
    await message.reply(
      "💡 *Next Steps:*\n\n" +
        "• Ketik *1* untuk melihat trend 90 hari\n" +
        "• Ketik *2* untuk investment insights\n" +
        "• Ketik *menu* untuk kembali",
    );
  } catch (error) {
    logger.error("Failed to generate period comparison", { error });
    await message.reply(
      "❌ Maaf, terjadi kesalahan saat membandingkan periode. Silakan coba lagi nanti.",
    );
  }
}

/**
 * Handle daily summary request
 */
export async function handleDailySummary(message: Message): Promise<void> {
  logger.info("Generating daily summary for investor", {
    from: message.from,
  });

  await message.reply("⏳ Sedang menghasilkan ringkasan harian...");

  try {
    const today = new Date();
    const summary = await ReportGenerator.generateInvestorDailySummary(today);

    // Format response
    let response = `*📋 RINGKASAN HARIAN*\n\n`;
    response += `📅 *Tanggal:* ${formatDateWITA(summary.date)}\n\n`;

    // Daily metrics
    response += `💰 *METRIK HARI INI*\n`;
    response += `Revenue: ${formatCurrency(summary.totalRevenue)}\n`;
    response += `Expense: ${formatCurrency(summary.totalExpense)}\n`;
    response += `Net Profit: ${formatCurrency(summary.netProfit)}\n`;
    response += `Profit Margin: ${summary.profitMargin.toFixed(2)}%\n`;
    response += `Total Transaksi: ${summary.transactionCount}\n\n`;

    // 7-day moving average
    response += `📊 *MOVING AVERAGE (7 HARI)*\n`;
    response += `Avg Revenue: ${formatCurrency(summary.movingAverage.avgIncome)}\n`;
    response += `Avg Expense: ${formatCurrency(summary.movingAverage.avgExpense)}\n`;
    response += `Avg Net: ${formatCurrency(summary.movingAverage.avgNetCashflow)}\n\n`;

    // Comparison with average
    const revenueVsAvg = summary.totalRevenue
      .minus(summary.movingAverage.avgIncome)
      .dividedBy(summary.movingAverage.avgIncome)
      .times(100);

    response += `📈 *VS AVERAGE*\n`;
    response += `Revenue: ${revenueVsAvg.toNumber() >= 0 ? "+" : ""}${revenueVsAvg.toFixed(2)}% vs avg\n`;

    await message.reply(response);

    // Offer follow-up options
    await message.reply(
      "💡 *Lihat Lebih Detail:*\n\n" +
        "• Ketik *1* untuk trend 90 hari\n" +
        "• Ketik *2* untuk investment insights\n" +
        "• Ketik *menu* untuk kembali",
    );
  } catch (error) {
    logger.error("Failed to generate daily summary", { error });
    await message.reply(
      "❌ Maaf, terjadi kesalahan saat menghasilkan ringkasan. Silakan coba lagi nanti.",
    );
  }
}

/**
 * Handle monthly report request
 */
export async function handleMonthlyReport(message: Message): Promise<void> {
  logger.info("Generating monthly report for investor", {
    from: message.from,
  });

  await message.reply("⏳ Sedang menghasilkan laporan bulanan...");

  try {
    const today = new Date();
    const reportData = await ReportGenerator.generateMonthlyReport(today);
    const investorData = reportData.get("investor");

    if (!investorData) {
      await message.reply("❌ Data investor tidak tersedia untuk bulan ini.");
      return;
    }

    // Format response
    let response = `*📑 LAPORAN BULANAN*\n\n`;
    response += `📅 *Bulan:* ${today.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}\n\n`;

    // Summary
    response += `💰 *RINGKASAN*\n`;
    response += `Revenue: ${formatCurrency(investorData.summary.totalIncome)}\n`;
    response += `Expense: ${formatCurrency(investorData.summary.totalExpense)}\n`;
    response += `Net Profit: ${formatCurrency(investorData.summary.netCashflow)}\n`;
    response += `Avg Transaksi: ${formatCurrency(investorData.summary.avgTransaction)}\n`;
    response += `Total Transaksi: ${investorData.summary.transactionCount}\n\n`;

    // Category breakdown
    response += `📊 *BREAKDOWN KATEGORI*\n`;
    investorData.categoryBreakdown.slice(0, 5).forEach((cat) => {
      response += `${cat.category}: ${formatCurrency(cat.amount)} (${cat.percentage.toFixed(1)}%)\n`;
    });
    response += `\n`;

    // Trends
    if (investorData.trends) {
      response += `📈 *TREND*\n`;
      response += `vs Yesterday:\n`;
      response += `  Revenue: ${investorData.trends.vsYesterday.income >= 0 ? "+" : ""}${investorData.trends.vsYesterday.income.toFixed(1)}%\n`;
      response += `  Expense: ${investorData.trends.vsYesterday.expense >= 0 ? "+" : ""}${investorData.trends.vsYesterday.expense.toFixed(1)}%\n`;
    }

    // Split and send message
    const messages = splitMessage(response);
    for (const msg of messages) {
      await message.reply(msg);
    }

    // Offer follow-up options
    await message.reply(
      "💡 *Analisis Lebih Lanjut:*\n\n" +
        "• Ketik *1* untuk trend 90 hari\n" +
        "• Ketik *2* untuk investment insights\n" +
        "• Ketik *menu* untuk kembali",
    );
  } catch (error) {
    logger.error("Failed to generate monthly report", { error });
    await message.reply(
      "❌ Maaf, terjadi kesalahan saat menghasilkan laporan bulanan. Silakan coba lagi nanti.",
    );
  }
}

/**
 * Split long messages into chunks for WhatsApp
 * Max length ~4000 characters to avoid truncation
 */
function splitMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const messages: string[] = [];
  let currentMessage = "";

  const lines = text.split("\n");

  for (const line of lines) {
    if ((currentMessage + line + "\n").length > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage.trim());
        currentMessage = "";
      }

      // If single line is too long, split by words
      if (line.length > maxLength) {
        const words = line.split(" ");
        for (const word of words) {
          if ((currentMessage + word + " ").length > maxLength) {
            messages.push(currentMessage.trim());
            currentMessage = word + " ";
          } else {
            currentMessage += word + " ";
          }
        }
      } else {
        currentMessage = line + "\n";
      }
    } else {
      currentMessage += line + "\n";
    }
  }

  if (currentMessage) {
    messages.push(currentMessage.trim());
  }

  return messages;
}

export default {
  handleInvestorMenu,
  handle90DayTrendAnalysis,
  handleInvestmentInsights,
  handlePeriodComparison,
  handleDailySummary,
  handleMonthlyReport,
};
