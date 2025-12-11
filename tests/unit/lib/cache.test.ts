/**
 * Unit tests for cache service
 * Tests Redis caching operations for daily totals, user data, categories, etc.
 */

import { CacheService } from "../../../src/lib/cache";
import { redis } from "../../../src/lib/redis";
import type { User, Category } from "@prisma/client";

// Mock Redis
jest.mock("../../../src/lib/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  },
}));

// Mock metrics
jest.mock("../../../src/lib/metrics", () => ({
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  recordCacheOperation: jest.fn(),
}));

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("CacheService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDailyTotals", () => {
    it("should return cached daily totals when available", async () => {
      const mockData = {
        date: "2024-01-15",
        totalIncome: 1000000,
        totalExpense: 500000,
        netCashflow: 500000,
        transactionCount: 10,
        lastUpdated: new Date().toISOString(),
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await CacheService.getDailyTotals("2024-01-15");

      expect(result).toEqual(mockData);
      expect(redis.get).toHaveBeenCalledWith("cache:daily_totals:2024-01-15");
    });

    it("should return null when cache miss", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await CacheService.getDailyTotals("2024-01-15");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      (redis.get as jest.Mock).mockRejectedValue(new Error("Redis error"));

      const result = await CacheService.getDailyTotals("2024-01-15");

      expect(result).toBeNull();
    });
  });

  describe("setDailyTotals", () => {
    it("should set daily totals in cache", async () => {
      const totals = {
        totalIncome: 1000000,
        totalExpense: 500000,
        netCashflow: 500000,
        transactionCount: 10,
      };

      await CacheService.setDailyTotals("2024-01-15", totals);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:daily_totals:2024-01-15",
        expect.stringContaining("2024-01-15"),
        300, // TTL
      );
    });

    it("should handle errors gracefully", async () => {
      (redis.set as jest.Mock).mockRejectedValue(new Error("Redis error"));

      await expect(
        CacheService.setDailyTotals("2024-01-15", {
          totalIncome: 1000000,
          totalExpense: 500000,
          netCashflow: 500000,
          transactionCount: 10,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("invalidateDailyTotals", () => {
    it("should delete daily totals cache", async () => {
      await CacheService.invalidateDailyTotals("2024-01-15");

      expect(redis.del).toHaveBeenCalledWith("cache:daily_totals:2024-01-15");
    });
  });

  describe("getUserRole", () => {
    it("should return cached user role when available", async () => {
      const mockData = {
        userId: "user123",
        role: "employee",
        isActive: true,
        cachedAt: new Date().toISOString(),
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await CacheService.getUserRole("user123");

      expect(result).toEqual(mockData);
      expect(redis.get).toHaveBeenCalledWith("cache:user_role:user123");
    });

    it("should return null when cache miss", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await CacheService.getUserRole("user123");

      expect(result).toBeNull();
    });
  });

  describe("setUserRole", () => {
    it("should set user role in cache", async () => {
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee",
        isActive: true,
        createdAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      };

      await CacheService.setUserRole(mockUser);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:user_role:user123",
        expect.stringContaining("user123"),
        3600, // TTL
      );
    });
  });

  describe("getUserData", () => {
    it("should return cached user data when available", async () => {
      const mockDate = new Date();
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee",
        isActive: true,
        createdAt: mockDate,
        lastActive: mockDate,
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      };

      // After JSON.stringify, dates become strings
      const mockUserStringified = {
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        lastActive: mockUser.lastActive?.toISOString() ?? null,
      };

      (redis.get as jest.Mock).mockResolvedValue(
        JSON.stringify(mockUserStringified),
      );

      const result = await CacheService.getUserData("user123");

      // After JSON parse, dates remain as strings
      const expected = {
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        lastActive: mockUser.lastActive?.toISOString() ?? null,
      };
      expect(result).toEqual(expected);
    });

    it("should return null when cache miss", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await CacheService.getUserData("user123");

      expect(result).toBeNull();
    });
  });

  describe("setUserData", () => {
    it("should set user data in cache", async () => {
      const mockUser: User = {
        id: "user123",
        phoneNumber: "+62812345678",
        name: "Test User",
        role: "employee",
        isActive: true,
        createdAt: new Date(),
        lastActive: new Date(),
        authTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      };

      await CacheService.setUserData(mockUser);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:user_data:user123",
        JSON.stringify(mockUser),
        1800, // TTL
      );
    });
  });

  describe("invalidateUserData", () => {
    it("should delete user data and role cache", async () => {
      (redis.del as jest.Mock).mockResolvedValue(1);

      await CacheService.invalidateUserData("user123");

      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledWith("cache:user_data:user123");
      expect(redis.del).toHaveBeenCalledWith("cache:user_role:user123");
    });
  });

  describe("getCategories", () => {
    it("should return cached categories when available", async () => {
      const mockDate = new Date();
      const mockCategories: Category[] = [
        {
          id: "cat1",
          name: "Food",
          type: "expense",
          createdAt: mockDate,
          isActive: true,
          icon: null,
          createdByUserId: null,
        },
      ];

      const mockData = {
        categories: mockCategories.map((cat) => ({
          ...cat,
          createdAt: cat.createdAt.toISOString(),
        })),
        cachedAt: new Date().toISOString(),
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await CacheService.getCategories();

      // After JSON parse, dates become strings
      const expected = mockCategories.map((cat) => ({
        ...cat,
        createdAt: cat.createdAt.toISOString(),
      }));
      expect(result).toEqual(expected);
    });

    it("should return cached categories by type", async () => {
      const mockDate = new Date();
      const mockCategories: Category[] = [
        {
          id: "cat1",
          name: "Food",
          type: "expense",
          createdAt: mockDate,
          isActive: true,
          icon: null,
          createdByUserId: null,
        },
      ];

      const mockData = {
        categories: mockCategories.map((cat) => ({
          ...cat,
          createdAt: cat.createdAt.toISOString(),
        })),
        cachedAt: new Date().toISOString(),
      };

      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await CacheService.getCategories("expense");

      // After JSON parse, dates become strings, so we need to convert back
      const expected = mockCategories.map((cat) => ({
        ...cat,
        createdAt: cat.createdAt.toISOString(),
      }));
      expect(result).toEqual(expected);
      expect(redis.get).toHaveBeenCalledWith("cache:categories:expense");
    });
  });

  describe("setCategories", () => {
    it("should set categories in cache", async () => {
      const mockCategories: Category[] = [
        {
          id: "cat1",
          name: "Food",
          type: "expense",
          createdAt: new Date(),
          isActive: true,
          icon: null,
          createdByUserId: null,
        },
      ];

      await CacheService.setCategories(mockCategories);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:categories:all",
        expect.stringContaining("categories"),
        7200, // TTL
      );
    });
  });

  describe("getActiveUsersCount", () => {
    it("should return cached active users count", async () => {
      (redis.get as jest.Mock).mockResolvedValue("10");

      const result = await CacheService.getActiveUsersCount();

      expect(result).toBe(10);
    });

    it("should return null when cache miss", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await CacheService.getActiveUsersCount();

      expect(result).toBeNull();
    });
  });

  describe("setActiveUsersCount", () => {
    it("should set active users count in cache", async () => {
      await CacheService.setActiveUsersCount(10);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:active_users:count",
        "10",
        60, // TTL
      );
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      (redis.keys as jest.Mock).mockImplementation((pattern: string) => {
        if (pattern.includes("daily_totals"))
          return Promise.resolve(["key1", "key2"]);
        if (pattern.includes("user_role")) return Promise.resolve(["key3"]);
        if (pattern.includes("user_data"))
          return Promise.resolve(["key4", "key5"]);
        if (pattern.includes("categories")) return Promise.resolve(["key6"]);
        return Promise.resolve([]);
      });

      const result = await CacheService.getCacheStats();

      expect(result).toEqual({
        dailyTotalsCount: 2,
        userRoleCount: 1,
        userDataCount: 2,
        categoriesCount: 1,
        totalKeys: 6,
      });
    });

    it("should return zeros on error", async () => {
      (redis.keys as jest.Mock).mockRejectedValue(new Error("Redis error"));

      const result = await CacheService.getCacheStats();

      expect(result).toEqual({
        dailyTotalsCount: 0,
        userRoleCount: 0,
        userDataCount: 0,
        categoriesCount: 0,
        totalKeys: 0,
      });
    });
  });

  describe("warmUp", () => {
    it("should warm up cache with categories and users", async () => {
      const mockCategories: Category[] = [
        {
          id: "cat1",
          name: "Food",
          type: "income",
          createdAt: new Date(),
          isActive: true,
          icon: null,
          createdByUserId: null,
        },
        {
          id: "cat2",
          name: "Transport",
          type: "expense",
          createdAt: new Date(),
          isActive: true,
          icon: null,
          createdByUserId: null,
        },
      ];

      const mockUsers: Array<
        User & {
          failedLoginAttempts?: number;
          lockedUntil?: Date | null;
          lastFailedLoginAt?: Date | null;
        }
      > = [
        {
          id: "user1",
          phoneNumber: "+62812345678",
          name: "User 1",
          role: "employee",
          isActive: true,
          createdAt: new Date(),
          lastActive: new Date(),
          authTokenHash: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        },
      ];

      await CacheService.warmUp({
        categories: mockCategories,
        activeUsers: mockUsers,
      });

      expect(redis.set).toHaveBeenCalled();
    });
  });
});
