import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../../lib/logger";

const prisma = new PrismaClient();

/**
 * Daily data point for trend analysis
 */
export interface DailyDataPoint {
  date: Date;
  income: Decimal;
  expense: Decimal;
  netCashflow: Decimal;
  transactionCount: number;
}

/**
 * Trend analysis result for a period
 */
export interface TrendAnalysis {
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  dailyData: DailyDataPoint[];
  summary: {
    totalIncome: Decimal;
    totalExpense: Decimal;
    totalNetCashflow: Decimal;
    avgDailyIncome: Decimal;
    avgDailyExpense: Decimal;
    avgDailyNetCashflow: Decimal;
  };
  trends: {
    incomeGrowthRate: number; // % change from first week to last week
    expenseGrowthRate: number;
    profitMarginTrend: number; // % change in profit margin
    volatility: {
      incomeStdDev: number;
      expenseStdDev: number;
      cashflowStdDev: number;
    };
  };
  visualRepresentation: {
    sparkline: string; // ASCII sparkline for WhatsApp
    peakDay: DailyDataPoint | null;
    lowestDay: DailyDataPoint | null;
  };
}

/**
 * Trend analysis service for investor reports
 * Provides 90-day trend analysis with statistical insights
 */
export class TrendAnalysisService {
  /**
   * Generate 90-day trend analysis
   * @param endDate - End date for the analysis period
   * @returns Comprehensive trend analysis with daily breakdown
   */
  static async generate90DayTrend(endDate: Date): Promise<TrendAnalysis> {
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = new Date(endDate);
    periodStart.setDate(periodStart.getDate() - 89); // 90 days including today
    periodStart.setHours(0, 0, 0, 0);

    logger.info("Generating 90-day trend analysis", {
      periodStart,
      periodEnd,
    });

    // Fetch all transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: periodStart,
          lte: periodEnd,
        },
        approvalStatus: "approved",
      },
      select: {
        amount: true,
        type: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Group by day
    const dailyDataMap = new Map<string, DailyDataPoint>();

    // Initialize all days with zero values
    for (let i = 0; i < 90; i++) {
      const day = new Date(periodStart);
      day.setDate(day.getDate() + i);
      const dateKey = day.toISOString().split("T")[0];

      dailyDataMap.set(dateKey, {
        date: new Date(day),
        income: new Decimal(0),
        expense: new Decimal(0),
        netCashflow: new Decimal(0),
        transactionCount: 0,
      });
    }

    // Aggregate transactions by day
    for (const tx of transactions) {
      const dateKey = tx.timestamp.toISOString().split("T")[0];
      const dataPoint = dailyDataMap.get(dateKey);

      if (dataPoint) {
        if (tx.type === "income") {
          dataPoint.income = dataPoint.income.plus(tx.amount);
        } else {
          dataPoint.expense = dataPoint.expense.plus(tx.amount);
        }
        dataPoint.netCashflow = dataPoint.income.minus(dataPoint.expense);
        dataPoint.transactionCount++;
      }
    }

    const dailyData = Array.from(dailyDataMap.values());

    // Calculate summary statistics
    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);

    for (const day of dailyData) {
      totalIncome = totalIncome.plus(day.income);
      totalExpense = totalExpense.plus(day.expense);
    }

    const totalNetCashflow = totalIncome.minus(totalExpense);
    const avgDailyIncome = totalIncome.dividedBy(90);
    const avgDailyExpense = totalExpense.dividedBy(90);
    const avgDailyNetCashflow = totalNetCashflow.dividedBy(90);

    // Calculate trends (first week vs last week)
    const firstWeekData = dailyData.slice(0, 7);
    const lastWeekData = dailyData.slice(-7);

    const firstWeekIncome = firstWeekData.reduce(
      (sum, d) => sum.plus(d.income),
      new Decimal(0),
    );
    const lastWeekIncome = lastWeekData.reduce(
      (sum, d) => sum.plus(d.income),
      new Decimal(0),
    );

    const firstWeekExpense = firstWeekData.reduce(
      (sum, d) => sum.plus(d.expense),
      new Decimal(0),
    );
    const lastWeekExpense = lastWeekData.reduce(
      (sum, d) => sum.plus(d.expense),
      new Decimal(0),
    );

    const incomeGrowthRate = firstWeekIncome.greaterThan(0)
      ? lastWeekIncome
          .minus(firstWeekIncome)
          .dividedBy(firstWeekIncome)
          .times(100)
          .toNumber()
      : 0;

    const expenseGrowthRate = firstWeekExpense.greaterThan(0)
      ? lastWeekExpense
          .minus(firstWeekExpense)
          .dividedBy(firstWeekExpense)
          .times(100)
          .toNumber()
      : 0;

    // Calculate profit margins for first and last week
    const firstWeekProfitMargin = firstWeekIncome.greaterThan(0)
      ? firstWeekIncome
          .minus(firstWeekExpense)
          .dividedBy(firstWeekIncome)
          .times(100)
          .toNumber()
      : 0;

    const lastWeekProfitMargin = lastWeekIncome.greaterThan(0)
      ? lastWeekIncome
          .minus(lastWeekExpense)
          .dividedBy(lastWeekIncome)
          .times(100)
          .toNumber()
      : 0;

    const profitMarginTrend = lastWeekProfitMargin - firstWeekProfitMargin;

    // Calculate volatility (standard deviation)
    const incomeStdDev = this.calculateStandardDeviation(
      dailyData.map((d) => d.income.toNumber()),
    );
    const expenseStdDev = this.calculateStandardDeviation(
      dailyData.map((d) => d.expense.toNumber()),
    );
    const cashflowStdDev = this.calculateStandardDeviation(
      dailyData.map((d) => d.netCashflow.toNumber()),
    );

    // Find peak and lowest days
    let peakDay: DailyDataPoint | null = null;
    let lowestDay: DailyDataPoint | null = null;

    for (const day of dailyData) {
      if (!peakDay || day.netCashflow.greaterThan(peakDay.netCashflow)) {
        peakDay = day;
      }
      if (!lowestDay || day.netCashflow.lessThan(lowestDay.netCashflow)) {
        lowestDay = day;
      }
    }

    // Generate sparkline visualization
    const sparkline = this.generateSparkline(
      dailyData.map((d) => d.netCashflow.toNumber()),
    );

    return {
      period: {
        start: periodStart,
        end: periodEnd,
        days: 90,
      },
      dailyData,
      summary: {
        totalIncome,
        totalExpense,
        totalNetCashflow,
        avgDailyIncome,
        avgDailyExpense,
        avgDailyNetCashflow,
      },
      trends: {
        incomeGrowthRate,
        expenseGrowthRate,
        profitMarginTrend,
        volatility: {
          incomeStdDev,
          expenseStdDev,
          cashflowStdDev,
        },
      },
      visualRepresentation: {
        sparkline,
        peakDay,
        lowestDay,
      },
    };
  }

  /**
   * Calculate standard deviation for volatility analysis
   */
  private static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  /**
   * Generate ASCII sparkline for visual representation
   * Uses Unicode block characters for better visualization
   */
  private static generateSparkline(values: number[]): string {
    if (values.length === 0) return "";

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) {
      return "▄".repeat(Math.min(values.length, 50)); // Flat line
    }

    // Unicode block characters for 8 levels
    const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

    // Sample to max 50 points for WhatsApp display
    const sampleSize = Math.min(values.length, 50);
    const step = Math.floor(values.length / sampleSize);
    const sampledValues = [];

    for (let i = 0; i < sampleSize; i++) {
      const index = Math.min(i * step, values.length - 1);
      sampledValues.push(values[index]);
    }

    // Map values to block characters
    return sampledValues
      .map((val) => {
        const normalized = (val - min) / range;
        const index = Math.floor(normalized * (blocks.length - 1));
        return blocks[Math.max(0, Math.min(index, blocks.length - 1))];
      })
      .join("");
  }

  /**
   * Generate weekly aggregated trend (easier to digest than daily)
   * @param endDate - End date for the analysis
   * @returns Weekly aggregated data for 13 weeks
   */
  static async generateWeeklyTrend(
    endDate: Date,
  ): Promise<Array<{ week: number; data: DailyDataPoint }>> {
    const trendData = await this.generate90DayTrend(endDate);

    // Group by week (7-day periods)
    const weeklyData: Array<{ week: number; data: DailyDataPoint }> = [];

    for (let week = 0; week < 13; week++) {
      const startIdx = week * 7;
      const endIdx = Math.min(startIdx + 7, trendData.dailyData.length);
      const weekData = trendData.dailyData.slice(startIdx, endIdx);

      const weekDate = weekData[0]?.date || new Date();
      let weekIncome = new Decimal(0);
      let weekExpense = new Decimal(0);
      let weekTxCount = 0;

      for (const day of weekData) {
        weekIncome = weekIncome.plus(day.income);
        weekExpense = weekExpense.plus(day.expense);
        weekTxCount += day.transactionCount;
      }

      weeklyData.push({
        week: week + 1,
        data: {
          date: weekDate,
          income: weekIncome,
          expense: weekExpense,
          netCashflow: weekIncome.minus(weekExpense),
          transactionCount: weekTxCount,
        },
      });
    }

    return weeklyData;
  }
}

export default TrendAnalysisService;
