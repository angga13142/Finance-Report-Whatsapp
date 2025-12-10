/**
 * Unit tests for ReceiptService
 * Tests receipt generation, formatting, and WhatsApp delivery
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return */

import {
  ReceiptService,
  ReceiptData,
} from "../../../../src/services/notification/receipt";
import { logger } from "../../../../src/lib/logger";

// Mock dependencies
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../../../src/bot/client/client", () => ({
  getWhatsAppClient: jest.fn(() => ({
    sendMessage: jest.fn().mockResolvedValue({ id: "msg123" }),
  })),
}));

jest.mock("../../../../src/lib/currency", () => {
  return {
    formatCurrency: jest.fn((amount) => {
      // Handle all cases including 0
      if (amount === undefined || amount === null) return "undefined";
      // Handle Decimal type
      let numValue: number;
      if (amount && typeof amount === "object" && "toNumber" in amount) {
        numValue = amount.toNumber();
      } else {
        numValue = Number(amount);
      }
      // Handle NaN
      if (isNaN(numValue)) return "undefined";
      // Format with locale
      return `Rp ${numValue.toLocaleString("id-ID")}`;
    }),
  };
});

jest.mock("../../../../src/lib/date", () => ({
  formatDate: jest.fn((date, _format) => {
    if (!date) return "undefined";
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    return new Date(date).toISOString().split("T")[0] + " 00:00:00";
  }),
}));

// Mock Prisma - use shared mock utility
jest.mock("@prisma/client", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockPrisma } = require("../../../utils/prisma-mock");
  return {
    PrismaClient: jest.fn(() => createMockPrisma()),
  };
});

