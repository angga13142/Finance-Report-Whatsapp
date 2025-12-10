/**
 * Unit tests for CustomRulesService
 * Tests custom recommendation rules CRUD operations and rule evaluation
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPrismaInstance: any;

import { CustomRulesService } from "../../../../src/services/recommendation/rules";
import type { RecommendationRule } from "../../../../src/services/recommendation/rules";

jest.mock("@prisma/client", () => {
  const mockInstance = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  // Assign to outer scope
  mockPrismaInstance = mockInstance;
  return {
    PrismaClient: jest.fn(() => mockInstance),
  };
});

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("CustomRulesService", () => {
  let service: CustomRulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (CustomRulesService as any).instance = undefined;
    // Clear mock implementations
    if (mockPrismaInstance) {
      mockPrismaInstance.$queryRaw.mockReset();
      mockPrismaInstance.$executeRaw.mockReset();
    }
    service = CustomRulesService.getInstance();
    // Ensure mock is set up after service creation
    if (mockPrismaInstance) {
      (service as any).prisma = mockPrismaInstance;
    }
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = CustomRulesService.getInstance();
      const instance2 = CustomRulesService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(CustomRulesService);
    });
  });

  describe("createRule", () => {
    it("should create a new rule", async () => {
      const ruleData: Omit<
        RecommendationRule,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: "High Expense Alert",
        description: "Alert when daily expense exceeds 1M",
        createdBy: "user123",
        enabled: true,
        priority: 10,
        conditions: [
          {
            type: "expense_spike",
            operator: ">",
            value: 1000000,
          },
        ],
        actions: [
          {
            type: "alert",
            priority: "high",
            recipients: ["boss"],
          },
        ],
      };

      const mockResult = [
        {
          id: "rule123",
          name: ruleData.name,
          description: ruleData.description,
          created_by: ruleData.createdBy,
          enabled: ruleData.enabled,
          priority: ruleData.priority,
          conditions: JSON.stringify(ruleData.conditions),
          actions: JSON.stringify(ruleData.actions),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockResult);

      const result = await service.createRule(ruleData);

      expect(result).toBeDefined();
      expect(result.id).toBe("rule123");
      expect(result.name).toBe(ruleData.name);
      expect(result.enabled).toBe(true);
      expect(result.conditions).toEqual(ruleData.conditions);
      expect(result.actions).toEqual(ruleData.actions);
      expect(mockPrismaInstance.$queryRaw).toHaveBeenCalled();
    });

    it("should handle rule creation without description", async () => {
      const ruleData: Omit<
        RecommendationRule,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: "Simple Rule",
        createdBy: "user123",
        enabled: true,
        priority: 5,
        conditions: [],
        actions: [],
      };

      const mockResult = [
        {
          id: "rule456",
          name: ruleData.name,
          description: null,
          created_by: ruleData.createdBy,
          enabled: ruleData.enabled,
          priority: ruleData.priority,
          conditions: JSON.stringify(ruleData.conditions),
          actions: JSON.stringify(ruleData.actions),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockResult);

      const result = await service.createRule(ruleData);

      expect(result).toBeDefined();
      expect(result.description).toBeUndefined();
    });

    it("should throw error on creation failure", async () => {
      const ruleData: Omit<
        RecommendationRule,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: "Test Rule",
        createdBy: "user123",
        enabled: true,
        priority: 5,
        conditions: [],
        actions: [],
      };

      mockPrismaInstance.$queryRaw.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.createRule(ruleData)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getAllRules", () => {
    it("should get all rules", async () => {
      const mockRules = [
        {
          id: "rule1",
          name: "Rule 1",
          description: "Description 1",
          created_by: "user1",
          enabled: true,
          priority: 10,
          conditions: JSON.stringify([]),
          actions: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "rule2",
          name: "Rule 2",
          description: null,
          created_by: "user2",
          enabled: false,
          priority: 5,
          conditions: JSON.stringify([]),
          actions: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockRules);

      const result = await service.getAllRules(false);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("rule1");
      expect(result[1].id).toBe("rule2");
    });

    it("should get only enabled rules", async () => {
      const mockRules = [
        {
          id: "rule1",
          name: "Rule 1",
          description: null,
          created_by: "user1",
          enabled: true,
          priority: 10,
          conditions: JSON.stringify([]),
          actions: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockRules);

      const result = await service.getAllRules(true);

      expect(result).toHaveLength(1);
      expect(result[0].enabled).toBe(true);
    });

    it("should return empty array on error", async () => {
      mockPrismaInstance.$queryRaw.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.getAllRules();

      expect(result).toEqual([]);
    });
  });

  describe("getRuleById", () => {
    it("should get rule by ID from database", async () => {
      const mockRule = {
        id: "rule123",
        name: "Test Rule",
        description: "Test Description",
        created_by: "user123",
        enabled: true,
        priority: 10,
        conditions: JSON.stringify([
          { type: "expense_spike", operator: ">", value: 1000 },
        ]),
        actions: JSON.stringify([{ type: "alert", priority: "high" }]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaInstance.$queryRaw.mockResolvedValue([mockRule]);

      const result = await service.getRuleById("rule123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("rule123");
      expect(result?.name).toBe("Test Rule");
    });

    it("should return null when rule not found", async () => {
      mockPrismaInstance.$queryRaw.mockResolvedValue([]);

      const result = await service.getRuleById("nonexistent");

      expect(result).toBeNull();
    });

    it("should return cached rule on second call", async () => {
      const mockRule = {
        id: "rule123",
        name: "Test Rule",
        description: null,
        created_by: "user123",
        enabled: true,
        priority: 10,
        conditions: JSON.stringify([]),
        actions: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaInstance.$queryRaw.mockResolvedValue([mockRule]);

      const result1 = await service.getRuleById("rule123");
      const result2 = await service.getRuleById("rule123");

      expect(result1).not.toBeNull();
      expect(result2).toBe(result1); // Same instance from cache
      expect(mockPrismaInstance.$queryRaw).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe("updateRule", () => {
    it("should update rule", async () => {
      const mockUpdatedRule = {
        id: "rule123",
        name: "Updated Rule",
        description: "Updated Description",
        created_by: "user123",
        enabled: false,
        priority: 15,
        conditions: JSON.stringify([]),
        actions: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);
      mockPrismaInstance.$queryRaw.mockResolvedValue([mockUpdatedRule]);

      const result = await service.updateRule("rule123", {
        name: "Updated Rule",
        enabled: false,
        priority: 15,
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Updated Rule");
      expect(result?.enabled).toBe(false);
      expect(result?.priority).toBe(15);
    });

    it("should return rule when no updates provided", async () => {
      const mockRule = {
        id: "rule123",
        name: "Test Rule",
        description: null,
        created_by: "user123",
        enabled: true,
        priority: 10,
        conditions: JSON.stringify([]),
        actions: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaInstance.$queryRaw.mockResolvedValue([mockRule]);

      const result = await service.updateRule("rule123", {});

      expect(result).not.toBeNull();
      expect(mockPrismaInstance.$executeRaw).not.toHaveBeenCalled();
    });

    it("should throw error on update failure", async () => {
      mockPrismaInstance.$executeRaw.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        service.updateRule("rule123", { name: "New Name" }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("deleteRule", () => {
    it("should delete rule", async () => {
      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);

      const result = await service.deleteRule("rule123");

      expect(result).toBe(true);
      expect(mockPrismaInstance.$executeRaw).toHaveBeenCalled();
    });

    it("should return false on delete failure", async () => {
      mockPrismaInstance.$executeRaw.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.deleteRule("rule123");

      expect(result).toBe(false);
    });
  });

  describe("toggleRule", () => {
    it("should enable rule", async () => {
      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);

      const result = await service.toggleRule("rule123", true);

      expect(result).toBe(true);
      expect(mockPrismaInstance.$executeRaw).toHaveBeenCalled();
    });

    it("should disable rule", async () => {
      mockPrismaInstance.$executeRaw.mockResolvedValue(undefined);

      const result = await service.toggleRule("rule123", false);

      expect(result).toBe(true);
    });

    it("should return false on toggle failure", async () => {
      mockPrismaInstance.$executeRaw.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.toggleRule("rule123", true);

      expect(result).toBe(false);
    });
  });

  describe("evaluateRules", () => {
    it("should evaluate rules and return matched rules", async () => {
      const mockRules = [
        {
          id: "rule1",
          name: "High Expense",
          description: null,
          created_by: "user1",
          enabled: true,
          priority: 10,
          conditions: JSON.stringify([
            { type: "expense_spike", operator: ">", value: 1000000 },
          ]),
          actions: JSON.stringify([{ type: "alert", priority: "high" }]),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "rule2",
          name: "Low Revenue",
          description: null,
          created_by: "user2",
          enabled: true,
          priority: 5,
          conditions: JSON.stringify([
            { type: "revenue_decline", operator: "<", value: 500000 },
          ]),
          actions: JSON.stringify([{ type: "notify", priority: "medium" }]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockRules);

      const data = {
        dailyExpense: 1500000, // Matches rule1
        weeklyExpense: 5000000,
        dailyRevenue: 600000, // Doesn't match rule2 (> 500000)
        weeklyRevenue: 3000000,
        cashflow: 100000,
        categoryExpenses: {},
      };

      const result = await service.evaluateRules(data);

      expect(result).toHaveLength(2);
      expect(result[0].matched).toBe(true); // Rule1 matches
      expect(result[0].actions).toHaveLength(1);
      expect(result[1].matched).toBe(false); // Rule2 doesn't match
      expect(result[1].actions).toHaveLength(0);
    });

    it("should handle multiple conditions with AND logic", async () => {
      const mockRules = [
        {
          id: "rule1",
          name: "Complex Rule",
          description: null,
          created_by: "user1",
          enabled: true,
          priority: 10,
          conditions: JSON.stringify([
            { type: "expense_spike", operator: ">", value: 1000000 },
            { type: "negative_cashflow", operator: "<", value: 0 },
          ]),
          actions: JSON.stringify([{ type: "alert", priority: "critical" }]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockRules);

      const data = {
        dailyExpense: 1500000, // Matches first condition
        weeklyExpense: 5000000,
        dailyRevenue: 600000,
        weeklyRevenue: 3000000,
        cashflow: -50000, // Matches second condition
        categoryExpenses: {},
      };

      const result = await service.evaluateRules(data);

      expect(result[0].matched).toBe(true); // Both conditions match
    });

    it("should handle category threshold conditions", async () => {
      const mockRules = [
        {
          id: "rule1",
          name: "Category Threshold",
          description: null,
          created_by: "user1",
          enabled: true,
          priority: 10,
          conditions: JSON.stringify([
            {
              type: "category_threshold",
              operator: ">",
              value: 500000,
              category: "Food",
            },
          ]),
          actions: JSON.stringify([{ type: "alert", priority: "high" }]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaInstance.$queryRaw.mockResolvedValue(mockRules);

      const data = {
        dailyExpense: 0,
        weeklyExpense: 0,
        dailyRevenue: 0,
        weeklyRevenue: 0,
        cashflow: 0,
        categoryExpenses: {
          Food: 600000, // Matches condition
          Transport: 200000,
        },
      };

      const result = await service.evaluateRules(data);

      expect(result[0].matched).toBe(true);
    });
  });
});
