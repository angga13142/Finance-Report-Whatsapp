/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Message } from "whatsapp-web.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { ReportGenerator } from "../../services/report/generator";
import { ReportFormatter } from "../../services/report/formatter";
import { PDFReportGenerator } from "../../services/report/pdf";
import { promises as fs } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

/**
 * Report drill-down handler
 * Handles detailed report requests from users
 * Commands: "detail", "detail kategori [nama]", "bandingkan [periode]"
 */
export class ReportDrillDownHandler {
  /**
   * Handle report drill-down request
   */
  static async handleReportRequest(message: Message): Promise<void> {
    try {
      // Get user from phone number
      const phoneNumber = message.from.replace("@c.us", "");
      const user = await prisma.user.findFirst({
        where: {
          phoneNumber,
          isActive: true,
        },
      });

      if (!user) {
        await message.reply(
          "❌ Anda belum terdaftar dalam sistem. Hubungi admin untuk registrasi.",
        );
        return;
      }

      const text = message.body.toLowerCase().trim();

      // Route to specific handler based on command
      if (text === "detail" || text === "laporan detail") {
        await this.handleDetailRequest(message, user.id, user.role);
      } else if (text.startsWith("detail kategori")) {
        await this.handleCategoryDetailRequest(message, user.id, user.role);
      } else if (text.startsWith("bandingkan")) {
        await this.handleComparisonRequest(message, user.id, user.role);
      } else if (text === "laporan pdf" || text === "download pdf") {
        await this.handlePDFRequest(message, user.id, user.role);
      } else if (text === "laporan minggu ini") {
        await this.handleWeeklyRequest(message, user.id, user.role);
      } else if (text === "laporan bulan ini") {
        await this.handleMonthlyRequest(message, user.id, user.role);
      } else {
        await message.reply(
          "ℹ️ *Perintah Laporan yang Tersedia:*\n\n" +
            "📊 *detail* - Laporan lengkap hari ini\n" +
            "🏷️ *detail kategori [nama]* - Detail per kategori\n" +
            "📈 *bandingkan [periode]* - Perbandingan periode\n" +
            "📄 *laporan pdf* - Download laporan PDF\n" +
            "📅 *laporan minggu ini* - Laporan mingguan\n" +
            "📅 *laporan bulan ini* - Laporan bulanan",
        );
      }
    } catch (error) {
      logger.error("Error handling report request", { error });
      await message.reply(
        "❌ Terjadi kesalahan saat memproses permintaan laporan. Silakan coba lagi.",
      );
    }
  }

