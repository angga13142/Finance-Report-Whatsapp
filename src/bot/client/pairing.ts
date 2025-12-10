/**
 * WhatsApp Pairing Code Authentication Helper
 * Alternative authentication method using phone number pairing code
 * instead of QR code scanning
 */

import { Client } from "whatsapp-web.js";
import { logger } from "../../lib/logger";

/**
 * Pairing code configuration options
 */
export interface PairingCodeOptions {
  /**
   * Phone number in international format without symbols
   * @example "6281234567890" for Indonesia
   * @example "12025550108" for US
   * @example "551155501234" for Brazil
   */
  phoneNumber: string;

  /**
   * Show notification on phone to pair
   * @default true
   */
  showNotification?: boolean;

  /**
   * Interval in milliseconds to regenerate pairing code
   * WhatsApp default is 3 minutes (180000ms)
   * @default 180000
   */
  intervalMs?: number;
}

/**
 * Request pairing code for WhatsApp authentication
 *
 * @param client - WhatsApp client instance
 * @param options - Pairing code configuration options
 * @returns Promise<string> - Returns pairing code in format "ABCDEFGH"
 *
 * @example
 * ```typescript
 * const pairingCode = await requestPairingCode(client, {
 *   phoneNumber: "6281234567890",
 *   showNotification: true,
 *   intervalMs: 180000
 * });
 * console.log(`Your pairing code: ${pairingCode}`);
 * ```
 */
export async function requestPairingCode(
  client: Client,
  options: PairingCodeOptions,
): Promise<string> {
  try {
    const {
      phoneNumber,
      showNotification = true,
      intervalMs = 180000, // 3 minutes
    } = options;

    logger.info("Requesting pairing code authentication", {
      phoneNumber: maskPhoneNumber(phoneNumber),
      showNotification,
      intervalMs,
    });

    // Request pairing code from WhatsApp
    const pairingCode = await client.requestPairingCode(
      phoneNumber,
      showNotification,
      intervalMs,
    );

    logger.info("Pairing code received successfully", {
      code: pairingCode,
      phoneNumber: maskPhoneNumber(phoneNumber),
    });

    return pairingCode;
  } catch (error) {
    logger.error("Failed to request pairing code", {
      error,
      phoneNumber: maskPhoneNumber(options.phoneNumber),
    });
    throw error;
  }
}

/**
 * Format phone number for pairing code authentication
 * Removes all non-numeric characters and ensures international format
 *
 * @param phoneNumber - Raw phone number (can include +, spaces, dashes)
 * @returns Formatted phone number (digits only)
 *
 * @example
 * ```typescript
 * formatPhoneNumber("+62 812-3456-7890") // Returns "6281234567890"
 * formatPhoneNumber("1 (202) 555-0108")  // Returns "12025550108"
 * ```
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Remove leading zeros (but keep country code)
  const withoutLeadingZeros = cleaned.replace(/^0+/, "");

  return withoutLeadingZeros;
}

/**
 * Validate phone number format for pairing code
 *
 * @param phoneNumber - Phone number to validate
 * @returns boolean - true if valid, false otherwise
 *
 * @example
 * ```typescript
 * validatePhoneNumber("6281234567890")  // true
 * validatePhoneNumber("12025550108")    // true
 * validatePhoneNumber("invalid")        // false
 * ```
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  const formatted = formatPhoneNumber(phoneNumber);

  // Check if it's all digits and has reasonable length (7-15 digits)
  return /^\d{7,15}$/.test(formatted);
}

/**
 * Mask phone number for logging (privacy protection)
 * Shows only first 2 and last 4 digits
 *
 * @param phoneNumber - Phone number to mask
 * @returns Masked phone number
 *
 * @example
 * ```typescript
 * maskPhoneNumber("6281234567890")  // "62 ****7890"
 * ```
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 6) {
    return "****";
  }

  const formatted = formatPhoneNumber(phoneNumber);
  const first = formatted.slice(0, 2);
  const last = formatted.slice(-4);
  const masked = "****";

  return `${first} ${masked}${last}`;
}

/**
 * Setup pairing code authentication for WhatsApp client
 * This configures the client to use pairing code instead of QR code
 *
 * @param phoneNumber - Phone number for pairing
 * @param options - Optional pairing configuration
 * @returns Client options with pairing code configuration
 *
 * @example
 * ```typescript
 * const client = new Client({
 *   ...setupPairingAuthentication("6281234567890", {
 *     showNotification: true,
 *     intervalMs: 180000
 *   }),
 *   authStrategy: new LocalAuth()
 * });
 * ```
 */
