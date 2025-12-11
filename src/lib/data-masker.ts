/**
 * Data masking utility for sensitive information
 * Masks phone numbers (last 4 digits) and message content (type+length only)
 */

/**
 * Mask phone number - shows only last 4 digits
 * @param phone - Phone number to mask
 * @returns Masked phone number (e.g., "+62****6789")
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) {
    return "****";
  }

  const cleaned = phone.replace(/\D/g, ""); // Remove non-digits
  if (cleaned.length < 4) {
    return "****";
  }

  const lastFour = cleaned.slice(-4);
  return `+62****${lastFour}`;
}

/**
 * Mask message content - shows only type and length
 * @param message - Message content to mask
 * @param messageType - Type of message (text, image, video, etc.)
 * @returns Masked message info (e.g., "text (25 chars)")
 */
export function maskMessageContent(
  message: string | null | undefined,
  messageType: string = "text",
): string {
  if (!message) {
    return `${messageType} (0 chars)`;
  }

  const length = typeof message === "string" ? message.length : 0;
  return `${messageType} (${length} chars)`;
}

/**
 * Mask sensitive data in an object
 * Recursively masks phone numbers and message content
 * @param data - Data object to mask
 * @returns Masked data object
 */
export function maskSensitiveData(data: unknown): unknown {
  if (typeof data === "string") {
    // Check if it looks like a phone number
    if (/^(\+62|0|62)\d{8,12}$/.test(data)) {
      return maskPhoneNumber(data);
    }
    return data;
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      const keyLower = key.toLowerCase();

      // Mask phone numbers
      if (
        keyLower.includes("phone") ||
        keyLower === "phone" ||
        keyLower === "phonenumber"
      ) {
        masked[key] = maskPhoneNumber(String(value));
      }
      // Mask message content
      else if (
        keyLower.includes("message") ||
        keyLower.includes("content") ||
        keyLower.includes("text")
      ) {
        const messageType =
          (data as Record<string, unknown>).type?.toString() || "text";
        masked[key] = maskMessageContent(String(value), messageType);
      }
      // Recursively mask nested objects
      else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  return data;
}

export default {
  maskPhoneNumber,
  maskMessageContent,
  maskSensitiveData,
};
