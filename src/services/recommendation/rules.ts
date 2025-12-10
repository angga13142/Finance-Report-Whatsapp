import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Custom recommendation rules service
 * Allows Dev/Boss to create and manage custom recommendation rules
 */

export interface RecommendationRule {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  enabled: boolean;
  priority: number; // Higher = more important
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  type:
    | "expense_spike"
    | "revenue_decline"
    | "negative_cashflow"
    | "category_threshold"
    | "custom_metric";
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  value: number;
  period?: "daily" | "weekly" | "monthly";
  category?: string;
}

export interface RuleAction {
  type: "notify" | "alert" | "report" | "block";
  priority: "low" | "medium" | "high" | "critical";
  recipients?: string[]; // User IDs or roles
  message?: string;
  template?: string;
}

export class CustomRulesService {
  private static instance: CustomRulesService;
  private prisma: PrismaClient;
  private rulesCache: Map<string, RecommendationRule> = new Map();

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): CustomRulesService {
    if (!CustomRulesService.instance) {
      CustomRulesService.instance = new CustomRulesService();
    }
    return CustomRulesService.instance;
  }

  /**
   * Create a new custom rule
   */
  async createRule(
    rule: Omit<RecommendationRule, "id" | "createdAt" | "updatedAt">,
  ): Promise<RecommendationRule> {
    try {
      const ruleData = {
        name: rule.name,
        description: rule.description || null,
        created_by: rule.createdBy,
        enabled: rule.enabled,
        priority: rule.priority,
        conditions: JSON.stringify(rule.conditions),
        actions: JSON.stringify(rule.actions),
      };

      const result = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          enabled: boolean;
          priority: number;
          conditions: string;
          actions: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        INSERT INTO recommendation_rules 
        (id, name, description, created_by, enabled, priority, conditions, actions, created_at, updated_at)
        VALUES (
          gen_random_uuid()::text,
          ${ruleData.name},
          ${ruleData.description},
          ${ruleData.created_by},
          ${ruleData.enabled},
          ${ruleData.priority},
          ${ruleData.conditions},
          ${ruleData.actions},
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      const createdRule = this.mapToRule(result[0]);

      // Update cache
      this.rulesCache.set(createdRule.id, createdRule);

      logger.info("Custom recommendation rule created", {
        ruleId: createdRule.id,
        name: rule.name,
        createdBy: rule.createdBy,
      });

      return createdRule;
    } catch (error) {
      logger.error("Failed to create custom rule", { error, rule });
      throw error;
    }
  }

  /**
   * Get all rules
   */
  async getAllRules(
    enabledOnly: boolean = false,
  ): Promise<RecommendationRule[]> {
    try {
      let results;

      if (enabledOnly) {
        results = await this.prisma.$queryRaw<
          Array<{
            id: string;
            name: string;
            description: string | null;
            created_by: string;
            enabled: boolean;
            priority: number;
            conditions: string;
            actions: string;
            created_at: Date;
            updated_at: Date;
          }>
        >`
          SELECT * FROM recommendation_rules
          WHERE enabled = true
          ORDER BY priority DESC, created_at DESC
        `;
      } else {
        results = await this.prisma.$queryRaw<
          Array<{
            id: string;
            name: string;
            description: string | null;
            created_by: string;
            enabled: boolean;
            priority: number;
            conditions: string;
            actions: string;
            created_at: Date;
            updated_at: Date;
          }>
        >`
          SELECT * FROM recommendation_rules
          ORDER BY priority DESC, created_at DESC
        `;
      }

      return results.map((r) => this.mapToRule(r));
    } catch (error) {
      logger.error("Failed to fetch custom rules", { error });
      return [];
    }
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: string): Promise<RecommendationRule | null> {
    // Check cache first
    if (this.rulesCache.has(ruleId)) {
      return this.rulesCache.get(ruleId)!;
    }

    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          enabled: boolean;
          priority: number;
          conditions: string;
          actions: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT * FROM recommendation_rules
        WHERE id = ${ruleId}
        LIMIT 1
      `;

      if (results.length === 0) {
        return null;
      }

      const rule = this.mapToRule(results[0]);
      this.rulesCache.set(ruleId, rule);

      return rule;
    } catch (error) {
      logger.error("Failed to fetch rule", { error, ruleId });
      return null;
    }
  }

  /**
   * Update rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<
      Omit<RecommendationRule, "id" | "createdAt" | "createdBy">
    >,
  ): Promise<RecommendationRule | null> {
    try {
      const updateData: {
        name?: string;
        description?: string | null;
        enabled?: boolean;
        priority?: number;
        conditions?: string;
        actions?: string;
      } = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.priority !== undefined)
        updateData.priority = updates.priority;
      if (updates.conditions)
        updateData.conditions = JSON.stringify(updates.conditions);
      if (updates.actions) updateData.actions = JSON.stringify(updates.actions);

      if (Object.keys(updateData).length === 0) {
        return await this.getRuleById(ruleId);
      }

      await this.prisma.$executeRaw`
        UPDATE recommendation_rules
        SET 
          name = COALESCE(${updateData.name ?? null}, name),
          description = COALESCE(${updateData.description ?? null}, description),
          enabled = COALESCE(${updateData.enabled ?? null}, enabled),
          priority = COALESCE(${updateData.priority ?? null}, priority),
          conditions = COALESCE(${updateData.conditions ?? null}, conditions),
          actions = COALESCE(${updateData.actions ?? null}, actions),
          updated_at = NOW()
        WHERE id = ${ruleId}
      `;

      // Clear cache
      this.rulesCache.delete(ruleId);

      logger.info("Custom rule updated", { ruleId });

      return await this.getRuleById(ruleId);
    } catch (error) {
      logger.error("Failed to update rule", { error, ruleId });
      throw error;
    }
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM recommendation_rules
        WHERE id = ${ruleId}
      `;

      // Clear cache
      this.rulesCache.delete(ruleId);

      logger.info("Custom rule deleted", { ruleId });
      return true;
    } catch (error) {
      logger.error("Failed to delete rule", { error, ruleId });
      return false;
    }
  }

  /**
   * Toggle rule enabled status
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    try {
      await this.prisma.$executeRaw`
        UPDATE recommendation_rules
        SET enabled = ${enabled}, updated_at = NOW()
        WHERE id = ${ruleId}
      `;

      this.rulesCache.delete(ruleId);

      logger.info("Rule toggled", { ruleId, enabled });
      return true;
    } catch (error) {
      logger.error("Failed to toggle rule", { error, ruleId });
      return false;
    }
  }

  /**
   * Evaluate rules against current data
   */
  async evaluateRules(data: {
    dailyExpense: number;
    weeklyExpense: number;
    dailyRevenue: number;
    weeklyRevenue: number;
    cashflow: number;
    categoryExpenses: Record<string, number>;
  }): Promise<
    Array<{
      ruleId: string;
      ruleName: string;
      matched: boolean;
      actions: RuleAction[];
    }>
  > {
    const rules = await this.getAllRules(true);
    const results: Array<{
      ruleId: string;
      ruleName: string;
      matched: boolean;
      actions: RuleAction[];
    }> = [];

    for (const rule of rules) {
      const matched = this.evaluateConditions(rule.conditions, data);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        actions: matched ? rule.actions : [],
      });

      if (matched) {
        logger.info("Rule matched", { ruleId: rule.id, ruleName: rule.name });
      }
    }

    return results;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(
    conditions: RuleCondition[],
    data: {
      dailyExpense: number;
      weeklyExpense: number;
      dailyRevenue: number;
      weeklyRevenue: number;
      cashflow: number;
      categoryExpenses: Record<string, number>;
    },
  ): boolean {
    // All conditions must be true (AND logic)
    return conditions.every((condition) => {
      let actualValue: number;

      switch (condition.type) {
        case "expense_spike":
          actualValue = data.dailyExpense;
          break;
        case "revenue_decline":
          actualValue = data.dailyRevenue;
          break;
        case "negative_cashflow":
          actualValue = data.cashflow;
          break;
        case "category_threshold":
          actualValue = condition.category
            ? data.categoryExpenses[condition.category] || 0
            : 0;
          break;
        default:
          return false;
      }

      return this.compareValues(
        actualValue,
        condition.operator,
        condition.value,
      );
    });
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: number,
    operator: string,
    expected: number,
  ): boolean {
    switch (operator) {
      case ">":
        return actual > expected;
      case "<":
        return actual < expected;
      case ">=":
        return actual >= expected;
      case "<=":
        return actual <= expected;
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      default:
        return false;
    }
  }

  /**
   * Map database result to RecommendationRule
   */
  private mapToRule(row: {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    enabled: boolean;
    priority: number;
    conditions: string;
    actions: string;
    created_at: Date;
    updated_at: Date;
  }): RecommendationRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdBy: row.created_by,
      enabled: row.enabled,
      priority: row.priority,
      conditions: JSON.parse(row.conditions) as RuleCondition[],
      actions: JSON.parse(row.actions) as RuleAction[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const customRules = CustomRulesService.getInstance();
