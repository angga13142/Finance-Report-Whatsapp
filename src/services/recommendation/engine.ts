import { logger } from "../../lib/logger";
import FinancialAnomalyAnalyzer from "./analyzer";
import RecommendationModel from "../../models/recommendation";
import type { UserRole } from "@prisma/client";
import type { AnomalyDetectionResult } from "./analyzer";

/**
 * Alert delivery gating configuration
 */
export interface AlertGatingConfig {
  minConfidenceScore: number; // Minimum confidence to deliver (0-100)
  criticalPriorityRequired: boolean; // Only deliver critical alerts
  deduplicationWindowMinutes: number; // Prevent duplicate alerts
}

/**
 * Recommendation engine run result
 */
export interface EngineRunResult {
  totalAnomaliesDetected: number;
  anomaliesGated: number; // Blocked by gating rules
  recommendationsCreated: number;
  recommendations: Array<{
    id: string;
    type: string;
    priority: string;
    confidenceScore: number;
  }>;
}

/**
 * Recommendation Engine
 * Orchestrates anomaly detection and manages alert delivery gating
 */
export class RecommendationEngine {
  /**
   * Run full anomaly detection cycle
   * Detects all anomalies and applies gating rules
   */
  static async run(
    gatingConfig: AlertGatingConfig = {
      minConfidenceScore: 80,
      criticalPriorityRequired: true,
      deduplicationWindowMinutes: 60,
    },
  ): Promise<EngineRunResult> {
    logger.info("Starting recommendation engine run", { gatingConfig });

    const result: EngineRunResult = {
      totalAnomaliesDetected: 0,
      anomaliesGated: 0,
      recommendationsCreated: 0,
      recommendations: [],
    };

    try {
      // Detect all anomalies
      const anomalies = await this.detectAllAnomalies();

      result.totalAnomaliesDetected = anomalies.length;

      // Apply gating rules and create recommendations
      for (const anomaly of anomalies) {
        const shouldDeliver = await this.shouldDeliverAlert(
          anomaly,
          gatingConfig,
        );

        if (!shouldDeliver) {
          result.anomaliesGated++;
          logger.debug("Alert gated", {
            type: anomaly.type,
            priority: anomaly.priority,
            confidenceScore: anomaly.confidenceScore,
          });
          continue;
        }

        // Create recommendation
        const recommendation = await this.createRecommendation(anomaly);

        result.recommendationsCreated++;
        result.recommendations.push({
          id: recommendation.id,
          type: anomaly.type,
          priority: anomaly.priority,
          confidenceScore: anomaly.confidenceScore,
        });
      }

      logger.info("Recommendation engine run completed", result);

      return result;
    } catch (error) {
      logger.error("Failed to run recommendation engine", { error });
      throw error;
    }
  }

