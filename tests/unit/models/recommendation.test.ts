/**
 * Unit tests for RecommendationModel
 * Tests recommendation CRUD operations, acknowledgment, dismissal, and statistics
 */

import type {
  RecommendationType,
  RecommendationPriority,
  UserRole,
} from "@prisma/client";

// Create shared mock Prisma instance
const mockPrismaInstance = {
  recommendation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $use: jest.fn(),
  $on: jest.fn(),
  $extends: jest.fn(),
};

// Mock Prisma before importing RecommendationModel
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
  };
});

// Import after mock setup
import { RecommendationModel } from "../../../src/models/recommendation";

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("RecommendationModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create recommendation", async () => {
      const mockRecommendation = {
        id: "rec123",
        generatedAt: new Date(),
      };

      mockPrismaInstance.recommendation.create.mockResolvedValue(
        mockRecommendation,
      );

      const result = await RecommendationModel.create({
        type: "expense_spike" as RecommendationType,
        priority: "high" as RecommendationPriority,
        confidenceScore: 85,
        targetRoles: ["boss" as UserRole, "employee" as UserRole],
        content: {
          title: "Expense Spike Detected",
          message: "Expenses increased significantly",
          recommendations: ["Review expenses", "Check categories"],
        },
      });

      expect(result).toEqual(mockRecommendation);
      expect(mockPrismaInstance.recommendation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "expense_spike",
          priority: "high",
          confidenceScore: 85,
          targetRoles: ["boss", "employee"],
        }),
        select: {
          id: true,
          generatedAt: true,
        },
      });
    });
  });

  describe("getById", () => {
    it("should get recommendation by ID", async () => {
      const mockRecommendation = {
        id: "rec123",
        type: "expense_spike",
        priority: "high",
        confidenceScore: 85,
        generatedAt: new Date(),
      };

      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(
        mockRecommendation,
      );

      const result = await RecommendationModel.getById("rec123");

      expect(result).toEqual(mockRecommendation);
      expect(mockPrismaInstance.recommendation.findUnique).toHaveBeenCalledWith(
        {
          where: { id: "rec123" },
        },
      );
    });

    it("should return null when not found", async () => {
      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(null);

      const result = await RecommendationModel.getById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getRecentForRole", () => {
    it("should get recent recommendations for role", async () => {
      const mockRecommendations = [
        {
          id: "rec1",
          type: "expense_spike",
          priority: "high",
          targetRoles: ["boss"],
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.recommendation.findMany.mockResolvedValue(
        mockRecommendations,
      );

      const result = await RecommendationModel.getRecentForRole("boss", 10, 24);

      expect(result).toEqual(mockRecommendations);
      expect(mockPrismaInstance.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetRoles: {
              has: "boss",
            },
            generatedAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
          orderBy: expect.arrayContaining([
            { priority: "desc" },
            { confidenceScore: "desc" },
            { generatedAt: "desc" },
          ]),
          take: 10,
        }),
      );
    });

    it("should use default limit and hoursBack", async () => {
      mockPrismaInstance.recommendation.findMany.mockResolvedValue([]);

      await RecommendationModel.getRecentForRole("boss");

      expect(mockPrismaInstance.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });
  });

  describe("getUnacknowledgedCritical", () => {
    it("should get unacknowledged critical recommendations", async () => {
      const mockRecommendations = [
        {
          id: "rec1",
          type: "cashflow_warning",
          priority: "critical",
          acknowledgedAt: null,
        },
      ];

      mockPrismaInstance.recommendation.findMany.mockResolvedValue(
        mockRecommendations,
      );

      const result =
        await RecommendationModel.getUnacknowledgedCritical("boss");

      expect(result).toEqual(mockRecommendations);
      expect(mockPrismaInstance.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetRoles: {
              has: "boss",
            },
            priority: "critical",
            acknowledgedAt: null,
          }),
        }),
      );
    });
  });

  describe("markAsAcknowledged", () => {
    it("should mark recommendation as acknowledged", async () => {
      mockPrismaInstance.recommendation.update.mockResolvedValue({
        id: "rec123",
        acknowledgedAt: new Date(),
      });

      await RecommendationModel.markAsAcknowledged("rec123");

      expect(mockPrismaInstance.recommendation.update).toHaveBeenCalledWith({
        where: { id: "rec123" },
        data: {
          acknowledgedAt: expect.any(Date),
        },
      });
    });
  });

  describe("dismissByUser", () => {
    it("should dismiss recommendation for user", async () => {
      const mockRecommendation = {
        id: "rec123",
        dismissedByUsers: [],
      };

      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(
        mockRecommendation,
      );
      mockPrismaInstance.recommendation.update.mockResolvedValue({
        id: "rec123",
        dismissedByUsers: ["user123"],
      });

      await RecommendationModel.dismissByUser("rec123", "user123");

      expect(mockPrismaInstance.recommendation.findUnique).toHaveBeenCalledWith(
        {
          where: { id: "rec123" },
          select: { dismissedByUsers: true },
        },
      );
      expect(mockPrismaInstance.recommendation.update).toHaveBeenCalledWith({
        where: { id: "rec123" },
        data: {
          dismissedByUsers: {
            push: "user123",
          },
        },
      });
    });

    it("should not add user if already dismissed", async () => {
      const mockRecommendation = {
        id: "rec123",
        dismissedByUsers: ["user123"],
      };

      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(
        mockRecommendation,
      );

      await RecommendationModel.dismissByUser("rec123", "user123");

      expect(mockPrismaInstance.recommendation.update).not.toHaveBeenCalled();
    });

    it("should throw error when recommendation not found", async () => {
      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(null);

      await expect(
        RecommendationModel.dismissByUser("nonexistent", "user123"),
      ).rejects.toThrow("Recommendation nonexistent not found");
    });
  });

  describe("isDismissedByUser", () => {
    it("should return true when user has dismissed", async () => {
      const mockRecommendation = {
        id: "rec123",
        dismissedByUsers: ["user123", "user456"],
      };

      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(
        mockRecommendation,
      );

      const result = await RecommendationModel.isDismissedByUser(
        "rec123",
        "user123",
      );

      expect(result).toBe(true);
    });

    it("should return false when user has not dismissed", async () => {
      const mockRecommendation = {
        id: "rec123",
        dismissedByUsers: ["user456"],
      };

      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(
        mockRecommendation,
      );

      const result = await RecommendationModel.isDismissedByUser(
        "rec123",
        "user123",
      );

      expect(result).toBe(false);
    });

    it("should return false when recommendation not found", async () => {
      mockPrismaInstance.recommendation.findUnique.mockResolvedValue(null);

      const result = await RecommendationModel.isDismissedByUser(
        "nonexistent",
        "user123",
      );

      expect(result).toBe(false);
    });
  });

  describe("getActiveForUser", () => {
    it("should get active recommendations not dismissed by user", async () => {
      const mockRecommendations = [
        {
          id: "rec1",
          dismissedByUsers: [],
        },
        {
          id: "rec2",
          dismissedByUsers: ["user123"],
        },
        {
          id: "rec3",
          dismissedByUsers: [],
        },
      ];

      mockPrismaInstance.recommendation.findMany.mockResolvedValue(
        mockRecommendations,
      );

      const result = await RecommendationModel.getActiveForUser(
        "user123",
        "boss",
        10,
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("rec1");
      expect(result[1].id).toBe("rec3");
    });
  });

  describe("getStatistics", () => {
    it("should get recommendation statistics", async () => {
      mockPrismaInstance.recommendation.count.mockResolvedValue(50);
      mockPrismaInstance.recommendation.groupBy
        .mockResolvedValueOnce([
          { priority: "critical", _count: 10 },
          { priority: "high", _count: 20 },
        ])
        .mockResolvedValueOnce([
          { type: "expense_spike", _count: 30 },
          { type: "cashflow_warning", _count: 20 },
        ]);
      mockPrismaInstance.recommendation.aggregate.mockResolvedValue({
        _avg: { confidenceScore: 85.5 },
      });

      const result = await RecommendationModel.getStatistics(24);

      expect(result.total).toBe(50);
      expect(result.bySeverity).toHaveLength(2);
      expect(result.byType).toHaveLength(2);
      expect(result.avgConfidence).toBe(85.5);
    });

    it("should handle null average confidence", async () => {
      mockPrismaInstance.recommendation.count.mockResolvedValue(0);
      mockPrismaInstance.recommendation.groupBy.mockResolvedValue([]);
      mockPrismaInstance.recommendation.aggregate.mockResolvedValue({
        _avg: { confidenceScore: null },
      });

      const result = await RecommendationModel.getStatistics(24);

      expect(result.avgConfidence).toBe(0);
    });
  });

  describe("cleanupOld", () => {
    it("should delete old recommendations", async () => {
      mockPrismaInstance.recommendation.deleteMany.mockResolvedValue({
        count: 25,
      });

      const result = await RecommendationModel.cleanupOld(30);

      expect(result).toBe(25);
      expect(mockPrismaInstance.recommendation.deleteMany).toHaveBeenCalledWith(
        {
          where: expect.objectContaining({
            generatedAt: expect.objectContaining({
              lt: expect.any(Date),
            }),
          }),
        },
      );
    });

    it("should use default daysOld", async () => {
      mockPrismaInstance.recommendation.deleteMany.mockResolvedValue({
        count: 10,
      });

      await RecommendationModel.cleanupOld();

      const callArgs =
        mockPrismaInstance.recommendation.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.generatedAt.lt;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);

      expect(cutoffDate.getTime()).toBeLessThanOrEqual(
        expectedDate.getTime() + 1000,
      );
    });
  });

  describe("hasDuplicateRecent", () => {
    it("should return true when duplicate exists", async () => {
      mockPrismaInstance.recommendation.count.mockResolvedValue(1);

      const result = await RecommendationModel.hasDuplicateRecent(
        "expense_spike",
        60,
      );

      expect(result).toBe(true);
      expect(mockPrismaInstance.recommendation.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: "expense_spike",
          generatedAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      });
    });

    it("should return false when no duplicate", async () => {
      mockPrismaInstance.recommendation.count.mockResolvedValue(0);

      const result = await RecommendationModel.hasDuplicateRecent(
        "expense_spike",
        60,
      );

      expect(result).toBe(false);
    });

    it("should use default minutesBack", async () => {
      mockPrismaInstance.recommendation.count.mockResolvedValue(0);

      await RecommendationModel.hasDuplicateRecent("expense_spike");

      const callArgs = mockPrismaInstance.recommendation.count.mock.calls[0][0];
      const cutoffTime = callArgs.where.generatedAt.gte;
      const expectedTime = new Date();
      expectedTime.setMinutes(expectedTime.getMinutes() - 60);

      expect(cutoffTime.getTime()).toBeGreaterThanOrEqual(
        expectedTime.getTime() - 1000,
      );
    });
  });

  describe("getPendingDelivery", () => {
    it("should get recommendations pending delivery", async () => {
      const mockRecommendations = [
        {
          id: "rec1",
          acknowledgedAt: null,
          priority: "high",
          confidenceScore: 85,
        },
      ];

      mockPrismaInstance.recommendation.findMany.mockResolvedValue(
        mockRecommendations,
      );

      const result = await RecommendationModel.getPendingDelivery(60);

      expect(result).toEqual(mockRecommendations);
      expect(mockPrismaInstance.recommendation.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          generatedAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
          acknowledgedAt: null,
        }),
        orderBy: [{ priority: "desc" }, { confidenceScore: "desc" }],
      });
    });

    it("should use default minutesBack", async () => {
      mockPrismaInstance.recommendation.findMany.mockResolvedValue([]);

      await RecommendationModel.getPendingDelivery();

      const callArgs =
        mockPrismaInstance.recommendation.findMany.mock.calls[0][0];
      const cutoffTime = callArgs.where.generatedAt.gte;
      const expectedTime = new Date();
      expectedTime.setMinutes(expectedTime.getMinutes() - 60);

      expect(cutoffTime.getTime()).toBeGreaterThanOrEqual(
        expectedTime.getTime() - 1000,
      );
    });
  });
});
