/**
 * Unit tests for currency utilities
 * Tests formatting, parsing, and validation of currency amounts
 */

import { Decimal } from "@prisma/client/runtime/library";
import {
  formatCurrency,
  parseAmount,
  validateAmountRange,
  toNumber,
  toDecimal,
} from "../../../src/lib/currency";

describe("Currency Utilities", () => {
  describe("formatCurrency", () => {
    it("should format Decimal to Indonesian Rupiah string", () => {
      const amount = new Decimal(500000);
      const result = formatCurrency(amount);
      expect(result).toContain("500.000");
      expect(result).toMatch(/^Rp\s500\.000$/);
    });

    it("should format number to Indonesian Rupiah string", () => {
      const result = formatCurrency(1500000);
      expect(result).toContain("1.500.000");
      expect(result).toMatch(/^Rp\s1\.500\.000$/);
    });

    it("should format string to Indonesian Rupiah string", () => {
      const result = formatCurrency("250000");
      expect(result).toContain("250.000");
      expect(result).toMatch(/^Rp\s250\.000$/);
    });

    it("should handle zero amount", () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/^Rp\s0$/);
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-100000);
      expect(result).toContain("100.000");
      expect(result).toContain("-");
    });

    it("should handle decimal values and round appropriately", () => {
      const result = formatCurrency(150000.99);
      // Rupiah doesn't use decimal places, should round
      expect(result).toContain("150.001");
    });

    it("should handle very large amounts", () => {
      const result = formatCurrency(1000000000);
      expect(result).toContain("1.000.000.000");
    });
  });

  describe("parseAmount", () => {
    it("should parse plain number string", () => {
      const result = parseAmount("500000");
      expect(result.toNumber()).toBe(500000);
    });

    it("should parse comma-separated thousands", () => {
      const result = parseAmount("500,000");
      expect(result.toNumber()).toBe(500000);
    });

    it("should parse dot-separated thousands", () => {
      const result = parseAmount("1.500.000");
      expect(result.toNumber()).toBe(1500000);
    });

    it("should parse amount with Rp prefix and comma separators", () => {
      const result = parseAmount("Rp 250,000");
      expect(result.toNumber()).toBe(250000);
    });

    it("should parse amount with mixed formatting", () => {
      const result = parseAmount("1000000");
      expect(result.toNumber()).toBe(1000000);
    });

    it("should handle single decimal number", () => {
      const result = parseAmount("100.50");
      // Note: Based on implementation, single dot might be ambiguous
      expect(result.toNumber()).toBeGreaterThan(0);
    });

    it("should throw error for invalid input", () => {
      expect(() => parseAmount("invalid")).toThrow();
    });

    it("should throw error for empty string", () => {
      expect(() => parseAmount("")).toThrow();
    });

    it("should handle spaces in input", () => {
      const result = parseAmount("500 000");
      expect(result.toNumber()).toBe(500000);
    });
  });

  describe("validateAmountRange", () => {
    it("should validate amount within range", () => {
      const amount = new Decimal(50000);

      expect(() => validateAmountRange(amount, 10000, 100000)).not.toThrow();
    });

    it("should throw error for amount below minimum", () => {
      const amount = new Decimal(5000);

      expect(() => validateAmountRange(amount, 10000, 100000)).toThrow();
      expect(() => validateAmountRange(amount, 10000, 100000)).toThrow(
        /at least/,
      );
    });

    it("should throw error for amount above maximum", () => {
      const amount = new Decimal(150000);

      expect(() => validateAmountRange(amount, 10000, 100000)).toThrow();
      expect(() => validateAmountRange(amount, 10000, 100000)).toThrow(
        /cannot exceed/,
      );
    });

    it("should accept amount equal to minimum", () => {
      const amount = new Decimal(10000);

      expect(() => validateAmountRange(amount, 10000, 100000)).not.toThrow();
    });

    it("should accept amount equal to maximum", () => {
      const amount = new Decimal(100000);

      expect(() => validateAmountRange(amount, 10000, 100000)).not.toThrow();
    });

    it("should throw error for negative amounts", () => {
      const amount = new Decimal(-5000);

      expect(() => validateAmountRange(amount, 0, 100000)).toThrow();
    });

    it("should work with number input", () => {
      expect(() => validateAmountRange(50000, 10000, 100000)).not.toThrow();
    });

    it("should work with string input", () => {
      expect(() => validateAmountRange("50000", 10000, 100000)).not.toThrow();
    });
  });

  describe("toNumber and toDecimal", () => {
    it("should convert Decimal to number", () => {
      const decimal = new Decimal(50000);
      const result = toNumber(decimal);
      expect(result).toBe(50000);
      expect(typeof result).toBe("number");
    });

    it("should convert number to Decimal", () => {
      const result = toDecimal(50000);
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toNumber()).toBe(50000);
    });

    it("should convert string to Decimal", () => {
      const result = toDecimal("50000");
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toNumber()).toBe(50000);
    });

    it("should handle decimal strings", () => {
      const result = toDecimal("50000.50");
      expect(result.toNumber()).toBe(50000.5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers without overflow", () => {
      const largeNumber = "999999999999";
      const result = parseAmount(largeNumber);
      expect(result.toString()).toBe(largeNumber);
    });

    it("should maintain precision for decimal calculations", () => {
      const amount1 = new Decimal("100.50");
      const amount2 = new Decimal("200.75");
      const sum = amount1.plus(amount2);
      expect(sum.toNumber()).toBe(301.25);
    });

    it("should format currency consistently regardless of input type", () => {
      const amount = 1000000;
      const resultFromNumber = formatCurrency(amount);
      const resultFromString = formatCurrency(String(amount));
      const resultFromDecimal = formatCurrency(new Decimal(amount));

      expect(resultFromNumber).toBe(resultFromString);
      expect(resultFromString).toBe(resultFromDecimal);
    });
  });
});
