import { PHONE_NUMBER_REGEX, AMOUNT_INPUT_PATTERNS } from "../config/constants";
import { parseAmount } from "./currency";

/**
 * Input validation helpers
 */

/**
 * Validate Indonesian phone number format
 * @param phoneNumber - Phone number to validate
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    throw new Error("Phone number is required");
  }

  if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
    throw new Error(
      "Phone number must be in Indonesian format: +62XXXXXXXXXX or 0XXXXXXXXXX",
    );
  }

  return true;
}

/**
 * Normalize phone number to +62 format
 * @param phoneNumber - Phone number to normalize
 * @returns Normalized phone number
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  validatePhoneNumber(phoneNumber);

  // Remove spaces and special characters
  const cleaned = phoneNumber.replace(/[\s\-()]/g, "");

  // Convert 0 prefix to +62
  if (cleaned.startsWith("0")) {
    return "+62" + cleaned.substring(1);
  }

  // Ensure +62 prefix
  if (!cleaned.startsWith("+62")) {
    throw new Error("Phone number must start with +62 or 0");
  }

  return cleaned;
}

/**
 * Validate amount input format
 * @param input - Amount string input
 * @returns true if valid format
 * @throws {Error} If invalid
 */
export function validateAmountFormat(input: string): boolean {
  if (!input || typeof input !== "string") {
    throw new Error("Amount is required");
  }

  // Check if input matches any valid pattern
  const isValid = AMOUNT_INPUT_PATTERNS.some((pattern) => pattern.test(input));

  if (!isValid) {
    throw new Error("Invalid amount format. Use: 500000, 500.000, or 500,000");
  }

  // Try to parse to ensure it's a valid number
  try {
    parseAmount(input);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    throw new Error("Invalid amount value");
  }

  return true;
}

/**
 * Validate string length
 * @param value - String to validate
 * @param min - Minimum length
 * @param max - Maximum length
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName: string = "Field",
): boolean {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  if (value.length < min) {
    throw new Error(`${fieldName} must be at least ${min} characters`);
  }

  if (value.length > max) {
    throw new Error(`${fieldName} must not exceed ${max} characters`);
  }

  return true;
}

/**
 * Validate enum value
 * @param value - Value to validate
 * @param enumObject - Enum object
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateEnum<T extends Record<string, string>>(
  value: string,
  enumObject: T,
  fieldName: string = "Field",
): value is T[keyof T] {
  const validValues = Object.values(enumObject);

  if (!validValues.includes(value as T[keyof T])) {
    throw new Error(`${fieldName} must be one of: ${validValues.join(", ")}`);
  }

  return true;
}

/**
 * Sanitize string input (remove dangerous characters)
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex
  return (
    input
      .replace(/\0/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim()
  );
}

/**
 * Validate UUID format
 * @param uuid - UUID string to validate
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    throw new Error("Invalid UUID format");
  }

  return true;
}
