/**
 * Unit tests for RecommendationLearningService
 * Tests recommendation learning and performance tracking
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPrismaInstance: any;

import { RecommendationLearningService } from "../../../../src/services/recommendation/learning";
import type { LearningData } from "../../../../src/services/recommendation/learning";

jest.mock("@prisma/client", () => {
  const mockInstance = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };
  mockPrismaInstance = mockInstance;
  return {
    PrismaClient: jest.fn(() => mockInstance),
  };
});

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("RecommendationLearningService", () => {
  let service: RecommendationLearningService;

  beforeEach(() => {
    jest.clearAllMocks();
    (RecommendationLearningService as any).instance = undefined;
    // Reset mocks
    if (mockPrismaInstance) {
      mockPrismaInstance.$executeRaw.mockReset();
      mockPrismaInstance.$queryRaw.mockReset();
    }
    service = RecommendationLearningService.getInstance();
    // Ensure mock is set up after service creation
    if (mockPrismaInstance) {
      (service as any).prisma = mockPrismaInstance;
    }
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = RecommendationLearningService.getInstance();
      const instance2 = RecommendationLearningService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RecommendationLearningService);
    });
  });

  describe("recordInteraction", () => {
    it("should record user interaction with recommendation", async () => {
      const learningData: LearningData = {
        recommendationId: "rec123",
        userId: "user123",
        recommendationType: "expense_spike",
        acknowledged: true,
        dismissed: false,
        actionTaken: "reviewed",
        feedbackScore: 4,
        timestamp: new Date(),
      };

      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);

      await service.recordInteraction(learningData);

      expect(mockPrismaInstance.$executeRaw).toHaveBeenCalled();
    });

    it("should handle interaction without optional fields", async () => {
      const learningData: LearningData = {
        recommendationId: "rec123",
        userId: "user123",
        recommendationType: "expense_spike",
        acknowledged: false,
        dismissed: true,
        timestamp: new Date(),
      };

      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);

      await service.recordInteraction(learningData);

      expect(mockPrismaInstance.$executeRaw).toHaveBeenCalled();
    });

    it("should throw error on failure", async () => {
      const learningData: LearningData = {
        recommendationId: "rec123",
        userId: "user123",
        recommendationType: "expense_spike",
        acknowledged: true,
        dismissed: false,
        timestamp: new Date(),
      };

      mockPrismaInstance.$executeRaw.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.recordInteraction(learningData)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should get performance metrics for all types", async () => {
      const mockResults = [
        {
          recommendation_type: "expense_spike",
          total_shown: BigInt(100),
          acknowledged_count: BigInt(60),
          dismissed_count: BigInt(20),
          avg_feedback: "4.2",
          last_updated: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockResults);

      const result = await service.getPerformanceMetrics();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should get performance metrics for specific type", async () => {
      const mockResults = [
        {
          recommendation_type: "expense_spike",
          total_shown: BigInt(50),
          acknowledged_count: BigInt(30),
          dismissed_count: BigInt(10),
          avg_feedback: "4.5",
          last_updated: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockResults);

      const result = await service.getPerformanceMetrics("expense_spike");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array on error", async () => {
      mockPrismaInstance.$queryRaw.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.getPerformanceMetrics();

      expect(result).toEqual([]);
    });
  });
});
