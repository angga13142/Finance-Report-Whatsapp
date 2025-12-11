/**
 * Unit tests for logger utilities
 * Tests Winston logger configuration and sensitive data masking
 */

import { logger, maskSensitiveData } from "../../../src/lib/logger";

// Mock winston
jest.mock("winston", () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const formatObj = {
    combine: jest.fn((..._args: unknown[]) => {
      // Return a function that passes through the info object
      return (info: unknown) => info;
    }),
    timestamp: jest.fn(() => (info: unknown) => ({
      ...(info as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    })),
    errors: jest.fn(() => (info: unknown) => info),
    colorize: jest.fn(() => (info: unknown) => info),
    printf: jest.fn((fn: unknown) => fn),
  };

  // Make format both an object and a function
  const formatFn = ((fn: (info: unknown) => unknown) => {
    // Return a format function that applies the transform
    return (info: unknown) => {
      // Ensure info has required properties
      const infoObj = (info || {}) as Record<string, unknown>;
      if (!infoObj.message) infoObj.message = "";
      if (!infoObj.level) infoObj.level = "info";
      const result = fn(infoObj);
      return result || infoObj;
    };
  }) as typeof formatObj &
    ((fn: (info: unknown) => unknown) => (info: unknown) => unknown);
  Object.assign(formatFn, formatObj);

  return {
    default: {
      createLogger: jest.fn(() => mockLogger),
      format: formatFn,
      transports: {
        Console: jest.fn(),
        File: jest.fn(),
      },
    },
    createLogger: jest.fn(() => mockLogger),
    format: formatFn,
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

// Mock env
jest.mock("../../../src/config/env", () => ({
  env: {
    LOG_LEVEL: "info",
    LOG_FORMAT: "simple",
    NODE_ENV: "test",
  },
}));

// Mock fs
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
}));

describe("Logger Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("maskSensitiveData", () => {
    describe("Phone numbers", () => {
      it("should mask phone numbers with +62 prefix", () => {
        const result = maskSensitiveData("User phone: +62812345678");
        expect(result).toContain("+62****5678");
        expect(result).not.toContain("812345678");
      });

      it("should mask phone numbers with 0 prefix", () => {
        const result = maskSensitiveData("User phone: 0812345678");
        expect(result).toContain("+62****5678");
      });

      it("should preserve last 4 digits", () => {
        const result = maskSensitiveData("+62812345678");
        expect(String(result)).toMatch(/\*\*\*\*5678/);
      });
    });

    describe("Amounts", () => {
      it("should mask amounts in Rupiah", () => {
        const result = maskSensitiveData("Amount: Rp 500000");
        expect(String(result)).toContain("Rp ******.***");
        expect(String(result)).not.toContain("500000");
      });

      it("should not mask plain numbers without Rp prefix", () => {
        const result = maskSensitiveData("Amount: 500000");
        // Logger only masks Rp format amounts, plain numbers are not masked
        expect(String(result)).toContain("500000");
      });
    });

    describe("Email addresses", () => {
      it("should mask email addresses", () => {
        const result = maskSensitiveData("Email: test@example.com");
        expect(String(result)).toMatch(/t\*\*\*t@example\.com/);
      });

      it("should preserve domain in email", () => {
        const result = maskSensitiveData("test@example.com");
        expect(String(result)).toContain("@example.com");
      });
    });

    describe("JWT tokens", () => {
      it("should mask JWT tokens", () => {
        const token =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        const result = maskSensitiveData(`Token: ${token}`);
        expect(String(result)).toContain("eyJ***[REDACTED]***");
        expect(String(result)).not.toContain(token);
      });
    });

    describe("Database URLs", () => {
      it("should mask database URLs", () => {
        const url = "postgresql://user:pass@localhost:5432/db";
        const result = maskSensitiveData(`Connection: ${url}`);
        expect(String(result)).toContain("postgres://***[REDACTED]***");
        expect(String(result)).not.toContain("user:pass");
      });
    });

    describe("API keys", () => {
      it("should mask API keys", () => {
        const result = maskSensitiveData('api_key: "abc123def456ghi789"');
        // Actual pattern masks more characters
        expect(String(result)).toMatch(/\*\*\*\*i789/);
        expect(String(result)).not.toContain("abc123");
      });

      it("should mask secrets", () => {
        const result = maskSensitiveData('secret: "my-secret-key-1234"');
        expect(String(result)).toMatch(/\*\*\*\*1234/);
      });
    });

    describe("Credit card numbers", () => {
      it("should mask credit card numbers", () => {
        const result = maskSensitiveData("Card: 1234-5678-9012-3456");
        expect(String(result)).toContain("****3456");
        expect(String(result)).not.toContain("1234-5678-9012");
      });
    });

    describe("Objects", () => {
      it("should mask sensitive fields in objects", () => {
        const data = {
          name: "John Doe",
          phoneNumber: "+62812345678",
          amount: "Rp 500000",
          password: "secret123",
        };

        const result = maskSensitiveData(data) as Record<string, unknown>;

        expect(result.phoneNumber).toContain("+62****5678");
        expect(result.amount).toBe("Rp ******.***");
        expect(result.password).toBe("***[REDACTED]***");
        expect(result.name).toBe("John Doe"); // Non-sensitive field unchanged
      });

      it("should recursively mask nested objects", () => {
        const data = {
          user: {
            phoneNumber: "+62812345678",
            email: "test@example.com",
          },
        };

        const result = maskSensitiveData(data) as Record<string, unknown>;

        expect((result.user as Record<string, unknown>).phoneNumber).toContain(
          "+62****5678",
        );
      });
    });

    describe("Arrays", () => {
      it("should mask sensitive data in arrays", () => {
        const data = ["+62812345678", "test@example.com", "normal text"];

        const result = maskSensitiveData(data) as string[];

        expect(result[0]).toContain("+62****5678");
        expect(result[1]).toMatch(/t\*\*\*t@example\.com/);
        expect(result[2]).toBe("normal text");
      });
    });

    describe("Non-string values", () => {
      it("should return non-string values as-is", () => {
        expect(maskSensitiveData(123)).toBe(123);
        expect(maskSensitiveData(null)).toBe(null);
        expect(maskSensitiveData(undefined)).toBe(undefined);
        expect(maskSensitiveData(true)).toBe(true);
      });
    });
  });

  describe("logger", () => {
    it("should export logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe("object");
    });

    it("should have info method", () => {
      expect(typeof logger.info).toBe("function");
    });

    it("should have error method", () => {
      expect(typeof logger.error).toBe("function");
    });

    it("should have warn method", () => {
      expect(typeof logger.warn).toBe("function");
    });

    it("should have debug method", () => {
      expect(typeof logger.debug).toBe("function");
    });
  });
});
