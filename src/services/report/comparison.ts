import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../../lib/logger";

const prisma = new PrismaClient();

/**
 * Period comparison result
 */
export interface PeriodComparison {
  currentPeriod: {
    start: Date;
    end: Date;
    income: Decimal;
    expense: Decimal;
    netCashflow: Decimal;
    transactionCount: number;
  };
  previousPeriod: {
    start: Date;
    end: Date;
    income: Decimal;
    expense: Decimal;
    netCashflow: Decimal;
    transactionCount: number;
  };
  variance: {
    income: {
      absolute: Decimal;
      percentage: number;
      significant: boolean; // >15% threshold
    };
    expense: {
      absolute: Decimal;
      percentage: number;
      significant: boolean;
    };
    netCashflow: {
      absolute: Decimal;
      percentage: number;
      significant: boolean;
    };
    transactionCount: {
      absolute: number;
      percentage: number;
    };
  };
  analysis: {
    trend: "improving" | "stable" | "declining";
    summary: string;
    highlights: string[];
  };
}

/**
 * Target comparison result
 */
export interface TargetComparison {
  period: {
    start: Date;
    end: Date;
  };
  actual: {
    revenue: Decimal;
    expense: Decimal;
    netProfit: Decimal;
  };
  target: {
    revenue: Decimal;
    expense: Decimal;
    netProfit: Decimal;
  };
  variance: {
    revenue: {
      absolute: Decimal;
      percentage: number;
      status: "above" | "on-track" | "below";
      significant: boolean; // >15% variance
    };
    expense: {
      absolute: Decimal;
      percentage: number;
      status: "above" | "on-track" | "below";
      significant: boolean;
    };
    netProfit: {
      absolute: Decimal;
      percentage: number;
      status: "above" | "on-track" | "below";
      significant: boolean;
    };
  };
  recommendations: string[];
}

/**
 * Variance analysis threshold (15%)
 */
const VARIANCE_THRESHOLD = 15;

/**
 * Period comparison service
 * Compares current period performance vs previous period and targets
 */
export class PeriodComparisonService {
  /**
   * Compare current month vs last month
   * @param currentMonthDate - Any date in the current month
   * @returns Period comparison with variance analysis
   */
  static async compareVsLastMonth(
    currentMonthDate: Date,
  ): Promise<PeriodComparison> {
    // Current month boundaries
    const currentStart = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth(),
      1,
    );
    currentStart.setHours(0, 0, 0, 0);

