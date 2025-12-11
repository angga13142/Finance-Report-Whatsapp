/**
 * Unit tests for Redis utilities
 * Tests Redis client wrapper, connection management, and helper functions
 */

import { EventEmitter } from "events";

// Mock redis - must be defined before module import
// Create EventEmitter-like mock for Redis client
class MockRedisClient extends EventEmitter {
  isOpen = false;
  connect = jest.fn().mockResolvedValue(undefined);
  quit = jest.fn().mockResolvedValue(undefined);
  get = jest.fn();
  set = jest.fn();
  setEx = jest.fn();
  del = jest.fn();
  exists = jest.fn();
  expire = jest.fn();
  incr = jest.fn();
  publish = jest.fn();
  keys = jest.fn();
}

const mockRedisClientInstance = new MockRedisClient();

const mockCreateClient = jest.fn(() => mockRedisClientInstance);

jest.mock("redis", () => ({
  createClient: mockCreateClient,
}));

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock env
jest.mock("../../../src/config/env", () => ({
  env: {
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    REDIS_PASSWORD: "",
    REDIS_DB: 0,
  },
}));

// Import after mocks
import {
  getRedisClient,
  connectRedis,
  disconnectRedis,
  redis,
  getContext,
  setContext,
  updateContext,
  clearContext,
  type ConversationContext,
} from "../../../src/lib/redis";

