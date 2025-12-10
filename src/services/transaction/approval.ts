import { ApprovalStatus, TransactionType, PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { TransactionModel } from "../../models/transaction";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/**
 * Suspicious transaction detection configuration
 */
const APPROVAL_CONFIG = {
  // Amount thresholds (in Rupiah)
  MAX_AUTO_APPROVE_AMOUNT: new Decimal(10_000_000), // 10 juta
  UNREALISTIC_AMOUNT_THRESHOLD: new Decimal(100_000_000), // 100 juta

  // Duplicate detection window (in minutes)
  DUPLICATE_CHECK_WINDOW_MINUTES: 30,

  // Similarity thresholds
  AMOUNT_SIMILARITY_THRESHOLD: 0.95, // 95% similar amounts
  TIME_SIMILARITY_THRESHOLD_MINUTES: 5, // Within 5 minutes

  // Daily limits
  MAX_DAILY_TRANSACTIONS_PER_USER: 50,
  MAX_DAILY_AMOUNT_PER_USER: new Decimal(50_000_000), // 50 juta

  // Pattern detection
  MIN_DESCRIPTION_LENGTH: 3,
  SUSPICIOUS_KEYWORDS: ["test", "testing", "coba", "tes"],
};

/**
 * Suspicious transaction flags
 */
export interface SuspiciousFlags {
  isDuplicate: boolean;
  isUnrealisticAmount: boolean;
  exceedsDailyLimit: boolean;
  exceedsDailyAmountLimit: boolean;
  hasSuspiciousKeywords: boolean;
  lacksDescription: boolean;
  rapidSuccessiveTransactions: boolean;
}

/**
 * Approval decision result
 */
export interface ApprovalDecision {
  status: ApprovalStatus;
  requiresManualApproval: boolean;
  flags: SuspiciousFlags;
  reason: string;
  confidenceScore: number; // 0-100, higher means more suspicious
}

/**
 * Transaction approval service
 */
export class ApprovalService {
  /**
   * Analyze transaction for suspicious patterns
   */
  static async analyzeTransaction(
    userId: string,
    type: TransactionType,
    amount: Decimal,
    category: string,
    description?: string,
  ): Promise<ApprovalDecision> {
    logger.info("Analyzing transaction for approval", {
      userId,
      type,
      amount: amount.toString(),
      category,
    });

    const flags: SuspiciousFlags = {
      isDuplicate: false,
      isUnrealisticAmount: false,
      exceedsDailyLimit: false,
      exceedsDailyAmountLimit: false,
      hasSuspiciousKeywords: false,
      lacksDescription: false,
      rapidSuccessiveTransactions: false,
    };

    let suspicionScore = 0;

    // Check for unrealistic amounts
    if (amount.greaterThan(APPROVAL_CONFIG.UNREALISTIC_AMOUNT_THRESHOLD)) {
      flags.isUnrealisticAmount = true;
      suspicionScore += 40;
      logger.warn("Unrealistic amount detected", {
        amount: amount.toString(),
        threshold: APPROVAL_CONFIG.UNREALISTIC_AMOUNT_THRESHOLD.toString(),
      });
    }

    // Check for duplicate transactions
    const duplicate = await this.checkForDuplicates(
      userId,
      type,
      amount,
      category,
    );
    if (duplicate) {
      flags.isDuplicate = true;
      suspicionScore += 30;
      logger.warn("Potential duplicate transaction detected", {
        userId,
        amount: amount.toString(),
      });
    }

    // Check daily limits
    const dailyStats = await this.getDailyUserStats(userId);
    if (
      dailyStats.transactionCount >=
      APPROVAL_CONFIG.MAX_DAILY_TRANSACTIONS_PER_USER
    ) {
      flags.exceedsDailyLimit = true;
      suspicionScore += 20;
      logger.warn("User exceeded daily transaction limit", {
        userId,
        count: dailyStats.transactionCount,
      });
    }

    if (
      dailyStats.totalAmount.greaterThanOrEqualTo(
        APPROVAL_CONFIG.MAX_DAILY_AMOUNT_PER_USER,
      )
    ) {
      flags.exceedsDailyAmountLimit = true;
      suspicionScore += 25;
      logger.warn("User exceeded daily amount limit", {
        userId,
        total: dailyStats.totalAmount.toString(),
      });
    }

    // Check for rapid successive transactions
    const recentCount = await this.getRecentTransactionCount(userId, 5);
    if (recentCount >= 3) {
      flags.rapidSuccessiveTransactions = true;
      suspicionScore += 15;
      logger.warn("Rapid successive transactions detected", {
        userId,
        recentCount,
      });
    }

    // Check description
    if (
      !description ||
      description.trim().length < APPROVAL_CONFIG.MIN_DESCRIPTION_LENGTH
    ) {
      flags.lacksDescription = true;
      suspicionScore += 5;
    }

    // Check for suspicious keywords
    if (description) {
      const lowerDesc = description.toLowerCase();
      const hasSuspicious = APPROVAL_CONFIG.SUSPICIOUS_KEYWORDS.some(
        (keyword) => lowerDesc.includes(keyword),
      );
      if (hasSuspicious) {
        flags.hasSuspiciousKeywords = true;
        suspicionScore += 10;
        logger.warn("Suspicious keywords in description", { description });
      }
    }

    // Determine approval status based on suspicion score and amount
    let status: ApprovalStatus;
    let requiresManualApproval: boolean;
    let reason: string;

    if (suspicionScore >= 50 || flags.isUnrealisticAmount) {
      // High suspicion - require manual approval
      status = "pending";
      requiresManualApproval = true;
      reason = this.buildReason(flags, "High suspicion score");
    } else if (
      suspicionScore >= 30 ||
      amount.greaterThan(APPROVAL_CONFIG.MAX_AUTO_APPROVE_AMOUNT)
    ) {
      // Medium suspicion or large amount - flag for review
      status = "pending";
      requiresManualApproval = true;
      reason = this.buildReason(flags, "Medium suspicion or large amount");
    } else if (suspicionScore > 0) {
      // Low suspicion - auto-approve but flag
      status = "approved";
      requiresManualApproval = false;
      reason = this.buildReason(flags, "Low suspicion - auto-approved");
    } else {
      // No suspicion - auto-approve
      status = "approved";
      requiresManualApproval = false;
      reason = "Normal transaction - auto-approved";
    }

    logger.info("Transaction analysis complete", {
      userId,
      status,
      requiresManualApproval,
      suspicionScore,
    });

    return {
      status,
      requiresManualApproval,
      flags,
      reason,
      confidenceScore: suspicionScore,
    };
  }

  /**
   * Check for duplicate transactions
   */
  private static async checkForDuplicates(
    userId: string,
    type: TransactionType,
    amount: Decimal,
    category: string,
  ): Promise<boolean> {
    const windowStart = new Date(
      Date.now() - APPROVAL_CONFIG.DUPLICATE_CHECK_WINDOW_MINUTES * 60 * 1000,
    );

    try {
      // Find similar transactions in time window
      const similarTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          type,
          category,
          timestamp: {
            gte: windowStart,
          },
        },
      });

      // Check for amount similarity
      for (const tx of similarTransactions) {
        const amountRatio = amount.dividedBy(tx.amount);
        if (
          amountRatio.greaterThanOrEqualTo(
            APPROVAL_CONFIG.AMOUNT_SIMILARITY_THRESHOLD,
          ) &&
          amountRatio.lessThanOrEqualTo(
            1 / APPROVAL_CONFIG.AMOUNT_SIMILARITY_THRESHOLD,
          )
        ) {
          // Similar amount found
          const timeDiffMinutes =
            (Date.now() - tx.timestamp.getTime()) / (60 * 1000);
          if (
            timeDiffMinutes <= APPROVAL_CONFIG.TIME_SIMILARITY_THRESHOLD_MINUTES
          ) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error("Error checking for duplicates", { error });
      return false; // Don't block on error
    }
  }

  /**
   * Get daily user statistics
   */
  private static async getDailyUserStats(userId: string): Promise<{
    transactionCount: number;
    totalAmount: Decimal;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          timestamp: {
            gte: startOfDay,
          },
        },
      });

      const totalAmount = transactions.reduce(
        (sum: Decimal, tx: { amount: Decimal }) => sum.plus(tx.amount),
        new Decimal(0),
      );

      return {
        transactionCount: transactions.length,
        totalAmount,
      };
    } catch (error) {
      logger.error("Error getting daily user stats", { error });
      return {
        transactionCount: 0,
        totalAmount: new Decimal(0),
      };
    }
  }

  /**
   * Get recent transaction count
   */
  private static async getRecentTransactionCount(
    userId: string,
    minutes: number,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - minutes * 60 * 1000);

    try {
      const count = await prisma.transaction.count({
        where: {
          userId,
          timestamp: {
            gte: windowStart,
          },
        },
      });

      return count;
    } catch (error) {
      logger.error("Error getting recent transaction count", { error });
      return 0;
    }
  }

  /**
   * Build reason string from flags
   */
  private static buildReason(flags: SuspiciousFlags, prefix: string): string {
    const reasons: string[] = [prefix];

    if (flags.isDuplicate) reasons.push("duplicate detected");
    if (flags.isUnrealisticAmount) reasons.push("unrealistic amount");
    if (flags.exceedsDailyLimit) reasons.push("daily limit exceeded");
    if (flags.exceedsDailyAmountLimit)
      reasons.push("daily amount limit exceeded");
    if (flags.rapidSuccessiveTransactions) reasons.push("rapid transactions");
    if (flags.hasSuspiciousKeywords) reasons.push("suspicious keywords");
    if (flags.lacksDescription) reasons.push("lacks description");

    return reasons.join(", ");
  }

  /**
   * Approve transaction manually
   */
  static async approveTransaction(
    transactionId: string,
    approverId: string,
  ): Promise<boolean> {
    logger.info("Manually approving transaction", {
      transactionId,
      approverId,
    });

    try {
      await TransactionModel.update(transactionId, {
        approvalStatus: "approved",
        approvalBy: approverId,
      });

      logger.info("Transaction approved successfully", { transactionId });
      return true;
    } catch (error) {
      logger.error("Error approving transaction", { error, transactionId });
      return false;
    }
  }

  /**
   * Reject transaction manually
   */
  static async rejectTransaction(
    transactionId: string,
    approverId: string,
    reason?: string,
  ): Promise<boolean> {
    logger.info("Manually rejecting transaction", {
      transactionId,
      approverId,
      reason,
    });

    try {
      await TransactionModel.update(transactionId, {
        approvalStatus: "rejected",
        approvalBy: approverId,
      });

      logger.info("Transaction rejected successfully", { transactionId });
      return true;
    } catch (error) {
      logger.error("Error rejecting transaction", { error, transactionId });
      return false;
    }
  }

  /**
   * Get pending transactions for approval
   */
  static async getPendingTransactions(limit = 20): Promise<
    Array<{
      id: string;
      userId: string;
      userName: string;
      type: TransactionType;
      amount: Decimal;
      category: string;
      description: string | null;
      timestamp: Date;
    }>
  > {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          approvalStatus: "pending",
        },
        include: {
          user: {
            select: {
              name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
      });

      return transactions.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        userName: tx.user.name || tx.user.phoneNumber,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        timestamp: tx.timestamp,
      }));
    } catch (error) {
      logger.error("Error getting pending transactions", { error });
      return [];
    }
  }

  /**
   * Get approval statistics
   */
  static async getApprovalStats(): Promise<{
    pendingCount: number;
    approvedToday: number;
    rejectedToday: number;
    autoApprovedToday: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    try {
      const [pending, approvedToday, rejectedToday, autoApprovedToday] =
        await Promise.all([
          prisma.transaction.count({
            where: { approvalStatus: "pending" },
          }),
          prisma.transaction.count({
            where: {
              approvalStatus: "approved",
              approvedAt: { gte: startOfDay },
              approvalBy: { not: null },
            },
          }),
          prisma.transaction.count({
            where: {
              approvalStatus: "rejected",
              approvedAt: { gte: startOfDay },
            },
          }),
          prisma.transaction.count({
            where: {
              approvalStatus: "approved",
              approvedAt: { gte: startOfDay },
              approvalBy: null,
            },
          }),
        ]);

      return {
        pendingCount: pending,
        approvedToday,
        rejectedToday,
        autoApprovedToday,
      };
    } catch (error) {
      logger.error("Error getting approval stats", { error });
      return {
        pendingCount: 0,
        approvedToday: 0,
        rejectedToday: 0,
        autoApprovedToday: 0,
      };
    }
  }
}

export default ApprovalService;