  /**
   * Handle detailed report request (today's full report)
   */
  private static async handleDetailRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating detailed report", {
      userId,
      role,
      startDate,
      endDate,
    });

    const reportData = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      startDate,
      endDate,
    );

    const formattedReport = ReportFormatter.formatDetailedReport(
      reportData,
      startDate,
    );

    await message.reply(formattedReport);
  }

  /**
   * Handle category detail request
   */
  private static async handleCategoryDetailRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const text = message.body.toLowerCase();
    const categoryMatch = text.match(/detail kategori\s+(.+)/i);

    if (!categoryMatch) {
      await message.reply(
        "❌ Format: *detail kategori [nama]*\n\nContoh: detail kategori operasional",
      );
      return;
    }

    const categoryName = categoryMatch[1].trim();

    // Get today's date range
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating category detail report", {
      userId,
      role,
      category: categoryName,
      startDate,
      endDate,
    });

    // Get transactions for this category
    const transactions = await prisma.transaction.findMany({
      where: {
        category: {
          contains: categoryName,
          mode: "insensitive",
        },
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        approvalStatus: "approved",
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        amount: "desc",
      },
      take: 20,
    });

    if (transactions.length === 0) {
      await message.reply(
        `📊 Tidak ada transaksi untuk kategori *${categoryName}* hari ini.`,
      );
      return;
    }

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Format response
    let response = `📊 *Detail Kategori: ${transactions[0].category}*\n`;
    response += `📅 ${startDate.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n`;
    response += `💰 Total Pemasukan: Rp ${totalIncome.toLocaleString("id-ID")}\n`;
    response += `💸 Total Pengeluaran: Rp ${totalExpense.toLocaleString("id-ID")}\n`;
    response += `📊 Total Transaksi: ${transactions.length}\n\n`;
    response += `*Detail Transaksi:*\n`;

    for (const transaction of transactions.slice(0, 10)) {
      const emoji = transaction.type === "income" ? "💰" : "💸";
      const sign = transaction.type === "income" ? "+" : "-";
      response += `${emoji} ${sign}Rp ${Number(transaction.amount).toLocaleString("id-ID")}\n`;
      response += `   ${transaction.description}\n`;
      response += `   👤 ${transaction.user.name || "Unknown"}\n`;
      response += `   🕐 ${transaction.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}\n\n`;
    }

    if (transactions.length > 10) {
      response += `\n_... dan ${transactions.length - 10} transaksi lainnya_`;
    }

    await message.reply(response);
  }

  /**
   * Handle comparison request (period comparison)
   */
  private static async handleComparisonRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const text = message.body.toLowerCase();

    let periodType: "day" | "week" | "month" = "day";
    if (text.includes("minggu")) {
      periodType = "week";
    } else if (text.includes("bulan")) {
      periodType = "month";
    }

    logger.info("Generating comparison report", {
      userId,
      role,
      periodType,
    });

    // Current period
    const currentEndDate = new Date();
    const currentStartDate = new Date();

    // Previous period
    const previousEndDate = new Date();
    const previousStartDate = new Date();

    // Set date ranges based on period type
    if (periodType === "day") {
      currentStartDate.setHours(0, 0, 0, 0);
      currentEndDate.setHours(23, 59, 59, 999);

      previousStartDate.setDate(currentStartDate.getDate() - 1);
      previousStartDate.setHours(0, 0, 0, 0);
      previousEndDate.setDate(currentEndDate.getDate() - 1);
      previousEndDate.setHours(23, 59, 59, 999);
    } else if (periodType === "week") {
      // Current week (Monday to Sunday)
      const dayOfWeek = currentStartDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      currentStartDate.setDate(currentStartDate.getDate() - daysToMonday);
      currentStartDate.setHours(0, 0, 0, 0);
      currentEndDate.setHours(23, 59, 59, 999);

      // Previous week
      previousEndDate.setDate(currentStartDate.getDate() - 1);
      previousEndDate.setHours(23, 59, 59, 999);
      previousStartDate.setDate(previousEndDate.getDate() - 6);
      previousStartDate.setHours(0, 0, 0, 0);
    } else {
      // Current month
      currentStartDate.setDate(1);
      currentStartDate.setHours(0, 0, 0, 0);
      currentEndDate.setHours(23, 59, 59, 999);

      // Previous month
      previousEndDate.setMonth(currentStartDate.getMonth() - 1);
      previousEndDate.setDate(
        new Date(
          previousEndDate.getFullYear(),
          previousEndDate.getMonth() + 1,
          0,
        ).getDate(),
      );
      previousEndDate.setHours(23, 59, 59, 999);
      previousStartDate.setMonth(previousEndDate.getMonth());
      previousStartDate.setDate(1);
      previousStartDate.setHours(0, 0, 0, 0);
    }

    // Generate reports for both periods
    const currentReport = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      currentStartDate,
      currentEndDate,
    );

    const previousReport = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      previousStartDate,
      previousEndDate,
    );

    // Calculate changes
    const incomeChange =
      Number(currentReport.summary.totalIncome) -
      Number(previousReport.summary.totalIncome);
    const expenseChange =
      Number(currentReport.summary.totalExpense) -
      Number(previousReport.summary.totalExpense);
    const netCashflowChange =
      Number(currentReport.summary.netCashflow) -
      Number(previousReport.summary.netCashflow);

    const incomeChangePercent =
      Number(previousReport.summary.totalIncome) > 0
        ? (incomeChange / Number(previousReport.summary.totalIncome)) * 100
        : 0;
    const expenseChangePercent =
      Number(previousReport.summary.totalExpense) > 0
        ? (expenseChange / Number(previousReport.summary.totalExpense)) * 100
        : 0;

    // Format response
    const periodNames = {
      day: { current: "Hari Ini", previous: "Kemarin" },
      week: { current: "Minggu Ini", previous: "Minggu Lalu" },
      month: { current: "Bulan Ini", previous: "Bulan Lalu" },
    };

    let response = `📊 *Perbandingan ${periodNames[periodType].current} vs ${periodNames[periodType].previous}*\n\n`;

    response += `*${periodNames[periodType].current}:*\n`;
    response += `💰 Pemasukan: Rp ${Number(currentReport.summary.totalIncome).toLocaleString("id-ID")}\n`;
    response += `💸 Pengeluaran: Rp ${Number(currentReport.summary.totalExpense).toLocaleString("id-ID")}\n`;
    response += `📊 Net Cashflow: Rp ${Number(currentReport.summary.netCashflow).toLocaleString("id-ID")}\n\n`;

    response += `*${periodNames[periodType].previous}:*\n`;
    response += `💰 Pemasukan: Rp ${Number(previousReport.summary.totalIncome).toLocaleString("id-ID")}\n`;
    response += `💸 Pengeluaran: Rp ${Number(previousReport.summary.totalExpense).toLocaleString("id-ID")}\n`;
    response += `📊 Net Cashflow: Rp ${Number(previousReport.summary.netCashflow).toLocaleString("id-ID")}\n\n`;

    response += `*Perubahan:*\n`;
    response += `${incomeChange >= 0 ? "📈" : "📉"} Pemasukan: ${incomeChange >= 0 ? "+" : ""}Rp ${incomeChange.toLocaleString("id-ID")} (${incomeChangePercent >= 0 ? "+" : ""}${incomeChangePercent.toFixed(1)}%)\n`;
    response += `${expenseChange <= 0 ? "📈" : "📉"} Pengeluaran: ${expenseChange >= 0 ? "+" : ""}Rp ${expenseChange.toLocaleString("id-ID")} (${expenseChangePercent >= 0 ? "+" : ""}${expenseChangePercent.toFixed(1)}%)\n`;
    response += `${netCashflowChange >= 0 ? "📈" : "📉"} Net Cashflow: ${netCashflowChange >= 0 ? "+" : ""}Rp ${netCashflowChange.toLocaleString("id-ID")}\n`;

    await message.reply(response);
  }

  /**
   * Handle PDF report request
   */
  private static async handlePDFRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    await message.reply(
      "📄 Sedang menghasilkan laporan PDF... Mohon tunggu sebentar.",
    );

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating PDF report", {
      userId,
      role,
      startDate,
      endDate,
    });

    const reportData = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      startDate,
      endDate,
    );

    // Generate PDF
    const outputDir = join(process.cwd(), "temp", "reports");
    await fs.mkdir(outputDir, { recursive: true });

    const filename = `report-${userId}-${Date.now()}.pdf`;
    const outputPath = join(outputDir, filename);

    await PDFReportGenerator.generatePDFReport(
      reportData,
      startDate,
      outputPath,
    );

    // TODO: Send PDF file via WhatsApp
    // For now, just send confirmation
    await message.reply(
      `✅ Laporan PDF berhasil dibuat!\n\n` +
        `📁 File: ${filename}\n` +
        `📅 Periode: ${startDate.toLocaleDateString("id-ID")}\n\n` +
        `_File akan dikirim segera..._`,
    );

    // Clean up temp file after 1 hour
    setTimeout(
      () => {
        void fs.unlink(outputPath).catch((error) => {
          logger.error("Failed to delete temp PDF", { outputPath, error });
        });
      },
      60 * 60 * 1000,
    );
  }

  /**
   * Handle weekly report request
   */
  private static async handleWeeklyRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();

    // Get start of week (Monday)
    const dayOfWeek = startDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToMonday);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating weekly report", {
      userId,
      role,
      startDate,
      endDate,
    });

    const reportData = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      startDate,
      endDate,
    );

    const formattedReport = ReportFormatter.formatShortSummary(reportData);

    await message.reply(
      `📅 *Laporan Minggu Ini*\n` +
        `${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}\n\n` +
        formattedReport,
    );
  }

  /**
   * Handle monthly report request
   */
  private static async handleMonthlyRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();

    // Get start of month
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating monthly report", {
      userId,
      role,
      startDate,
      endDate,
    });

    const reportData = await ReportGenerator.generateRoleSpecificReport(
      role as never,
      startDate,
      endDate,
    );

    const formattedReport = ReportFormatter.formatDetailedReport(
      reportData,
      startDate,
    );

    await message.reply(
      `📅 *Laporan Bulan ${startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}*\n\n` +
        formattedReport,
    );
  }
}
