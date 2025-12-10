/**
 * Unit tests for TrendingInsightsService
 * Tests trend detection and monthly insights generation
 */

import { TrendingInsightsService } from "../../../../src/services/recommendation/trending";

// Mock Prisma
let mockPrismaInstance: {
  $queryRaw: jest.Mock;
};

jest.mock("@prisma/client", () => {
  const mockInstance = {
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

// Mock currency
jest.mock("../../../../src/lib/currency", () => ({
  formatCurrency: jest.fn((amount: number) => `Rp ${amount.toLocaleString()}`),
}));

describe("TrendingInsightsService", () => {
  let service: TrendingInsightsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (TrendingInsightsService as any).instance = undefined;
    mockPrismaInstance.$queryRaw.mockReset();
    service = TrendingInsightsService.getInstance();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = TrendingInsightsService.getInstance();
      const instance2 = TrendingInsightsService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(TrendingInsightsService);
    });
  });

  describe("generateMonthlyInsights", () => {
    it("should generate monthly insights", async () => {
      const month = new Date("2024-01-15");

      // Mock all the private method calls by mocking $queryRaw
      mockPrismaInstance.$queryRaw
        .mockResolvedValueOnce([]) // analyzeRevenueTrend
        .mockResolvedValueOnce([]) // analyzeExpenseTrend
        .mockResolvedValueOnce([]) // analyzeCategoryTrends
        .mockResolvedValueOnce([]) // analyzeCashflowPattern
        .mockResolvedValueOnce([]) // detectSeasonalPatterns
        .mockResolvedValueOnce([]) // detectAnomalies
        .mockResolvedValueOnce(undefined); // saveInsights

      const result = await service.generateMonthlyInsights(month);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array on error", async () => {
      const month = new Date("2024-01-15");

      mockPrismaInstance.$queryRaw.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.generateMonthlyInsights(month);

      expect(result).toEqual([]);
    });
  });
});
