import { logger } from "../../lib/logger";

/**
 * Confidence score calculation factors
 */
export interface ConfidenceFactors {
  dataQuality: number; // 0-100: Based on sample size and completeness
  anomalySeverity: number; // 0-100: How severe is the anomaly
  historicalConsistency: number; // 0-100: Does this match historical patterns
  timeRelevance: number; // 0-100: How recent/relevant is the data
}

/**
 * Confidence score calculator
 * Calculates confidence score (0-100%) for recommendations
 * based on data quality and anomaly severity
 */
export class ConfidenceScoreCalculator {
  /**
   * Calculate overall confidence score
   * @returns Confidence score between 0-100
   */
  static calculate(factors: ConfidenceFactors): number {
    // Validate inputs
    this.validateFactors(factors);

    // Weighted average calculation
    // Data quality: 30% weight (most important - can't trust bad data)
    // Anomaly severity: 35% weight (how significant is the issue)
    // Historical consistency: 20% weight (does it match patterns)
    // Time relevance: 15% weight (how fresh is the data)

    const weights = {
      dataQuality: 0.3,
      anomalySeverity: 0.35,
      historicalConsistency: 0.2,
      timeRelevance: 0.15,
    };

    const score =
      factors.dataQuality * weights.dataQuality +
      factors.anomalySeverity * weights.anomalySeverity +
      factors.historicalConsistency * weights.historicalConsistency +
      factors.timeRelevance * weights.timeRelevance;

    // Round to integer
    const finalScore = Math.round(score);

    logger.debug("Confidence score calculated", {
      factors,
      weights,
      finalScore,
    });

    return finalScore;
  }

  /**
   * Calculate data quality score
   * Based on sample size and data completeness
   */
  static calculateDataQuality(
    sampleSize: number,
    minRequiredSamples: number,
    missingDataPoints: number = 0,
  ): number {
    // Sample size score (0-70 points)
    const sampleRatio = Math.min(sampleSize / minRequiredSamples, 1);
    const sampleScore = sampleRatio * 70;

    // Completeness score (0-30 points)
    const missingRatio = missingDataPoints / sampleSize;
    const completenessScore = Math.max(0, (1 - missingRatio) * 30);

    const totalScore = sampleScore + completenessScore;

    logger.debug("Data quality score calculated", {
      sampleSize,
      minRequiredSamples,
      missingDataPoints,
      sampleScore,
      completenessScore,
      totalScore,
    });

    return Math.min(100, totalScore);
  }

  /**
   * Calculate anomaly severity score
   * Based on how far the value deviates from baseline
   */
  static calculateAnomalySeverity(
    currentValue: number,
    baselineValue: number,
    thresholdPercentage: number,
  ): number {
    if (baselineValue === 0) {
      // If baseline is zero, any non-zero value is 100% severity
      return currentValue === 0 ? 0 : 100;
    }

    // Calculate variance percentage
    const variance = Math.abs(
      ((currentValue - baselineValue) / baselineValue) * 100,
    );

    // Normalize to 0-100 scale
    // At threshold: 50 points
    // At 2x threshold: 80 points
    // At 3x+ threshold: 100 points

    let score: number;
    if (variance < thresholdPercentage) {
      // Below threshold - linear scale to 50
      score = (variance / thresholdPercentage) * 50;
    } else if (variance < thresholdPercentage * 2) {
      // 1x-2x threshold: scale from 50 to 80
      const excessRatio =
        (variance - thresholdPercentage) / thresholdPercentage;
      score = 50 + excessRatio * 30;
    } else if (variance < thresholdPercentage * 3) {
      // 2x-3x threshold: scale from 80 to 100
      const excessRatio =
        (variance - thresholdPercentage * 2) / thresholdPercentage;
      score = 80 + excessRatio * 20;
    } else {
      // 3x+ threshold: max severity
      score = 100;
    }

    logger.debug("Anomaly severity calculated", {
      currentValue,
      baselineValue,
      thresholdPercentage,
      variance,
      score,
    });

    return Math.round(score);
  }

  /**
   * Calculate historical consistency score
   * Based on how often similar patterns occurred in the past
   */
  static calculateHistoricalConsistency(
    similarOccurrences: number,
    totalHistoricalPeriods: number,
  ): number {
    if (totalHistoricalPeriods === 0) {
      // No historical data - neutral score
      return 50;
    }

    // If this pattern occurs frequently (>30% of time), score is high
    // If rare (<10%), score is lower (might be false positive)
    const occurrenceRate = similarOccurrences / totalHistoricalPeriods;

    let score: number;
    if (occurrenceRate > 0.3) {
      // Frequent pattern (>30%): high confidence (70-100)
      score = 70 + Math.min(occurrenceRate * 30, 30);
    } else if (occurrenceRate > 0.1) {
      // Moderate pattern (10-30%): medium confidence (50-70)
      score = 50 + ((occurrenceRate - 0.1) / 0.2) * 20;
    } else {
      // Rare pattern (<10%): lower confidence (20-50)
      score = 20 + (occurrenceRate / 0.1) * 30;
    }

    logger.debug("Historical consistency calculated", {
      similarOccurrences,
      totalHistoricalPeriods,
      occurrenceRate,
      score,
    });

    return Math.round(score);
  }

