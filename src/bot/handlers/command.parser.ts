/**
 * Command parser with fuzzy matching and confidence scoring
 * Uses fuse.js for typo tolerance and synonym/abbreviation mapping
 */

import Fuse from "fuse.js";
import {
  COMMANDS,
  COMMAND_SYNONYMS,
  COMMAND_ABBREVIATIONS,
  CONFIDENCE_THRESHOLD,
  type CommandName,
} from "../../config/constants";
import { logger } from "../../lib/logger";

export interface ParsedCommand {
  rawText: string;
  recognizedIntent: CommandName;
  confidence: number;
  parameters?: Record<string, unknown>;
  synonyms?: string[];
  timestamp: Date;
}

export interface CommandSuggestion {
  command: CommandName;
  description: string;
  confidence: number;
}

/**
 * Command parser with fuzzy matching support
 */
export class CommandParser {
  private fuse: Fuse<{ command: CommandName; text: string }>;
  private commandList: Array<{ command: CommandName; text: string }>;

  constructor() {
    // Build command list for fuzzy matching
    this.commandList = this.buildCommandList();

    // Configure Fuse.js for fuzzy matching
    this.fuse = new Fuse(this.commandList, {
      keys: ["text"],
      threshold: 0.4, // Lower threshold = more strict matching (0.0 = exact, 1.0 = match anything)
      includeScore: true,
      minMatchCharLength: 2,
    });
  }

  /**
   * Build command list from constants, synonyms, and abbreviations
   */
  private buildCommandList(): Array<{ command: CommandName; text: string }> {
    const list: Array<{ command: CommandName; text: string }> = [];

    // Add canonical commands
    for (const command of Object.values(COMMANDS)) {
      // Convert snake_case to space-separated for matching
      const text = command.replace(/_/g, " ");
      list.push({ command, text });
    }

    // Add synonyms
    for (const [synonym, command] of Object.entries(COMMAND_SYNONYMS)) {
      list.push({ command, text: synonym });
    }

    // Add abbreviations
    for (const [abbrev, command] of Object.entries(COMMAND_ABBREVIATIONS)) {
      list.push({ command, text: abbrev });
    }

    return list;
  }

  /**
   * T067: Parse user input into recognized command with confidence scoring and performance monitoring
   * Target: <100ms latency per Plan §Performance Goals
   */
  parseCommand(
    rawText: string,
    userId?: string,
    userRole?: string,
  ): ParsedCommand | null {
    const startTime = Date.now();
    const trimmed = rawText.trim().toLowerCase();

    if (!trimmed) {
      return null;
    }

    // Check exact match first (highest confidence)
    const exactMatch = this.findExactMatch(trimmed);
    if (exactMatch) {
      const latency = Date.now() - startTime;
      // T067: Performance monitoring
      if (latency > 100) {
        logger.warn("Command parser latency exceeds target", {
          rawText,
          userId,
          latency,
          target: 100,
        });
      }
      return {
        rawText,
        recognizedIntent: exactMatch.command,
        confidence: 1.0,
        timestamp: new Date(),
      };
    }

    // Check abbreviation match
    const abbrevMatch = COMMAND_ABBREVIATIONS[trimmed];
    if (abbrevMatch) {
      const latency = Date.now() - startTime;
      if (latency > 100) {
        logger.warn("Command parser latency exceeds target", {
          rawText,
          userId,
          latency,
          target: 100,
        });
      }
      return {
        rawText,
        recognizedIntent: abbrevMatch,
        confidence: 0.95,
        synonyms: [trimmed],
        timestamp: new Date(),
      };
    }

    // Check synonym match
    const synonymMatch = COMMAND_SYNONYMS[trimmed];
    if (synonymMatch) {
      const latency = Date.now() - startTime;
      if (latency > 100) {
        logger.warn("Command parser latency exceeds target", {
          rawText,
          userId,
          latency,
          target: 100,
        });
      }
      return {
        rawText,
        recognizedIntent: synonymMatch,
        confidence: 0.9,
        synonyms: [trimmed],
        timestamp: new Date(),
      };
    }

    // Use fuzzy matching for typos and variations
    const fuzzyResults = this.fuse.search(trimmed);
    if (fuzzyResults.length > 0) {
      const bestMatch = fuzzyResults[0];
      // Convert Fuse.js score (0 = perfect match, 1 = no match) to confidence (1 = perfect, 0 = no match)
      const confidence = 1 - (bestMatch.score || 0);
      const latency = Date.now() - startTime;

      // T067: Performance monitoring
      if (latency > 100) {
        logger.warn("Command parser latency exceeds target", {
          rawText,
          userId,
          latency,
          target: 100,
        });
      }

      return {
        rawText,
        recognizedIntent: bestMatch.item.command,
        confidence,
        synonyms:
          bestMatch.item.text !== trimmed ? [bestMatch.item.text] : undefined,
        timestamp: new Date(),
      };
    }

    // No match found
    const latency = Date.now() - startTime;
    logger.debug("Command not recognized", {
      rawText,
      userId,
      userRole,
      latency,
    });

    // T067: Performance monitoring - log if latency exceeds target
    if (latency > 100) {
      logger.warn("Command parser latency exceeds target", {
        rawText,
        userId,
        latency,
        target: 100,
      });
    }

    return null;
  }

