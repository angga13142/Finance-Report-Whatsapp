import { Decimal } from '@prisma/client/runtime/library';

/**
 * Currency formatting utilities for Indonesian Rupiah (Rp)
 */

/**
 * Format amount to Indonesian Rupiah string
 * @param amount - Amount as Decimal, number, or string
 * @returns Formatted string like "Rp 500.000"
 */
export function formatCurrency(amount: Decimal | number | string): string {
  const decimal = typeof amount === 'string' || typeof amount === 'number' 
    ? new Decimal(amount) 
    : amount;
  
  const numValue = decimal.toNumber();
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);

  return formatted;
}

/**
 * Parse amount input (accepts multiple formats: 500000, 500.000, 500,000)
 * @param input - Amount string input
 * @returns Decimal value
 * @throws {Error} If input is invalid
 */
export function parseAmount(input: string): Decimal {
  // Remove all non-digit characters except decimal point
  const cleaned = input.replace(/[^\d,.]/g, '');
  
  // Replace comma with dot for decimal separator, or remove for thousand separator
  let normalized = cleaned;
  
  // Check if comma is used as thousand separator (e.g., 500,000)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    normalized = cleaned.replace(/,/g, '');
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Check if dot is used as thousand separator (e.g., 500.000)
    // If there are multiple dots, it's likely thousand separator
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1 || (dotCount === 1 && cleaned.split('.')[0].length > 3)) {
      normalized = cleaned.replace(/\./g, '');
    }
    // Otherwise, dot is decimal separator (keep as is)
  } else {
    // Mixed or unclear format, try to parse as-is
    normalized = cleaned.replace(/,/g, '');
  }

  const numValue = parseFloat(normalized);
  
  if (isNaN(numValue) || numValue <= 0) {
    throw new Error('Invalid amount format. Please enter a positive number.');
  }

  return new Decimal(numValue);
}

/**
 * Validate amount is within acceptable range
 * @param amount - Amount to validate
 * @param min - Minimum amount (default: 0.01)
 * @param max - Maximum amount (default: 500,000,000)
 * @returns true if valid
 * @throws {Error} If amount is out of range
 */
export function validateAmountRange(
  amount: Decimal | number | string,
  min: number = 0.01,
  max: number = 500_000_000
): boolean {
  const decimal = typeof amount === 'string' || typeof amount === 'number'
    ? new Decimal(amount)
    : amount;
  
  const numValue = decimal.toNumber();
  
  if (numValue < min) {
    throw new Error(`Amount must be at least ${formatCurrency(min)}`);
  }
  
  if (numValue > max) {
    throw new Error(`Amount cannot exceed ${formatCurrency(max)}`);
  }
  
  return true;
}

/**
 * Convert Decimal to number (for calculations)
 * @param amount - Decimal amount
 * @returns Number value
 */
export function toNumber(amount: Decimal): number {
  return amount.toNumber();
}

/**
 * Convert number to Decimal
 * @param amount - Number amount
 * @returns Decimal value
 */
export function toDecimal(amount: number | string): Decimal {
  return new Decimal(amount);
}

