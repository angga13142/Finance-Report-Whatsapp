import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../../lib/logger";
import TrendAnalysisService from "./trend";

const prisma = new PrismaClient();

/**
 * Business health score levels
 */
export type HealthLevel = "excellent" | "good" | "fair" | "poor" | "critical";

/**
 * Investment insight result
 */
export interface InvestmentInsight {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  businessHealth: {
    score: number; // 0-100
    level: HealthLevel;
    factors: {
      profitMargin: number;
      cashflowStability: number;
      growthRate: number;
      operationalEfficiency: number;
    };
    summary: string;
  };
  financialMetrics: {
    revenue: {
      total: Decimal;
      average: Decimal;
      growthRate: number; // % change vs previous period
    };
    expenses: {
      total: Decimal;
      average: Decimal;
      growthRate: number;
    };
    profitability: {
      netProfit: Decimal;
      profitMargin: number; // %
      roi: number; // % (if investment data available)
    };
    burnRate: {
      daily: Decimal; // Average daily cash burn
      monthly: Decimal; // Estimated monthly burn
      runwayMonths: number; // Months of runway (if cash balance known)
    };
  };
  growthIndicators: {
    revenueGrowth: {
      rate: number; // % change
      trend: "accelerating" | "steady" | "slowing" | "declining";
      momentum: number; // Rate of change of growth rate
    };
    expenseGrowth: {
      rate: number;
      trend: "accelerating" | "steady" | "slowing" | "declining";
    };
    operatingLeverage: number; // Revenue growth - Expense growth
  };
  riskFactors: {
    cashflowVolatility: {
      level: "low" | "medium" | "high" | "very-high";
      coefficient: number; // Coefficient of variation
    };
    negativeFlowDays: {
      count: number;
      consecutiveMax: number;
      percentage: number;
    };
    concentrationRisk: {
      topCategoryPercentage: number;
      diversificationScore: number; // 0-100
    };
  };
  recommendations: string[];
  alerts: Array<{
    severity: "critical" | "warning" | "info";
    message: string;
    action: string;
  }>;
}

/**
 * Investment insights service
 * Generates AI-like investment analysis based on financial data
 */
export class InvestmentInsightsService {
  /**
   * Generate comprehensive investment insights
   * @param endDate - End date for the analysis period
   * @param days - Number of days to analyze (default 90)
   * @returns Detailed investment insights with recommendations
   */
  static async generateInsights(
    endDate: Date,
    days: number = 90,
  ): Promise<InvestmentInsight> {
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = new Date(endDate);
    periodStart.setDate(periodStart.getDate() - (days - 1));
    periodStart.setHours(0, 0, 0, 0);

    logger.info("Generating investment insights", {
      periodStart,
      periodEnd,
      days,
    });

    // Get trend analysis for the period
    const trendAnalysis =
      await TrendAnalysisService.generate90DayTrend(endDate);

    // Calculate financial metrics
    const financialMetrics = await this.calculateFinancialMetrics(
      periodStart,
      periodEnd,
      trendAnalysis,
    );

    // Calculate growth indicators
    const growthIndicators = this.calculateGrowthIndicators(trendAnalysis);

    // Assess risk factors
    const riskFactors = await this.assessRiskFactors(trendAnalysis);

    // Calculate business health score
    const businessHealth = this.calculateBusinessHealthScore(
      financialMetrics,
      growthIndicators,
      riskFactors,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      businessHealth,
      financialMetrics,
      growthIndicators,
      riskFactors,
    );

    // Generate alerts
    const alerts = this.generateAlerts(
      financialMetrics,
      growthIndicators,
      riskFactors,
    );

    return {
      generatedAt: new Date(),
      period: {
        start: periodStart,
        end: periodEnd,
        days,
      },
      businessHealth,
      financialMetrics,
      growthIndicators,
      riskFactors,
      recommendations,
      alerts,
    };
  }

