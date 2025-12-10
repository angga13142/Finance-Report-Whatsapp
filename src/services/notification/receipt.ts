import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { getWhatsAppClient } from "../../bot/client/client";
import { formatCurrency } from "../../lib/currency";
import { formatDate } from "../../lib/date";

/**
 * Receipt notification service
 * Sends transaction receipt confirmations via WhatsApp (optional, Dev-enabled)
 */

export interface ReceiptData {
  transactionId: string;
  userId: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description?: string;
  timestamp: Date;
  userName?: string;
}

export interface ReceiptConfig {
  enabled: boolean;
  includeDetails: boolean;
  includeReference: boolean;
  sendImmediately: boolean;
  recipients?: string[]; // Additional phone numbers to CC
}

export class ReceiptService {
  private static instance: ReceiptService;
  private prisma: PrismaClient;
  private config: ReceiptConfig = {
    enabled: false,
    includeDetails: true,
    includeReference: true,
    sendImmediately: true,
  };

  private constructor() {
    this.prisma = new PrismaClient();
    void this.loadConfig();
  }

  static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService();
    }
    return ReceiptService.instance;
  }

  /**
   * Load receipt configuration from database
   */
  private async loadConfig(): Promise<void> {
    try {
      const configResult = await this.prisma.$queryRaw<
        Array<{ config_value: string }>
      >`
        SELECT config_value 
        FROM system_config 
        WHERE config_key = 'receipt_notification'
        LIMIT 1
      `;

      if (configResult && configResult.length > 0) {
        this.config = JSON.parse(configResult[0].config_value) as ReceiptConfig;
      }
    } catch (error) {
      logger.warn("Failed to load receipt config, using defaults", { error });
    }
  }

  /**
   * Get current receipt configuration
   */
  async getConfig(): Promise<ReceiptConfig> {
    await this.loadConfig();
    return { ...this.config };
  }

  /**
   * Update receipt configuration (Dev only)
   */
  async updateConfig(
    config: Partial<ReceiptConfig>,
    updatedBy: string,
  ): Promise<void> {
    try {
      const newConfig = {
        ...this.config,
        ...config,
      };

      await this.prisma.$executeRaw`
        INSERT INTO system_config (config_key, config_value, updated_by, updated_at)
        VALUES ('receipt_notification', ${JSON.stringify(newConfig)}, ${updatedBy}, NOW())
        ON CONFLICT (config_key)
        DO UPDATE SET 
          config_value = ${JSON.stringify(newConfig)},
          updated_by = ${updatedBy},
          updated_at = NOW()
      `;

      this.config = newConfig;

      logger.info("Receipt config updated", { config: newConfig, updatedBy });
    } catch (error) {
      logger.error("Failed to update receipt config", { error });
      throw error;
    }
  }

  /**
   * Send transaction receipt
   */
  async sendReceipt(receiptData: ReceiptData): Promise<boolean> {
    // Check if receipts are enabled
    if (!this.config.enabled) {
      logger.debug("Receipt notifications disabled, skipping", {
        transactionId: receiptData.transactionId,
      });
      return false;
    }

    const client = getWhatsAppClient();
    if (!client) {
      logger.error("WhatsApp client not available for receipt");
      return false;
    }

    try {
      // Get user phone number
      const user = await this.prisma.user.findUnique({
        where: { id: receiptData.userId },
        select: { phoneNumber: true, name: true },
      });

      if (!user || !user.phoneNumber) {
        logger.warn("User phone not found for receipt", {
          userId: receiptData.userId,
        });
        return false;
      }

      // Format receipt message
      const receiptMessage = this.formatReceiptMessage(receiptData);

      // Send to user
      const userChatId = `${user.phoneNumber}@c.us`;
      await client.sendMessage(userChatId, receiptMessage);

      logger.info("Receipt sent to user", {
        userId: receiptData.userId,
        transactionId: receiptData.transactionId,
      });

      // Send to additional recipients if configured
      if (this.config.recipients && this.config.recipients.length > 0) {
        for (const phone of this.config.recipients) {
          try {
            const ccChatId = `${phone}@c.us`;
            await client.sendMessage(ccChatId, receiptMessage);
            logger.debug("Receipt CC sent", {
              phone,
              transactionId: receiptData.transactionId,
            });
          } catch (ccError) {
            logger.warn("Failed to send receipt CC", { phone, error: ccError });
          }
        }
      }

      // Log receipt delivery
      await this.logReceiptDelivery(receiptData.transactionId, "success");

      return true;
    } catch (error) {
      logger.error("Failed to send receipt", {
        error,
        transactionId: receiptData.transactionId,
      });

      await this.logReceiptDelivery(
        receiptData.transactionId,
        "failed",
        String(error),
      );

      return false;
    }
  }

  /**
   * Format receipt message
   */
  private formatReceiptMessage(data: ReceiptData): string {
    const typeEmoji = data.type === "income" ? "💰" : "💸";
    const typeLabel = data.type === "income" ? "PENJUALAN" : "PENGELUARAN";

    let message = `${typeEmoji} *BUKTI ${typeLabel}*\n\n`;

    // Transaction details
    message += `📋 *Detail Transaksi*\n`;
    message += `• Kategori: ${data.category}\n`;
    message += `• Jumlah: ${formatCurrency(data.amount)}\n`;
    message += `• Waktu: ${formatDate(data.timestamp, "YYYY-MM-DD HH:mm:ss")}\n`;

    if (this.config.includeDetails) {
      if (data.description) {
        message += `• Catatan: ${data.description}\n`;
      }
      if (data.userName) {
        message += `• Dicatat oleh: ${data.userName}\n`;
      }
    }

    // Reference number
    if (this.config.includeReference) {
      message += `\n🔖 *Referensi*\n`;
      message += `• ID: ${data.transactionId.substring(0, 8).toUpperCase()}\n`;
    }

    message += `\n✅ Transaksi Anda telah berhasil dicatat dalam sistem.\n`;
    message += `\n_Simpan pesan ini sebagai bukti transaksi._`;

    return message;
  }

  /**
   * Send bulk receipts (for batch processing)
   */
  async sendBulkReceipts(receipts: ReceiptData[]): Promise<{
    success: number;
    failed: number;
  }> {
    if (!this.config.enabled) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const receipt of receipts) {
      try {
        const sent = await this.sendReceipt(receipt);
        if (sent) {
          success++;
        } else {
          failed++;
        }

        // Rate limiting - wait between messages
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds
      } catch (error) {
        logger.error("Error in bulk receipt sending", {
          error,
          transactionId: receipt.transactionId,
        });
        failed++;
      }
    }

    logger.info("Bulk receipt sending completed", { success, failed });

    return { success, failed };
  }

  /**
   * Resend receipt for a transaction
   */
  async resendReceipt(transactionId: string): Promise<boolean> {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { user: true, Category: true },
      });

      if (!transaction) {
        logger.warn("Transaction not found for receipt resend", {
          transactionId,
        });
        return false;
      }

      const receiptData: ReceiptData = {
        transactionId: transaction.id,
        userId: transaction.userId,
        type: transaction.type as "income" | "expense",
        category: transaction.Category?.name || "Unknown",
        amount: Number(transaction.amount),
        description: transaction.description || undefined,
        timestamp: transaction.timestamp,
        userName: transaction.user.name || undefined,
      };

      return await this.sendReceipt(receiptData);
    } catch (error) {
      logger.error("Failed to resend receipt", { error, transactionId });
      return false;
    }
  }

  /**
   * Log receipt delivery
   */
  private async logReceiptDelivery(
    transactionId: string,
    status: "success" | "failed",
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO receipt_delivery_log 
        (id, transaction_id, delivered_at, status, error_message)
        VALUES (
          gen_random_uuid()::text,
          ${transactionId},
          NOW(),
          ${status},
          ${error || null}
        )
      `;
    } catch (logError) {
      logger.error("Failed to log receipt delivery", {
        logError,
        transactionId,
      });
    }
  }

  /**
   * Get receipt delivery history for a transaction
   */
  async getDeliveryHistory(transactionId: string): Promise<
    Array<{
      deliveredAt: Date;
      status: string;
      errorMessage?: string;
    }>
  > {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          delivered_at: Date;
          status: string;
          error_message: string | null;
        }>
      >`
        SELECT delivered_at, status, error_message
        FROM receipt_delivery_log
        WHERE transaction_id = ${transactionId}
        ORDER BY delivered_at DESC
      `;

      return results.map((r) => ({
        deliveredAt: r.delivered_at,
        status: r.status,
        errorMessage: r.error_message || undefined,
      }));
    } catch (error) {
      logger.error("Failed to fetch receipt delivery history", {
        error,
        transactionId,
      });
      return [];
    }
  }

  /**
   * Get receipt statistics
   */
  async getStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSent: number;
    successRate: number;
    failedCount: number;
  }> {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          total: bigint;
          success: bigint;
          failed: bigint;
        }>
      >`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM receipt_delivery_log
        WHERE delivered_at BETWEEN ${startDate} AND ${endDate}
      `;

      if (!results || results.length === 0) {
        return { totalSent: 0, successRate: 0, failedCount: 0 };
      }

      const total = Number(results[0].total);
      const success = Number(results[0].success);
      const failed = Number(results[0].failed);

      return {
        totalSent: total,
        successRate: total > 0 ? (success / total) * 100 : 0,
        failedCount: failed,
      };
    } catch (error) {
      logger.error("Failed to fetch receipt statistics", { error });
      return { totalSent: 0, successRate: 0, failedCount: 0 };
    }
  }
}

export const receiptService = ReceiptService.getInstance();
