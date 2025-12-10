import { PrismaClient, UserRole } from "@prisma/client";
import { logger } from "../../lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/**
 * Transaction summary interface
 */
export interface TransactionSummary {
  totalIncome: Decimal;
  totalExpense: Decimal;
  netCashflow: Decimal;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  avgTransaction: Decimal;
}

/**
 * Category breakdown interface
 */
export interface CategoryBreakdown {
  category: string;
  amount: Decimal;
  count: number;
  percentage: number;
}

/**
 * Role-specific report data interface
 */
export interface RoleReportData {
  role: UserRole;
  summary: TransactionSummary;
  categoryBreakdown: CategoryBreakdown[];
  topTransactions: Array<{
    id: string;
    type: string;
    category: string;
    amount: Decimal;
    description: string | null;
    timestamp: Date;
    userName: string | null;
  }>;
  trends?: {
    vsYesterday: {
      income: number;
      expense: number;
      cashflow: number;
    };
    vs7DayAvg: {
      income: number;
      expense: number;
      cashflow: number;
    };
    vsMonthlyTarget?: {
      revenue: number;
      expense: number;
    };
  };
}

/**
 * Report generator service
 * Aggregates transaction data for reports
 */
export class ReportGenerator {
  /**
   * Generate daily report data for a specific date
   */
  static async generateDailyReport(
    date: Date,
  ): Promise<Map<UserRole, RoleReportData>> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    logger.info("Generating daily report", { date, startOfDay, endOfDay });

    const roles: UserRole[] = ["dev", "boss", "employee", "investor"];
    const reportData = new Map<UserRole, RoleReportData>();

    for (const role of roles) {
      const data = await this.generateRoleSpecificReport(
        role,
        startOfDay,
        endOfDay,
      );
      reportData.set(role, data);
    }