  /**
   * Find exact match in command list
   */
  private findExactMatch(
    text: string,
  ): { command: CommandName; text: string } | null {
    return (
      this.commandList.find(
        (item) => item.text.toLowerCase() === text.toLowerCase(),
      ) || null
    );
  }

  /**
   * Get command suggestions for unrecognized input
   * Returns top 3 matches with descriptions
   */
  getSuggestions(rawText: string, limit: number = 3): CommandSuggestion[] {
    const trimmed = rawText.trim().toLowerCase();
    if (!trimmed) {
      return [];
    }

    const fuzzyResults = this.fuse.search(trimmed);
    const suggestions: CommandSuggestion[] = [];

    for (let i = 0; i < Math.min(limit, fuzzyResults.length); i++) {
      const result = fuzzyResults[i];
      const confidence = 1 - (result.score || 0);

      // Only include suggestions with reasonable confidence (>0.3)
      if (confidence > 0.3) {
        suggestions.push({
          command: result.item.command,
          description: this.getCommandDescription(result.item.command),
          confidence,
        });
      }
    }

    return suggestions;
  }

  /**
   * Get human-readable description for command
   */
  private getCommandDescription(command: CommandName): string {
    const descriptions: Record<CommandName, string> = {
      [COMMANDS.RECORD_SALE]: "Catat penjualan",
      [COMMANDS.RECORD_EXPENSE]: "Catat pengeluaran",
      [COMMANDS.VIEW_REPORT_TODAY]: "Lihat laporan hari ini",
      [COMMANDS.VIEW_REPORT_WEEK]: "Lihat laporan minggu ini",
      [COMMANDS.VIEW_REPORT_MONTH]: "Lihat laporan bulan ini",
      [COMMANDS.VIEW_BALANCE]: "Lihat saldo",
      [COMMANDS.CHECK_BALANCE]: "Cek saldo",
      [COMMANDS.HELP]: "Bantuan",
      [COMMANDS.MENU]: "Menu",
    };

    return descriptions[command] || command;
  }

  /**
   * Check if command should be auto-executed based on confidence
   * Returns true if confidence >= threshold (per FR-041)
   */
  shouldAutoExecute(confidence: number): boolean {
    return confidence >= CONFIDENCE_THRESHOLD;
  }
}

// Singleton instance
let parserInstance: CommandParser | null = null;

/**
 * Get command parser instance
 */
export function getCommandParser(): CommandParser {
  if (!parserInstance) {
    parserInstance = new CommandParser();
  }
  return parserInstance;
}

/**
 * Parse command (convenience function)
 */
export function parseCommand(
  rawText: string,
  userId?: string,
  userRole?: string,
): ParsedCommand | null {
  return getCommandParser().parseCommand(rawText, userId, userRole);
}

/**
 * Get command suggestions (convenience function)
 */
export function getCommandSuggestions(
  rawText: string,
  limit?: number,
): CommandSuggestion[] {
  return getCommandParser().getSuggestions(rawText, limit);
}
