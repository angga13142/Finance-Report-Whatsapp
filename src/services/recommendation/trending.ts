import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { formatCurrency } from "../../lib/currency";

/**
 * Monthly trending insights service
 * Generates insights about financial trends and patterns
 */

export interface TrendingInsight {
  id: string;
  month: string; // YYYY-MM format
  type: "growth" | "decline" | "stable" | "seasonal" | "anomaly";
  category: string;
  title: string;
  description: string;
  metrics: {
    currentValue: number;
    previousValue: number;
    change: number;
    changePercent: number;
  };
  confidence: number; // 0-100
  priority: "low" | "medium" | "high";
  generatedAt: Date;
}

export class TrendingInsightsService {
  private static instance: TrendingInsightsService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): TrendingInsightsService {
    if (!TrendingInsightsService.instance) {
      TrendingInsightsService.instance = new TrendingInsightsService();
    }
    return TrendingInsightsService.instance;
  }

  /**
   * Generate monthly trending insights
   */
  async generateMonthlyInsights(month: Date): Promise<TrendingInsight[]> {
    const insights: TrendingInsight[] = [];

    try {
      // Revenue trends
      const revenueTrend = await this.analyzeRevenueTrend(month);
      if (revenueTrend) insights.push(revenueTrend);

      // Expense trends
      const expenseTrend = await this.analyzeExpenseTrend(month);
      if (expenseTrend) insights.push(expenseTrend);

      // Category trends
      const categoryTrends = await this.analyzeCategoryTrends(month);
      insights.push(...categoryTrends);

      // Cashflow patterns
      const cashflowInsight = await this.analyzeCashflowPattern(month);
      if (cashflowInsight) insights.push(cashflowInsight);

      // Seasonal patterns
      const seasonalInsights = await this.detectSeasonalPatterns(month);
      insights.push(...seasonalInsights);

      // Anomalies
      const anomalies = await this.detectAnomalies(month);
      insights.push(...anomalies);

      // Save insights to database
      await this.saveInsights(insights);

      logger.info("Monthly insights generated", {
        month: month.toISOString().substring(0, 7),
        count: insights.length,
      });

      return insights;
    } catch (error) {
      logger.error("Failed to generate monthly insights", { error, month });
      return [];
    }
  }

  /**
   * Analyze revenue trend
   */
  private async analyzeRevenueTrend(
    month: Date,
  ): Promise<TrendingInsight | null> {
    const monthStr = month.toISOString().substring(0, 7);
    const prevMonth = new Date(month);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().substring(0, 7);

    const results = await this.prisma.$queryRaw<
      Array<{ month: string; total: number }>
    >`
      SELECT 
        TO_CHAR(timestamp, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'income'
        AND TO_CHAR(timestamp, 'YYYY-MM') IN (${monthStr}, ${prevMonthStr})
      GROUP BY TO_CHAR(timestamp, 'YYYY-MM')
    `;

    if (results.length < 2) return null;

    const current = results.find((r) => r.month === monthStr);
    const previous = results.find((r) => r.month === prevMonthStr);

    if (!current || !previous) return null;

    const currentValue = Number(current.total);
    const previousValue = Number(previous.total);
    const change = currentValue - previousValue;
    const changePercent = (change / previousValue) * 100;

    let type: TrendingInsight["type"];
    let priority: TrendingInsight["priority"];
    let title: string;
    let description: string;

    if (changePercent > 15) {
      type = "growth";
      priority = "high";
      title = `Pertumbuhan Pendapatan ${changePercent.toFixed(1)}%`;
      description = `Pendapatan bulan ini meningkat ${formatCurrency(change)} dari bulan lalu. Pertahankan strategi yang berhasil!`;
    } else if (changePercent < -15) {
      type = "decline";
      priority = "high";
      title = `Penurunan Pendapatan ${Math.abs(changePercent).toFixed(1)}%`;
      description = `Pendapatan bulan ini menurun ${formatCurrency(Math.abs(change))} dari bulan lalu. Perlu evaluasi strategi penjualan.`;
    } else {
      type = "stable";
      priority = "medium";
      title = "Pendapatan Stabil";
      description = `Pendapatan bulan ini relatif stabil dengan perubahan ${changePercent.toFixed(1)}%.`;
    }

    return {
      id: `revenue-trend-${monthStr}`,
      month: monthStr,
      type,
      category: "revenue",
      title,
      description,
      metrics: { currentValue, previousValue, change, changePercent },
      confidence: 85,
      priority,
      generatedAt: new Date(),
    };
  }

  /**
   * Analyze expense trend
   */
  private async analyzeExpenseTrend(
    month: Date,
  ): Promise<TrendingInsight | null> {
    const monthStr = month.toISOString().substring(0, 7);
    const prevMonth = new Date(month);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().substring(0, 7);

    const results = await this.prisma.$queryRaw<
      Array<{ month: string; total: number }>
    >`
      SELECT 
        TO_CHAR(timestamp, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'expense'
        AND TO_CHAR(timestamp, 'YYYY-MM') IN (${monthStr}, ${prevMonthStr})
      GROUP BY TO_CHAR(timestamp, 'YYYY-MM')
    `;

    if (results.length < 2) return null;

    const current = results.find((r) => r.month === monthStr);
    const previous = results.find((r) => r.month === prevMonthStr);

    if (!current || !previous) return null;

    const currentValue = Number(current.total);
    const previousValue = Number(previous.total);
    const change = currentValue - previousValue;
    const changePercent = (change / previousValue) * 100;

    let type: TrendingInsight["type"];
    let priority: TrendingInsight["priority"];
    let title: string;
    let description: string;

    if (changePercent > 20) {
      type = "growth";
      priority = "high";
      title = `Kenaikan Pengeluaran ${changePercent.toFixed(1)}%`;
      description = `Pengeluaran meningkat ${formatCurrency(change)}. Perlu review kategori pengeluaran yang meningkat signifikan.`;
    } else if (changePercent < -10) {
      type = "decline";
      priority = "medium";
      title = `Efisiensi Biaya ${Math.abs(changePercent).toFixed(1)}%`;
      description = `Pengeluaran berhasil diturunkan ${formatCurrency(Math.abs(change))}. Strategi penghematan berjalan baik!`;
    } else {
      type = "stable";
      priority = "low";
      title = "Pengeluaran Terkontrol";
      description = `Pengeluaran bulan ini relatif konsisten dengan bulan lalu (${changePercent.toFixed(1)}%).`;
    }

    return {
      id: `expense-trend-${monthStr}`,
      month: monthStr,
      type,
      category: "expense",
      title,
      description,
      metrics: { currentValue, previousValue, change, changePercent },
      confidence: 80,
      priority,
      generatedAt: new Date(),
    };
  }

  /**
   * Analyze category trends
   */
  private analyzeCategoryTrends(_month: Date): Promise<TrendingInsight[]> {
    // Implementation simplified for demonstration
    return Promise.resolve([]);
  }

  /**
   * Analyze cashflow pattern
   */
  private analyzeCashflowPattern(
    _month: Date,
  ): Promise<TrendingInsight | null> {
    // Implementation simplified for demonstration
    return Promise.resolve(null);
  }

  /**
   * Detect seasonal patterns
   */
  private detectSeasonalPatterns(_month: Date): Promise<TrendingInsight[]> {
    // Implementation simplified for demonstration
    return Promise.resolve([]);
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(_month: Date): Promise<TrendingInsight[]> {
    // Implementation simplified for demonstration
    return Promise.resolve([]);
  }

  /**
   * Save insights to database
   */
  private async saveInsights(insights: TrendingInsight[]): Promise<void> {
    for (const insight of insights) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO trending_insights 
          (id, month, type, category, title, description, metrics, confidence, priority, generated_at)
          VALUES (
            ${insight.id},
            ${insight.month},
            ${insight.type},
            ${insight.category},
            ${insight.title},
            ${insight.description},
            ${JSON.stringify(insight.metrics)},
            ${insight.confidence},
            ${insight.priority},
            ${insight.generatedAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            type = ${insight.type},
            title = ${insight.title},
            description = ${insight.description},
            metrics = ${JSON.stringify(insight.metrics)},
            confidence = ${insight.confidence},
            priority = ${insight.priority},
            generated_at = ${insight.generatedAt}
        `;
      } catch (error) {
        logger.error("Failed to save insight", {
          error,
          insightId: insight.id,
        });
      }
    }
  }

  /**
   * Get insights for a month
   */
  async getMonthlyInsights(month: Date): Promise<TrendingInsight[]> {
    const monthStr = month.toISOString().substring(0, 7);

    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          month: string;
          type: string;
          category: string;
          title: string;
          description: string;
          metrics: string;
          confidence: number;
          priority: string;
          generated_at: Date;
        }>
      >`
        SELECT * FROM trending_insights
        WHERE month = ${monthStr}
        ORDER BY priority DESC, confidence DESC
      `;

      return results.map((r) => ({
        ...r,
        type: r.type as TrendingInsight["type"],
        priority: r.priority as TrendingInsight["priority"],
        metrics: JSON.parse(r.metrics) as TrendingInsight["metrics"],
        generatedAt: r.generated_at,
      }));
    } catch (error) {
      logger.error("Failed to fetch monthly insights", { error, month });
      return [];
    }
  }
}

export const trendingInsights = TrendingInsightsService.getInstance();
