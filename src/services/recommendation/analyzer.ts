import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../../lib/logger";
import ConfidenceScoreCalculator from "./confidence";
import type {
  RecommendationType,
  RecommendationPriority,
} from "@prisma/client";
import type { RecommendationContent } from "../../models/recommendation";

const prisma = new PrismaClient();

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  detected: boolean;
  type: RecommendationType;
  priority: RecommendationPriority;
  confidenceScore: number;
  content: RecommendationContent;
}

/**
 * Expense spike detection configuration
 */
export interface ExpenseSpikeConfig {
  threshold: number; // Percentage threshold (e.g., 30 for 30%)
  lookbackDays: number; // Days to calculate baseline
}

/**
 * Revenue decline detection configuration
 */
export interface RevenueDeclineConfig {
  threshold: number; // Percentage threshold (e.g., 15 for 15%)
  lookbackDays: number; // Days to compare
}

/**
 * Negative cashflow detection configuration
 */
export interface NegativeCashflowConfig {
  consecutiveDaysThreshold: number; // Minimum consecutive days
  lookbackDays: number; // Days to analyze
}

/**
 * Financial Anomaly Analyzer
 * Detects financial anomalies and generates recommendations
 */
export class FinancialAnomalyAnalyzer {
  /**
   * Detect expense spike (>30% vs 7-day average)
   */
  static async detectExpenseSpike(
    config: ExpenseSpikeConfig = { threshold: 30, lookbackDays: 7 },
  ): Promise<AnomalyDetectionResult | null> {
    logger.info("Detecting expense spike", { config });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate today's expense
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayExpense = await this.calculateDailyExpense(today, todayEnd);

    // Calculate 7-day average (excluding today)
    const baselineStart = new Date(today);
    baselineStart.setDate(baselineStart.getDate() - config.lookbackDays);

    const baselineEnd = new Date(today);
    baselineEnd.setMilliseconds(-1); // End of yesterday

    const avgExpense = await this.calculate7DayAvgExpense(
      baselineStart,
      baselineEnd,
    );

    // Check if spike detected
    if (avgExpense.equals(0)) {
      logger.debug("No baseline expense data available");
      return null;
    }

    const variance = todayExpense
      .minus(avgExpense)
      .dividedBy(avgExpense)
      .times(100);

    const variancePercent = variance.toNumber();

    logger.debug("Expense spike analysis", {
      todayExpense: todayExpense.toString(),
      avgExpense: avgExpense.toString(),
      variancePercent,
      threshold: config.threshold,
    });

    if (variancePercent <= config.threshold) {
      return null; // No spike detected
    }

    // Calculate confidence score
    const dataAgeHours = 1; // Today's data is very fresh
    const confidenceScore = ConfidenceScoreCalculator.forExpenseSpike(
      todayExpense.toNumber(),
      avgExpense.toNumber(),
      config.lookbackDays,
      dataAgeHours,
    );

    // Determine priority based on severity
    let priority: RecommendationPriority;
    if (variancePercent > config.threshold * 2) {
      priority = "critical"; // >60% spike
    } else if (variancePercent > config.threshold * 1.5) {
      priority = "high"; // >45% spike
    } else {
      priority = "medium";
    }

    // Generate content
    const content: RecommendationContent = {
      title: "🚨 Expense Spike Detected",
      message: `Expense hari ini ${this.formatCurrency(todayExpense)} meningkat ${variancePercent.toFixed(1)}% dibanding rata-rata 7 hari (${this.formatCurrency(avgExpense)}).`,
      anomalyData: {
        type: "expense_spike",
        current: todayExpense.toNumber(),
        baseline: avgExpense.toNumber(),
        variance: variancePercent,
        threshold: config.threshold,
      },
      recommendations: [
        "Review transaksi expense hari ini untuk identifikasi penyebab kenaikan",
        "Cek apakah ada transaksi besar yang tidak biasa atau duplikat",
        "Verifikasi dengan tim terkait untuk konfirmasi expense",
        "Pertimbangkan untuk menunda expense non-urgent jika memungkinkan",
      ],
      actionRequired:
        priority === "critical"
          ? "Immediate action required - review all expenses today"
          : "Review recommended within 24 hours",
    };

    return {
      detected: true,
      type: "expense_spike",
      priority,
      confidenceScore,
      content,
    };
  }

