/**
 * Unit tests for ReportModel
 * Tests report CRUD operations, delivery status, and statistics
 */

import { Report, ReportType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Create shared mock Prisma instance
const mockPrismaInstance = {
  report: {
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

// Mock Prisma before importing ReportModel
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    ReportType: {
      DAILY: "daily",
      WEEKLY: "weekly",
      MONTHLY: "monthly",
      CUSTOM: "custom",
    },
  };
});

// Import after mock setup
import { ReportModel } from "../../../src/models/report";

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe("ReportModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create report", async () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: "/reports/daily-2024-01-15.pdf",
        jsonSummary: { totalIncome: 1000000, totalExpense: 500000 },
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: [
          {
            role: "boss",
            phoneNumber: "+62812345678",
            status: "pending",
            retryCount: 0,
          },
        ],
        generatedAt: new Date(),
      };

      mockPrismaInstance.report.create.mockResolvedValue(mockReport);

      const result = await ReportModel.create({
        reportDate: new Date("2024-01-15"),
        reportType: "daily",
        filePath: "/reports/daily-2024-01-15.pdf",
        jsonSummary: { totalIncome: 1000000, totalExpense: 500000 },
        totalIncome: 1000000,
        totalExpense: 500000,
        netCashflow: 500000,
        deliveryStatus: [
          {
            role: "boss",
            phoneNumber: "+62812345678",
            status: "pending",
            retryCount: 0,
          },
        ],
      });

      expect(result).toEqual(mockReport);
      expect(mockPrismaInstance.report.create).toHaveBeenCalledWith({
        data: {
          reportDate: expect.any(Date),
          reportType: "daily",
          filePath: "/reports/daily-2024-01-15.pdf",
          jsonSummary: { totalIncome: 1000000, totalExpense: 500000 },
          totalIncome: 1000000,
          totalExpense: 500000,
          netCashflow: 500000,
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "pending",
              retryCount: 0,
            },
          ],
        },
      });
    });

    it("should create report without optional fields", async () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(0),
        totalExpense: new Decimal(0),
        netCashflow: new Decimal(0),
        deliveryStatus: null,
        generatedAt: new Date(),
      };

      mockPrismaInstance.report.create.mockResolvedValue(mockReport);

      const result = await ReportModel.create({
        reportDate: new Date("2024-01-15"),
        reportType: "daily",
        totalIncome: 0,
        totalExpense: 0,
        netCashflow: 0,
      });

      expect(result).toEqual(mockReport);
    });
  });

  describe("findById", () => {
    it("should find report by ID", async () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: null,
        generatedAt: new Date(),
      };

      mockPrismaInstance.report.findUnique.mockResolvedValue(mockReport);

      const result = await ReportModel.findById("report123");

      expect(result).toEqual(mockReport);
      expect(mockPrismaInstance.report.findUnique).toHaveBeenCalledWith({
        where: { id: "report123" },
      });
    });

    it("should return null when not found", async () => {
      mockPrismaInstance.report.findUnique.mockResolvedValue(null);

      const result = await ReportModel.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByDateRange", () => {
    it("should find reports by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: null,
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.findByDateRange(startDate, endDate);

      expect(result).toEqual(mockReports);
      expect(mockPrismaInstance.report.findMany).toHaveBeenCalledWith({
        where: {
          reportDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { generatedAt: "desc" },
      });
    });
  });

  describe("findLatestDailyReport", () => {
    it("should find latest daily report", async () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: null,
        generatedAt: new Date(),
      };

      mockPrismaInstance.report.findFirst.mockResolvedValue(mockReport);

      const result = await ReportModel.findLatestDailyReport();

      expect(result).toEqual(mockReport);
      expect(mockPrismaInstance.report.findFirst).toHaveBeenCalledWith({
        where: {
          reportType: "daily",
        },
        orderBy: { generatedAt: "desc" },
      });
    });

    it("should return null when no daily report found", async () => {
      mockPrismaInstance.report.findFirst.mockResolvedValue(null);

      const result = await ReportModel.findLatestDailyReport();

      expect(result).toBeNull();
    });
  });

  describe("updateDeliveryStatus", () => {
    it("should update delivery status", async () => {
      const deliveryStatus = [
        {
          role: "boss",
          phoneNumber: "+62812345678",
          status: "delivered" as const,
          deliveredAt: new Date().toISOString(),
          retryCount: 0,
        },
      ];

      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: deliveryStatus as never,
        generatedAt: new Date(),
      };

      mockPrismaInstance.report.update.mockResolvedValue(mockReport);

      const result = await ReportModel.updateDeliveryStatus(
        "report123",
        deliveryStatus,
      );

      expect(result).toEqual(mockReport);
      expect(mockPrismaInstance.report.update).toHaveBeenCalledWith({
        where: { id: "report123" },
        data: {
          deliveryStatus: deliveryStatus as never,
        },
      });
    });
  });

  describe("getDeliveryStatus", () => {
    it("should get delivery status from report", () => {
      const deliveryStatus = [
        {
          role: "boss",
          phoneNumber: "+62812345678",
          status: "delivered" as const,
          deliveredAt: new Date().toISOString(),
          retryCount: 0,
        },
      ];

      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: deliveryStatus as never,
        generatedAt: new Date(),
      };

      const result = ReportModel.getDeliveryStatus(mockReport);

      expect(result).toEqual(deliveryStatus);
    });

    it("should return empty array when delivery status is null", () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: null,
        generatedAt: new Date(),
      };

      const result = ReportModel.getDeliveryStatus(mockReport);

      expect(result).toEqual([]);
    });

    it("should return empty array when delivery status is not an array", () => {
      const mockReport: Report = {
        id: "report123",
        reportDate: new Date("2024-01-15"),
        reportType: "daily" as ReportType,
        filePath: null,
        jsonSummary: null,
        totalIncome: new Decimal(1000000),
        totalExpense: new Decimal(500000),
        netCashflow: new Decimal(500000),
        deliveryStatus: { invalid: "format" } as never,
        generatedAt: new Date(),
      };

      const result = ReportModel.getDeliveryStatus(mockReport);

      expect(result).toEqual([]);
    });
  });

  describe("findPendingDeliveries", () => {
    it("should find reports with pending deliveries", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "pending" as const,
              retryCount: 1,
            },
          ] as never,
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.findPendingDeliveries(3);

      expect(result).toEqual(mockReports);
    });

    it("should filter out reports exceeding max retries", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "failed" as const,
              retryCount: 3,
            },
          ] as never,
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.findPendingDeliveries(3);

      expect(result).toEqual([]);
    });

    it("should use default maxRetries", async () => {
      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "pending" as const,
              retryCount: 2,
            },
          ] as never,
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.findPendingDeliveries();

      expect(result).toEqual(mockReports);
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete old reports", async () => {
      const cutoffDate = new Date("2024-01-01");
      mockPrismaInstance.report.deleteMany.mockResolvedValue({ count: 50 });

      const result = await ReportModel.deleteOlderThan(cutoffDate);

      expect(result).toBe(50);
      expect(mockPrismaInstance.report.deleteMany).toHaveBeenCalledWith({
        where: {
          generatedAt: { lt: cutoffDate },
        },
      });
    });
  });

  describe("getStatistics", () => {
    it("should get report statistics", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "delivered" as const,
              deliveredAt: new Date(Date.now() + 1000).toISOString(),
              retryCount: 0,
            },
          ] as never,
          generatedAt: new Date("2024-01-15T10:00:00Z"),
        },
        {
          id: "report2",
          reportDate: new Date("2024-01-16"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(2000000),
          totalExpense: new Decimal(1000000),
          netCashflow: new Decimal(1000000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "failed" as const,
              retryCount: 1,
            },
          ] as never,
          generatedAt: new Date("2024-01-16T10:00:00Z"),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.getStatistics(startDate, endDate);

      expect(result.total).toBe(2);
      expect(result.delivered).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.pending).toBe(0);
      expect(result.avgDeliveryTime).toBeGreaterThan(0);
    });

    it("should handle reports with no delivery status", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: null,
          generatedAt: new Date(),
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.getStatistics(startDate, endDate);

      expect(result.total).toBe(1);
      expect(result.delivered).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.avgDeliveryTime).toBeNull();
    });

    it("should calculate average delivery time correctly", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const generatedTime = new Date("2024-01-15T10:00:00Z");
      const deliveredTime = new Date("2024-01-15T10:05:00Z"); // 5 minutes later

      const mockReports: Report[] = [
        {
          id: "report1",
          reportDate: new Date("2024-01-15"),
          reportType: "daily" as ReportType,
          filePath: null,
          jsonSummary: null,
          totalIncome: new Decimal(1000000),
          totalExpense: new Decimal(500000),
          netCashflow: new Decimal(500000),
          deliveryStatus: [
            {
              role: "boss",
              phoneNumber: "+62812345678",
              status: "delivered" as const,
              deliveredAt: deliveredTime.toISOString(),
              retryCount: 0,
            },
          ] as never,
          generatedAt: generatedTime,
        },
      ];

      mockPrismaInstance.report.findMany.mockResolvedValue(mockReports);

      const result = await ReportModel.getStatistics(startDate, endDate);

      expect(result.avgDeliveryTime).toBeCloseTo(300, 0); // ~300 seconds (5 minutes)
    });
  });
});