export function setupPairingAuthentication(
  phoneNumber: string,
  options: Partial<Omit<PairingCodeOptions, "phoneNumber">> = {},
) {
  const formatted = formatPhoneNumber(phoneNumber);

  if (!validatePhoneNumber(formatted)) {
    throw new Error(
      `Invalid phone number format: ${phoneNumber}. Expected international format without symbols (e.g., 6281234567890)`,
    );
  }

  return {
    pairWithPhoneNumber: {
      phoneNumber: formatted,
      showNotification: options.showNotification ?? true,
      intervalMs: options.intervalMs ?? 180000,
    },
  };
}

/**
 * Helper function to handle pairing code events
 * Logs pairing code when received and provides instructions
 *
 * @param client - WhatsApp client instance
 * @param callback - Optional callback to handle pairing code
 *
 * @example
 * ```typescript
 * setupPairingCodeHandler(client, (code) => {
 *   console.log(`\n=== PAIRING CODE ===\n${code}\n===================\n`);
 * });
 * ```
 */
export function setupPairingCodeHandler(
  client: Client,
  callback?: (code: string) => void,
): void {
  client.on("code", (code: string) => {
    logger.info("Pairing code received", { code });

    // Display pairing code prominently
    console.log("\n" + "=".repeat(50));
    console.log("🔐 WHATSAPP PAIRING CODE");
    console.log("=".repeat(50));
    console.log(`\nYour pairing code: ${code}\n`);
    console.log("Instructions:");
    console.log("1. Open WhatsApp on your phone");
    console.log("2. Go to Settings → Linked Devices");
    console.log("3. Tap 'Link a Device'");
    console.log("4. Tap 'Link with phone number instead'");
    console.log(`5. Enter this code: ${code}`);
    console.log("\n" + "=".repeat(50) + "\n");

    if (callback) {
      callback(code);
    }
  });
}

/**
 * Complete pairing code authentication setup
 * Creates a WhatsApp client configured for pairing code authentication
 *
 * @param phoneNumber - Phone number for pairing
 * @param clientOptions - Additional WhatsApp client options
 * @returns Configured WhatsApp client
 *
 * @example
 * ```typescript
 * const client = createPairingClient("6281234567890", {
 *   authStrategy: new LocalAuth(),
 *   puppeteer: { headless: true }
 * });
 *
 * client.on("authenticated", () => {
 *   console.log("Successfully authenticated with pairing code!");
 * });
 *
 * await client.initialize();
 * ```
 */
export function createPairingClient(
  phoneNumber: string,
  clientOptions: Record<string, unknown> = {},
): Client {
  logger.info("Creating WhatsApp client with pairing code authentication", {
    phoneNumber: maskPhoneNumber(phoneNumber),
  });

  const pairingOptions = setupPairingAuthentication(phoneNumber);

  const client = new Client({
    ...clientOptions,
    ...pairingOptions,
  });

  // Setup pairing code event handler
  setupPairingCodeHandler(client);

  // Setup authentication success handler
  client.on("authenticated", () => {
    logger.info("WhatsApp authenticated successfully via pairing code", {
      phoneNumber: maskPhoneNumber(phoneNumber),
    });
  });

  // Setup authentication failure handler
  client.on("auth_failure", (error) => {
    logger.error("WhatsApp authentication failed", {
      error,
      phoneNumber: maskPhoneNumber(phoneNumber),
    });
  });

  return client;
}

/**
 * Export all pairing utilities
 */
export default {
  requestPairingCode,
  formatPhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
  setupPairingAuthentication,
  setupPairingCodeHandler,
  createPairingClient,
};
