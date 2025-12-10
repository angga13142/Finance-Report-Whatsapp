/**
 * Shared Prisma Client Mock Utility
 * Provides consistent Prisma client mocking across all test files
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Create a mock model with all Prisma methods
 */
function createMockModel() {
  return {
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
  };
}

/**
 * Create a mock Prisma client with all model methods
 */
export function createMockPrisma(): PrismaClient {
  return {
    // Models
    user: createMockModel(),
    category: createMockModel(),
    transaction: createMockModel(),
    report: createMockModel(),
    userSession: createMockModel(),
    auditLog: createMockModel(),
    recommendation: createMockModel(),

    // Prisma client methods
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $use: jest.fn(),
    $on: jest.fn(),
    $extends: jest.fn(),
  } as unknown as PrismaClient;
}

/**
 * Setup Prisma mock for Jest
 * Call this before importing any modules that use PrismaClient
 */
export function setupPrismaMock(): PrismaClient {
  const mockPrisma = createMockPrisma();

  jest.mock("@prisma/client", () => {
    return {
      PrismaClient: jest.fn(() => mockPrisma),
      TransactionType: {
        INCOME: "income",
        EXPENSE: "expense",
      },
      ApprovalStatus: {
        APPROVED: "approved",
        PENDING: "pending",
        REJECTED: "rejected",
      },
      UserRole: {
        DEV: "dev",
        BOSS: "boss",
        EMPLOYEE: "employee",
        INVESTOR: "investor",
      },
      ReportType: {
        DAILY: "daily",
        WEEKLY: "weekly",
        MONTHLY: "monthly",
        CUSTOM: "custom",
      },
      RecommendationType: {
        EXPENSE_SPIKE: "expense_spike",
        REVENUE_DECLINE: "revenue_decline",
        CASHFLOW_WARNING: "cashflow_warning",
        EMPLOYEE_INACTIVITY: "employee_inactivity",
        TARGET_VARIANCE: "target_variance",
      },
      RecommendationPriority: {
        CRITICAL: "critical",
        HIGH: "high",
        MEDIUM: "medium",
        LOW: "low",
      },
    };
  });

  return mockPrisma;
}

/**
 * Get mock Prisma client instance
 * Use this in tests to access the mocked Prisma client
 */
export function getMockPrisma(): PrismaClient {
  return createMockPrisma();
}

/**
 * Reset all mocks on a Prisma client instance
 */
export function resetMockPrisma(mockPrisma: PrismaClient): void {
  const models = [
    "user",
    "category",
    "transaction",
    "report",
    "userSession",
    "auditLog",
    "recommendation",
  ] as const;

  models.forEach((model) => {
    const modelMock = (mockPrisma as any)[model];
    if (modelMock) {
      Object.keys(modelMock).forEach((method) => {
        if (jest.isMockFunction(modelMock[method])) {
          modelMock[method].mockClear();
        }
      });
    }
  });
}
