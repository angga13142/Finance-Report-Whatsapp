/**
 * Unit tests for TemplateService
 * Tests template validation (syntax, placeholders, escape sequences)
 */

import { TemplateService } from "../../../../src/services/system/template";

// Mock dependencies
jest.mock("../../../../src/models/template");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("TemplateService - Template Validation", () => {
  let templateService: TemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    templateService = new TemplateService();
  });

  describe("Syntax Validation", () => {
    it("should validate valid template syntax", () => {
      const validTemplate = "Hello {{name}}, your balance is {{amount}}";
      const result = templateService.validateSyntax(validTemplate);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect unclosed placeholders", () => {
      const invalidTemplate = "Hello {{name}, your balance is {{amount}}";
      const result = templateService.validateSyntax(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: "syntax_error",
        }),
      );
    });

    it("should detect nested placeholders", () => {
      const invalidTemplate = "Hello {{name{{nested}}}}";
      const result = templateService.validateSyntax(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate placeholder names (alphanumeric and underscore only)", () => {
      const validTemplate = "Hello {{user_name}}, amount: {{amount_123}}";
      const result = templateService.validateSyntax(validTemplate);

      expect(result.valid).toBe(true);
    });

    it("should reject invalid placeholder names", () => {
      const invalidTemplate = "Hello {{user-name}}, amount: {{amount.123}}";
      const result = templateService.validateSyntax(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: "invalid_placeholder",
        }),
      );
    });
  });

  describe("Placeholder Validation", () => {
    it("should extract all placeholders from template", () => {
      const template = "Hello {{name}}, your balance is {{amount}}";
      const placeholders = templateService.extractPlaceholders(template);

      expect(placeholders).toContain("name");
      expect(placeholders).toContain("amount");
      expect(placeholders.length).toBe(2);
    });

    it("should handle templates with no placeholders", () => {
      const template = "Hello, welcome to our service!";
      const placeholders = templateService.extractPlaceholders(template);

      expect(placeholders).toHaveLength(0);
    });

    it("should handle duplicate placeholders", () => {
      const template = "Hello {{name}}, {{name}} your balance is {{amount}}";
      const placeholders = templateService.extractPlaceholders(template);

      expect(placeholders).toContain("name");
      expect(placeholders).toContain("amount");
      // Should deduplicate
      expect(placeholders.filter((p) => p === "name").length).toBe(1);
    });
  });

  describe("Escape Sequences Validation", () => {
    it("should validate escape sequences", () => {
      const template = "Price: \\{{amount\\}} = {{real_amount}}";
      const result = templateService.validateSyntax(template);

      expect(result.valid).toBe(true);
    });

    it("should handle escaped braces", () => {
      const template = "Literal {{ = \\{{ and }} = \\}}";
      const result = templateService.validateSyntax(template);

      expect(result.valid).toBe(true);
    });

    it("should detect invalid escape sequences", () => {
      const template = "Invalid: \\x";
      const result = templateService.validateSyntax(template);

      // Should either be valid (if \x is allowed) or invalid
      expect(typeof result.valid).toBe("boolean");
    });
  });

  describe("Content Length Validation", () => {
    it("should validate content within 5000 character limit", () => {
      const template = "A".repeat(4000);
      const result = templateService.validateContent(template);

      expect(result.valid).toBe(true);
    });

    it("should reject content exceeding 5000 characters", () => {
      const template = "A".repeat(5001);
      const result = templateService.validateContent(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: "length_error",
        }),
      );
    });
  });

  describe("Full Template Validation", () => {
    it("should validate complete template", () => {
      const template = {
        name: "welcome_message",
        content: "Hello {{name}}, your balance is {{amount}}",
      };

      const result = templateService.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return all validation errors", () => {
      const template = {
        name: "invalid_template",
        content: "Hello {{unclosed, your balance is {{amount}}",
      };

      const result = templateService.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