  /**
   * Detect revenue decline (>15% vs last week)
   */
  static async detectRevenueDecline(
    config: RevenueDeclineConfig = { threshold: 15, lookbackDays: 7 },
  ): Promise<AnomalyDetectionResult | null> {
    logger.info("Detecting revenue decline", { config });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Current week (last 7 days including today)
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(currentWeekStart.getDate() - 6);

    const currentWeekRevenue = await this.calculatePeriodRevenue(
      currentWeekStart,
      today,
    );

    // Previous week (8-14 days ago)
    const previousWeekStart = new Date(today);
    previousWeekStart.setDate(previousWeekStart.getDate() - 14);

    const previousWeekEnd = new Date(today);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
    previousWeekEnd.setHours(23, 59, 59, 999);

    const previousWeekRevenue = await this.calculatePeriodRevenue(
      previousWeekStart,
      previousWeekEnd,
    );

    // Check if decline detected
    if (previousWeekRevenue.equals(0)) {
      logger.debug("No previous week revenue data available");
      return null;
    }

    const variance = currentWeekRevenue
      .minus(previousWeekRevenue)
      .dividedBy(previousWeekRevenue)
      .times(100);

    const variancePercent = variance.toNumber();

    logger.debug("Revenue decline analysis", {
      currentWeekRevenue: currentWeekRevenue.toString(),
      previousWeekRevenue: previousWeekRevenue.toString(),
      variancePercent,
      threshold: config.threshold,
    });

    // Only alert on decline (negative variance)
    if (variancePercent >= -config.threshold) {
      return null; // No significant decline
    }

    // Calculate confidence score
    const dataAgeHours = 24; // Week data is 1 day old at most
    const confidenceScore = ConfidenceScoreCalculator.forRevenueDecline(
      currentWeekRevenue.toNumber(),
      previousWeekRevenue.toNumber(),
      config.lookbackDays,
      dataAgeHours,
    );

    // Determine priority
    const absVariance = Math.abs(variancePercent);
    let priority: RecommendationPriority;
    if (absVariance > config.threshold * 2) {
      priority = "critical"; // >30% decline
    } else if (absVariance > config.threshold * 1.5) {
      priority = "high"; // >22.5% decline
    } else {
      priority = "medium";
    }

    // Generate content
    const content: RecommendationContent = {
      title: "📉 Revenue Decline Detected",
      message: `Revenue minggu ini ${this.formatCurrency(currentWeekRevenue)} turun ${Math.abs(variancePercent).toFixed(1)}% dibanding minggu lalu (${this.formatCurrency(previousWeekRevenue)}).`,
      anomalyData: {
        type: "revenue_decline",
        current: currentWeekRevenue.toNumber(),
        baseline: previousWeekRevenue.toNumber(),
        variance: variancePercent,
        threshold: config.threshold,
      },
      recommendations: [
        "Analisis penyebab penurunan revenue (faktor musiman, kompetitor, pasar)",
        "Review strategi sales dan marketing untuk periode mendatang",
        "Identifikasi customer yang kurang aktif dan lakukan follow-up",
        "Evaluasi pricing dan product offering untuk meningkatkan daya saing",
        "Consider promotional campaigns atau special offers untuk boost revenue",
      ],
      actionRequired:
        priority === "critical"
          ? "Urgent - schedule strategy meeting within 24 hours"
          : "Review and plan action within 48 hours",
    };

    return {
      detected: true,
      type: "revenue_decline",
      priority,
      confidenceScore,
      content,
    };
  }

  /**
   * Detect consecutive negative cashflow days (3+ days)
   */
  static async detectNegativeCashflow(
    config: NegativeCashflowConfig = {
      consecutiveDaysThreshold: 3,
      lookbackDays: 7,
    },
  ): Promise<AnomalyDetectionResult | null> {
    logger.info("Detecting negative cashflow", { config });

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - config.lookbackDays);
    startDate.setHours(0, 0, 0, 0);

    // Get daily cashflow for last N days
    const dailyCashflows = await this.getDailyCashflows(startDate, today);

    // Find consecutive negative days
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let totalNegativeDays = 0;
    let totalDeficit = new Decimal(0);

