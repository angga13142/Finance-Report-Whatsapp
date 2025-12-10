/**
 * Unit tests for RecommendationExportService
 * Tests recommendation export functionality (email, Slack)
 */

import { RecommendationExportService } from "../../../../src/services/recommendation/export";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("RecommendationExportService", () => {
  let service: RecommendationExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = RecommendationExportService.getInstance();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = RecommendationExportService.getInstance();
      const instance2 = RecommendationExportService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RecommendationExportService);
    });
  });

  describe("exportToEmail", () => {
    it("should export recommendation to email", async () => {
      const recommendationId = "rec123";
      const recipients = ["user1@example.com", "user2@example.com"];

      const result = await service.exportToEmail(recommendationId, recipients);

      expect(result).toBe(true);
    });

    it("should handle empty recipients array", async () => {
      const recommendationId = "rec123";
      const recipients: string[] = [];

      const result = await service.exportToEmail(recommendationId, recipients);

      expect(result).toBe(true);
    });

    it("should handle single recipient", async () => {
      const recommendationId = "rec123";
      const recipients = ["user@example.com"];

      const result = await service.exportToEmail(recommendationId, recipients);

      expect(result).toBe(true);
    });
  });

  describe("exportToSlack", () => {
    it("should export recommendation to Slack", async () => {
      const recommendationId = "rec123";
      const channel = "#finance-alerts";

      const result = await service.exportToSlack(recommendationId, channel);

      expect(result).toBe(true);
    });

    it("should handle different channel formats", async () => {
      const recommendationId = "rec123";
      const channels = ["#general", "@user", "channel-name"];

      for (const channel of channels) {
        const result = await service.exportToSlack(recommendationId, channel);
        expect(result).toBe(true);
      }
    });
  });
});