    const currentEnd = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() + 1,
      0,
    );
    currentEnd.setHours(23, 59, 59, 999);

    // Previous month boundaries
    const previousStart = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() - 1,
      1,
    );
    previousStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth(),
      0,
    );
    previousEnd.setHours(23, 59, 59, 999);

    logger.info("Comparing current month vs last month", {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    });

    // Fetch data for both periods
    const [currentData, previousData] = await Promise.all([
      this.fetchPeriodData(currentStart, currentEnd),
      this.fetchPeriodData(previousStart, previousEnd),
    ]);

    // Calculate variance
    const variance = this.calculateVariance(currentData, previousData);

    // Analyze trend
    const analysis = this.analyzeTrend(variance);

    return {
      currentPeriod: {
        start: currentStart,
        end: currentEnd,
        ...currentData,
      },
      previousPeriod: {
        start: previousStart,
        end: previousEnd,
        ...previousData,
      },
      variance,
      analysis,
    };
  }

  /**
   * Compare current period vs last 3 months
   * @param endDate - End date for the current period
   * @returns Array of 3 month comparisons
   */
  static async compareVsLast3Months(
    endDate: Date,
  ): Promise<PeriodComparison[]> {
    const comparisons: PeriodComparison[] = [];

    for (let i = 1; i <= 3; i++) {
      const comparisonDate = new Date(endDate);
      comparisonDate.setMonth(comparisonDate.getMonth() - i);

      const comparison = await this.compareVsLastMonth(comparisonDate);
      comparisons.push(comparison);
    }

    return comparisons;
  }

  /**
   * Compare actual performance vs targets
   * @param periodStart - Start date for the period
   * @param periodEnd - End date for the period
   * @param targets - Target values for the period
   * @returns Target comparison with variance analysis
   */
  static async compareVsTargets(
    periodStart: Date,
    periodEnd: Date,
    targets: {
      revenue: number;
      expense: number;
      netProfit: number;
    },
  ): Promise<TargetComparison> {
    logger.info("Comparing vs targets", { periodStart, periodEnd, targets });

    // Fetch actual data
    const actualData = await this.fetchPeriodData(periodStart, periodEnd);

    const targetRevenue = new Decimal(targets.revenue);
    const targetExpense = new Decimal(targets.expense);
    const targetNetProfit = new Decimal(targets.netProfit);

    // Calculate variance for revenue
    const revenueVariance = actualData.income.minus(targetRevenue);
    const revenueVarPercent = targetRevenue.greaterThan(0)
      ? revenueVariance.dividedBy(targetRevenue).times(100).toNumber()
      : 0;

    const revenueSignificant = Math.abs(revenueVarPercent) > VARIANCE_THRESHOLD;
    const revenueStatus = this.determineStatus(revenueVarPercent, "revenue");

    // Calculate variance for expense
    const expenseVariance = actualData.expense.minus(targetExpense);
    const expenseVarPercent = targetExpense.greaterThan(0)
      ? expenseVariance.dividedBy(targetExpense).times(100).toNumber()
      : 0;

    const expenseSignificant = Math.abs(expenseVarPercent) > VARIANCE_THRESHOLD;
    const expenseStatus = this.determineStatus(expenseVarPercent, "expense");

    // Calculate variance for net profit
    const netProfitVariance = actualData.netCashflow.minus(targetNetProfit);
    const netProfitVarPercent = targetNetProfit.greaterThan(0)
      ? netProfitVariance.dividedBy(targetNetProfit).times(100).toNumber()
      : 0;

    const netProfitSignificant =
      Math.abs(netProfitVarPercent) > VARIANCE_THRESHOLD;
    const netProfitStatus = this.determineStatus(
      netProfitVarPercent,
      "netProfit",
    );

    // Generate recommendations
    const recommendations = this.generateTargetRecommendations({
      revenue: {
        percentage: revenueVarPercent,
        status: revenueStatus,
        significant: revenueSignificant,
      },
      expense: {
        percentage: expenseVarPercent,
        status: expenseStatus,
        significant: expenseSignificant,
      },
      netProfit: {
        percentage: netProfitVarPercent,
        status: netProfitStatus,
        significant: netProfitSignificant,
      },
    });

    return {
      period: {
        start: periodStart,
        end: periodEnd,
      },
      actual: {
        revenue: actualData.income,
        expense: actualData.expense,
        netProfit: actualData.netCashflow,
      },
      target: {
        revenue: targetRevenue,
        expense: targetExpense,
        netProfit: targetNetProfit,
      },
      variance: {
        revenue: {
          absolute: revenueVariance,
          percentage: revenueVarPercent,
          status: revenueStatus,
          significant: revenueSignificant,
        },
        expense: {
          absolute: expenseVariance,
          percentage: expenseVarPercent,
          status: expenseStatus,
          significant: expenseSignificant,
        },
        netProfit: {
          absolute: netProfitVariance,
          percentage: netProfitVarPercent,
          status: netProfitStatus,
          significant: netProfitSignificant,
        },
      },
      recommendations,
    };
  }

  /**
   * Fetch period data from database
   */
  private static async fetchPeriodData(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    income: Decimal;
    expense: Decimal;
    netCashflow: Decimal;
    transactionCount: number;
  }> {
    const transactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        approvalStatus: "approved",
      },
      select: {
        amount: true,
        type: true,
      },
    });

    let income = new Decimal(0);
    let expense = new Decimal(0);

    for (const tx of transactions) {
      if (tx.type === "income") {
        income = income.plus(tx.amount);
      } else {
        expense = expense.plus(tx.amount);
      }
    }

    return {
      income,
      expense,
      netCashflow: income.minus(expense),
      transactionCount: transactions.length,
    };
  }

  /**
   * Calculate variance between two periods
   */
  private static calculateVariance(
    current: {
      income: Decimal;
      expense: Decimal;
      netCashflow: Decimal;
      transactionCount: number;
    },
    previous: {
      income: Decimal;
      expense: Decimal;
      netCashflow: Decimal;
      transactionCount: number;
    },
  ): PeriodComparison["variance"] {
    // Income variance
    const incomeAbsolute = current.income.minus(previous.income);
    const incomePercentage = previous.income.greaterThan(0)
      ? incomeAbsolute.dividedBy(previous.income).times(100).toNumber()
      : 0;
    const incomeSignificant = Math.abs(incomePercentage) > VARIANCE_THRESHOLD;

    // Expense variance
    const expenseAbsolute = current.expense.minus(previous.expense);
    const expensePercentage = previous.expense.greaterThan(0)
      ? expenseAbsolute.dividedBy(previous.expense).times(100).toNumber()
      : 0;
    const expenseSignificant = Math.abs(expensePercentage) > VARIANCE_THRESHOLD;

    // Net cashflow variance
    const cashflowAbsolute = current.netCashflow.minus(previous.netCashflow);
    const cashflowPercentage = previous.netCashflow.greaterThan(0)
      ? cashflowAbsolute.dividedBy(previous.netCashflow).times(100).toNumber()
      : current.netCashflow.greaterThan(0)
        ? 100
        : previous.netCashflow.lessThan(0) && current.netCashflow.greaterThan(0)
          ? 100
          : 0;
    const cashflowSignificant =
      Math.abs(cashflowPercentage) > VARIANCE_THRESHOLD;

    // Transaction count variance
    const txCountAbsolute =
      current.transactionCount - previous.transactionCount;
    const txCountPercentage =
      previous.transactionCount > 0
        ? (txCountAbsolute / previous.transactionCount) * 100
        : 0;

    return {
      income: {
        absolute: incomeAbsolute,
        percentage: incomePercentage,
        significant: incomeSignificant,
      },
      expense: {
        absolute: expenseAbsolute,
        percentage: expensePercentage,
        significant: expenseSignificant,
      },
      netCashflow: {
        absolute: cashflowAbsolute,
        percentage: cashflowPercentage,
        significant: cashflowSignificant,
      },
      transactionCount: {
        absolute: txCountAbsolute,
        percentage: txCountPercentage,
      },
    };
  }

  /**
   * Analyze trend based on variance
   */
  private static analyzeTrend(
    variance: PeriodComparison["variance"],
  ): PeriodComparison["analysis"] {
    const highlights: string[] = [];

    // Overall trend determination
    let trend: "improving" | "stable" | "declining" = "stable";

    // Check if cashflow is significantly better
    if (
      variance.netCashflow.significant &&
      variance.netCashflow.percentage > 0
    ) {
      trend = "improving";
      highlights.push(
        `Net cashflow naik ${Math.round(variance.netCashflow.percentage)}% (signifikan)`,
      );
    }
    // Check if cashflow is significantly worse
    else if (
      variance.netCashflow.significant &&
      variance.netCashflow.percentage < 0
    ) {
      trend = "declining";
      highlights.push(
        `Net cashflow turun ${Math.abs(Math.round(variance.netCashflow.percentage))}% (signifikan)`,
      );
    }

    // Income highlights
    if (variance.income.significant) {
      const direction = variance.income.percentage > 0 ? "naik" : "turun";
      highlights.push(
        `Revenue ${direction} ${Math.abs(Math.round(variance.income.percentage))}%`,
      );
    }

    // Expense highlights
    if (variance.expense.significant) {
      const direction = variance.expense.percentage > 0 ? "naik" : "turun";
      highlights.push(
        `Expense ${direction} ${Math.abs(Math.round(variance.expense.percentage))}%`,
      );
    }

    // Transaction count highlights
    if (Math.abs(variance.transactionCount.percentage) > VARIANCE_THRESHOLD) {
      const direction =
        variance.transactionCount.percentage > 0 ? "naik" : "turun";
      highlights.push(
        `Jumlah transaksi ${direction} ${Math.abs(Math.round(variance.transactionCount.percentage))}%`,
      );
    }

    // Generate summary
    const summary = this.generateTrendSummary(trend, variance);

    return {
      trend,
      summary,
      highlights,
    };
  }

  /**
   * Generate trend summary text
   */
  private static generateTrendSummary(
    trend: "improving" | "stable" | "declining",
    variance: PeriodComparison["variance"],
  ): string {
    switch (trend) {
      case "improving":
        return "Performa finansial membaik dibanding periode sebelumnya. Pertahankan momentum positif.";
      case "declining":
        return "Performa finansial menurun dibanding periode sebelumnya. Perlu evaluasi dan action plan.";
      case "stable":
        if (
          Math.abs(variance.income.percentage) < 5 &&
          Math.abs(variance.expense.percentage) < 5
        ) {
          return "Performa finansial stabil dan konsisten dengan periode sebelumnya.";
        }
        return "Performa finansial relatif stabil dengan beberapa perubahan minor.";
    }
  }

  /**
   * Determine status for target comparison
   */
  private static determineStatus(
    variancePercent: number,
    metric: "revenue" | "expense" | "netProfit",
  ): "above" | "on-track" | "below" {
    // For expense, lower is better
    if (metric === "expense") {
      if (variancePercent < -5) return "above"; // Spending less (good)
      if (variancePercent > 5) return "below"; // Spending more (bad)
      return "on-track";
    }

    // For revenue and netProfit, higher is better
    if (variancePercent > 5) return "above"; // Exceeding target (good)
    if (variancePercent < -5) return "below"; // Missing target (bad)
    return "on-track";
  }

  /**
   * Generate recommendations for target variance
   */
  private static generateTargetRecommendations(variance: {
    revenue: { percentage: number; status: string; significant: boolean };
    expense: { percentage: number; status: string; significant: boolean };
    netProfit: { percentage: number; status: string; significant: boolean };
  }): string[] {
    const recommendations: string[] = [];

    // Revenue recommendations
    if (variance.revenue.status === "below" && variance.revenue.significant) {
      recommendations.push(
        `Revenue ${Math.abs(Math.round(variance.revenue.percentage))}% di bawah target. Fokus pada sales acceleration dan customer acquisition.`,
      );
    } else if (variance.revenue.status === "above") {
      recommendations.push(
        `Revenue ${Math.round(variance.revenue.percentage)}% di atas target. Excellent performance! Consider raising targets.`,
      );
    }

    // Expense recommendations
    if (variance.expense.status === "below" && variance.expense.significant) {
      recommendations.push(
        `Expense ${Math.abs(Math.round(variance.expense.percentage))}% di atas target. Review dan optimalkan struktur biaya.`,
      );
    } else if (variance.expense.status === "above") {
      recommendations.push(
        `Expense ${Math.abs(Math.round(variance.expense.percentage))}% di bawah target. Good cost control!`,
      );
    }

    // Net profit recommendations
    if (
      variance.netProfit.status === "below" &&
      variance.netProfit.significant
    ) {
      recommendations.push(
        `Net profit ${Math.abs(Math.round(variance.netProfit.percentage))}% di bawah target. Perlu strategic review untuk improve profitability.`,
      );
    } else if (variance.netProfit.status === "above") {
      recommendations.push(
        `Net profit ${Math.round(variance.netProfit.percentage)}% di atas target. Strong profitability - consider reinvestment opportunities.`,
      );
    }

    // General recommendation
    if (recommendations.length === 0) {
      recommendations.push(
        "Performance on track with targets. Maintain current strategy and monitor closely.",
      );
    }

    return recommendations;
  }
}

export default PeriodComparisonService;
