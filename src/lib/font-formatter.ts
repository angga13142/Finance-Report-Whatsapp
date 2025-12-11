/**
 * Font Formatter
 * Provides Unicode font conversion utilities with character mapping tables
 * Uses Unicode Mathematical Alphanumeric Symbols (U+1D400 to U+1D7FF)
 */

/**
 * Font style options
 */
export enum FontStyle {
  BOLD = "bold",
  ITALIC = "italic",
  MONOSPACE = "monospace",
  SCRIPT = "script",
}

/**
 * Character mapping cache for performance optimization
 */
class CharacterMappingCache {
  private cache: Map<string, string> = new Map();
  private maxSize = 10000; // Limit cache size to ~1MB (assuming ~100 bytes per entry)

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

/**
 * Font Formatter with Unicode character mapping
 */
export class FontFormatter {
  private static cache = new CharacterMappingCache();

  // Unicode ranges for Mathematical Alphanumeric Symbols
  // Bold: U+1D400-1D433 (A-Z), U+1D434-1D467 (a-z), U+1D7CE-1D7D7 (0-9)
  private static readonly BOLD_UPPER_START = 0x1d400;
  private static readonly BOLD_LOWER_START = 0x1d434;
  private static readonly BOLD_DIGIT_START = 0x1d7ce;

  // Italic: U+1D434-1D467 (A-Z), U+1D468-1D49B (a-z), U+1D7CE-1D7D7 (0-9)
  private static readonly ITALIC_UPPER_START = 0x1d434;
  private static readonly ITALIC_LOWER_START = 0x1d468;
  private static readonly ITALIC_DIGIT_START = 0x1d7ce;

  // Monospace: U+1D670-1D6A3 (A-Z), U+1D68A-1D6BD (a-z), U+1D7F6-1D7FF (0-9)
  private static readonly MONOSPACE_UPPER_START = 0x1d670;
  private static readonly MONOSPACE_LOWER_START = 0x1d68a;
  private static readonly MONOSPACE_DIGIT_START = 0x1d7f6;

  // Script: U+1D49C-1D4CF (A-Z), U+1D4D0-1D503 (a-z)
  private static readonly SCRIPT_UPPER_START = 0x1d49c;
  private static readonly SCRIPT_LOWER_START = 0x1d4d0;

  /**
   * Convert text to specified font style using Unicode mathematical symbols
   * @param text - Input text to convert
   * @param style - Font style (bold, italic, monospace, script)
   * @returns Converted text with Unicode characters
   */
  static convert(text: string, style: FontStyle): string {
    if (!text) {
      return text;
    }

    // Check cache first
    const cacheKey = `${style}:${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let result = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const codePoint = char.codePointAt(0);

      if (codePoint === undefined) {
        result += char;
        continue;
      }

      // Check if character is supported for conversion
      const converted = this.convertCharacter(char, codePoint, style);
      result += converted;
    }

    // Cache the result
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Convert a single character to Unicode mathematical symbol
   */
  private static convertCharacter(
    char: string,
    codePoint: number,
    style: FontStyle,
  ): string {
    // Uppercase A-Z (65-90)
    if (codePoint >= 65 && codePoint <= 90) {
      const offset = codePoint - 65;
      switch (style) {
        case FontStyle.BOLD:
          return String.fromCodePoint(this.BOLD_UPPER_START + offset);
        case FontStyle.ITALIC:
          return String.fromCodePoint(this.ITALIC_UPPER_START + offset);
        case FontStyle.MONOSPACE:
          return String.fromCodePoint(this.MONOSPACE_UPPER_START + offset);
        case FontStyle.SCRIPT:
          return String.fromCodePoint(this.SCRIPT_UPPER_START + offset);
        default:
          return char;
      }
    }

    // Lowercase a-z (97-122)
    if (codePoint >= 97 && codePoint <= 122) {
      const offset = codePoint - 97;
      switch (style) {
        case FontStyle.BOLD:
          return String.fromCodePoint(this.BOLD_LOWER_START + offset);
        case FontStyle.ITALIC:
          return String.fromCodePoint(this.ITALIC_LOWER_START + offset);
        case FontStyle.MONOSPACE:
          return String.fromCodePoint(this.MONOSPACE_LOWER_START + offset);
        case FontStyle.SCRIPT:
          return String.fromCodePoint(this.SCRIPT_LOWER_START + offset);
        default:
          return char;
      }
    }

    // Digits 0-9 (48-57)
    if (codePoint >= 48 && codePoint <= 57) {
      const offset = codePoint - 48;
      switch (style) {
        case FontStyle.BOLD:
          return String.fromCodePoint(this.BOLD_DIGIT_START + offset);
        case FontStyle.ITALIC:
          return String.fromCodePoint(this.ITALIC_DIGIT_START + offset);
        case FontStyle.MONOSPACE:
          return String.fromCodePoint(this.MONOSPACE_DIGIT_START + offset);
        case FontStyle.SCRIPT:
          // Script doesn't have number variants, preserve original
          return char;
        default:
          return char;
      }
    }

    // Preserve unsupported characters (emojis, special symbols, punctuation, spaces)
    return char;
  }

  /**
   * Format currency amount with Rupiah symbol and thousand separators
   * @param amount - Amount as number
   * @returns Formatted string like "Rp 500.000"
   */
  static formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) {
      return "Rp 0";
    }

    // Format with thousand separators (dots)
    const formatted = Math.abs(numAmount)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    const sign = numAmount < 0 ? "-" : "";
    return `${sign}Rp ${formatted}`;
  }

  /**
   * Apply visual hierarchy to message text
   * @param text - Text to format
   * @param options - Formatting options
   * @returns Formatted text
   */
  static formatWithHierarchy(
    text: string,
    options: {
      header?: boolean;
      numeric?: boolean;
      emphasis?: boolean;
    } = {},
  ): string {
    if (options.header) {
      return this.convert(text, FontStyle.BOLD);
    }
    if (options.numeric) {
      return this.convert(text, FontStyle.MONOSPACE);
    }
    if (options.emphasis) {
      return this.convert(text, FontStyle.ITALIC);
    }
    return text;
  }

  /**
   * Clear character mapping cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.getSize(),
      maxSize: 10000,
    };
  }
}

export default FontFormatter;
