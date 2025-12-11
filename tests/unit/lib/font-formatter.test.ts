/**
 * Unit tests for Font Formatter
 * Tests Unicode font conversion utilities with character mapping tables
 */

import { FontFormatter, FontStyle } from "../../../src/lib/font-formatter";

describe("FontFormatter", () => {
  describe("Unicode Font Conversion", () => {
    describe("Bold conversion", () => {
      it("should convert uppercase letters to bold Unicode", () => {
        const result = FontFormatter.convert("HELLO", FontStyle.BOLD);
        // Check that result contains Unicode mathematical bold characters
        expect(result).not.toBe("HELLO");
        // Unicode characters outside BMP use surrogate pairs (2 code units each)
        // So 5 characters = 10 code units
        expect(result.length).toBeGreaterThanOrEqual(5);
        // Verify it's not the original ASCII
        expect(result).not.toMatch(/^[A-Z]+$/);
        // Verify conversion happened by checking code points
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d400);
      });

      it("should convert lowercase letters to bold Unicode", () => {
        const result = FontFormatter.convert("hello", FontStyle.BOLD);
        expect(result).not.toBe("hello");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d434);
      });

      it("should convert numbers to bold Unicode", () => {
        const result = FontFormatter.convert("12345", FontStyle.BOLD);
        expect(result).not.toBe("12345");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d7ce);
      });

      it("should convert mixed case and numbers", () => {
        const result = FontFormatter.convert("Hello123", FontStyle.BOLD);
        expect(result.length).toBeGreaterThanOrEqual(8);
        expect(result).not.toBe("Hello123");
      });
    });

    describe("Italic conversion", () => {
      it("should convert uppercase letters to italic Unicode", () => {
        const result = FontFormatter.convert("HELLO", FontStyle.ITALIC);
        expect(result).not.toBe("HELLO");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d434);
      });

      it("should convert lowercase letters to italic Unicode", () => {
        const result = FontFormatter.convert("hello", FontStyle.ITALIC);
        expect(result).not.toBe("hello");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d468);
      });

      it("should convert numbers to italic Unicode", () => {
        const result = FontFormatter.convert("12345", FontStyle.ITALIC);
        expect(result).not.toBe("12345");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d7ce);
      });
    });

    describe("Monospace conversion", () => {
      it("should convert uppercase letters to monospace Unicode", () => {
        const result = FontFormatter.convert("HELLO", FontStyle.MONOSPACE);
        expect(result).not.toBe("HELLO");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d670);
      });

      it("should convert lowercase letters to monospace Unicode", () => {
        const result = FontFormatter.convert("hello", FontStyle.MONOSPACE);
        expect(result).not.toBe("hello");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d68a);
      });

      it("should convert numbers to monospace Unicode", () => {
        const result = FontFormatter.convert("12345", FontStyle.MONOSPACE);
        expect(result).not.toBe("12345");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d7f6);
      });
    });

    describe("Script conversion", () => {
      it("should convert uppercase letters to script Unicode", () => {
        const result = FontFormatter.convert("HELLO", FontStyle.SCRIPT);
        expect(result).not.toBe("HELLO");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d49c);
      });

      it("should convert lowercase letters to script Unicode", () => {
        const result = FontFormatter.convert("hello", FontStyle.SCRIPT);
        expect(result).not.toBe("hello");
        expect(result.length).toBeGreaterThanOrEqual(5);
        const codePoints = Array.from(result).map((c) => c.codePointAt(0));
        expect(codePoints[0]).toBeGreaterThanOrEqual(0x1d4d0);
      });

      it("should preserve numbers in script conversion (no script numbers)", () => {
        const result = FontFormatter.convert("12345", FontStyle.SCRIPT);
        // Numbers should be preserved as-is (no script number variants)
        expect(result).toBe("12345");
        expect(result.length).toBe(5);
      });
    });
  });

  describe("Fallback Behavior", () => {
    it("should preserve emojis unchanged", () => {
      const input = "Hello ✅ World";
      const result = FontFormatter.convert(input, FontStyle.BOLD);
      expect(result).toContain("✅");
      // Emoji should be preserved
      expect(result.length).toBeGreaterThan(input.length - 2); // Account for Unicode conversion
    });

    it("should preserve special characters unchanged", () => {
      const input = "Hello @#$% World";
      const result = FontFormatter.convert(input, FontStyle.BOLD);
      expect(result).toContain("@");
      expect(result).toContain("#");
      expect(result).toContain("$");
      expect(result).toContain("%");
    });

    it("should preserve spaces and punctuation", () => {
      const input = "Hello, World!";
      const result = FontFormatter.convert(input, FontStyle.BOLD);
      expect(result).toContain(",");
      expect(result).toContain(" ");
      expect(result).toContain("!");
    });

    it("should handle mixed character sets", () => {
      const input = "Hello 123 ✅ Test!";
      const result = FontFormatter.convert(input, FontStyle.BOLD);
      expect(result).toContain("✅");
      expect(result.length).toBeGreaterThan(input.length - 2);
    });

    it("should fallback to native formatting for unsupported characters", () => {
      // Test that fallback mechanism works
      const input = "Hello 🌟 World";
      const result = FontFormatter.convert(input, FontStyle.BOLD);
      expect(result).toContain("🌟");
    });
  });

  describe("Currency Formatting", () => {
    it("should format currency with Rupiah symbol and thousand separators", () => {
      const result = FontFormatter.formatCurrency(500000);
      expect(result).toContain("Rp");
      expect(result).toContain("500");
      expect(result).toContain(".");
    });

    it("should format large amounts with multiple thousand separators", () => {
      const result = FontFormatter.formatCurrency(1250000);
      expect(result).toContain("Rp");
      expect(result).toContain("1.250.000");
    });

    it("should format zero amount", () => {
      const result = FontFormatter.formatCurrency(0);
      expect(result).toContain("Rp");
      expect(result).toContain("0");
    });

    it("should format negative amounts", () => {
      const result = FontFormatter.formatCurrency(-50000);
      expect(result).toContain("Rp");
      expect(result).toContain("-");
    });
  });

  describe("Performance", () => {
    it("should convert text in under 5ms for typical message", () => {
      const input = "Hello World 12345".repeat(10); // ~170 characters
      const start = Date.now();
      FontFormatter.convert(input, FontStyle.BOLD);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5);
    });

    it("should use cache for repeated conversions", () => {
      const input = "Hello";
      // First conversion
      const start1 = Date.now();
      FontFormatter.convert(input, FontStyle.BOLD);
      const duration1 = Date.now() - start1;

      // Second conversion (should be faster due to cache)
      const start2 = Date.now();
      FontFormatter.convert(input, FontStyle.BOLD);
      const duration2 = Date.now() - start2;

      // Second should be faster or similar (cache hit)
      expect(duration2).toBeLessThanOrEqual(duration1 + 1);
    });

    it("should handle long messages efficiently", () => {
      const input = "A".repeat(1000); // 1000 characters
      const start = Date.now();
      FontFormatter.convert(input, FontStyle.BOLD);
      const duration = Date.now() - start;
      // Should still be under 5ms even for long messages
      expect(duration).toBeLessThan(5);
    });
  });
});
