/**
 * Unit tests for RecommendationEngine
 * Tests recommendation engine orchestration and gating logic
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import RecommendationEngine from "../../../../src/services/recommendation/engine";
import type { AlertGatingConfig } from "../../../../src/services/recommendation/engine";

// Mock analyzer
jest.mock("../../../../src/services/recommendation/analyzer");

// Mock recommendation model
jest.mock("../../../../src/models/recommendation");

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("RecommendationEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("run", () => {
    it("should run engine and create recommendations for passed anomalies", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      const mockAnomalies = [
        {
          detected: true,
          type: "expense_spike",
          priority: "critical",
          confidenceScore: 85,
          content: {
            title: "Expense Spike",
            message: "Test message",
            recommendations: [],
          },
        },
        {
          detected: true,
          type: "revenue_decline",
          priority: "high",
          confidenceScore: 75,
          content: {
            title: "Revenue Decline",
            message: "Test message",
            recommendations: [],
          },
        },
      ];

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(mockAnomalies[0]);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(mockAnomalies[1]);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(false);
      RecommendationModel.default.create = jest.fn().mockResolvedValue({
        id: "rec1",
        generatedAt: new Date(),
      });

      const config: AlertGatingConfig = {
        minConfidenceScore: 70,
        criticalPriorityRequired: false,
        deduplicationWindowMinutes: 60,
      };

      const result = await RecommendationEngine.run(config);

      expect(result.totalAnomaliesDetected).toBe(2);
      expect(result.recommendationsCreated).toBe(2);
      expect(result.anomaliesGated).toBe(0);
      expect(result.recommendations).toHaveLength(2);
    });

    it("should gate anomalies below confidence threshold", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      const mockAnomaly = {
        detected: true,
        type: "expense_spike",
        priority: "medium",
        confidenceScore: 65, // Below threshold
        content: {
          title: "Expense Spike",
          message: "Test message",
          recommendations: [],
        },
      };

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(mockAnomaly);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      const config: AlertGatingConfig = {
        minConfidenceScore: 70,
        criticalPriorityRequired: false,
        deduplicationWindowMinutes: 60,
      };

      const result = await RecommendationEngine.run(config);

      expect(result.totalAnomaliesDetected).toBe(1);
      expect(result.anomaliesGated).toBe(1);
      expect(result.recommendationsCreated).toBe(0);
      expect(RecommendationModel.default.create).not.toHaveBeenCalled();
    });

    it("should gate non-critical anomalies when criticalPriorityRequired is true", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");

      const mockAnomaly = {
        detected: true,
        type: "expense_spike",
        priority: "high", // Not critical
        confidenceScore: 85,
        content: {
          title: "Expense Spike",
          message: "Test message",
          recommendations: [],
        },
      };

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(mockAnomaly);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      const RecommendationModel = require("../../../../src/models/recommendation");
      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(false);

      const config: AlertGatingConfig = {
        minConfidenceScore: 70,
        criticalPriorityRequired: true,
        deduplicationWindowMinutes: 60,
      };

      const result = await RecommendationEngine.run(config);

      expect(result.anomaliesGated).toBe(1);
      expect(result.recommendationsCreated).toBe(0);
    });

    it("should gate duplicate anomalies within deduplication window", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      const mockAnomaly = {
        detected: true,
        type: "expense_spike",
        priority: "critical",
        confidenceScore: 85,
        content: {
          title: "Expense Spike",
          message: "Test message",
          recommendations: [],
        },
      };

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(mockAnomaly);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(true); // Duplicate exists

      const config: AlertGatingConfig = {
        minConfidenceScore: 70,
        criticalPriorityRequired: false,
        deduplicationWindowMinutes: 60,
      };

      const result = await RecommendationEngine.run(config);

      expect(result.anomaliesGated).toBe(1);
      expect(result.recommendationsCreated).toBe(0);
    });
  });

  describe("runForCriticalOnly", () => {
    it("should run with critical-only configuration", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(false);

      const result = await RecommendationEngine.runForCriticalOnly();

      expect(result).toBeDefined();
      expect(result.totalAnomaliesDetected).toBe(0);
    });
  });

  describe("runWithRelaxedGating", () => {
    it("should run with relaxed gating configuration", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(false);

      const result = await RecommendationEngine.runWithRelaxedGating();

      expect(result).toBeDefined();
    });
  });

  describe("runWithoutGating", () => {
    it("should run without any gating", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const RecommendationModel = require("../../../../src/models/recommendation");

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(null);
      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(null);

      RecommendationModel.default.hasDuplicateRecent = jest
        .fn()
        .mockResolvedValue(false);

      const result = await RecommendationEngine.runWithoutGating();

      expect(result).toBeDefined();
    });
  });

  describe("checkExpenseSpike", () => {
    it("should check expense spike manually", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const mockAnomaly = {
        detected: true,
        type: "expense_spike",
        priority: "critical",
        confidenceScore: 85,
        content: {},
      };

      FinancialAnomalyAnalyzer.default.detectExpenseSpike = jest
        .fn()
        .mockResolvedValue(mockAnomaly);

      const result = await RecommendationEngine.checkExpenseSpike();

      expect(result).toEqual(mockAnomaly);
    });
  });

  describe("checkRevenueDecline", () => {
    it("should check revenue decline manually", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const mockAnomaly = {
        detected: true,
        type: "revenue_decline",
        priority: "high",
        confidenceScore: 75,
        content: {},
      };

      FinancialAnomalyAnalyzer.default.detectRevenueDecline = jest
        .fn()
        .mockResolvedValue(mockAnomaly);

      const result = await RecommendationEngine.checkRevenueDecline();

      expect(result).toEqual(mockAnomaly);
    });
  });

  describe("checkNegativeCashflow", () => {
    it("should check negative cashflow manually", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const mockAnomaly = {
        detected: true,
        type: "cashflow_warning",
        priority: "medium",
        confidenceScore: 70,
        content: {},
      };

      FinancialAnomalyAnalyzer.default.detectNegativeCashflow = jest
        .fn()
        .mockResolvedValue(mockAnomaly);

      const result = await RecommendationEngine.checkNegativeCashflow();

      expect(result).toEqual(mockAnomaly);
    });
  });

  describe("checkTargetVariance", () => {
    it("should check target variance manually", async () => {
      const FinancialAnomalyAnalyzer = require("../../../../src/services/recommendation/analyzer");
      const mockAnomaly = {
        detected: true,
        type: "target_variance",
        priority: "high",
        confidenceScore: 80,
        content: {},
      };

      FinancialAnomalyAnalyzer.default.detectTargetVariance = jest
        .fn()
        .mockResolvedValue(mockAnomaly);

      const result = await RecommendationEngine.checkTargetVariance(
        1000000,
        500000,
      );

      expect(result).toEqual(mockAnomaly);
      expect(
        FinancialAnomalyAnalyzer.default.detectTargetVariance,
      ).toHaveBeenCalledWith(1000000, 500000);
    });
  });

  describe("getStatistics", () => {
    it("should get engine statistics", async () => {
      const RecommendationModel = require("../../../../src/models/recommendation");
      const mockStats = {
        total: 10,
        byType: {},
        byPriority: {},
      };

      RecommendationModel.default.getStatistics = jest
        .fn()
        .mockResolvedValue(mockStats);

      const result = await RecommendationEngine.getStatistics();

      expect(result).toEqual(mockStats);
      expect(RecommendationModel.default.getStatistics).toHaveBeenCalledWith(
        24,
      );
    });
  });
});
