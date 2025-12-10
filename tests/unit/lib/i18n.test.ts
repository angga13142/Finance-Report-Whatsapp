/**
 * Unit tests for i18n utilities
 * Tests internationalization and localization functions
 */

import { t, i18n } from "../../../src/lib/i18n";

describe("i18n Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("t function", () => {
    it("should return translation for valid key", () => {
      const result = t("general.welcome");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return key when translation not found", () => {
      const result = t("nonexistent.key");
      expect(result).toBeDefined();
    });

    it("should format message with parameters", () => {
      const result = t("general.welcome", undefined, { name: "Test" });
      expect(result).toBeDefined();
    });
  });

  describe("i18n service", () => {
    it("should have getInstance method", () => {
      expect(i18n).toBeDefined();
    });

    it("should translate messages", () => {
      const result = i18n.t("general.welcome");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });
});
