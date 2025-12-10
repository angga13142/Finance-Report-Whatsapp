/* eslint-disable no-useless-escape */
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

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    throw new Error("Email is required");
  }

  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  if (email.length > 254) {
    throw new Error("Email must not exceed 254 characters");
  }

  return true;
}

/**
 * Validate amount value is within acceptable range
 * @param amount - Amount to validate
 * @param min - Minimum allowed amount (default: 0)
 * @param max - Maximum allowed amount (default: 999,999,999.99)
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateAmountRange(
  amount: number,
  min: number = 0,
  max: number = 999999999.99,
  fieldName: string = "Amount",
): boolean {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (amount < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (amount > max) {
    throw new Error(`${fieldName} must not exceed ${max}`);
  }

  return true;
}

/**
 * Validate transaction category
 * @param category - Category name to validate
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateCategory(
  category: string,
  fieldName: string = "Category",
): boolean {
  validateStringLength(category, 1, 50, fieldName);

  // Only alphanumeric, spaces, and hyphens
  const categoryRegex = /^[a-zA-Z0-9\s\-]+$/;

  if (!categoryRegex.test(category)) {
    throw new Error(`${fieldName} can only contain letters, numbers, spaces, and hyphens`);
  }

  return true;
}

/**
 * Validate transaction description
 * @param description - Description to validate
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateDescription(
  description: string,
  fieldName: string = "Description",
): boolean {
  if (typeof description !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  // Max 255 characters for description
  validateStringLength(description, 0, 255, fieldName);

  return true;
}

/**
 * Validate date is within acceptable range
 * @param date - Date to validate
 * @param maxDaysInPast - Maximum days in the past (default: 30 days)
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateDateRange(
  date: Date | string,
  maxDaysInPast: number = 30,
  fieldName: string = "Date",
): boolean {
  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`${fieldName} must be a valid date`);
    }
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    throw new Error(`${fieldName} must be a Date object or ISO string`);
  }

  const now = new Date();
  const maxPastDate = new Date();
  maxPastDate.setDate(maxPastDate.getDate() - maxDaysInPast);

  // Date should not be in the future
  if (dateObj > now) {
    throw new Error(`${fieldName} cannot be in the future`);
  }

  // Date should not be more than maxDaysInPast days in the past
  if (dateObj < maxPastDate) {
    throw new Error(
      `${fieldName} cannot be more than ${maxDaysInPast} days in the past`,
    );
  }

  return true;
}

/**
 * Validate user name
 * @param name - Name to validate
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateUserName(
  name: string,
  fieldName: string = "Name",
): boolean {
  validateStringLength(name, 2, 100, fieldName);

  // Allow letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s\-']+$/;

  if (!nameRegex.test(name)) {
    throw new Error(
      `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`,
    );
  }

  return true;
}

/**
 * Validate user password strength
 * @param password - Password to validate
 * @param minLength - Minimum password length (default: 8)
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validatePasswordStrength(
  password: string,
  minLength: number = 8,
): boolean {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }

  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters`);
  }

  // Password must contain at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter");
  }

  // Password must contain at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    throw new Error("Password must contain at least one lowercase letter");
  }

  // Password must contain at least one digit
  if (!/\d/.test(password)) {
    throw new Error("Password must contain at least one digit");
  }

  // Password must contain at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    throw new Error("Password must contain at least one special character");
  }

  return true;
}

/**
 * Validate list of items (e.g., tags, categories)
 * @param items - Array of items to validate
 * @param maxItems - Maximum number of items allowed
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateItemList(
  items: unknown,
  maxItems: number = 50,
  fieldName: string = "Items",
): boolean {
  if (!Array.isArray(items)) {
    throw new Error(`${fieldName} must be an array`);
  }

  if (items.length === 0) {
    throw new Error(`${fieldName} must contain at least one item`);
  }

  if (items.length > maxItems) {
    throw new Error(`${fieldName} must not contain more than ${maxItems} items`);
  }

  // Validate all items are strings
  if (!items.every((item) => typeof item === "string")) {
    throw new Error(`${fieldName} must contain only strings`);
  }

  return true;
}

/**
 * Validate numeric range
 * @param value - Value to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = "Value",
): boolean {
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (value < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (value > max) {
    throw new Error(`${fieldName} must not exceed ${max}`);
  }

  return true;
}

/**
 * Validate boolean value
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateBoolean(
  value: unknown,
  fieldName: string = "Value",
): value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean (true or false)`);
  }

  return true;
}

/**
 * Validate input is not empty or just whitespace
 * @param value - String to validate
 * @param fieldName - Field name for error message
 * @returns true if valid
 * @throws {Error} If invalid
 */
export function validateRequired(
  value: unknown,
  fieldName: string = "Field",
): boolean {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    throw new Error(`${fieldName} is required`);
  }

  return true;
}
