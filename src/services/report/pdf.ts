/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import PDFDocument = require("pdfkit");
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { RoleReportData } from "./generator";
import { formatCurrency } from "../../lib/currency";
import { logger } from "../../lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * PDF report generator service
 * Creates PDF reports with charts, tables, and formatted data
 */
export class PDFReportGenerator {
  private static readonly COLORS = {
    primary: "#2563eb",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#ea580c",
    gray: "#6b7280",
    lightGray: "#f3f4f6",
  };

  private static readonly CHART_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  /**
   * Generate PDF report and save to file
   */
  static async generatePDFReport(
    reportData: RoleReportData,
    date: Date,
    outputPath: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Ensure output directory exists
        const outputDir = join(outputPath, "..");
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = createWriteStream(outputPath);
        doc.pipe(stream);

        // Generate report content
        this.addHeader(doc, date);
        this.addSummarySection(doc, reportData);
        this.addCategoryPieChart(doc, reportData);

        // Add page break before detailed sections
        doc.addPage();

        this.addTrendsChart(doc, reportData);
        this.addCategoryTable(doc, reportData);
        this.addTopTransactionsTable(doc, reportData);
        this.addFooter(doc, reportData.role);

        // Finalize PDF
        doc.end();

        stream.on("finish", () => {
          logger.info("PDF report generated successfully", { outputPath });
          resolve(outputPath);
        });

        stream.on("error", (error) => {
          logger.error("Failed to generate PDF report", { error });
          reject(error);
        });
      } catch (error) {
        logger.error("Error generating PDF report", { error });
        reject(error);
      }
    });
  }

  /**
   * Add header section with logo and date
   */
  private static addHeader(
    doc: typeof PDFDocument.prototype,
    date: Date,
  ): void {
    // Title
    doc
      .fontSize(24)
      .fillColor(this.COLORS.primary)
      .text("LAPORAN CASHFLOW HARIAN", { align: "center" });

    // Date
    const dateStr = date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc
      .fontSize(12)
      .fillColor(this.COLORS.gray)
      .text(dateStr, { align: "center" });

    // Horizontal line
    doc
      .moveTo(50, doc.y + 10)
      .lineTo(doc.page.width - 50, doc.y + 10)
      .stroke(this.COLORS.gray);

    doc.moveDown(2);
  }

  /**
   * Add summary section with key metrics
   */
  private static addSummarySection(
    doc: typeof PDFDocument.prototype,
    reportData: RoleReportData,
  ): void {
    const { summary } = reportData;

    doc.fontSize(16).fillColor(this.COLORS.primary).text("Ringkasan");
    doc.moveDown(0.5);

    // Create three-column layout for summary
    const startY = doc.y;
    const colWidth = (doc.page.width - 100) / 3;

    // Total Income
    this.addMetricCard(
      doc,
      50,
      startY,
      colWidth,
      "Pemasukan",
      formatCurrency(summary.totalIncome),
      `${summary.incomeCount} transaksi`,
      this.COLORS.success,
    );

    // Total Expense
    this.addMetricCard(
      doc,
      50 + colWidth,
      startY,
      colWidth,
      "Pengeluaran",
      formatCurrency(summary.totalExpense),
      `${summary.expenseCount} transaksi`,
      this.COLORS.danger,
    );

    // Net Cashflow
    const cashflowColor = summary.netCashflow.greaterThanOrEqualTo(0)
      ? this.COLORS.success
      : this.COLORS.danger;

    this.addMetricCard(
      doc,
      50 + colWidth * 2,
      startY,
      colWidth,
      "Cashflow Bersih",
      formatCurrency(summary.netCashflow),
      `Rata-rata: ${formatCurrency(summary.avgTransaction)}`,
      cashflowColor,
    );

    doc.y = startY + 80;
    doc.moveDown(2);
  }

  /**
   * Add metric card with colored border
   */
  private static addMetricCard(
    doc: typeof PDFDocument.prototype,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    subtext: string,
    color: string,
  ): void {
    // Card background
    doc.rect(x, y, width - 10, 70).fillAndStroke(this.COLORS.lightGray, color);

    // Label
    doc
      .fontSize(10)
      .fillColor(this.COLORS.gray)
      .text(label, x + 10, y + 10, {
        width: width - 30,
        align: "left",
      });

    // Value
    doc
      .fontSize(14)
      .fillColor(color)
      .text(value, x + 10, y + 25, {
        width: width - 30,
        align: "left",
      });

    // Subtext
    doc
      .fontSize(9)
      .fillColor(this.COLORS.gray)
      .text(subtext, x + 10, y + 50, {
        width: width - 30,
        align: "left",
      });
  }

  /**
   * Add pie chart for category breakdown
   */
  private static addCategoryPieChart(
    doc: typeof PDFDocument.prototype,
    reportData: RoleReportData,
  ): void {
    const { categoryBreakdown } = reportData;

    if (categoryBreakdown.length === 0) {
      return;
    }

    doc.fontSize(14).fillColor(this.COLORS.primary).text("Distribusi Kategori");
    doc.moveDown(0.5);

    // Chart dimensions
    const centerX = doc.page.width / 2;
    const centerY = doc.y + 100;
    const radius = 80;

    // Calculate total for percentages
    const total = categoryBreakdown.reduce(
      (sum, cat) => sum + Number(cat.amount),
      0,
    );

    // Draw pie chart
    let startAngle = -90; // Start from top

    categoryBreakdown.forEach((cat, index) => {
      const percentage = (Number(cat.amount) / total) * 100;
      const sweepAngle = (percentage / 100) * 360;
      const color = this.CHART_COLORS[index % this.CHART_COLORS.length];

      // Draw pie slice
      this.drawPieSlice(
        doc,
        centerX,
        centerY,
        radius,
        startAngle,
        sweepAngle,
        color,
      );

      startAngle += sweepAngle;
    });

    // Add legend
    this.addPieChartLegend(doc, categoryBreakdown, centerY + radius + 30);

    doc.moveDown(2);
  }

  /**
   * Draw pie chart slice
   */
  private static drawPieSlice(
    doc: typeof PDFDocument.prototype,
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    sweepAngle: number,
    color: string,
  ): void {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + sweepAngle) * Math.PI) / 180;

    doc.save();
    doc.fillColor(color);

    // Move to center
    doc.moveTo(centerX, centerY);

    // Draw arc
    const startX = centerX + radius * Math.cos(startRad);
    const startY = centerY + radius * Math.sin(startRad);
    doc.lineTo(startX, startY);

    // Draw the arc segment
    const segments = Math.ceil(Math.abs(sweepAngle) / 15);
    for (let i = 1; i <= segments; i++) {
      const angle = startRad + (endRad - startRad) * (i / segments);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      doc.lineTo(x, y);
    }

    doc.lineTo(centerX, centerY);
    doc.fill();
    doc.restore();
  }

  /**
   * Add legend for pie chart
   */
  private static addPieChartLegend(
    doc: typeof PDFDocument.prototype,
    categoryBreakdown: Array<{
      category: string;
      amount: Decimal;
      percentage: number;
    }>,
    startY: number,
  ): void {
    const legendX = 100;
    let legendY = startY;

    categoryBreakdown.forEach((cat, index) => {
      const color = this.CHART_COLORS[index % this.CHART_COLORS.length];

      // Color box
      doc.rect(legendX, legendY, 12, 12).fillAndStroke(color, color);

      // Category name and percentage
      doc
        .fontSize(10)
        .fillColor(this.COLORS.gray)
        .text(
          `${cat.category}: ${cat.percentage.toFixed(1)}% (${formatCurrency(cat.amount)})`,
          legendX + 20,
          legendY,
          { width: 400 },
        );

      legendY += 18;
    });
  }

  /**
   * Add trends chart comparing periods
   */
  private static addTrendsChart(
    doc: typeof PDFDocument.prototype,
    reportData: RoleReportData,
  ): void {
    const { trends } = reportData;

    if (!trends) {
      return;
    }

    doc.fontSize(14).fillColor(this.COLORS.primary).text("Perbandingan Tren");
    doc.moveDown(0.5);

    // Simple bar chart for trends
    const chartX = 80;
    const chartY = doc.y + 20;
    const barWidth = 60;
    const maxBarHeight = 100;

    // Yesterday comparison
    if (trends.vsYesterday) {
      const { income, expense, cashflow } = trends.vsYesterday;

      this.drawTrendBar(
        doc,
        chartX,
        chartY,
        barWidth,
        maxBarHeight,
        income,
        "vs Kemarin (Pemasukan)",
        this.COLORS.success,
      );

      this.drawTrendBar(
        doc,
        chartX + 120,
        chartY,
        barWidth,
        maxBarHeight,
        expense,
        "vs Kemarin (Pengeluaran)",
        this.COLORS.danger,
      );

      this.drawTrendBar(
        doc,
        chartX + 240,
        chartY,
        barWidth,
        maxBarHeight,
        cashflow,
        "vs Kemarin (Cashflow)",
        cashflow >= 0 ? this.COLORS.success : this.COLORS.danger,
      );
    }

    doc.y = chartY + maxBarHeight + 60;
    doc.moveDown(1);
  }

  /**
   * Draw trend bar
   */
  private static drawTrendBar(
    doc: typeof PDFDocument.prototype,
    x: number,
    y: number,
    width: number,
    maxHeight: number,
    percentage: number,
    label: string,
    color: string,
  ): void {
    const height = Math.min(Math.abs(percentage), 100) * (maxHeight / 100);
    const barY = percentage >= 0 ? y + maxHeight - height : y + maxHeight;

    // Draw bar
    doc.rect(x, barY, width, height).fillAndStroke(color, color);

    // Draw percentage
    doc
      .fontSize(10)
      .fillColor(color)
      .text(`${percentage.toFixed(1)}%`, x, barY - 15, {
        width: width,
        align: "center",
      });

    // Draw label
    doc
      .fontSize(8)
      .fillColor(this.COLORS.gray)
      .text(label, x - 20, y + maxHeight + 10, {
        width: width + 40,
        align: "center",
      });
  }

  /**
   * Add category breakdown table
   */
  private static addCategoryTable(
    doc: typeof PDFDocument.prototype,
    reportData: RoleReportData,
  ): void {
    const { categoryBreakdown } = reportData;

    if (categoryBreakdown.length === 0) {
      return;
    }

    doc.fontSize(14).fillColor(this.COLORS.primary).text("Rincian Kategori");
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colWidths = [200, 150, 100, 100];
    const tableLeft = 50;

    this.drawTableRow(
      doc,
      tableTop,
      tableLeft,
      colWidths,
      ["Kategori", "Jumlah", "Transaksi", "Persentase"],
      true,
    );

    // Table rows
    let rowY = tableTop + 20;
    categoryBreakdown.forEach((cat) => {
      this.drawTableRow(doc, rowY, tableLeft, colWidths, [
        cat.category,
        formatCurrency(cat.amount),
        cat.count.toString(),
        `${cat.percentage.toFixed(1)}%`,
      ]);
      rowY += 20;
    });

    doc.y = rowY + 10;
    doc.moveDown(1);
  }

  /**
   * Add top transactions table
   */
  private static addTopTransactionsTable(
    doc: typeof PDFDocument.prototype,
    reportData: RoleReportData,
  ): void {
    const { topTransactions } = reportData;

    if (topTransactions.length === 0) {
      return;
    }

    doc.fontSize(14).fillColor(this.COLORS.primary).text("Transaksi Terbesar");
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colWidths = [80, 120, 150, 150];
    const tableLeft = 50;

    this.drawTableRow(
      doc,
      tableTop,
      tableLeft,
      colWidths,
      ["Tipe", "Kategori", "Jumlah", "Keterangan"],
      true,
    );

    // Table rows (top 10)
    let rowY = tableTop + 20;
    topTransactions.slice(0, 10).forEach((txn) => {
      this.drawTableRow(doc, rowY, tableLeft, colWidths, [
        txn.type === "income" ? "Masuk" : "Keluar",
        txn.category,
        formatCurrency(txn.amount),
        txn.description || "-",
      ]);
      rowY += 20;
    });

    doc.y = rowY + 10;
  }

  /**
   * Draw table row
   */
  private static drawTableRow(
    doc: typeof PDFDocument.prototype,
    y: number,
    x: number,
    colWidths: number[],
    values: string[],
    isHeader = false,
  ): void {
    const fontSize = isHeader ? 10 : 9;
    const textColor = isHeader ? this.COLORS.primary : this.COLORS.gray;

    doc.fontSize(fontSize).fillColor(textColor);

    let currentX = x;
    values.forEach((value, index) => {
      doc.text(value, currentX, y, {
        width: colWidths[index] - 10,
        align: "left",
      });
      currentX += colWidths[index];
    });

    // Draw line below header
    if (isHeader) {
      doc
        .moveTo(x, y + 15)
        .lineTo(x + colWidths.reduce((a, b) => a + b, 0), y + 15)
        .stroke(this.COLORS.gray);
    }
  }

  /**
   * Add footer with generation timestamp
   */
  private static addFooter(
    doc: typeof PDFDocument.prototype,
    _role: string,
  ): void {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Footer line
      doc
        .moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke(this.COLORS.gray);

      // Page number
      doc
        .fontSize(9)
        .fillColor(this.COLORS.gray)
        .text(`Halaman ${i + 1} dari ${pageCount}`, 50, doc.page.height - 40, {
          align: "center",
        });

      // Generation timestamp
      const timestamp = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Makassar",
      });

      doc
        .fontSize(8)
        .fillColor(this.COLORS.gray)
        .text(`Dibuat: ${timestamp} WITA`, 50, doc.page.height - 25, {
          align: "center",
        });
    }
  }
}
