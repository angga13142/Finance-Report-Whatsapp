/**
 * Unit tests for CacheService
 * Tests cache clear operations with pattern matching and Redis SCAN
 */

import { CacheService } from "../../../../src/services/system/cache";
import { redis } from "../../../../src/lib/redis";

// Mock dependencies
jest.mock("../../../../src/lib/redis", () => ({
  redis: {
    keys: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  },
}));
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("CacheService - Cache Clear Operations", () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService();
  });

  describe("Pattern Matching", () => {
    it("should clear cache by exact key", async () => {
      (redis.del as jest.Mock).mockResolvedValue(1);

      const result = await cacheService.clear("user:123");

      expect(result.deleted).toBe(1);
      expect(redis.del).toHaveBeenCalledWith("user:123");
    });

    it("should clear cache by pattern using SCAN", async () => {
      // Mock SCAN to return keys matching pattern
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["user:123", "user:456", "user:789"],
      });
      (redis.del as jest.Mock).mockResolvedValue(3);

      const result = await cacheService.clear("user:*");

      expect(result.deleted).toBe(3);
      expect(redis.scan).toHaveBeenCalled();
    });

    it("should handle multiple SCAN iterations", async () => {
      // First scan returns cursor and some keys
      (redis.scan as jest.Mock)
        .mockResolvedValueOnce({
          cursor: 100,
          keys: ["user:123", "user:456"],
        })
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ["user:789"],
        });
      (redis.del as jest.Mock).mockResolvedValue(3);

      const result = await cacheService.clear("user:*");

      expect(result.deleted).toBe(3);
      expect(redis.scan).toHaveBeenCalledTimes(2);
    });

    it("should support wildcard patterns", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["cache:user:123", "cache:user:456"],
      });
      (redis.del as jest.Mock).mockResolvedValue(2);

      const result = await cacheService.clear("cache:user:*");

      expect(result.deleted).toBe(2);
    });

    it("should support prefix patterns", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["session:abc", "session:def", "session:ghi"],
      });
      (redis.del as jest.Mock).mockResolvedValue(3);

      const result = await cacheService.clear("session:*");

      expect(result.deleted).toBe(3);
    });
  });

  describe("Redis SCAN Implementation", () => {
    it("should use SCAN instead of KEYS for pattern matching", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["user:123"],
      });
      (redis.del as jest.Mock).mockResolvedValue(1);

      await cacheService.clear("user:*");

      expect(redis.scan).toHaveBeenCalled();
      expect(redis.keys).not.toHaveBeenCalled(); // Should not use KEYS
    });

    it("should handle SCAN cursor pagination", async () => {
      let scanCallCount = 0;
      (redis.scan as jest.Mock).mockImplementation(() => {
        scanCallCount++;
        if (scanCallCount === 1) {
          return Promise.resolve({
            cursor: 50,
            keys: ["user:123", "user:456"],
          });
        } else {
          return Promise.resolve({
            cursor: 0,
            keys: ["user:789"],
          });
        }
      });
      (redis.del as jest.Mock).mockResolvedValue(3);

      const result = await cacheService.clear("user:*");

      expect(result.deleted).toBe(3);
      expect(redis.scan).toHaveBeenCalledTimes(2);
    });

    it("should handle empty scan results", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: [],
      });

      const result = await cacheService.clear("nonexistent:*");

      expect(result.deleted).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis errors gracefully", async () => {
      (redis.scan as jest.Mock).mockRejectedValue(
        new Error("Redis connection failed"),
      );

      await expect(cacheService.clear("user:*")).rejects.toThrow(
        "Redis connection failed",
      );
    });

    it("should handle partial deletion failures", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["user:123", "user:456", "user:789"],
      });
      (redis.del as jest.Mock).mockResolvedValue(2); // Only 2 deleted

      const result = await cacheService.clear("user:*");

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe("Clear All Cache", () => {
    it("should clear all cache entries", async () => {
      (redis.scan as jest.Mock).mockResolvedValue({
        cursor: 0,
        keys: ["key1", "key2", "key3"],
      });
      (redis.del as jest.Mock).mockResolvedValue(3);

      const result = await cacheService.clearAll();

      expect(result.deleted).toBeGreaterThan(0);
    });
  });
});
