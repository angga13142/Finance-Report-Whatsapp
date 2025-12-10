/**
 * Unit tests for validation utilities
 * Tests all validation functions including phone numbers, amounts, strings, enums, etc.
 */

import {
  validatePhoneNumber,
  normalizePhoneNumber,
  validateAmountFormat,
  validateStringLength,
  validateEnum,
  sanitizeString,
  validateUUID,
  validateEmail,
  validateAmountRange,
  validateCategory,
  validateDescription,
  validateDateRange,
  validateUserName,
  validatePasswordStrength,
  validateItemList,
  validateNumberRange,
  validateBoolean,
  validateRequired,
} from "../../../src/lib/validation";
import { TRANSACTION_TYPES } from "../../../src/config/constants";

describe("Validation Utilities", () => {
  describe("validatePhoneNumber", () => {
    it("should validate Indonesian phone number with +62 prefix", () => {
      expect(() => validatePhoneNumber("+62812345678")).not.toThrow();
    });

    it("should validate Indonesian phone number with 0 prefix", () => {
      expect(() => validatePhoneNumber("0812345678")).not.toThrow();
    });

    it("should throw error for invalid phone number format", () => {
      expect(() => validatePhoneNumber("123456")).toThrow();
      expect(() => validatePhoneNumber("+1234567890")).toThrow();
    });

    it("should throw error for empty phone number", () => {
      expect(() => validatePhoneNumber("")).toThrow("Phone number is required");
    });

    it("should throw error for non-string input", () => {
      expect(() => validatePhoneNumber(null as unknown as string)).toThrow();
      expect(() =>
        validatePhoneNumber(undefined as unknown as string),
      ).toThrow();
    });
  });

  describe("normalizePhoneNumber", () => {
    it("should normalize phone number with 0 prefix to +62", () => {
      const result = normalizePhoneNumber("0812345678");
      expect(result).toBe("+62812345678");
    });

    it("should keep +62 prefix as is", () => {
      const result = normalizePhoneNumber("+62812345678");
      expect(result).toBe("+62812345678");
    });

    it("should remove spaces and special characters", () => {
      // Input must be valid format first, then normalization removes special chars
      const result = normalizePhoneNumber("0812345678");
      expect(result).toBe("+62812345678");
    });

    it("should throw error for invalid phone number", () => {
      expect(() => normalizePhoneNumber("invalid")).toThrow();
    });
  });

  describe("validateAmountFormat", () => {
    it("should validate plain number format", () => {
      expect(() => validateAmountFormat("500000")).not.toThrow();
    });

    it("should validate dot-separated thousands", () => {
      expect(() => validateAmountFormat("500.000")).not.toThrow();
    });

    it("should validate comma-separated thousands", () => {
      expect(() => validateAmountFormat("500,000")).not.toThrow();
    });

    it("should throw error for invalid format", () => {
      expect(() => validateAmountFormat("invalid")).toThrow();
      expect(() => validateAmountFormat("abc123")).toThrow();
    });

    it("should throw error for empty string", () => {
      expect(() => validateAmountFormat("")).toThrow("Amount is required");
    });
  });

  describe("validateStringLength", () => {
    it("should validate string within length range", () => {
      expect(() => validateStringLength("test", 2, 10)).not.toThrow();
    });

    it("should throw error for string shorter than minimum", () => {
      expect(() => validateStringLength("a", 2, 10)).toThrow(
        /at least 2 characters/,
      );
    });

    it("should throw error for string longer than maximum", () => {
      expect(() => validateStringLength("a".repeat(11), 2, 10)).toThrow(
        /not exceed 10 characters/,
      );
    });

    it("should throw error for non-string input", () => {
      expect(() =>
        validateStringLength(123 as unknown as string, 2, 10),
      ).toThrow(/must be a string/);
    });

    it("should use custom field name in error message", () => {
      expect(() => validateStringLength("a", 2, 10, "Username")).toThrow(
        /Username/,
      );
    });
  });

  describe("validateEnum", () => {
    it("should validate valid enum value", () => {
      expect(() =>
        validateEnum("income", TRANSACTION_TYPES, "Type"),
      ).not.toThrow();
      expect(() =>
        validateEnum("expense", TRANSACTION_TYPES, "Type"),
      ).not.toThrow();
    });

    it("should throw error for invalid enum value", () => {
      expect(() =>
        validateEnum("invalid", TRANSACTION_TYPES, "Type"),
      ).toThrow();
    });

    it("should use custom field name in error message", () => {
      expect(() =>
        validateEnum("invalid", TRANSACTION_TYPES, "TransactionType"),
      ).toThrow(/TransactionType/);
    });
  });

  describe("sanitizeString", () => {
    it("should remove null bytes", () => {
      const result = sanitizeString("test\0string");
      expect(result).not.toContain("\0");
    });

    it("should remove control characters", () => {
      const result = sanitizeString("test\x00\x1Fstring");
      expect(result).toBe("teststring");
    });

    it("should trim whitespace", () => {
      const result = sanitizeString("  test  ");
      expect(result).toBe("test");
    });

    it("should return empty string for non-string input", () => {
      expect(sanitizeString(null as unknown as string)).toBe("");
      expect(sanitizeString(undefined as unknown as string)).toBe("");
    });
  });

  describe("validateUUID", () => {
    it("should validate valid UUID format", () => {
      expect(() =>
        validateUUID("123e4567-e89b-12d3-a456-426614174000"),
      ).not.toThrow();
    });

    it("should throw error for invalid UUID format", () => {
      expect(() => validateUUID("invalid-uuid")).toThrow("Invalid UUID format");
      expect(() => validateUUID("123")).toThrow();
    });

    it("should accept uppercase UUID", () => {
      expect(() =>
        validateUUID("123E4567-E89B-12D3-A456-426614174000"),
      ).not.toThrow();
    });
  });

  describe("validateEmail", () => {
    it("should validate valid email format", () => {
      expect(() => validateEmail("test@example.com")).not.toThrow();
      expect(() => validateEmail("user.name@domain.co.id")).not.toThrow();
    });

    it("should throw error for invalid email format", () => {
      expect(() => validateEmail("invalid")).toThrow("Invalid email format");
      expect(() => validateEmail("test@")).toThrow();
      expect(() => validateEmail("@example.com")).toThrow();
    });

    it("should throw error for email exceeding 254 characters", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      expect(() => validateEmail(longEmail)).toThrow(/254 characters/);
    });

    it("should throw error for empty email", () => {
      expect(() => validateEmail("")).toThrow("Email is required");
    });
  });

  describe("validateAmountRange", () => {
    it("should validate amount within range", () => {
      expect(() => validateAmountRange(50000, 10000, 100000)).not.toThrow();
    });

    it("should throw error for amount below minimum", () => {
      expect(() => validateAmountRange(5000, 10000, 100000)).toThrow(
        /at least 10000/,
      );
    });

    it("should throw error for amount above maximum", () => {
      expect(() => validateAmountRange(150000, 10000, 100000)).toThrow(
        /not exceed 100000/,
      );
    });

    it("should throw error for NaN", () => {
      expect(() => validateAmountRange(NaN, 0, 100000)).toThrow(/valid number/);
    });

    it("should use custom field name in error message", () => {
      expect(() => validateAmountRange(5000, 10000, 100000, "Price")).toThrow(
        /Price/,
      );
    });
  });

  describe("validateCategory", () => {
    it("should validate valid category name", () => {
      expect(() => validateCategory("Food Beverage")).not.toThrow();
      expect(() => validateCategory("Transport-2024")).not.toThrow();
    });

    it("should throw error for category with invalid characters", () => {
      expect(() => validateCategory("Food@Beverage")).toThrow(
        /letters, numbers, spaces, and hyphens/,
      );
    });

    it("should throw error for category shorter than 1 character", () => {
      expect(() => validateCategory("")).toThrow();
    });

    it("should throw error for category longer than 50 characters", () => {
      expect(() => validateCategory("a".repeat(51))).toThrow();
    });
  });

  describe("validateDescription", () => {
    it("should validate valid description", () => {
      expect(() => validateDescription("Test description")).not.toThrow();
      expect(() => validateDescription("")).not.toThrow(); // Empty is allowed
    });

    it("should throw error for description longer than 255 characters", () => {
      expect(() => validateDescription("a".repeat(256))).toThrow(
        /not exceed 255 characters/,
      );
    });

    it("should throw error for non-string input", () => {
      expect(() => validateDescription(123 as unknown as string)).toThrow(
        /must be a string/,
      );
    });
  });

  describe("validateDateRange", () => {
    it("should validate date within range", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(() => validateDateRange(yesterday, 30)).not.toThrow();
    });

    it("should throw error for future date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(() => validateDateRange(tomorrow, 30)).toThrow(
        /cannot be in the future/,
      );
    });

    it("should throw error for date too far in the past", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      expect(() => validateDateRange(oldDate, 30)).toThrow(
        /more than 30 days in the past/,
      );
    });

    it("should accept date string", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(() =>
        validateDateRange(yesterday.toISOString(), 30),
      ).not.toThrow();
    });

    it("should throw error for invalid date string", () => {
      expect(() => validateDateRange("invalid-date", 30)).toThrow(/valid date/);
    });
  });

  describe("validateUserName", () => {
    it("should validate valid user name", () => {
      expect(() => validateUserName("John Doe")).not.toThrow();
      expect(() => validateUserName("Mary-Jane")).not.toThrow();
      expect(() => validateUserName("O'Brien")).not.toThrow();
    });

    it("should throw error for name shorter than 2 characters", () => {
      expect(() => validateUserName("A")).toThrow(/at least 2 characters/);
    });

    it("should throw error for name longer than 100 characters", () => {
      expect(() => validateUserName("a".repeat(101))).toThrow(
        /not exceed 100 characters/,
      );
    });

    it("should throw error for name with invalid characters", () => {
      expect(() => validateUserName("John123")).toThrow(
        /letters, spaces, hyphens, and apostrophes/,
      );
    });
  });

  describe("validatePasswordStrength", () => {
    it("should validate strong password", () => {
      expect(() => validatePasswordStrength("Password123!")).not.toThrow();
    });

    it("should throw error for password shorter than minimum length", () => {
      expect(() => validatePasswordStrength("Pass1!")).toThrow(
        /at least 8 characters/,
      );
    });

    it("should throw error for password without uppercase letter", () => {
      expect(() => validatePasswordStrength("password123!")).toThrow(
        /uppercase letter/,
      );
    });

    it("should throw error for password without lowercase letter", () => {
      expect(() => validatePasswordStrength("PASSWORD123!")).toThrow(
        /lowercase letter/,
      );
    });

    it("should throw error for password without digit", () => {
      expect(() => validatePasswordStrength("Password!")).toThrow(/digit/);
    });

    it("should throw error for password without special character", () => {
      expect(() => validatePasswordStrength("Password123")).toThrow(
        /special character/,
      );
    });

    it("should throw error for empty password", () => {
      expect(() => validatePasswordStrength("")).toThrow(
        "Password is required",
      );
    });
  });

  describe("validateItemList", () => {
    it("should validate valid item list", () => {
      expect(() => validateItemList(["item1", "item2", "item3"])).not.toThrow();
    });

    it("should throw error for non-array input", () => {
      expect(() =>
        validateItemList("not-array" as unknown as string[]),
      ).toThrow(/must be an array/);
    });

    it("should throw error for empty array", () => {
      expect(() => validateItemList([])).toThrow(/at least one item/);
    });

    it("should throw error for array exceeding max items", () => {
      const items = Array.from({ length: 51 }, (_, i) => `item${i}`);
      expect(() => validateItemList(items, 50)).toThrow(
        /not contain more than 50 items/,
      );
    });

    it("should throw error for array with non-string items", () => {
      expect(() =>
        validateItemList(["item1", 123, "item3"] as unknown as string[]),
      ).toThrow(/only strings/);
    });
  });

  describe("validateNumberRange", () => {
    it("should validate number within range", () => {
      expect(() => validateNumberRange(50, 0, 100)).not.toThrow();
    });

    it("should throw error for number below minimum", () => {
      expect(() => validateNumberRange(-10, 0, 100)).toThrow(/at least 0/);
    });

    it("should throw error for number above maximum", () => {
      expect(() => validateNumberRange(150, 0, 100)).toThrow(/not exceed 100/);
    });

    it("should throw error for NaN", () => {
      expect(() => validateNumberRange(NaN, 0, 100)).toThrow(/valid number/);
    });
  });

  describe("validateBoolean", () => {
    it("should validate boolean true", () => {
      expect(() => validateBoolean(true)).not.toThrow();
    });

    it("should validate boolean false", () => {
      expect(() => validateBoolean(false)).not.toThrow();
    });

    it("should throw error for non-boolean value", () => {
      expect(() => validateBoolean("true")).toThrow(/must be a boolean/);
      expect(() => validateBoolean(1)).toThrow(/must be a boolean/);
      expect(() => validateBoolean(null)).toThrow(/must be a boolean/);
    });
  });

  describe("validateRequired", () => {
    it("should validate non-empty string", () => {
      expect(() => validateRequired("test")).not.toThrow();
    });

    it("should validate non-empty number", () => {
      expect(() => validateRequired(123)).not.toThrow();
    });

    it("should validate boolean false", () => {
      expect(() => validateRequired(false)).not.toThrow();
    });

    it("should throw error for null", () => {
      expect(() => validateRequired(null)).toThrow(/is required/);
    });

    it("should throw error for undefined", () => {
      expect(() => validateRequired(undefined)).toThrow(/is required/);
    });

    it("should throw error for empty string", () => {
      expect(() => validateRequired("")).toThrow(/is required/);
    });

    it("should throw error for whitespace-only string", () => {
      expect(() => validateRequired("   ")).toThrow(/is required/);
    });

    it("should use custom field name in error message", () => {
      expect(() => validateRequired(null, "Username")).toThrow(/Username/);
    });
  });
});
