import {
  PrismaClient,
  Transaction,
  TransactionType,
  ApprovalStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../lib/logger";
import { validateAmountRange, parseAmount } from "../lib/currency";
import { getDayRangeWITA } from "../lib/date";

const prisma = new PrismaClient();

/**
 * Transaction model operations
 */
export class TransactionModel {
  /**
   * Find transaction by ID
   */
  static async findById(id: string): Promise<Transaction | null> {
    try {
      return await prisma.transaction.findUnique({
        where: { id },
        include: {
          user: true,
          approver: true,
        },
      });
    } catch (error) {
      logger.error("Error finding transaction by ID", { error, id });
      throw error;
    }
  }

  /**
   * Find transactions by user ID
   */
  static async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      type?: TransactionType;
    },
  ): Promise<Transaction[]> {
    try {
      const where: any = { userId };

      if (options?.type) {
        where.type = options.type;
      }

      if (options?.startDate || options?.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      return await prisma.transaction.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: options?.limit,
        skip: options?.offset,
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error("Error finding transactions by user ID", {
        error,
        userId,
        options,
      });
      throw error;
    }
  }

  /**
   * Find transactions for today (WITA timezone)
   */
  static async findTodayTransactions(userId?: string): Promise<Transaction[]> {
    try {
      const { start, end } = getDayRangeWITA();
      const where: any = {
        timestamp: {
          gte: start,
          lte: end,
        },
      };

      if (userId) {
        where.userId = userId;
      }

      return await prisma.transaction.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error("Error finding today transactions", { error, userId });
      throw error;
    }
  }

  /**
   * Create new transaction
   */
  static async create(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: Decimal | number | string;
    description?: string;
    approvalStatus?: ApprovalStatus;
    approvalBy?: string;
  }): Promise<Transaction> {
    try {
      // Validate and parse amount
      const amountDecimal =
        typeof data.amount === "string" || typeof data.amount === "number"
          ? parseAmount(String(data.amount))
          : data.amount;

      validateAmountRange(amountDecimal);

      // Check for duplicate transaction (same user, category, amount within 1 minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const duplicate = await prisma.transaction.findFirst({
        where: {
          userId: data.userId,
          category: data.category,
          amount: amountDecimal,
          timestamp: {
            gte: oneMinuteAgo,
          },
        },
      });

      if (duplicate) {
        throw new Error(
          "Duplicate transaction detected. Similar transaction was created within the last minute.",
        );
      }

      return await prisma.transaction.create({
        data: {
          userId: data.userId,
          type: data.type,
          category: data.category,
          amount: amountDecimal,
          description: data.description,
          approvalStatus: data.approvalStatus || "approved",
          approvalBy: data.approvalBy,
          approvedAt: data.approvalBy ? new Date() : undefined,
        },
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error("Error creating transaction", { error, data });
      throw error;
    }
  }

  /**
   * Update transaction
   */
  static async update(
    id: string,
    data: Partial<{
      category: string;
      amount: Decimal | number | string;
      description: string;
      approvalStatus: ApprovalStatus;
      approvalBy: string;
    }>,
  ): Promise<Transaction> {
    try {
      const updateData: any = { ...data };

      // Handle amount update
      if (data.amount !== undefined) {
        const amountDecimal =
          typeof data.amount === "string" || typeof data.amount === "number"
            ? parseAmount(String(data.amount))
            : data.amount;
        validateAmountRange(amountDecimal);
        updateData.amount = amountDecimal;
      }

      // Increment version for optimistic locking
      updateData.version = { increment: 1 };

      // Set approved_at if approval status changes
      if (data.approvalStatus && data.approvalBy) {
        updateData.approvedAt = new Date();
      }

      return await prisma.transaction.update({
        where: { id },
        data: updateData,
        include: {
          user: true,
          approver: true,
        },
      });
    } catch (error) {
      logger.error("Error updating transaction", { error, id, data });
      throw error;
    }
  }

  /**
   * Get daily totals for user
   */
  static async getDailyTotals(
    userId: string,
    date?: Date,
  ): Promise<{
    income: Decimal;
    expense: Decimal;
    net: Decimal;
    count: number;
  }> {
    try {
      const { start, end } = date ? getDayRangeWITA(date) : getDayRangeWITA();

      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          timestamp: {
            gte: start,
            lte: end,
          },
        },
      });

      let income = new Decimal(0);
      let expense = new Decimal(0);

      for (const txn of transactions) {
        if (txn.type === "income") {
          income = income.plus(txn.amount);
        } else {
          expense = expense.plus(txn.amount);
        }
      }

      const net = income.minus(expense);

      return {
        income,
        expense,
        net,
        count: transactions.length,
      };
    } catch (error) {
      logger.error("Error getting daily totals", { error, userId, date });
      throw error;
    }
  }

  /**
   * Get user's last transaction category (for pre-selection)
   */
  static async getLastCategory(
    userId: string,
    type: TransactionType,
  ): Promise<string | null> {
    try {
      const lastTransaction = await prisma.transaction.findFirst({
        where: {
          userId,
          type,
        },
        orderBy: { timestamp: "desc" },
        select: { category: true },
      });

      return lastTransaction?.category || null;
    } catch (error) {
      logger.error("Error getting last category", { error, userId, type });
      return null;
    }
  }
}

export default TransactionModel;
