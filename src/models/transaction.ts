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
      const where: {
        userId: string;
        type?: TransactionType;
        timestamp?: { gte?: Date; lte?: Date };
      } = { userId };

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
      const where: {
        userId?: string;
        timestamp: { gte: Date; lte: Date };
      } = {
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
      const updateData: {
        category?: string;
        amount?: Decimal;
        description?: string;
        approvalStatus?: ApprovalStatus;
        approvalBy?: string;
        version?: { increment: number };
        approvedAt?: Date;
      } = {
        category: data.category,
        description: data.description,
        approvalStatus: data.approvalStatus,
        approvalBy: data.approvalBy,
      };

      // Handle amount update
      if (data.amount !== undefined) {
        const amountDecimal: Decimal =
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

  /**
   * Update transaction with optimistic locking
   * Throws error if version mismatch (concurrent edit detected)
   */
  static async updateWithOptimisticLock(
    id: string,
    expectedVersion: number,
    data: {
      category?: string;
      amount?: string | number | Decimal;
      description?: string | null;
      approvalStatus?: ApprovalStatus;
      approvalBy?: string;
    },
  ): Promise<Transaction> {
    try {
      // Check current version
      const current = await prisma.transaction.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error("Transaction not found");
      }

      if (current.version !== expectedVersion) {
        throw new Error(
          `Version mismatch: expected ${expectedVersion}, got ${current.version}. Transaction may have been modified by another user.`,
        );
      }

      // Prepare update data
      const updateData: {
        category?: string;
        amount?: Decimal;
        description?: string | null;
        approvalStatus?: ApprovalStatus;
        approvalBy?: string;
        version: { increment: number };
        approvedAt?: Date;
      } = {
        category: data.category,
        description: data.description,
        approvalStatus: data.approvalStatus,
        approvalBy: data.approvalBy,
        version: { increment: 1 },
      };

      // Handle amount update
      if (data.amount !== undefined) {
        const amountDecimal: Decimal =
          typeof data.amount === "string" || typeof data.amount === "number"
            ? parseAmount(String(data.amount))
            : data.amount;
        validateAmountRange(amountDecimal);
        updateData.amount = amountDecimal;
      }

      // Set approved_at if approval status changes
      if (data.approvalStatus && data.approvalBy) {
        updateData.approvedAt = new Date();
      }

      // Update with version check in WHERE clause
      const updated = await prisma.transaction.updateMany({
        where: {
          id,
          version: expectedVersion,
        },
        data: updateData,
      });

      if (updated.count === 0) {
        throw new Error(
          "Failed to update transaction. It may have been modified by another user.",
        );
      }

      // Fetch updated transaction
      const transaction = await prisma.transaction.findUnique({
        where: { id },
        include: {
          user: true,
          approver: true,
        },
      });

      if (!transaction) {
        throw new Error("Transaction not found after update");
      }

      logger.info("Transaction updated with optimistic lock", {
        id,
        oldVersion: expectedVersion,
        newVersion: transaction.version,
      });

      return transaction;
    } catch (error) {
      logger.error("Error updating transaction with optimistic lock", {
        error,
        id,
        expectedVersion,
      });
      throw error;
    }
  }

  /**
   * Retry update with optimistic locking
   * Automatically retries on version mismatch
   */
  static async updateWithRetry(
    id: string,
    data: {
      category?: string;
      amount?: string | number | Decimal;
      description?: string | null;
      approvalStatus?: ApprovalStatus;
      approvalBy?: string;
    },
    maxRetries = 3,
  ): Promise<Transaction> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fetch current version
        const current = await this.findById(id);
        if (!current) {
          throw new Error("Transaction not found");
        }

        // Attempt update with current version
        return await this.updateWithOptimisticLock(id, current.version, data);
      } catch (error) {
        lastError = error as Error;

        if (
          lastError.message.includes("Version mismatch") ||
          lastError.message.includes("modified by another user")
        ) {
          logger.warn("Optimistic lock conflict, retrying", {
            id,
            attempt,
            maxRetries,
          });

          if (attempt < maxRetries) {
            // Exponential backoff
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // Non-version-mismatch error or max retries reached
        throw lastError;
      }
    }

    logger.error("Failed to update transaction after max retries", {
      id,
      maxRetries,
      error: lastError,
    });
    throw new Error(
      `Failed to update transaction: ${lastError?.message || "Unknown error"}`,
    );
  }
}

export default TransactionModel;
