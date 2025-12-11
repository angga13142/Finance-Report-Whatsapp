/**
 * Template Service
 * Provides template management with syntax validation
 */

import { MessageTemplateModel } from "../../models/template";
import { MessageTemplate } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: Array<{
    type: string;
    message: string;
    position?: number;
  }>;
}

/**
 * Template Service
 * Handles template operations with validation
 */
export class TemplateService {
  /**
   * List all templates
   */
  async list(): Promise<MessageTemplate[]> {
    try {
      return await MessageTemplateModel.list();
    } catch (error) {
      logger.error("Error listing templates", { error });
      throw error;
    }
  }

  /**
   * Preview template by name
   */
  async preview(name: string): Promise<MessageTemplate | null> {
    try {
      return await MessageTemplateModel.findByName(name);
    } catch (error) {
      logger.error("Error previewing template", { error, name });
      throw error;
    }
  }

  /**
   * Edit template with validation and conflict handling
   */
  async edit(
    name: string,
    content: string,
    userId: string,
  ): Promise<MessageTemplate> {
    try {
      // Validate template syntax
      const validation = this.validate({ name, content });
      if (!validation.valid) {
        throw new Error(
          `Template validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        );
      }

      // Get existing template for optimistic locking
      const existing = await MessageTemplateModel.findByName(name);
      if (!existing) {
        throw new Error(`Template '${name}' not found`);
      }

      // Update template (last-write-wins for conflicts)
      return await MessageTemplateModel.update(name, {
        content,
        updatedBy: userId,
      });
    } catch (error) {
      logger.error("Error editing template", { error, name });
      throw error;
    }
  }

  /**
   * Validate template syntax, placeholders, and escape sequences
   */
  validate(template: {
    name: string;
    content: string;
  }): TemplateValidationResult {
    const errors: TemplateValidationResult["errors"] = [];

    // Validate content length
    if (template.content.length > 5000) {
      errors.push({
        type: "length_error",
        message: "Template content must not exceed 5000 characters",
      });
    }

    // Validate syntax (placeholder matching)
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = placeholderRegex.exec(template.content)) !== null) {
      const placeholderName = match[1].trim();
      placeholders.push(placeholderName);

      // Validate placeholder name (alphanumeric and underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(placeholderName)) {
        errors.push({
          type: "invalid_placeholder",
          message: `Invalid placeholder name: ${placeholderName}`,
          position: match.index,
        });
      }
    }

    // Check for unclosed placeholders
    const openBraces = (template.content.match(/\{\{/g) || []).length;
    const closeBraces = (template.content.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push({
        type: "syntax_error",
        message: "Unmatched placeholder braces",
      });
    }

    // Check for nested placeholders (invalid)
    if (
      template.content.includes("{{{{") ||
      template.content.includes("}}}}")
    ) {
      errors.push({
        type: "syntax_error",
        message: "Nested placeholders are not allowed",
      });
    }

    // Validate escape sequences
    const escapeRegex = /\\(.)/g;
    const validEscapes = ["{", "}", "\\", "n", "t"];
    while ((match = escapeRegex.exec(template.content)) !== null) {
      const escapedChar = match[1];
      if (!validEscapes.includes(escapedChar)) {
        errors.push({
          type: "invalid_escape",
          message: `Invalid escape sequence: \\${escapedChar}`,
          position: match.index,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract placeholders from template content
   */
  extractPlaceholders(content: string): string[] {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = placeholderRegex.exec(content)) !== null) {
      const placeholderName = match[1].trim();
      if (!seen.has(placeholderName)) {
        placeholders.push(placeholderName);
        seen.add(placeholderName);
      }
    }

    return placeholders;
  }

  /**
   * Validate content length
   */
  validateContent(content: string): TemplateValidationResult {
    const errors: TemplateValidationResult["errors"] = [];

    if (content.length > 5000) {
      errors.push({
        type: "length_error",
        message: `Content length ${content.length} exceeds maximum of 5000 characters`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate syntax only
   */
  validateSyntax(content: string): TemplateValidationResult {
    return this.validate({ name: "temp", content });
  }
}

export default TemplateService;