    for (const cashflow of dailyCashflows) {
      if (cashflow.netCashflow.lessThan(0)) {
        currentConsecutive++;
        totalNegativeDays++;
        totalDeficit = totalDeficit.plus(cashflow.netCashflow.abs());
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    logger.debug("Negative cashflow analysis", {
      maxConsecutive,
      totalNegativeDays,
      totalDeficit: totalDeficit.toString(),
      threshold: config.consecutiveDaysThreshold,
    });

    if (maxConsecutive < config.consecutiveDaysThreshold) {
      return null; // No significant negative streak
    }

    // Calculate confidence score
    const dataAgeHours = 12; // Fairly recent data
    const confidenceScore = ConfidenceScoreCalculator.forNegativeCashflow(
      maxConsecutive,
      config.lookbackDays,
      dataAgeHours,
    );

    // Determine priority
    let priority: RecommendationPriority;
    if (maxConsecutive >= 5) {
      priority = "critical"; // 5+ consecutive days
    } else if (maxConsecutive >= 4) {
      priority = "high"; // 4 consecutive days
    } else {
      priority = "medium"; // 3 consecutive days
    }

    // Generate content
    const content: RecommendationContent = {
      title: "⚠️ Negative Cashflow Warning",
      message: `Cashflow negatif selama ${maxConsecutive} hari berturut-turut. Total deficit: ${this.formatCurrency(totalDeficit)}.`,
      anomalyData: {
        type: "cashflow_warning",
        current: maxConsecutive,
        baseline: 0,
        variance: maxConsecutive * 100, // Days as percentage
        threshold: config.consecutiveDaysThreshold,
      },
      recommendations: [
        "Urgent: Review cash position dan proyeksi cashflow untuk minggu depan",
        "Prioritaskan collection dari customer dengan outstanding payment",
        "Defer atau reschedule non-critical expenses",
        "Prepare contingency plan untuk bridge financing jika diperlukan",
        "Communicate dengan stakeholder tentang cash situation",
        "Review dan optimalkan working capital management",
      ],
      actionRequired:
        priority === "critical"
          ? "Critical - immediate cashflow management action required"
          : "High priority - address within 24 hours",
      relatedData: {
        consecutiveDays: maxConsecutive,
        totalNegativeDays,
        totalDeficit: totalDeficit.toNumber(),
        negativeRatio: (totalNegativeDays / config.lookbackDays) * 100,
      },
    };

    return {
      detected: true,
      type: "cashflow_warning",
      priority,
      confidenceScore,
      content,
    };
  }

  /**
   * Detect monthly target variance (>20%)
   */
  static async detectTargetVariance(
    targetRevenue: number,
    targetExpense: number,
  ): Promise<AnomalyDetectionResult | null> {
    logger.info("Detecting target variance", {
      targetRevenue,
      targetExpense,
    });

    const today = new Date();

    // Calculate month-to-date actuals
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const actualRevenue = await this.calculatePeriodRevenue(monthStart, today);
    const actualExpense = await this.calculatePeriodExpense(monthStart, today);

    // Calculate period completeness (how far through the month)
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const daysSoFar = today.getDate();
    const periodCompleteness = daysSoFar / daysInMonth;

    // Pro-rate targets based on days elapsed
    const proratedTargetRevenue = new Decimal(targetRevenue).times(
      periodCompleteness,
    );
    const proratedTargetExpense = new Decimal(targetExpense).times(
      periodCompleteness,
    );

    // Calculate variances
    const revenueVariance = actualRevenue
      .minus(proratedTargetRevenue)
      .dividedBy(proratedTargetRevenue)
      .times(100);

    const expenseVariance = actualExpense
      .minus(proratedTargetExpense)
      .dividedBy(proratedTargetExpense)
      .times(100);

    const revenueVarPercent = revenueVariance.toNumber();
    const expenseVarPercent = expenseVariance.toNumber();

    logger.debug("Target variance analysis", {
      actualRevenue: actualRevenue.toString(),
      proratedTargetRevenue: proratedTargetRevenue.toString(),
      revenueVarPercent,
      actualExpense: actualExpense.toString(),
      proratedTargetExpense: proratedTargetExpense.toString(),
      expenseVarPercent,
      periodCompleteness,
    });

    // Check if significant variance (>20%)
    const hasRevenueIssue = revenueVarPercent < -20; // Revenue below target
    const hasExpenseIssue = expenseVarPercent > 20; // Expense above target

    if (!hasRevenueIssue && !hasExpenseIssue) {
      return null; // No significant variance
    }

    // Calculate confidence score
    const dataAgeHours = 24;
    const primaryVariance = hasRevenueIssue
      ? Math.abs(revenueVarPercent)
      : expenseVarPercent;
    const confidenceScore = ConfidenceScoreCalculator.forTargetVariance(
      hasRevenueIssue ? actualRevenue.toNumber() : actualExpense.toNumber(),
      hasRevenueIssue
        ? proratedTargetRevenue.toNumber()
        : proratedTargetExpense.toNumber(),
      periodCompleteness,
      dataAgeHours,
    );

    // Determine priority
    let priority: RecommendationPriority;
    if (primaryVariance > 40) {
      priority = "critical";
    } else if (primaryVariance > 30) {
      priority = "high";
    } else {
      priority = "medium";
    }

    // Generate content
    const issues: string[] = [];
    if (hasRevenueIssue) {
      issues.push(
        `Revenue ${Math.abs(revenueVarPercent).toFixed(1)}% di bawah target`,
      );
    }
    if (hasExpenseIssue) {
      issues.push(`Expense ${expenseVarPercent.toFixed(1)}% di atas target`);
    }

    const content: RecommendationContent = {
      title: "🎯 Monthly Target Variance Alert",
      message: `Target variance terdeteksi untuk bulan ini (${(periodCompleteness * 100).toFixed(0)}% periode berlalu): ${issues.join(", ")}.`,
      anomalyData: {
        type: "target_variance",
        current: hasRevenueIssue
          ? actualRevenue.toNumber()
          : actualExpense.toNumber(),
        baseline: hasRevenueIssue
          ? proratedTargetRevenue.toNumber()
          : proratedTargetExpense.toNumber(),
        variance: primaryVariance,
        threshold: 20,
      },
      recommendations: hasRevenueIssue
        ? [
            "Review sales pipeline dan forecast untuk sisa bulan",
            "Accelerate deal closures dan follow-up dengan prospek",
            "Consider promotional activities untuk boost revenue",
            "Adjust target jika market condition berubah signifikan",
            "Prepare explanation dan mitigation plan untuk stakeholder",
          ]
        : [
            "Review dan kategorisasi expense untuk identifikasi area pemborosan",
            "Defer atau cancel non-essential expenses",
            "Negotiate dengan vendor untuk better terms atau pricing",
            "Implement expense approval process yang lebih ketat",
            "Review budget allocation untuk realignment",
          ],
      actionRequired:
        priority === "critical"
          ? "Critical - immediate corrective action required"
          : "High priority - action plan needed within 48 hours",
      relatedData: {
        periodCompleteness,
        revenueVarPercent,
        expenseVarPercent,
        daysRemaining: daysInMonth - daysSoFar,
      },
    };

    return {
      detected: true,
      type: "target_variance",
      priority,
      confidenceScore,
      content,
    };
  }

  /**
   * Helper: Calculate daily expense
   */
  private static async calculateDailyExpense(
    startDate: Date,
    endDate: Date,
  ): Promise<Decimal> {
    const result = await prisma.transaction.aggregate({
      where: {
        type: "expense",
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        approvalStatus: "approved",
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || new Decimal(0);
  }

  /**
   * Helper: Calculate 7-day average expense
   */
  private static async calculate7DayAvgExpense(
    startDate: Date,
    endDate: Date,
  ): Promise<Decimal> {
    const totalExpense = await this.calculateDailyExpense(startDate, endDate);
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return totalExpense.dividedBy(days);
  }

  /**
   * Helper: Calculate period revenue
   */
  private static async calculatePeriodRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<Decimal> {
    const result = await prisma.transaction.aggregate({
      where: {
        type: "income",
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        approvalStatus: "approved",
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || new Decimal(0);
  }

  /**
   * Helper: Calculate period expense
   */
  private static async calculatePeriodExpense(
    startDate: Date,
    endDate: Date,
  ): Promise<Decimal> {
    return this.calculateDailyExpense(startDate, endDate);
  }

  /**
   * Helper: Get daily cashflows
   */
  private static async getDailyCashflows(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: Date; netCashflow: Decimal }>> {
    const transactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        approvalStatus: "approved",
      },
      select: {
        timestamp: true,
        type: true,
        amount: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Group by day
    const dailyMap = new Map<string, Decimal>();

    for (const tx of transactions) {
      const dateKey = tx.timestamp.toISOString().split("T")[0];
      const current = dailyMap.get(dateKey) || new Decimal(0);

      if (tx.type === "income") {
        dailyMap.set(dateKey, current.plus(tx.amount));
      } else {
        dailyMap.set(dateKey, current.minus(tx.amount));
      }
    }

    // Convert to array
    return Array.from(dailyMap.entries()).map(([dateKey, netCashflow]) => ({
      date: new Date(dateKey),
      netCashflow,
    }));
  }

  /**
   * Helper: Format currency
   */
  private static formatCurrency(amount: Decimal): string {
    return `Rp ${amount.toNumber().toLocaleString("id-ID")}`;
  }
}

export default FinancialAnomalyAnalyzer;
