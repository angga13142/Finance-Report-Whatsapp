/**
 * Unit tests for RecommendationDeliveryService
 * Tests recommendation delivery via WhatsApp
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import type { Client } from "whatsapp-web.js";

// Mock Prisma - create singleton mock instance BEFORE importing delivery module
const mockPrismaInstance = {
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Create a factory function that always returns the same instance
let PrismaClientMock: jest.Mock;

jest.mock("@prisma/client", () => {
  PrismaClientMock = jest.fn(() => mockPrismaInstance);
  return {
    PrismaClient: PrismaClientMock,
  };
});

// Mock recommendation model
const mockRecommendationModel = {
  getById: jest.fn(),
  isDismissedByUser: jest.fn().mockResolvedValue(false),
};

jest.mock("../../../../src/models/recommendation", () => ({
  __esModule: true,
  default: mockRecommendationModel,
  RecommendationModel: mockRecommendationModel,
}));

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after all mocks are set up
import { RecommendationDeliveryService } from "../../../../src/services/recommendation/delivery";

describe("RecommendationDeliveryService", () => {
  let service: RecommendationDeliveryService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset and setup mock - ensure it returns empty array by default
    if (mockPrismaInstance) {
      mockPrismaInstance.user.findMany.mockReset();
      mockPrismaInstance.user.findMany.mockResolvedValue([]);
    }
    mockRecommendationModel.getById.mockReset();
    mockRecommendationModel.isDismissedByUser.mockReset();
    mockRecommendationModel.isDismissedByUser.mockResolvedValue(false);
    mockClient = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new RecommendationDeliveryService(mockClient);
  });

  describe("deliverRecommendation", () => {
    it("should deliver recommendation to target users", async () => {
      require("../../../../src/models/recommendation");
      const mockRecommendation = {
        id: "rec123",
        targetRoles: ["boss", "dev"],
        content: {
          title: "Test Alert",
          message: "Test message",
        },
      };

      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          role: "boss",
        },
        {
          id: "user2",
          phoneNumber: "+62812345679",
          role: "dev",
        },
      ];

      // Setup all mocks before calling service
      const mockRecommendationWithExtras = {
        ...mockRecommendation,
        content: {
          ...mockRecommendation.content,
          recommendations: ["Action 1", "Action 2"],
        },
        priority: "high",
        confidenceScore: 85,
      };
      mockRecommendationModel.getById.mockResolvedValue(
        mockRecommendationWithExtras,
      );
      mockRecommendationModel.isDismissedByUser.mockResolvedValue(false);
      // Reset and set mock - must be done before service uses prisma
      mockPrismaInstance.user.findMany.mockReset();
      mockPrismaInstance.user.findMany.mockResolvedValue(mockUsers);
      (mockClient.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deliverRecommendation("rec123");

      expect(result).toBeDefined();
      expect(result.recommendationId).toBe("rec123");
      expect(result.totalUsers).toBe(2);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalled();
      expect(mockRecommendationModel.isDismissedByUser).toHaveBeenCalled();
      // Check if sendMessage was called (should be called 2 times for 2 users)
      expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
      expect(result.delivered).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should skip dismissed recommendations", async () => {
      const mockRecommendation = {
        id: "rec123",
        targetRoles: ["boss"],
        content: {
          title: "Test Alert",
          message: "Test message",
        },
        priority: "high",
        confidenceScore: 85,
      };

      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          role: "boss",
        },
      ];

      mockRecommendationModel.getById.mockResolvedValue(mockRecommendation);
      mockRecommendationModel.isDismissedByUser.mockResolvedValue(true); // Dismissed
      mockPrismaInstance.user.findMany.mockResolvedValue(mockUsers);
      (mockClient.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deliverRecommendation("rec123");

      // Dismissed recommendations are counted as delivered (success)
      expect(result.delivered).toBe(1);
      expect(mockClient.sendMessage).not.toHaveBeenCalled();
    });

    it("should throw error when recommendation not found", async () => {
      mockRecommendationModel.getById.mockResolvedValue(null);

      await expect(
        service.deliverRecommendation("nonexistent"),
      ).rejects.toThrow("Recommendation nonexistent not found");
    });

    it("should handle delivery failures gracefully", async () => {
      const mockRecommendation = {
        id: "rec123",
        targetRoles: ["boss"],
        content: {
          title: "Test Alert",
          message: "Test message",
        },
        priority: "high",
        confidenceScore: 85,
      };

      const mockUsers = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          role: "boss",
        },
      ];

      mockRecommendationModel.getById.mockResolvedValue(mockRecommendation);
      mockRecommendationModel.isDismissedByUser.mockResolvedValue(false);
      mockPrismaInstance.user.findMany.mockResolvedValue(mockUsers);
      (mockClient.sendMessage as jest.Mock).mockRejectedValue(
        new Error("WhatsApp error"),
      );

      const result = await service.deliverRecommendation("rec123");

      expect(result.failed).toBe(1);
      expect(result.delivered).toBe(0);
    });
  });
});
