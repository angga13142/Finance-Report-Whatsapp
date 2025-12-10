/**
 * Common test utilities and helpers
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Create a mock Decimal value
 */
export function createMockDecimal(value: string | number): Decimal {
  return new Decimal(value);
}

/**
 * Create a mock date
 */
export function createMockDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides?: Partial<any>): any {
  return {
    id: "user123",
    phoneNumber: "+62812345678",
    name: "Test User",
    role: "employee",
    isActive: true,
    createdAt: new Date(),
    lastActive: new Date(),
    authTokenHash: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    ...overrides,
  };
}

/**
 * Create a mock transaction object
 */
export function createMockTransaction(overrides?: Partial<any>): any {
  return {
    id: "txn123",
    userId: "user123",
    type: "expense",
    category: "Food",
    amount: new Decimal(50000),
    description: "Test transaction",
    approvalStatus: "approved",
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    archivedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock category object
 */
export function createMockCategory(overrides?: Partial<any>): any {
  return {
    id: "cat123",
    name: "Food",
    type: "expense",
    icon: "🍔",
    isActive: true,
    createdAt: new Date(),
    createdByUserId: null,
    ...overrides,
  };
}
