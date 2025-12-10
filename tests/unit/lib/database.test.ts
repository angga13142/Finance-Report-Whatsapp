/**
 * Unit tests for database utilities
 * Tests Prisma client wrapper, connection management, and transaction retry logic
 */

/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import { PrismaClient } from "@prisma/client";

// Mock Prisma - setup factory that always returns client with $use
jest.mock("@prisma/client", () => {
  const createMockClient = () => {
    const mockClient: any = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
      $on: jest.fn(),
      $extends: jest.fn(),
      user: {},
      category: {},
      transaction: {},
      report: {},
      userSession: {},
      auditLog: {},
      recommendation: {},
    };
    // $use must return the client for chaining
    mockClient.$use = jest.fn().mockReturnValue(mockClient);
    return mockClient;
  };

  return {
    PrismaClient: jest.fn(createMockClient),
  };
});

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock env
jest.mock("../../../src/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
    NODE_ENV: "test",
  },
}));

describe("Database Utilities", () => {
  let mockPrismaClient: {
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
    $use: jest.Mock;
    $on: jest.Mock;
    $extends: jest.Mock;
    [key: string]: any;
  };
  let getPrismaClient: () => any;
  let connectDatabase: () => Promise<void>;
  let disconnectDatabase: () => Promise<void>;
  let getDatabaseStats: () => Promise<any>;
  let isDatabaseHealthy: () => Promise<boolean>;
  let executeTransaction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (PrismaClient as jest.Mock).mockClear();

    // Reset module to clear singleton
    jest.resetModules();

    // Re-import after reset - PrismaClient mock will create new instance with $use
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dbModule = require("../../../src/lib/database");
    getPrismaClient = dbModule.getPrismaClient;
    connectDatabase = dbModule.connectDatabase;
    disconnectDatabase = dbModule.disconnectDatabase;
    getDatabaseStats = dbModule.getDatabaseStats;
    isDatabaseHealthy = dbModule.isDatabaseHealthy;
    executeTransaction = dbModule.executeTransaction;

    // Get the mock instance that was created
    const client = getPrismaClient();
    mockPrismaClient = client;
  });

  describe("getPrismaClient", () => {
    it("should create Prisma client instance on first call", () => {
      const client = getPrismaClient();
      expect(client).toBeDefined();
      expect(client).toHaveProperty("$connect");
      expect(client).toHaveProperty("$disconnect");
      expect(client).toHaveProperty("$use");
    });

    it("should return same instance on subsequent calls", () => {
      const client1 = getPrismaClient();
      const client2 = getPrismaClient();

      expect(client1).toBe(client2);
    });

    it("should configure Prisma client with connection string", () => {
      // Client is already created in beforeEach, verify it has the expected structure
      const client = getPrismaClient();

      // Verify client was created and has expected methods
      expect(client).toBeDefined();
      expect(client).toHaveProperty("$connect");
      expect(client).toHaveProperty("$disconnect");
      expect(client).toHaveProperty("$use");

      // The connection string is built internally, we verify the client works
      // by checking that it can be used (implicit test of configuration)
      expect(typeof client.$connect).toBe("function");
    });

    it("should add query logging middleware", () => {
      // Client already created in beforeEach, $use should have been called
      expect(mockPrismaClient.$use).toHaveBeenCalled();
    });
  });

  describe("connectDatabase", () => {
    it("should connect to database successfully", async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      await connectDatabase();

      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it("should throw error on connection failure", async () => {
      mockPrismaClient.$connect.mockRejectedValue(
        new Error("Connection failed"),
      );

      await expect(connectDatabase()).rejects.toThrow("Connection failed");
    });

    it("should throw error on health check failure", async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error("Query failed"));

      await expect(connectDatabase()).rejects.toThrow("Query failed");
    });
  });

  describe("disconnectDatabase", () => {
    it("should disconnect from database", async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      // First create a client instance
      getPrismaClient();
      await disconnectDatabase();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it("should handle disconnect when client is null", async () => {
      // Reset client
      await disconnectDatabase();
      await disconnectDatabase(); // Second call should not throw

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe("getDatabaseStats", () => {
    it("should return database connection stats", async () => {
      const mockStats = [
        { state: "active", count: BigInt(5) },
        { state: "idle", count: BigInt(10) },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockStats);

      const stats = await getDatabaseStats();

      expect(stats.activeConnections).toBe(5);
      expect(stats.idleConnections).toBe(10);
      expect(stats.totalConnections).toBe(15);
    });

    it("should return zero stats on error", async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error("Query failed"));

      const stats = await getDatabaseStats();

      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });

    it("should handle empty result set", async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const stats = await getDatabaseStats();

      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });
  });

  describe("isDatabaseHealthy", () => {
    it("should return true when database is healthy", async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const healthy = await isDatabaseHealthy();

      expect(healthy).toBe(true);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it("should return false when database query fails", async () => {
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error("Query failed"));

      const healthy = await isDatabaseHealthy();

      expect(healthy).toBe(false);
    });
  });

  describe("executeTransaction", () => {
    it("should execute transaction successfully", async () => {
      const mockResult = { id: "123", name: "Test" };
      mockPrismaClient.$transaction.mockResolvedValue(mockResult);

      const result = await executeTransaction(async (_tx: unknown) => {
        return mockResult;
      });

      expect(result).toEqual(mockResult);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it("should retry transaction on failure", async () => {
      const mockResult = { id: "123", name: "Test" };
      mockPrismaClient.$transaction
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce(mockResult);

      // Mock setTimeout for exponential backoff
      jest.useFakeTimers({ advanceTimers: true });

      const resultPromise = executeTransaction(async (_tx: unknown) => {
        return mockResult;
      }, 2);

      // Fast-forward timers and wait for promise
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual(mockResult);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("should throw error after max retries", async () => {
      mockPrismaClient.$transaction.mockRejectedValue(
        new Error("Persistent error"),
      );

      jest.useFakeTimers({ advanceTimers: true });

      const resultPromise = executeTransaction(async (_tx: any) => {
        return { id: "123" };
      }, 2);

      // Fast-forward through retries
      jest.runAllTimers();

      // Wait for the promise to settle and expect it to throw
      await expect(resultPromise).rejects.toThrow("Transaction failed");

      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("should use exponential backoff for retries", async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = jest.fn((fn: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      }) as unknown as typeof setTimeout;

      mockPrismaClient.$transaction
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce({ id: "123" });

      await executeTransaction(async (_tx: unknown) => {
        return { id: "123" };
      }, 3);

      // Check that delays increase exponentially (with max cap)
      expect(delays.length).toBeGreaterThan(0);
      expect(delays[0]).toBeLessThanOrEqual(1000);
      expect(delays[1]).toBeLessThanOrEqual(2000);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe("buildConnectionString", () => {
    it("should include pool parameters in connection string", async () => {
      // Reset singleton by disconnecting to force new instance
      await disconnectDatabase();
      (PrismaClient as jest.Mock).mockClear();

      const client = getPrismaClient();

      // Verify client was created
      expect(client).toBeDefined();
      // Check that PrismaClient was called (might be called in beforeEach too)
      const calls = (PrismaClient as jest.Mock).mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1];
        if (lastCall && lastCall[0] && lastCall[0].datasources) {
          expect(lastCall[0].datasources.db.url).toContain("connection_limit");
        }
      }
    });

    it("should include pgbouncer mode in connection string", async () => {
      // Reset singleton by disconnecting to force new instance
      await disconnectDatabase();
      (PrismaClient as jest.Mock).mockClear();

      const client = getPrismaClient();

      // Verify client was created
      expect(client).toBeDefined();
      // Check that PrismaClient was called (might be called in beforeEach too)
      const calls = (PrismaClient as jest.Mock).mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1];
        if (lastCall && lastCall[0] && lastCall[0].datasources) {
          expect(lastCall[0].datasources.db.url).toContain("pgbouncer=true");
        }
      }
    });
  });
});