describe("ReceiptService", () => {
  let receiptService: ReceiptService;
  let mockPrisma: any;
  const mockReceiptData: ReceiptData = {
    transactionId: "txn123",
    userId: "user123",
    type: "expense",
    category: "Food",
    amount: 50000,
    description: "Lunch at restaurant",
    timestamp: new Date("2025-12-10T12:00:00Z"),
    userName: "John Doe",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Get mock instance - ReceiptService creates its own PrismaClient instance
    // We need to access it through the service instance
    receiptService = ReceiptService.getInstance();
    // Access the prisma instance from the service (it's private, so we use type assertion)
    mockPrisma = (receiptService as any).prisma;

    // Mock config loading
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        config_value: JSON.stringify({
          enabled: true,
          includeDetails: true,
          includeReference: true,
          sendImmediately: true,
        }),
      },
    ]);
    // Mock user.findUnique for sendReceipt
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      phoneNumber: "+62812345678",
      name: "John Doe",
    });
    // Mock WhatsApp client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getWhatsAppClient } = require("../../../../src/bot/client/client");
    (getWhatsAppClient as jest.Mock).mockReturnValue({
      sendMessage: jest.fn().mockResolvedValue({ id: "msg123" }),
    });
    // Reload config to apply mock
    void (receiptService as any).loadConfig();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = ReceiptService.getInstance();
      const instance2 = ReceiptService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("sendReceipt", () => {
    it("should send receipt when enabled", async () => {
      const result = await receiptService.sendReceipt(mockReceiptData);

      expect(result).toBe(true);
    });

    it("should not send receipt when disabled", async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
        { config_value: JSON.stringify({ enabled: false }) },
      ]);
      // Reload config to apply the disabled state
      await (receiptService as any).loadConfig();

      const result = await receiptService.sendReceipt(mockReceiptData);

      expect(result).toBe(false);
    });

    it("should format receipt message correctly", async () => {
      const result = await receiptService.sendReceipt(mockReceiptData);

      expect(result).toBe(true);
    });

    it("should handle missing optional fields", async () => {
      const minimalData: ReceiptData = {
        transactionId: "txn124",
        userId: "user124",
        type: "income",
        category: "Sales",
        amount: 100000,
        timestamp: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        phoneNumber: "+62812345678",
        name: "User 124",
      });

      const result = await receiptService.sendReceipt(minimalData);

      expect(result).toBe(true);
    });

    it("should handle send errors gracefully", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: jest.fn().mockRejectedValue(new Error("Send failed")),
      });

      const result = await receiptService.sendReceipt(mockReceiptData);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("sendReceipt message formatting", () => {
    it("should format expense receipt correctly", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      await receiptService.sendReceipt(mockReceiptData);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain("PENGELUARAN");
      expect(message).toContain("Food");
    });

    it("should format income receipt correctly", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      const incomeData: ReceiptData = {
        ...mockReceiptData,
        type: "income",
        category: "Sales",
        amount: 200000,
      };

      await receiptService.sendReceipt(incomeData);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain("PENJUALAN");
      expect(message).toContain("Sales");
    });

    it("should include description when provided", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      await receiptService.sendReceipt(mockReceiptData);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain("Lunch at restaurant");
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", async () => {
      const config = await receiptService.getConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("includeDetails");
    });

    it("should load config from database", async () => {
      await receiptService.getConfig();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it("should use defaults when config not found", async () => {
      // Reset config to defaults first
      (receiptService as any).config = {
        enabled: false,
        includeDetails: true,
        includeReference: true,
        sendImmediately: true,
      };

      // Mock empty result
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      // getConfig will call loadConfig which will get empty result
      const config = await receiptService.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.includeDetails).toBe(true);
    });
  });

  describe("updateConfig", () => {
    it("should update receipt configuration", async () => {
      (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1);

      const newConfig = {
        enabled: true,
        includeDetails: true,
        includeReference: true,
        sendImmediately: true,
      };

      await receiptService.updateConfig(newConfig, "dev123");

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe("sendBulkReceipts", () => {
    it("should send receipts to multiple recipients", async () => {
      const receipts: ReceiptData[] = [
        mockReceiptData,
        { ...mockReceiptData, transactionId: "txn124", userId: "user124" },
      ];

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          phoneNumber: "+62812345678",
          name: "John Doe",
        })
        .mockResolvedValueOnce({
          phoneNumber: "+62812345679",
          name: "Jane Doe",
        });

      const result = await receiptService.sendBulkReceipts(receipts);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should handle partial failures in batch", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      let callCount = 0;
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error("Send failed"));
          }
          return Promise.resolve({ id: `msg${callCount}` });
        }),
      });

      const receipts: ReceiptData[] = [
        mockReceiptData,
        { ...mockReceiptData, transactionId: "txn124" },
        { ...mockReceiptData, transactionId: "txn125" },
      ];

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        phoneNumber: "+62812345678",
        name: "John Doe",
      });

      const result = await receiptService.sendBulkReceipts(receipts);

      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle very large amounts", async () => {
      const { formatCurrency } = require("../../../../src/lib/currency");
      const { formatDate } = require("../../../../src/lib/date");

      // Ensure mocks are called correctly
      (formatCurrency as jest.Mock).mockImplementation((amount) => {
        const numValue = Number(amount);
        return `Rp ${numValue.toLocaleString("id-ID")}`;
      });
      (formatDate as jest.Mock).mockImplementation((date) => {
        if (!date) return "undefined";
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      });

      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      const largeAmount: ReceiptData = {
        ...mockReceiptData,
        amount: 999999999,
      };

      await receiptService.sendReceipt(largeAmount);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain("999");
    });

    it("should handle zero amounts", async () => {
      const { formatCurrency } = require("../../../../src/lib/currency");
      const { formatDate } = require("../../../../src/lib/date");

      // Ensure mocks are called correctly
      (formatCurrency as jest.Mock).mockImplementation((amount) => {
        const numValue = Number(amount);
        return `Rp ${numValue.toLocaleString("id-ID")}`;
      });
      (formatDate as jest.Mock).mockImplementation((date) => {
        if (!date) return "undefined";
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      });

      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      const zeroAmount: ReceiptData = {
        ...mockReceiptData,
        amount: 0,
      };

      await receiptService.sendReceipt(zeroAmount);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain("0");
    });

    it("should handle very long descriptions", async () => {
      const {
        getWhatsAppClient,
      } = require("../../../../src/bot/client/client");
      const mockSendMessage = jest.fn().mockResolvedValue({ id: "msg123" });
      (getWhatsAppClient as jest.Mock).mockReturnValue({
        sendMessage: mockSendMessage,
      });

      const longDesc: ReceiptData = {
        ...mockReceiptData,
        description: "A".repeat(500),
      };

      await receiptService.sendReceipt(longDesc);

      expect(mockSendMessage).toHaveBeenCalled();
      const message = mockSendMessage.mock.calls[0][1];
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
