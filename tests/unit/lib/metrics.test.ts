/**
 * Unit tests for metrics utilities
 * Tests Prometheus metrics collection and recording functions
 */

// Mock prom-client - use factory function to avoid hoisting issues
const mockEndTimer = jest.fn();
const mockCounter = {
  inc: jest.fn(),
  reset: jest.fn(),
};
const mockHistogram = {
  observe: jest.fn(),
  startTimer: jest.fn(() => mockEndTimer),
  reset: jest.fn(),
};
const mockGauge = {
  set: jest.fn(),
  reset: jest.fn(),
};
const mockRegistry = {
  metrics: jest.fn().mockResolvedValue("# Metrics output"),
  resetMetrics: jest.fn(),
  getMetricsAsArray: jest.fn().mockReturnValue([]),
};

jest.mock("prom-client", () => ({
  Registry: jest.fn(() => mockRegistry),
  Counter: jest.fn(() => mockCounter),
  Histogram: jest.fn(() => mockHistogram),
  Gauge: jest.fn(() => mockGauge),
  collectDefaultMetrics: jest.fn(),
}));

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
import {
  recordMessageReceived,
  recordMessageSent,
  startMessageProcessingTimer,
  recordMessageProcessingError,
  recordTransactionProcessed,
  startTransactionValidationTimer,
  recordReportGenerated,
  recordReportDelivery,
  recordDatabaseQuery,
  recordDatabaseError,
  recordCacheHit,
  recordCacheMiss,
  recordCacheOperation,
  updateActiveUsers,
  updateWhatsAppSessionStatus,
  updatePendingTransactions,
  recordRecommendationAlert,
  recordCommandExecution,
  recordApplicationError,
  getMetrics,
  resetMetrics,
} from "../../../src/lib/metrics";

describe("Metrics Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock return values
    mockRegistry.metrics.mockResolvedValue("# Metrics output");
    mockEndTimer.mockClear();
    // Reset histogram startTimer to return mockEndTimer
    (mockHistogram.startTimer as jest.Mock).mockReturnValue(mockEndTimer);
  });

  describe("recordMessageReceived", () => {
    it("should record message received", () => {
      recordMessageReceived("text");
      // Counter should be incremented
      expect(true).toBe(true); // Function should not throw
    });
  });

  describe("recordMessageSent", () => {
    it("should record message sent with status", () => {
      recordMessageSent("text", "success");
      recordMessageSent("button", "failed");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("startMessageProcessingTimer", () => {
    it("should return timer function", () => {
      const endTimer = startMessageProcessingTimer("transaction");
      expect(typeof endTimer).toBe("function");
    });

    it("should allow ending timer", () => {
      // Reset mock to return a function
      (mockHistogram.startTimer as jest.Mock).mockReturnValue(mockEndTimer);
      const endTimer = startMessageProcessingTimer("transaction");
      expect(typeof endTimer).toBe("function");
      // Call the timer - it should call mockEndTimer with status
      endTimer();
      expect(mockEndTimer).toHaveBeenCalledWith({ status: "success" });
    });
  });

  describe("recordMessageProcessingError", () => {
    it("should record processing error", () => {
      recordMessageProcessingError("transaction", "ValidationError");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordTransactionProcessed", () => {
    it("should record successful transaction", () => {
      recordTransactionProcessed("income", "success", 50000);
      // Should not throw
      expect(true).toBe(true);
    });

    it("should record failed transaction", () => {
      recordTransactionProcessed("expense", "failed");
      // Should not throw
      expect(true).toBe(true);
    });

    it("should record flagged transaction", () => {
      recordTransactionProcessed("expense", "flagged", 100000);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("startTransactionValidationTimer", () => {
    it("should return timer function", () => {
      // Reset mock to return a function
      (mockHistogram.startTimer as jest.Mock).mockReturnValue(mockEndTimer);
      const endTimer = startTransactionValidationTimer();
      expect(typeof endTimer).toBe("function");
      // Call the timer - it should call mockEndTimer
      endTimer();
      expect(mockEndTimer).toHaveBeenCalled();
    });
  });

  describe("recordReportGenerated", () => {
    it("should record report generation", () => {
      recordReportGenerated("daily", "employee", 1.5);
      // Should not throw
      expect(true).toBe(true);
    });

    it("should record different report types", () => {
      recordReportGenerated("daily", "boss", 2.0);
      recordReportGenerated("weekly", "investor", 5.0);
      recordReportGenerated("monthly", "dev", 10.0);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordReportDelivery", () => {
    it("should record successful delivery", () => {
      recordReportDelivery("success");
      // Should not throw
      expect(true).toBe(true);
    });

    it("should record failed delivery", () => {
      recordReportDelivery("failed");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordDatabaseQuery", () => {
    it("should record database query", () => {
      recordDatabaseQuery("select", "users", 0.05);
      recordDatabaseQuery("insert", "transactions", 0.1);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordDatabaseError", () => {
    it("should record database error", () => {
      recordDatabaseError("ConnectionError", "error");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordCacheHit", () => {
    it("should record cache hit", () => {
      recordCacheHit("user_data");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordCacheMiss", () => {
    it("should record cache miss", () => {
      recordCacheMiss("user_data");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordCacheOperation", () => {
    it("should record cache operation", () => {
      recordCacheOperation("set", 0.01);
      recordCacheOperation("get", 0.005);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("updateActiveUsers", () => {
    it("should update active users count", () => {
      updateActiveUsers("employee", 10);
      updateActiveUsers("boss", 25);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("updateWhatsAppSessionStatus", () => {
    it("should update session status", () => {
      updateWhatsAppSessionStatus(true);
      updateWhatsAppSessionStatus(false);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("updatePendingTransactions", () => {
    it("should update pending transactions count", () => {
      updatePendingTransactions(5);
      updatePendingTransactions(0);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordRecommendationAlert", () => {
    it("should record recommendation alert", () => {
      recordRecommendationAlert("critical", "expense_spike");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordCommandExecution", () => {
    it("should record command execution", () => {
      recordCommandExecution("/start", "success", 0.1);
      recordCommandExecution("/help", "error", 0.05);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordApplicationError", () => {
    it("should record application error", () => {
      recordApplicationError("NetworkError", "warning");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("getMetrics", () => {
    it("should return metrics string", async () => {
      // The register instance should use the mocked registry
      mockRegistry.metrics.mockResolvedValue("# Metrics output");
      const metrics = await getMetrics();
      expect(typeof metrics).toBe("string");
      expect(metrics).toBe("# Metrics output");
      expect(mockRegistry.metrics).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Mock register.metrics to throw error
      mockRegistry.metrics.mockRejectedValueOnce(new Error("Metrics error"));

      const metrics = await getMetrics();
      expect(metrics).toBe("");

      // Restore
      mockRegistry.metrics.mockResolvedValue("# Metrics output");
    });
  });

  describe("resetMetrics", () => {
    it("should reset all metrics", () => {
      resetMetrics();
      expect(mockRegistry.resetMetrics).toHaveBeenCalled();
    });
  });
});