  /**
   * Calculate time relevance score
   * Based on how recent the data is
   */
  static calculateTimeRelevance(dataAgeHours: number): number {
    // Fresh data (<6 hours): 100 points
    // Recent data (6-24 hours): 80-100 points
    // Older data (24-72 hours): 50-80 points
    // Stale data (>72 hours): 20-50 points

    let score: number;
    if (dataAgeHours <= 6) {
      score = 100;
    } else if (dataAgeHours <= 24) {
      // Linear decay from 100 to 80
      score = 100 - ((dataAgeHours - 6) / 18) * 20;
    } else if (dataAgeHours <= 72) {
      // Linear decay from 80 to 50
      score = 80 - ((dataAgeHours - 24) / 48) * 30;
    } else if (dataAgeHours <= 168) {
      // 1 week: Linear decay from 50 to 20
      score = 50 - ((dataAgeHours - 72) / 96) * 30;
    } else {
      // Very stale: minimum score
      score = 20;
    }

    logger.debug("Time relevance calculated", {
      dataAgeHours,
      score,
    });

    return Math.round(score);
  }

  /**
   * Calculate confidence for expense spike detection
   */
  static forExpenseSpike(
    currentExpense: number,
    avgExpense: number,
    sampleDays: number,
    dataAgeHours: number,
  ): number {
    const dataQuality = this.calculateDataQuality(sampleDays, 7, 0);
    const anomalySeverity = this.calculateAnomalySeverity(
      currentExpense,
      avgExpense,
      30, // 30% threshold
    );
    const historicalConsistency = 75; // Assume moderate consistency for expense patterns
    const timeRelevance = this.calculateTimeRelevance(dataAgeHours);

    return this.calculate({
      dataQuality,
      anomalySeverity,
      historicalConsistency,
      timeRelevance,
    });
  }

  /**
   * Calculate confidence for revenue decline detection
   */
  static forRevenueDecline(
    currentRevenue: number,
    previousRevenue: number,
    sampleDays: number,
    dataAgeHours: number,
  ): number {
    const dataQuality = this.calculateDataQuality(sampleDays, 7, 0);
    const anomalySeverity = this.calculateAnomalySeverity(
      currentRevenue,
      previousRevenue,
      15, // 15% threshold
    );
    const historicalConsistency = 70; // Revenue patterns are usually consistent
    const timeRelevance = this.calculateTimeRelevance(dataAgeHours);

    return this.calculate({
      dataQuality,
      anomalySeverity,
      historicalConsistency,
      timeRelevance,
    });
  }

  /**
   * Calculate confidence for negative cashflow warning
   */
  static forNegativeCashflow(
    consecutiveDays: number,
    totalDaysAnalyzed: number,
    dataAgeHours: number,
  ): number {
    const dataQuality = this.calculateDataQuality(totalDaysAnalyzed, 7, 0);

    // Severity increases with consecutive days
    // 3 days: 60 points, 5 days: 80 points, 7+ days: 100 points
    let anomalySeverity: number;
    if (consecutiveDays >= 7) {
      anomalySeverity = 100;
    } else if (consecutiveDays >= 5) {
      anomalySeverity = 80 + ((consecutiveDays - 5) / 2) * 20;
    } else {
      anomalySeverity = 60 + ((consecutiveDays - 3) / 2) * 20;
    }

    const historicalConsistency = 80; // Negative cashflow is a strong signal
    const timeRelevance = this.calculateTimeRelevance(dataAgeHours);

    return this.calculate({
      dataQuality,
      anomalySeverity,
      historicalConsistency,
      timeRelevance,
    });
  }

  /**
   * Calculate confidence for target variance warning
   */
  static forTargetVariance(
    actualValue: number,
    targetValue: number,
    periodCompleteness: number,
    dataAgeHours: number,
  ): number {
    // Period completeness: 0-1 (e.g., 0.5 = 50% through month)
    const dataQuality = periodCompleteness * 100;

    const anomalySeverity = this.calculateAnomalySeverity(
      actualValue,
      targetValue,
      20, // 20% variance threshold
    );

    const historicalConsistency = 65; // Target variance patterns vary
    const timeRelevance = this.calculateTimeRelevance(dataAgeHours);

    return this.calculate({
      dataQuality,
      anomalySeverity,
      historicalConsistency,
      timeRelevance,
    });
  }

  /**
   * Validate confidence factors
   */
  private static validateFactors(factors: ConfidenceFactors): void {
    const {
      dataQuality,
      anomalySeverity,
      historicalConsistency,
      timeRelevance,
    } = factors;

    if (
      dataQuality < 0 ||
      dataQuality > 100 ||
      anomalySeverity < 0 ||
      anomalySeverity > 100 ||
      historicalConsistency < 0 ||
      historicalConsistency > 100 ||
      timeRelevance < 0 ||
      timeRelevance > 100
    ) {
      throw new Error("All confidence factors must be between 0 and 100");
    }
  }
}

export default ConfidenceScoreCalculator;
