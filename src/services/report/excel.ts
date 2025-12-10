import * as ExcelJS from "exceljs";
import { UserRole } from "@prisma/client";
import { RoleReportData } from "./generator";
import { logger } from "../../lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Excel export service
 * Generates Excel reports with role-based data filtering
 */
export class ExcelExportService {
  /**
   * Generate Excel report buffer
   */
  static async generateExcelReport(
    reportData: RoleReportData,
    role: UserRole,
    fileName: string,
  ): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "WhatsApp Cashflow Bot";
      workbook.created = new Date();

      // Add summary sheet
      this.addSummarySheet(workbook, reportData, role);

      // Add category breakdown sheet
      this.addCategorySheet(workbook, reportData);

      // Add transactions sheet (role-dependent)
      if (role !== "investor") {
        this.addTransactionsSheet(workbook, reportData, role);
      }

      // Add trends sheet
      if (reportData.trends) {
        this.addTrendsSheet(workbook, reportData);
      }

      // Generate buffer
      const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
      const nodeBuffer = Buffer.from(buffer);

      logger.info("Excel report generated", {
        role,
        fileName,
        size: nodeBuffer.length,
      });

      return nodeBuffer;
    } catch (error) {
      logger.error("Error generating Excel report", { error, role, fileName });
      throw error;
    }
  }

  /**
   * Add summary sheet
   */
  private static addSummarySheet(
    workbook: ExcelJS.Workbook,
    reportData: RoleReportData,
    role: UserRole,
  ): void {
    const sheet = workbook.addWorksheet("Ringkasan", {
      properties: { tabColor: { argb: "FF4CAF50" } },
    });

    // Set column widths
    sheet.columns = [{ width: 30 }, { width: 20 }];

    // Title
    sheet.mergeCells("A1:B1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "📊 LAPORAN KEUANGAN";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: "center" };

    // Role
    sheet.mergeCells("A2:B2");
    const roleCell = sheet.getCell("A2");
    roleCell.value = `Role: ${this.getRoleDisplay(role)}`;
    roleCell.font = { size: 12, italic: true };
    roleCell.alignment = { horizontal: "center" };

    // Empty row
    sheet.getRow(3).height = 5;

    // Summary data
    const { summary } = reportData;
    let row = 4;

    // Headers
    const headerRow = sheet.getRow(row++);
    headerRow.values = ["Metrik", "Nilai"];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Data rows
    this.addDataRow(
      sheet,
      row++,
      "💰 Total Pemasukan",
      this.formatCurrency(summary.totalIncome),
    );
    this.addDataRow(
      sheet,
      row++,
      "💸 Total Pengeluaran",
      this.formatCurrency(summary.totalExpense),
    );
    this.addDataRow(
      sheet,
      row++,
      "📊 Net Cashflow",
      this.formatCurrency(summary.netCashflow),
      summary.netCashflow.toNumber() >= 0 ? "positive" : "negative",
    );

    row++; // Empty row

    this.addDataRow(
      sheet,
      row++,
      "📝 Total Transaksi",
      summary.transactionCount,
    );
    this.addDataRow(
      sheet,
      row++,
      "➕ Transaksi Pemasukan",
      summary.incomeCount,
    );
    this.addDataRow(
      sheet,
      row++,
      "➖ Transaksi Pengeluaran",
      summary.expenseCount,
    );

    row++; // Empty row

    this.addDataRow(
      sheet,
      row++,
      "📊 Rata-rata Transaksi",
      this.formatCurrency(summary.avgTransaction),
    );

    // Auto-filter
    sheet.autoFilter = {
      from: "A4",
      to: `B${row - 1}`,
    };
  }

  /**
   * Add category breakdown sheet
   */
  private static addCategorySheet(
    workbook: ExcelJS.Workbook,
    reportData: RoleReportData,
  ): void {
    const sheet = workbook.addWorksheet("Kategori", {
      properties: { tabColor: { argb: "FF2196F3" } },
    });

    // Set column widths
    sheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];

    // Title
    sheet.mergeCells("A1:D1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "📂 BREAKDOWN KATEGORI";
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: "center" };

    // Empty row
    sheet.getRow(2).height = 5;

    // Headers
    const headerRow = sheet.getRow(3);
    headerRow.values = [
      "Kategori",
      "Total Amount",
      "Jumlah Transaksi",
      "Persentase",
    ];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Data rows
    const { categoryBreakdown } = reportData;
    categoryBreakdown.forEach((cat, index) => {
      const row = sheet.getRow(4 + index);
      row.values = [
        cat.category,
        this.formatCurrency(cat.amount),
        cat.count,
        `${cat.percentage.toFixed(2)}%`,
      ];

      // Format currency column
      row.getCell(2).alignment = { horizontal: "right" };
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "center" };
    });

    // Auto-filter
    sheet.autoFilter = {
      from: "A3",
      to: `D${3 + categoryBreakdown.length}`,
    };
  }

  /**
   * Add transactions sheet
   */
  private static addTransactionsSheet(
    workbook: ExcelJS.Workbook,
    reportData: RoleReportData,
    role: UserRole,
  ): void {
    const sheet = workbook.addWorksheet("Transaksi", {
      properties: { tabColor: { argb: "FFFF9800" } },
    });

    // Set column widths
    const columns: Array<{ width: number }> = [
      { width: 15 }, // Type
      { width: 20 }, // Category
      { width: 18 }, // Amount
      { width: 30 }, // Description
      { width: 20 }, // Timestamp
    ];

    if (role === "boss" || role === "dev") {
      columns.push({ width: 20 }); // User name
    }

    sheet.columns = columns;

    // Title
    const titleCell = sheet.getCell("A1");
    titleCell.value = "💳 TOP TRANSAKSI";
    titleCell.font = { size: 14, bold: true };
    sheet.mergeCells("A1:E1");
    titleCell.alignment = { horizontal: "center" };

    // Empty row
    sheet.getRow(2).height = 5;

    // Headers
    const headerRow = sheet.getRow(3);
    const headers = ["Tipe", "Kategori", "Amount", "Deskripsi", "Timestamp"];
    if (role === "boss" || role === "dev") {
      headers.push("User");
    }
    headerRow.values = headers;
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Data rows
    const { topTransactions } = reportData;
    topTransactions.forEach((txn, index) => {
      const row = sheet.getRow(4 + index);
      const values: Array<string | number> = [
        txn.type === "income" ? "Pemasukan" : "Pengeluaran",
        txn.category,
        this.formatCurrency(txn.amount),
        txn.description || "-",
        txn.timestamp.toLocaleString("id-ID", {
          timeZone: "Asia/Makassar",
        }),
      ];

      if (role === "boss" || role === "dev") {
        values.push(txn.userName || "Unknown");
      }

      row.values = values;

      // Format amount column
      row.getCell(3).alignment = { horizontal: "right" };

      // Color code by type
      if (txn.type === "income") {
        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC8E6C9" },
        };
      } else {
        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFCDD2" },
        };
      }
    });

    // Auto-filter
    const lastColumn = role === "boss" || role === "dev" ? "F" : "E";
    sheet.autoFilter = {
      from: "A3",
      to: `${lastColumn}${3 + topTransactions.length}`,
    };
  }

  /**
   * Add trends sheet
   */
  private static addTrendsSheet(
    workbook: ExcelJS.Workbook,
    reportData: RoleReportData,
  ): void {
    const sheet = workbook.addWorksheet("Trends", {
      properties: { tabColor: { argb: "FF9C27B0" } },
    });

    if (!reportData.trends) return;

    // Set column widths
    sheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // Title
    sheet.mergeCells("A1:D1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "📈 TREND ANALYSIS";
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: "center" };

    // Empty row
    sheet.getRow(2).height = 5;

    // Headers
    const headerRow = sheet.getRow(3);
    headerRow.values = ["Metrik", "Pemasukan", "Pengeluaran", "Cashflow"];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    let row = 4;

    // vs Yesterday
    const { vsYesterday, vs7DayAvg } = reportData.trends;
    this.addTrendRow(
      sheet,
      row++,
      "vs Yesterday",
      vsYesterday.income,
      vsYesterday.expense,
      vsYesterday.cashflow,
    );

    this.addTrendRow(
      sheet,
      row++,
      "vs 7-Day Avg",
      vs7DayAvg.income,
      vs7DayAvg.expense,
      vs7DayAvg.cashflow,
    );
  }

  /**
   * Add data row helper
   */
  private static addDataRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    value: string | number,
    style?: "positive" | "negative",
  ): void {
    const row = sheet.getRow(rowNum);
    row.values = [label, value];

    if (style === "positive") {
      row.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC8E6C9" },
      };
      row.getCell(2).font = { bold: true, color: { argb: "FF2E7D32" } };
    } else if (style === "negative") {
      row.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFCDD2" },
      };
      row.getCell(2).font = { bold: true, color: { argb: "FFC62828" } };
    }

    row.getCell(2).alignment = { horizontal: "right" };
  }

  /**
   * Add trend row helper
   */
  private static addTrendRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    income: number,
    expense: number,
    cashflow: number,
  ): void {
    const row = sheet.getRow(rowNum);
    row.values = [
      label,
      `${income >= 0 ? "+" : ""}${income.toFixed(2)}%`,
      `${expense >= 0 ? "+" : ""}${expense.toFixed(2)}%`,
      `${cashflow >= 0 ? "+" : ""}${cashflow.toFixed(2)}%`,
    ];

    // Color code
    this.colorCodeCell(row.getCell(2), income);
    this.colorCodeCell(row.getCell(3), expense);
    this.colorCodeCell(row.getCell(4), cashflow);
  }

  /**
   * Color code cell based on value
   */
  private static colorCodeCell(cell: ExcelJS.Cell, value: number): void {
    cell.alignment = { horizontal: "center" };

    if (value > 0) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC8E6C9" },
      };
      cell.font = { color: { argb: "FF2E7D32" } };
    } else if (value < 0) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFCDD2" },
      };
      cell.font = { color: { argb: "FFC62828" } };
    }
  }

  /**
   * Format currency
   */
  private static formatCurrency(amount: Decimal | number): string {
    const num = typeof amount === "number" ? amount : amount.toNumber();
    return `Rp ${new Intl.NumberFormat("id-ID").format(num)}`;
  }

  /**
   * Get role display name
   */
  private static getRoleDisplay(role: UserRole): string {
    const roleMap: Record<UserRole, string> = {
      employee: "Karyawan",
      boss: "Boss",
      investor: "Investor",
      dev: "Developer",
    };
    return roleMap[role] || role;
  }
}

export default ExcelExportService;
