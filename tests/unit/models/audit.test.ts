/**
 * Unit tests for AuditLogModel
 * Tests audit log CRUD operations, filtering, statistics, and cleanup
 */

import { AuditLog } from "@prisma/client";

// Create shared mock Prisma instance
const mockPrismaInstance = {
  auditLog: {
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

// Mock Prisma before importing AuditLogModel
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    Prisma: {
      InputJsonValue: {},
    },
  };
});

// Import after mock setup
import { AuditLogModel } from "../../../src/models/audit";

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("AuditLogModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create audit log entry", async () => {
      const mockAuditLog: AuditLog = {
        id: "audit123",
        userId: "user123",
        action: "transaction_created",
        details: { amount: 50000 },
        ipAddress: "192.168.1.1",
        affectedEntityId: "txn123",
        affectedEntityType: "transaction",
        timestamp: new Date(),
        archivedAt: null,
      };

      mockPrismaInstance.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await AuditLogModel.create({
        userId: "user123",
        action: "transaction_created",
        details: { amount: 50000 },
        ipAddress: "192.168.1.1",
        affectedEntityId: "txn123",
        affectedEntityType: "transaction",
      });

      expect(result).toEqual(mockAuditLog);
      expect(mockPrismaInstance.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user123",
          action: "transaction_created",
          affectedEntityId: "txn123",
          affectedEntityType: "transaction",
        }),
      });
    });

    it("should create audit log without optional fields", async () => {
      const mockAuditLog: AuditLog = {
        id: "audit123",
        userId: null,
        action: "system_start",
        details: null,
        ipAddress: null,
        affectedEntityId: null,
        affectedEntityType: null,
        timestamp: new Date(),
        archivedAt: null,
      };

      mockPrismaInstance.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await AuditLogModel.create({
        action: "system_start",
      });

      expect(result).toEqual(mockAuditLog);
    });
  });

  describe("findMany", () => {
    it("should find audit logs with filters", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "audit1",
          userId: "user123",
          action: "transaction_created",
          details: null,
          ipAddress: null,
          affectedEntityId: null,
          affectedEntityType: null,
          timestamp: new Date(),
          archivedAt: null,
        },
      ];

      mockPrismaInstance.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditLogModel.findMany({
        userId: "user123",
        action: "transaction_created",
      });

      expect(result).toEqual(mockLogs);
      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user123",
            action: "transaction_created",
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockPrismaInstance.auditLog.findMany.mockResolvedValue([]);

      await AuditLogModel.findMany({
        startDate,
        endDate,
      });

      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it("should apply limit and offset", async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([]);

      await AuditLogModel.findMany({
        limit: 50,
        offset: 100,
      });

      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 100,
        }),
      );
    });

    it("should use default limit when not provided", async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([]);

      await AuditLogModel.findMany({});

      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });
  });

  describe("findById", () => {
    it("should find audit log by ID", async () => {
      const mockAuditLog: AuditLog = {
        id: "audit123",
        userId: "user123",
        action: "transaction_created",
        details: null,
        ipAddress: null,
        affectedEntityId: null,
        affectedEntityType: null,
        timestamp: new Date(),
        archivedAt: null,
      };

      mockPrismaInstance.auditLog.findUnique.mockResolvedValue(mockAuditLog);

      const result = await AuditLogModel.findById("audit123");

      expect(result).toEqual(mockAuditLog);
      expect(mockPrismaInstance.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: "audit123" },
        include: expect.any(Object),
      });
    });

    it("should return null when not found", async () => {
      mockPrismaInstance.auditLog.findUnique.mockResolvedValue(null);

      const result = await AuditLogModel.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUser", () => {
    it("should find audit logs for user", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "audit1",
          userId: "user123",
          action: "transaction_created",
          details: null,
          ipAddress: null,
          affectedEntityId: null,
          affectedEntityType: null,
          timestamp: new Date(),
          archivedAt: null,
        },
      ];

      mockPrismaInstance.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditLogModel.findByUser("user123", 50);

      expect(result).toEqual(mockLogs);
      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user123" },
          take: 50,
        }),
      );
    });

    it("should use default limit when not provided", async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([]);

      await AuditLogModel.findByUser("user123");

      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });

  describe("findByAction", () => {
    it("should find audit logs by action", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "audit1",
          userId: "user123",
          action: "transaction_created",
          details: null,
          ipAddress: null,
          affectedEntityId: null,
          affectedEntityType: null,
          timestamp: new Date(),
          archivedAt: null,
        },
      ];

      mockPrismaInstance.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditLogModel.findByAction(
        "transaction_created",
        100,
      );

      expect(result).toEqual(mockLogs);
      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: "transaction_created" },
          take: 100,
        }),
      );
    });
  });

  describe("findByAffectedEntity", () => {
    it("should find audit logs by affected entity", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "audit1",
          userId: "user123",
          action: "transaction_updated",
          details: null,
          ipAddress: null,
          affectedEntityId: "txn123",
          affectedEntityType: "transaction",
          timestamp: new Date(),
          archivedAt: null,
        },
      ];

      mockPrismaInstance.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditLogModel.findByAffectedEntity(
        "transaction",
        "txn123",
      );

      expect(result).toEqual(mockLogs);
      expect(mockPrismaInstance.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            affectedEntityType: "transaction",
            affectedEntityId: "txn123",
          },
        }),
      );
    });
  });

  describe("count", () => {
    it("should count audit logs with filters", async () => {
      mockPrismaInstance.auditLog.count.mockResolvedValue(10);

      const result = await AuditLogModel.count({
        userId: "user123",
        action: "transaction_created",
      });

      expect(result).toBe(10);
      expect(mockPrismaInstance.auditLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "user123",
          action: "transaction_created",
        }),
      });
    });

    it("should count all audit logs when no filter", async () => {
      mockPrismaInstance.auditLog.count.mockResolvedValue(100);

      const result = await AuditLogModel.count();

      expect(result).toBe(100);
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete old audit logs", async () => {
      mockPrismaInstance.auditLog.deleteMany.mockResolvedValue({ count: 50 });

      const result = await AuditLogModel.deleteOlderThan(30);

      expect(result).toBe(50);
      expect(mockPrismaInstance.auditLog.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: expect.objectContaining({
            lt: expect.any(Date),
          }),
        }),
      });
    });

    it("should calculate cutoff date correctly", async () => {
      const days = 7;
      const beforeCall = new Date();
      beforeCall.setDate(beforeCall.getDate() - days);

      mockPrismaInstance.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await AuditLogModel.deleteOlderThan(days);

      const callArgs = mockPrismaInstance.auditLog.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.timestamp.lt;

      expect(cutoffDate.getTime()).toBeLessThanOrEqual(
        beforeCall.getTime() + 1000,
      ); // Allow 1 second tolerance
    });
  });

  describe("getStatistics", () => {
    it("should get audit log statistics", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockPrismaInstance.auditLog.count.mockResolvedValue(100);
      mockPrismaInstance.auditLog.groupBy
        .mockResolvedValueOnce([
          { action: "transaction_created", _count: { id: 50 } },
          { action: "user_login", _count: { id: 30 } },
        ])
        .mockResolvedValueOnce([
          { userId: "user1", _count: { id: 40 } },
          { userId: "user2", _count: { id: 35 } },
        ])
        .mockResolvedValueOnce([
          { affectedEntityType: "transaction", _count: { id: 60 } },
          { affectedEntityType: "user", _count: { id: 20 } },
        ]);

      const result = await AuditLogModel.getStatistics(startDate, endDate);

      expect(result.totalLogs).toBe(100);
      expect(result.logsByAction).toHaveProperty("transaction_created", 50);
      expect(result.logsByAction).toHaveProperty("user_login", 30);
      expect(result.logsByUser).toHaveProperty("user1", 40);
      expect(result.logsByEntityType).toHaveProperty("transaction", 60);
    });

    it("should get statistics without date range", async () => {
      mockPrismaInstance.auditLog.count.mockResolvedValue(200);
      mockPrismaInstance.auditLog.groupBy.mockResolvedValue([]);

      const result = await AuditLogModel.getStatistics();

      expect(result.totalLogs).toBe(200);
    });

    it("should handle null userId and entityType in statistics", async () => {
      mockPrismaInstance.auditLog.count.mockResolvedValue(10);
      mockPrismaInstance.auditLog.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { userId: "user1", _count: { id: 5 } },
          { userId: null, _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { affectedEntityType: "transaction", _count: { id: 7 } },
          { affectedEntityType: null, _count: { id: 2 } },
        ]);

      const result = await AuditLogModel.getStatistics();

      expect(result.logsByUser).toHaveProperty("user1", 5);
      expect("null" in result.logsByUser).toBe(false);
      expect(result.logsByEntityType).toHaveProperty("transaction", 7);
      expect("null" in result.logsByEntityType).toBe(false);
    });
  });
});