  /**
   * Detect all financial anomalies
   */
  private static async detectAllAnomalies(): Promise<AnomalyDetectionResult[]> {
    logger.info("Detecting all financial anomalies");

    const detectionPromises = [
      FinancialAnomalyAnalyzer.detectExpenseSpike(),
      FinancialAnomalyAnalyzer.detectRevenueDecline(),
      FinancialAnomalyAnalyzer.detectNegativeCashflow(),
      // Note: detectTargetVariance requires target parameters
      // It should be called separately when targets are known
    ];

    const results = await Promise.allSettled(detectionPromises);

    const anomalies: AnomalyDetectionResult[] = [];

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        anomalies.push(result.value);
      } else if (result.status === "rejected") {
        logger.error("Anomaly detection failed", {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }

    logger.info("Anomaly detection completed", {
      totalDetected: anomalies.length,
    });

    return anomalies;
  }

  /**
   * Check if alert should be delivered based on gating rules
   * Prevents alert fatigue by filtering low-confidence or duplicate alerts
   */
  private static async shouldDeliverAlert(
    anomaly: AnomalyDetectionResult,
    config: AlertGatingConfig,
  ): Promise<boolean> {
    // Rule 1: Minimum confidence score
    if (anomaly.confidenceScore < config.minConfidenceScore) {
      logger.debug("Alert gated: confidence too low", {
        type: anomaly.type,
        confidenceScore: anomaly.confidenceScore,
        minRequired: config.minConfidenceScore,
      });
      return false;
    }

    // Rule 2: Critical priority required
    if (config.criticalPriorityRequired && anomaly.priority !== "critical") {
      logger.debug("Alert gated: not critical priority", {
        type: anomaly.type,
        priority: anomaly.priority,
      });
      return false;
    }

    // Rule 3: Deduplication - check for recent similar alerts
    const hasDuplicate = await RecommendationModel.hasDuplicateRecent(
      anomaly.type,
      config.deduplicationWindowMinutes,
    );

    if (hasDuplicate) {
      logger.debug("Alert gated: duplicate within deduplication window", {
        type: anomaly.type,
        windowMinutes: config.deduplicationWindowMinutes,
      });
      return false;
    }

    // All gating rules passed
    return true;
  }

  /**
   * Create recommendation from anomaly detection result
   */
  private static async createRecommendation(
    anomaly: AnomalyDetectionResult,
  ): Promise<{ id: string; generatedAt: Date }> {
    // Determine target roles based on anomaly type
    const targetRoles = this.getTargetRoles(anomaly.type);

    return RecommendationModel.create({
      type: anomaly.type,
      priority: anomaly.priority,
      confidenceScore: anomaly.confidenceScore,
      targetRoles,
      content: anomaly.content,
    });
  }

  /**
   * Get target roles for a recommendation type
   */
  private static getTargetRoles(type: string): UserRole[] {
    switch (type) {
      case "expense_spike":
      case "revenue_decline":
      case "cashflow_warning":
        // Financial anomalies go to Boss and Dev
        return ["boss", "dev"];

      case "target_variance":
        // Target variance goes to Boss, Dev, and Investor
        return ["boss", "dev", "investor"];

      case "employee_inactivity":
        // Employee issues go to Boss and Dev
        return ["boss", "dev"];

      default:
        // Default: Boss and Dev
        return ["boss", "dev"];
    }
  }

  /**
   * Run engine with custom gating for specific scenarios
   */
  static async runForCriticalOnly(): Promise<EngineRunResult> {
    return this.run({
      minConfidenceScore: 80,
      criticalPriorityRequired: true,
      deduplicationWindowMinutes: 60,
    });
  }

  /**
   * Run engine with relaxed gating (for testing or catch-up)
   */
  static async runWithRelaxedGating(): Promise<EngineRunResult> {
    return this.run({
      minConfidenceScore: 60,
      criticalPriorityRequired: false,
      deduplicationWindowMinutes: 120,
    });
  }

  /**
   * Run engine for all alerts (no gating)
   */
  static async runWithoutGating(): Promise<EngineRunResult> {
    return this.run({
      minConfidenceScore: 0,
      criticalPriorityRequired: false,
      deduplicationWindowMinutes: 0,
    });
  }

  /**
   * Check specific anomaly type manually
   */
  static async checkExpenseSpike(): Promise<AnomalyDetectionResult | null> {
    return FinancialAnomalyAnalyzer.detectExpenseSpike();
  }

  /**
   * Check revenue decline manually
   */
  static async checkRevenueDecline(): Promise<AnomalyDetectionResult | null> {
    return FinancialAnomalyAnalyzer.detectRevenueDecline();
  }

  /**
   * Check negative cashflow manually
   */
  static async checkNegativeCashflow(): Promise<AnomalyDetectionResult | null> {
    return FinancialAnomalyAnalyzer.detectNegativeCashflow();
  }

  /**
   * Check target variance manually
   */
  static async checkTargetVariance(
    targetRevenue: number,
    targetExpense: number,
  ): Promise<AnomalyDetectionResult | null> {
    return FinancialAnomalyAnalyzer.detectTargetVariance(
      targetRevenue,
      targetExpense,
    );
  }

  /**
   * Get engine statistics
   */
  static async getStatistics() {
    return RecommendationModel.getStatistics(24);
  }
}

export default RecommendationEngine;