  /**
   * Calculate comprehensive financial metrics
   */
  private static async calculateFinancialMetrics(
    periodStart: Date,
    _periodEnd: Date,
    trendAnalysis: Awaited<
      ReturnType<typeof TrendAnalysisService.generate90DayTrend>
    >,
  ): Promise<InvestmentInsight["financialMetrics"]> {
    const { summary } = trendAnalysis;

    // Get previous period data for comparison
    const previousPeriodEnd = new Date(periodStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(
      previousPeriodStart.getDate() - (trendAnalysis.period.days - 1),
    );

    const previousTransactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
        approvalStatus: "approved",
      },
      select: {
        amount: true,
        type: true,
      },
    });

    let previousIncome = new Decimal(0);
    let previousExpense = new Decimal(0);

    for (const tx of previousTransactions) {
      if (tx.type === "income") {
        previousIncome = previousIncome.plus(tx.amount);
      } else {
        previousExpense = previousExpense.plus(tx.amount);
      }
    }

    // Calculate growth rates
    const revenueGrowth = previousIncome.greaterThan(0)
      ? summary.totalIncome
          .minus(previousIncome)
          .dividedBy(previousIncome)
          .times(100)
          .toNumber()
      : 0;

    const expenseGrowth = previousExpense.greaterThan(0)
      ? summary.totalExpense
          .minus(previousExpense)
          .dividedBy(previousExpense)
          .times(100)
          .toNumber()
      : 0;

    // Calculate profit margin
    const profitMargin = summary.totalIncome.greaterThan(0)
      ? summary.totalNetCashflow
          .dividedBy(summary.totalIncome)
          .times(100)
          .toNumber()
      : 0;

    // Calculate burn rate
    const dailyBurnRate = summary.avgDailyExpense;
    const monthlyBurnRate = dailyBurnRate.times(30);

    // Estimate runway (assuming we don't have cash balance data)
    // For demo purposes, we'll use a placeholder
    const runwayMonths = 0; // Would need cash balance data

    return {
      revenue: {
        total: summary.totalIncome,
        average: summary.avgDailyIncome,
        growthRate: revenueGrowth,
      },
      expenses: {
        total: summary.totalExpense,
        average: summary.avgDailyExpense,
        growthRate: expenseGrowth,
      },
      profitability: {
        netProfit: summary.totalNetCashflow,
        profitMargin,
        roi: 0, // Would need investment amount data
      },
      burnRate: {
        daily: dailyBurnRate,
        monthly: monthlyBurnRate,
        runwayMonths,
      },
    };
  }

  /**
   * Calculate growth indicators and trends
   */
  private static calculateGrowthIndicators(
    trendAnalysis: Awaited<
      ReturnType<typeof TrendAnalysisService.generate90DayTrend>
    >,
  ): InvestmentInsight["growthIndicators"] {
    const { trends } = trendAnalysis;

    // Determine revenue trend
    const revenueTrend = this.determineTrend(trends.incomeGrowthRate);
    const expenseTrend = this.determineTrend(trends.expenseGrowthRate);

    // Calculate operating leverage
    const operatingLeverage =
      trends.incomeGrowthRate - trends.expenseGrowthRate;

    // Calculate momentum (rate of change of growth rate)
    // Would need multiple periods for true momentum calculation
    const momentum = trends.profitMarginTrend;

    return {
      revenueGrowth: {
        rate: trends.incomeGrowthRate,
        trend: revenueTrend,
        momentum,
      },
      expenseGrowth: {
        rate: trends.expenseGrowthRate,
        trend: expenseTrend,
      },
      operatingLeverage,
    };
  }

  /**
   * Assess risk factors
   */
  private static async assessRiskFactors(
    trendAnalysis: Awaited<
      ReturnType<typeof TrendAnalysisService.generate90DayTrend>
    >,
  ): Promise<InvestmentInsight["riskFactors"]> {
    const { dailyData, summary, trends } = trendAnalysis;

    // Calculate cashflow volatility
    const avgCashflow = summary.avgDailyNetCashflow.toNumber();
    const cashflowStdDev = trends.volatility.cashflowStdDev;
    const coefficientOfVariation =
      avgCashflow !== 0 ? Math.abs(cashflowStdDev / avgCashflow) : 0;

    const volatilityLevel =
      coefficientOfVariation > 1.5
        ? "very-high"
        : coefficientOfVariation > 1.0
          ? "high"
          : coefficientOfVariation > 0.5
            ? "medium"
            : "low";

    // Count negative cashflow days
    let negativeFlowDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    for (const day of dailyData) {
      if (day.netCashflow.lessThan(0)) {
        negativeFlowDays++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const negativeFlowPercentage = (negativeFlowDays / dailyData.length) * 100;

    // Calculate concentration risk (top category percentage)
    const transactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: trendAnalysis.period.start,
          lte: trendAnalysis.period.end,
        },
        approvalStatus: "approved",
      },
      select: {
        category: true,
        amount: true,
      },
    });

    const categoryTotals = new Map<string, Decimal>();
    let totalAmount = new Decimal(0);

    for (const tx of transactions) {
      const current = categoryTotals.get(tx.category) || new Decimal(0);
      categoryTotals.set(tx.category, current.plus(tx.amount));
      totalAmount = totalAmount.plus(tx.amount);
    }

    const topCategoryAmount =
      categoryTotals.size > 0
        ? Math.max(
            ...Array.from(categoryTotals.values()).map((v) => v.toNumber()),
          )
        : 0;

    const topCategoryPercentage = totalAmount.greaterThan(0)
      ? (topCategoryAmount / totalAmount.toNumber()) * 100
      : 0;

    // Diversification score (higher is better)
    const diversificationScore = Math.max(0, 100 - topCategoryPercentage * 1.5);

    return {
      cashflowVolatility: {
        level: volatilityLevel,
        coefficient: coefficientOfVariation,
      },
      negativeFlowDays: {
        count: negativeFlowDays,
        consecutiveMax: maxStreak,
        percentage: negativeFlowPercentage,
      },
      concentrationRisk: {
        topCategoryPercentage,
        diversificationScore,
      },
    };
  }

  /**
   * Calculate business health score (0-100)
   */
  private static calculateBusinessHealthScore(
    financialMetrics: InvestmentInsight["financialMetrics"],
    growthIndicators: InvestmentInsight["growthIndicators"],
    riskFactors: InvestmentInsight["riskFactors"],
  ): InvestmentInsight["businessHealth"] {
    // Profit margin score (0-30 points)
    const profitMarginScore = Math.min(
      30,
      Math.max(0, financialMetrics.profitability.profitMargin * 0.5),
    );

    // Cashflow stability score (0-25 points)
    const volatilityPenalty =
      riskFactors.cashflowVolatility.level === "very-high"
        ? 20
        : riskFactors.cashflowVolatility.level === "high"
          ? 15
          : riskFactors.cashflowVolatility.level === "medium"
            ? 8
            : 0;
    const cashflowStabilityScore = Math.max(0, 25 - volatilityPenalty);

    // Growth rate score (0-25 points)
    const growthRateScore = Math.min(
      25,
      Math.max(0, growthIndicators.revenueGrowth.rate * 0.5 + 10),
    );

    // Operational efficiency score (0-20 points)
    const operationalEfficiencyScore = Math.min(
      20,
      Math.max(0, growthIndicators.operatingLeverage * 0.5 + 10),
    );

    const totalScore = Math.round(
      profitMarginScore +
        cashflowStabilityScore +
        growthRateScore +
        operationalEfficiencyScore,
    );

    // Determine health level
    let level: HealthLevel;
    if (totalScore >= 80) level = "excellent";
    else if (totalScore >= 60) level = "good";
    else if (totalScore >= 40) level = "fair";
    else if (totalScore >= 20) level = "poor";
    else level = "critical";

    // Generate summary
    const summary = this.generateHealthSummary(level, totalScore);

    return {
      score: totalScore,
      level,
      factors: {
        profitMargin: Math.round(profitMarginScore),
        cashflowStability: Math.round(cashflowStabilityScore),
        growthRate: Math.round(growthRateScore),
        operationalEfficiency: Math.round(operationalEfficiencyScore),
      },
      summary,
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    businessHealth: InvestmentInsight["businessHealth"],
    financialMetrics: InvestmentInsight["financialMetrics"],
    growthIndicators: InvestmentInsight["growthIndicators"],
    riskFactors: InvestmentInsight["riskFactors"],
  ): string[] {
    const recommendations: string[] = [];

    // Profit margin recommendations
    if (financialMetrics.profitability.profitMargin < 10) {
      recommendations.push(
        "Profit margin di bawah 10%. Fokus pada peningkatan efisiensi operasional dan review struktur biaya.",
      );
    }

    // Growth recommendations
    if (growthIndicators.revenueGrowth.rate < 0) {
      recommendations.push(
        "Revenue mengalami penurunan. Pertimbangkan strategi akuisisi pelanggan baru dan retensi pelanggan existing.",
      );
    } else if (growthIndicators.revenueGrowth.trend === "slowing") {
      recommendations.push(
        "Pertumbuhan revenue melambat. Evaluasi strategi go-to-market dan pertimbangkan ekspansi produk/layanan.",
      );
    }

    // Expense recommendations
    if (
      growthIndicators.expenseGrowth.rate > growthIndicators.revenueGrowth.rate
    ) {
      recommendations.push(
        "Biaya tumbuh lebih cepat dari revenue. Tinjau struktur biaya dan cari efisiensi operasional.",
      );
    }

    // Volatility recommendations
    if (
      riskFactors.cashflowVolatility.level === "high" ||
      riskFactors.cashflowVolatility.level === "very-high"
    ) {
      recommendations.push(
        "Cashflow sangat volatil. Pertimbangkan diversifikasi revenue stream dan bangun cash reserve yang lebih kuat.",
      );
    }

    // Negative cashflow recommendations
    if (riskFactors.negativeFlowDays.percentage > 30) {
      recommendations.push(
        `${Math.round(riskFactors.negativeFlowDays.percentage)}% hari mengalami negative cashflow. Perbaiki working capital management dan pertimbangkan sumber pendanaan alternatif.`,
      );
    }

    // Concentration risk recommendations
    if (riskFactors.concentrationRisk.topCategoryPercentage > 50) {
      recommendations.push(
        "Risiko konsentrasi tinggi pada satu kategori. Diversifikasi revenue stream untuk mengurangi risiko bisnis.",
      );
    }

    // Health-based recommendations
    if (
      businessHealth.level === "critical" ||
      businessHealth.level === "poor"
    ) {
      recommendations.push(
        "Business health score rendah. Lakukan strategic review menyeluruh dan pertimbangkan turnaround strategy.",
      );
    }

    // Always add at least one positive/forward-looking recommendation
    if (
      recommendations.length === 0 ||
      businessHealth.level === "excellent" ||
      businessHealth.level === "good"
    ) {
      recommendations.push(
        "Pertahankan momentum positif. Fokus pada skalabilitas dan optimasi proses untuk mendukung pertumbuhan jangka panjang.",
      );
    }

    return recommendations;
  }

  /**
   * Generate alerts for critical issues
   */
  private static generateAlerts(
    financialMetrics: InvestmentInsight["financialMetrics"],
    growthIndicators: InvestmentInsight["growthIndicators"],
    riskFactors: InvestmentInsight["riskFactors"],
  ): InvestmentInsight["alerts"] {
    const alerts: InvestmentInsight["alerts"] = [];

    // Critical: Negative profit margin
    if (financialMetrics.profitability.profitMargin < 0) {
      alerts.push({
        severity: "critical",
        message: "Profit margin negatif - bisnis tidak menguntungkan",
        action: "Review struktur biaya dan pricing strategy segera",
      });
    }

    // Critical: Consecutive negative cashflow
    if (riskFactors.negativeFlowDays.consecutiveMax >= 7) {
      alerts.push({
        severity: "critical",
        message: `${riskFactors.negativeFlowDays.consecutiveMax} hari berturut-turut negative cashflow`,
        action:
          "Evaluasi likuiditas dan pertimbangkan sumber pendanaan darurat",
      });
    }

    // Warning: Revenue decline
    if (growthIndicators.revenueGrowth.rate < -10) {
      alerts.push({
        severity: "warning",
        message: `Revenue turun ${Math.abs(Math.round(growthIndicators.revenueGrowth.rate))}%`,
        action: "Analisis penyebab penurunan dan buat action plan recovery",
      });
    }

    // Warning: High volatility
    if (riskFactors.cashflowVolatility.level === "very-high") {
      alerts.push({
        severity: "warning",
        message: "Cashflow sangat volatil dan tidak predictable",
        action: "Bangun cash buffer minimum 3 bulan operating expenses",
      });
    }

    // Info: Good growth
    if (growthIndicators.revenueGrowth.rate > 20) {
      alerts.push({
        severity: "info",
        message: `Revenue tumbuh ${Math.round(growthIndicators.revenueGrowth.rate)}% - momentum sangat positif`,
        action:
          "Pertimbangkan scaling up operations untuk capture market opportunity",
      });
    }

    return alerts;
  }

  /**
   * Helper: Determine trend direction
   */
  private static determineTrend(
    growthRate: number,
  ): "accelerating" | "steady" | "slowing" | "declining" {
    if (growthRate > 20) return "accelerating";
    if (growthRate > 5) return "steady";
    if (growthRate > -5) return "slowing";
    return "declining";
  }

  /**
   * Helper: Generate health summary text
   */
  private static generateHealthSummary(
    level: HealthLevel,
    score: number,
  ): string {
    switch (level) {
      case "excellent":
        return `Business health sangat baik (${score}/100). Fundamental kuat dengan pertumbuhan solid dan cashflow stabil.`;
      case "good":
        return `Business health baik (${score}/100). Performa positif dengan beberapa area improvement.`;
      case "fair":
        return `Business health cukup (${score}/100). Ada beberapa concern yang perlu attention.`;
      case "poor":
        return `Business health kurang baik (${score}/100). Perlu action plan untuk memperbaiki fundamental.`;
      case "critical":
        return `Business health kritis (${score}/100). Memerlukan immediate action dan strategic review.`;
    }
  }
}

export default InvestmentInsightsService;