    return reportData;
  }

  /**
   * Generate role-specific report data
   */
  static async generateRoleSpecificReport(
    role: UserRole,
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<RoleReportData> {
    logger.debug("Generating role-specific report", {
      role,
      startDate,
      endDate,
      userId,
    });

    // Base query - filter by role permissions
    const whereClause = this.buildWhereClauseForRole(
      role,
      startDate,
      endDate,
      userId,
    );

    // Get summary statistics
    const summary = await this.calculateSummary(whereClause);

    // Get category breakdown
    const categoryBreakdown = await this.getCategoryBreakdown(whereClause);

    // Get top transactions
    const topTransactions = await this.getTopTransactions(whereClause, role);

    // Calculate trends (comparison with previous periods)
    const trends = await this.calculateTrends(
      role,
      startDate,
      endDate,
      summary,
      userId,
    );

    return {
      role,
      summary,
      categoryBreakdown,
      topTransactions,
      trends,
    };
  }

  /**
   * Build where clause based on role permissions
   */
  private static buildWhereClauseForRole(
    role: UserRole,
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Record<string, unknown> {
    const baseWhere: Record<string, unknown> = {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
      approvalStatus: "approved", // Only include approved transactions
    };

    // Role-based filtering
    switch (role) {
      case "employee":
        // Employees only see their own transactions
        if (userId) {
          baseWhere.userId = userId;
        }
        break;
      case "investor":
        // Investor sees aggregated data only (no individual transactions in detail)
        break;
      case "boss":
      case "dev":
        // Boss and Dev see all transactions
        break;
    }

    return baseWhere;
  }

  /**
   * Calculate summary statistics
   */
  private static async calculateSummary(
    whereClause: Record<string, unknown>,
  ): Promise<TransactionSummary> {
    const transactions = await prisma.transaction.findMany({
      where: whereClause as never,
      select: {
        amount: true,
        type: true,
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach((txn) => {
      if (txn.type === "income") {
        totalIncome = totalIncome.plus(txn.amount);
        incomeCount++;
      } else {
        totalExpense = totalExpense.plus(txn.amount);
        expenseCount++;
      }
    });

    const netCashflow = totalIncome.minus(totalExpense);
    const transactionCount = transactions.length;
    const avgTransaction =
      transactionCount > 0
        ? totalIncome.plus(totalExpense).dividedBy(transactionCount)
        : new Decimal(0);

    return {
      totalIncome,
      totalExpense,
      netCashflow,
      transactionCount,
      incomeCount,
      expenseCount,
      avgTransaction,
    };
  }

  /**
   * Get category breakdown
   */
  private static async getCategoryBreakdown(
    whereClause: Record<string, unknown>,
  ): Promise<CategoryBreakdown[]> {
    const result = await prisma.transaction.groupBy({
      by: ["category", "type"],
      where: whereClause as never,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Calculate total for percentage
    const total = result.reduce(
      (sum, item) => sum.plus(item._sum.amount || 0),
      new Decimal(0),
    );

    return result.map((item) => {
      const amount = new Decimal(item._sum.amount || 0);
      const percentage = total.greaterThan(0)
        ? amount.dividedBy(total).times(100).toNumber()
        : 0;

      return {
        category: item.category,
        amount,
        count: item._count.id,
        percentage,
      };
    });
  }

  /**
   * Get top transactions
   */
  private static async getTopTransactions(
    whereClause: Record<string, unknown>,
    role: UserRole,
  ): Promise<
    Array<{
      id: string;
      type: string;
      category: string;
      amount: Decimal;
      description: string | null;
      timestamp: Date;
      userName: string | null;
    }>
  > {
    // Investor should not see individual transactions
    if (role === "investor") {
      return [];
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause as never,
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
      take: 5,
    });

    return transactions.map((txn) => ({
      id: txn.id,
      type: txn.type,
      category: txn.category,
      amount: txn.amount,
      description: txn.description,
      timestamp: txn.timestamp,
      userName: txn.user.name,
    }));
  }

  /**
   * Calculate trends (comparison with previous periods)
   */
  private static async calculateTrends(
    role: UserRole,
    startDate: Date,
    _endDate: Date,
    currentSummary: TransactionSummary,
    userId?: string,
  ): Promise<{
    vsYesterday: {
      income: number;
      expense: number;
      cashflow: number;
    };
    vs7DayAvg: {
      income: number;
      expense: number;
      cashflow: number;
    };
    vsMonthlyTarget?: {
      revenue: number;
      expense: number;
    };
  }> {
    // Calculate yesterday's data
    const yesterday = new Date(startDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayWhere = this.buildWhereClauseForRole(
      role,
      yesterday,
      yesterdayEnd,
      userId,
    );
    const yesterdaySummary = await this.calculateSummary(yesterdayWhere);

    // Calculate 7-day average
    const sevenDaysAgo = new Date(startDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sevenDayWhere = this.buildWhereClauseForRole(
      role,
      sevenDaysAgo,
      startDate,
      userId,
    );
    const sevenDaySummary = await this.calculateSummary(sevenDayWhere);

    // Calculate percentage changes
    const vsYesterday = {
      income: this.calculatePercentageChange(
        currentSummary.totalIncome,
        yesterdaySummary.totalIncome,
      ),
      expense: this.calculatePercentageChange(
        currentSummary.totalExpense,
        yesterdaySummary.totalExpense,
      ),
      cashflow: this.calculatePercentageChange(
        currentSummary.netCashflow,
        yesterdaySummary.netCashflow,
      ),
    };

    const avgIncome = sevenDaySummary.totalIncome.dividedBy(7);
    const avgExpense = sevenDaySummary.totalExpense.dividedBy(7);
    const avgCashflow = sevenDaySummary.netCashflow.dividedBy(7);

    const vs7DayAvg = {
      income: this.calculatePercentageChange(
        currentSummary.totalIncome,
        avgIncome,
      ),
      expense: this.calculatePercentageChange(
        currentSummary.totalExpense,
        avgExpense,
      ),
      cashflow: this.calculatePercentageChange(
        currentSummary.netCashflow,
        avgCashflow,
      ),
    };

    return {
      vsYesterday,
      vs7DayAvg,
    };
  }

  /**
   * Calculate percentage change
   */
  private static calculatePercentageChange(
    current: Decimal,
    previous: Decimal,
  ): number {
    if (previous.isZero()) {
      return current.isZero() ? 0 : 100;
    }

    return current
      .minus(previous)
      .dividedBy(previous)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
  }

  /**
   * Generate custom date range report
   */
  static async generateCustomReport(
    role: UserRole,
    startDate: Date,
    endDate: Date,
  ): Promise<RoleReportData> {
    return await this.generateRoleSpecificReport(role, startDate, endDate);
  }

  /**
   * Generate weekly report
   */
  static async generateWeeklyReport(
    weekStartDate: Date,
  ): Promise<Map<UserRole, RoleReportData>> {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    logger.info("Generating weekly report", { weekStartDate, weekEndDate });

    const roles: UserRole[] = ["dev", "boss", "employee", "investor"];
    const reportData = new Map<UserRole, RoleReportData>();

    for (const role of roles) {
      const data = await this.generateRoleSpecificReport(
        role,
        weekStartDate,
        weekEndDate,
      );
      reportData.set(role, data);
    }

    return reportData;
  }

  /**
   * Generate monthly report
   */
  static async generateMonthlyReport(
    monthDate: Date,
  ): Promise<Map<UserRole, RoleReportData>> {
    const startOfMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const endOfMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    logger.info("Generating monthly report", { startOfMonth, endOfMonth });

    const roles: UserRole[] = ["dev", "boss", "employee", "investor"];
    const reportData = new Map<UserRole, RoleReportData>();

    for (const role of roles) {
      const data = await this.generateRoleSpecificReport(
        role,
        startOfMonth,
        endOfMonth,
      );
      reportData.set(role, data);
    }

    return reportData;
  }
}

export default ReportGenerator;