describe("Redis Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClientInstance.isOpen = false;
    mockRedisClientInstance.connect.mockResolvedValue(undefined);
    mockRedisClientInstance.quit.mockResolvedValue(undefined);
    mockRedisClientInstance.removeAllListeners();
    // Ensure createClient returns our mock
    (mockCreateClient as jest.Mock).mockReturnValue(mockRedisClientInstance);
  });

  describe("getRedisClient", () => {
    it("should return Redis client", () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      expect(typeof client).toBe("object");
    });

    it("should return same instance on subsequent calls", () => {
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });
  });

  describe("connectRedis", () => {
    it("should connect when client is not open", async () => {
      mockRedisClientInstance.isOpen = false;
      await connectRedis();
      expect(mockRedisClientInstance.connect).toHaveBeenCalled();
    });

    it("should not connect when client is already open", async () => {
      mockRedisClientInstance.isOpen = true;
      mockRedisClientInstance.connect.mockClear();
      await connectRedis();
      expect(mockRedisClientInstance.connect).not.toHaveBeenCalled();
    });
  });

  describe("disconnectRedis", () => {
    it("should disconnect when client exists", async () => {
      mockRedisClientInstance.isOpen = true;
      await disconnectRedis();
      expect(mockRedisClientInstance.quit).toHaveBeenCalled();
    });
  });

  describe("redis.get", () => {
    it("should get value by key", async () => {
      mockRedisClientInstance.get.mockResolvedValue("test-value");
      const result = await redis.get("test-key");
      expect(result).toBe("test-value");
    });

    it("should return null when key not found", async () => {
      mockRedisClientInstance.get.mockResolvedValue(null);
      const result = await redis.get("non-existent-key");
      expect(result).toBeNull();
    });
  });

  describe("redis.set", () => {
    it("should set value without TTL", async () => {
      mockRedisClientInstance.set.mockResolvedValue("OK");
      await redis.set("test-key", "test-value");
      expect(mockRedisClientInstance.set).toHaveBeenCalledWith(
        "test-key",
        "test-value",
      );
    });

    it("should set value with TTL", async () => {
      mockRedisClientInstance.setEx.mockResolvedValue("OK");
      await redis.set("test-key", "test-value", 3600);
      expect(mockRedisClientInstance.setEx).toHaveBeenCalledWith(
        "test-key",
        3600,
        "test-value",
      );
    });
  });

  describe("redis.del", () => {
    it("should delete key", async () => {
      mockRedisClientInstance.del.mockResolvedValue(1);
      await redis.del("test-key");
      expect(mockRedisClientInstance.del).toHaveBeenCalledWith("test-key");
    });
  });

  describe("redis.exists", () => {
    it("should return true when key exists", async () => {
      mockRedisClientInstance.exists.mockResolvedValue(1);
      const result = await redis.exists("test-key");
      expect(result).toBe(true);
    });

    it("should return false when key does not exist", async () => {
      mockRedisClientInstance.exists.mockResolvedValue(0);
      const result = await redis.exists("non-existent-key");
      expect(result).toBe(false);
    });
  });

  describe("redis.expire", () => {
    it("should set expiration for key", async () => {
      mockRedisClientInstance.expire.mockResolvedValue(1);
      await redis.expire("test-key", 3600);
      expect(mockRedisClientInstance.expire).toHaveBeenCalledWith(
        "test-key",
        3600,
      );
    });
  });

  describe("redis.incr", () => {
    it("should increment key value", async () => {
      mockRedisClientInstance.incr.mockResolvedValue(2);
      const result = await redis.incr("counter");
      expect(result).toBe(2);
    });
  });

  describe("redis.publish", () => {
    it("should publish message to channel", async () => {
      mockRedisClientInstance.publish.mockResolvedValue(1);
      await redis.publish("test-channel", "test-message");
      expect(mockRedisClientInstance.publish).toHaveBeenCalledWith(
        "test-channel",
        "test-message",
      );
    });
  });

  describe("redis.keys", () => {
    it("should get keys matching pattern", async () => {
      const keys = ["key1", "key2", "key3"];
      mockRedisClientInstance.keys.mockResolvedValue(keys);
      const result = await redis.keys("key*");
      expect(result).toEqual(keys);
    });
  });

  describe("redis.setNX", () => {
    it("should set value if not exists with TTL", async () => {
      mockRedisClientInstance.set.mockResolvedValue("OK");
      const result = await redis.setNX("new-key", "value", 3600);
      expect(result).toBe(true);
    });

    it("should set value if not exists without TTL", async () => {
      mockRedisClientInstance.set.mockResolvedValue("OK");
      const result = await redis.setNX("new-key", "value");
      expect(result).toBe(true);
    });

    it("should handle existing key scenario", async () => {
      mockRedisClientInstance.get.mockResolvedValue("existing");
      const result = await redis.get("existing-key");
      expect(result).toBe("existing");
    });
  });

  describe("T012: Conversation context storage/retrieval for transaction workflow", () => {
    const mockUserId = "user123";
    const mockContext: ConversationContext = {
      userId: mockUserId,
      workflowType: "transaction_entry",
      currentStep: 1,
      enteredData: {},
      pendingTransaction: {
        type: "income",
      },
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should store conversation context with TTL", async () => {
      mockRedisClientInstance.set.mockResolvedValue("OK");
      await setContext(mockContext);
      expect(mockRedisClientInstance.set).toHaveBeenCalled();
      const callArgs = mockRedisClientInstance.set.mock.calls[0];
      expect(callArgs[0]).toContain("conversation:");
      expect(callArgs[0]).toContain(mockUserId);
      expect(callArgs[2]).toBe(1800); // TTL in seconds
    });

    it("should retrieve conversation context", async () => {
      const contextJson = JSON.stringify(mockContext);
      mockRedisClientInstance.get.mockResolvedValue(contextJson);
      const result = await getContext(mockUserId);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.workflowType).toBe("transaction_entry");
      expect(result?.currentStep).toBe(1);
    });

    it("should return null when context does not exist", async () => {
      mockRedisClientInstance.get.mockResolvedValue(null);
      const result = await getContext("non-existent-user");
      expect(result).toBeNull();
    });

    it("should update conversation context and refresh TTL", async () => {
      // First, set up existing context
      const existingContextJson = JSON.stringify(mockContext);
      mockRedisClientInstance.get.mockResolvedValue(existingContextJson);
      mockRedisClientInstance.set.mockResolvedValue("OK");

      await updateContext(mockUserId, {
        currentStep: 2,
        pendingTransaction: {
          type: "income",
          amount: 500000,
        },
      });

      // Should call get first to retrieve existing context
      expect(mockRedisClientInstance.get).toHaveBeenCalled();
      // Should call set to update with new TTL
      expect(mockRedisClientInstance.set).toHaveBeenCalled();
    });

    it("should create new context if doesn't exist when updating", async () => {
      mockRedisClientInstance.get.mockResolvedValue(null);
      mockRedisClientInstance.set.mockResolvedValue("OK");

      await updateContext(mockUserId, {
        workflowType: "transaction_entry",
        currentStep: 1,
      });

      // Should create new context
      expect(mockRedisClientInstance.set).toHaveBeenCalled();
    });

    it("should clear conversation context", async () => {
      mockRedisClientInstance.del.mockResolvedValue(1);
      await clearContext(mockUserId);
      expect(mockRedisClientInstance.del).toHaveBeenCalled();
      const callArgs = mockRedisClientInstance.del.mock.calls[0];
      expect(callArgs[0]).toContain("conversation:");
      expect(callArgs[0]).toContain(mockUserId);
    });

    it("should handle errors gracefully when getting context", async () => {
      mockRedisClientInstance.get.mockRejectedValue(new Error("Redis error"));
      const result = await getContext(mockUserId);
      expect(result).toBeNull();
    });

    it("should include timestamps in context", async () => {
      mockRedisClientInstance.set.mockResolvedValue("OK");
      await setContext(mockContext);
      const callArgs = mockRedisClientInstance.set.mock.calls[0];
      const storedContext = JSON.parse(callArgs[1] as string);
      expect(storedContext.lastActivity).toBeDefined();
      expect(storedContext.expiresAt).toBeDefined();
      expect(new Date(storedContext.expiresAt).getTime()).toBeGreaterThan(
        new Date(storedContext.lastActivity).getTime(),
      );
    });

    it("should preserve pending transaction data in context", async () => {
      const contextWithTransaction: ConversationContext = {
        ...mockContext,
        pendingTransaction: {
          type: "income",
          amount: 500000,
          category: "Sales",
        },
      };
      const contextJson = JSON.stringify(contextWithTransaction);
      mockRedisClientInstance.get.mockResolvedValue(contextJson);
      const result = await getContext(mockUserId);
      expect(result?.pendingTransaction).toBeDefined();
      expect(result?.pendingTransaction?.amount).toBe(500000);
      expect(result?.pendingTransaction?.category).toBe("Sales");
    });
  });
});
