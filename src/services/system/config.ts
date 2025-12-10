import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Configuration management service
 * Handles button label customization and other system configurations
 */

export interface ButtonLabelConfig {
  key: string;
  label: string;
  emoji?: string;
  description?: string;
}

export interface SystemConfig {
  buttonLabels: Record<string, string>;
  reportSchedule?: string | Record<string, unknown>;
  notificationSettings?: Record<string, boolean | Record<string, unknown>>;
  customRules?: Record<string, Record<string, unknown>>;
}

export class ConfigService {
  private static instance: ConfigService;
  private prisma: PrismaClient;
  private configCache: Map<string, { value: unknown; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Default button labels (Indonesian)
   */
  private static readonly DEFAULT_BUTTON_LABELS: Record<
    string,
    ButtonLabelConfig
  > = {
    record_income: {
      key: "record_income",
      label: "Catat Penjualan",
      emoji: "💰",
      description: "Record income transaction",
    },
    record_expense: {
      key: "record_expense",
      label: "Catat Pengeluaran",
      emoji: "💸",
      description: "Record expense transaction",
    },
    view_report: {
      key: "view_report",
      label: "Lihat Laporan",
      emoji: "📊",
      description: "View reports",
    },
    help: {
      key: "help",
      label: "Bantuan",
      emoji: "❓",
      description: "Get help",
    },
    settings: {
      key: "settings",
      label: "Pengaturan",
      emoji: "⚙️",
      description: "System settings",
    },
    edit_amount: {
      key: "edit_amount",
      label: "Edit Jumlah",
      emoji: "✏️",
      description: "Edit amount",
    },
    edit_category: {
      key: "edit_category",
      label: "Edit Kategori",
      emoji: "✏️",
      description: "Edit category",
    },
    confirm: {
      key: "confirm",
      label: "Konfirmasi",
      emoji: "✅",
      description: "Confirm action",
    },
    cancel: {
      key: "cancel",
      label: "Batal",
      emoji: "❌",
      description: "Cancel action",
    },
    retry: {
      key: "retry",
      label: "Coba Lagi",
      emoji: "🔄",
      description: "Retry action",
    },
    main_menu: {
      key: "main_menu",
      label: "Menu Utama",
      emoji: "🏠",
      description: "Return to main menu",
    },
  };

  /**
   * Get button label by key
   */
  async getButtonLabel(key: string): Promise<string> {
    const cached = this.getCachedConfig(`button_label_${key}`);
    if (cached) {
      return cached as string;
    }

    try {
      // Try to get custom label from database
      const config = await this.prisma.$queryRaw<
        Array<{ config_value: string }>
      >`
        SELECT config_value 
        FROM system_config 
        WHERE config_key = ${`button_label_${key}`}
        LIMIT 1
      `;

      if (config && config.length > 0) {
        const label = config[0].config_value;
        this.setCachedConfig(`button_label_${key}`, label);
        return label;
      }
    } catch (error) {
      logger.warn(`Failed to fetch custom button label for ${key}`, { error });
    }

    // Return default label
    const defaultConfig = ConfigService.DEFAULT_BUTTON_LABELS[key];
    if (!defaultConfig) {
      logger.warn(`No default button label found for key: ${key}`);
      return key;
    }

    return defaultConfig.emoji
      ? `${defaultConfig.emoji} ${defaultConfig.label}`
      : defaultConfig.label;
  }

  /**
   * Get all button labels
   */
  async getAllButtonLabels(): Promise<Record<string, string>> {
    const cached = this.getCachedConfig("all_button_labels");
    if (cached) {
      return cached as Record<string, string>;
    }

    const labels: Record<string, string> = {};

    try {
      const configs = await this.prisma.$queryRaw<
        Array<{ config_key: string; config_value: string }>
      >`
        SELECT config_key, config_value 
        FROM system_config 
        WHERE config_key LIKE 'button_label_%'
      `;

      for (const config of configs) {
        const key = config.config_key.replace("button_label_", "");
        labels[key] = config.config_value;
      }
    } catch (error) {
      logger.warn("Failed to fetch custom button labels", { error });
    }

    // Fill in defaults for missing labels
    for (const [key, config] of Object.entries(
      ConfigService.DEFAULT_BUTTON_LABELS,
    )) {
      if (!labels[key]) {
        labels[key] = config.emoji
          ? `${config.emoji} ${config.label}`
          : config.label;
      }
    }

    this.setCachedConfig("all_button_labels", labels);
    return labels;
  }

  /**
   * Update button label (Dev role only)
   */
  async updateButtonLabel(
    key: string,
    label: string,
    userId: string,
  ): Promise<void> {
    try {
      // Validate label length
      if (label.length > 20) {
        throw new Error("Button label cannot exceed 20 characters");
      }

      // Validate key exists
      if (!ConfigService.DEFAULT_BUTTON_LABELS[key]) {
        throw new Error(`Invalid button key: ${key}`);
      }

      await this.prisma.$executeRaw`
        INSERT INTO system_config (config_key, config_value, updated_by, updated_at)
        VALUES (${`button_label_${key}`}, ${label}, ${userId}, NOW())
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = ${label},
          updated_by = ${userId},
          updated_at = NOW()
      `;

      // Clear cache
      this.clearCache();

      logger.info("Button label updated", { key, label, userId });
    } catch (error) {
      logger.error("Failed to update button label", { key, label, error });
      throw error;
    }
  }

  /**
   * Reset button label to default (Dev role only)
   */
  async resetButtonLabel(key: string, userId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM system_config 
        WHERE config_key = ${`button_label_${key}`}
      `;

      // Clear cache
      this.clearCache();

      logger.info("Button label reset to default", { key, userId });
    } catch (error) {
      logger.error("Failed to reset button label", { key, error });
      throw error;
    }
  }

  /**
   * Get list of available button keys for customization
   */
  getAvailableButtonKeys(): ButtonLabelConfig[] {
    return Object.values(ConfigService.DEFAULT_BUTTON_LABELS);
  }

  /**
   * Get system configuration
   */
  async getSystemConfig(): Promise<SystemConfig> {
    const buttonLabels = await this.getAllButtonLabels();

    try {
      const configs = await this.prisma.$queryRaw<
        Array<{ config_key: string; config_value: string }>
      >`
        SELECT config_key, config_value 
        FROM system_config 
        WHERE config_key NOT LIKE 'button_label_%'
      `;

      const systemConfig: SystemConfig = {
        buttonLabels,
        reportSchedule: undefined,
        notificationSettings: {},
        customRules: {},
      };

      for (const config of configs) {
        try {
          const value: unknown = JSON.parse(config.config_value);
          if (config.config_key === "report_schedule") {
            systemConfig.reportSchedule = value as Record<string, unknown>;
          } else if (config.config_key.startsWith("notification_")) {
            systemConfig.notificationSettings![config.config_key] =
              value as Record<string, unknown>;
          } else if (config.config_key.startsWith("rule_")) {
            systemConfig.customRules![config.config_key] = value as Record<
              string,
              unknown
            >;
          }
        } catch {
          // If not JSON, treat as string
          if (config.config_key === "report_schedule") {
            systemConfig.reportSchedule =
              config.config_value as unknown as Record<string, unknown>;
          }
        }
      }

      return systemConfig;
    } catch (error) {
      logger.error("Failed to fetch system config", { error });
      return { buttonLabels };
    }
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(
    configKey: string,
    configValue: string | number | boolean | object,
    userId: string,
  ): Promise<void> {
    try {
      const valueStr =
        typeof configValue === "string"
          ? configValue
          : JSON.stringify(configValue);

      await this.prisma.$executeRaw`
        INSERT INTO system_config (config_key, config_value, updated_by, updated_at)
        VALUES (${configKey}, ${valueStr}, ${userId}, NOW())
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = ${valueStr},
          updated_by = ${userId},
          updated_at = NOW()
      `;

      this.clearCache();

      logger.info("System config updated", { configKey, userId });
    } catch (error) {
      logger.error("Failed to update system config", { configKey, error });
      throw error;
    }
  }

  /**
   * Cache helpers
   */
  private getCachedConfig(key: string): unknown {
    const cached = this.configCache.get(key);
    if (!cached) return null;

    const { value, timestamp } = cached;
    if (Date.now() - timestamp > this.CACHE_TTL) {
      this.configCache.delete(key);
      return null;
    }

    return value;
  }

  private setCachedConfig(key: string, value: unknown): void {
    this.configCache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  private clearCache(): void {
    this.configCache.clear();
  }
}

export const configService = ConfigService.getInstance();
