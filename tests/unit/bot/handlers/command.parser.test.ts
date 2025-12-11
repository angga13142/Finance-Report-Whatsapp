/**
 * Unit tests for command parser with fuzzy matching
 * Tests command recognition, confidence scoring, and parameter validation
 */

import {
  CommandParser,
  parseCommand,
  getCommandSuggestions,
} from "../../../../src/bot/handlers/command.parser";
import {
  COMMANDS,
  CONFIDENCE_THRESHOLD,
} from "../../../../src/config/constants";

// Mock logger
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Command Parser", () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
    jest.clearAllMocks();
  });

  describe("T010: Command recognition for 'catat penjualan'", () => {
    it("should recognize 'catat penjualan' as RECORD_SALE command", () => {
      const result = parser.parseCommand(
        "catat penjualan",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
      expect(result?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it("should recognize 'catat_penjualan' (snake_case) as RECORD_SALE", () => {
      const result = parser.parseCommand(
        "catat_penjualan",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7); // Match (may use fuzzy matching)
    });

    it("should recognize synonym 'tambah' as RECORD_SALE", () => {
      const result = parser.parseCommand("tambah", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7); // Synonym match (may be exact match)
    });

    it("should recognize abbreviation 'cp' as RECORD_SALE", () => {
      const result = parser.parseCommand("cp", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7); // Abbreviation match (may be exact match)
    });

    it("should handle typo 'catat penjualn' with fuzzy matching", () => {
      const result = parser.parseCommand("catat penjualn", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
      expect(result?.confidence).toBeGreaterThan(0.3); // Fuzzy match
    });

    it("should handle case-insensitive input", () => {
      const result = parser.parseCommand(
        "CATAT PENJUALAN",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
    });
  });

  describe("T011: Transaction command parameter validation", () => {
    it("should parse command without parameters", () => {
      const result = parser.parseCommand(
        "catat penjualan",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.parameters).toBeUndefined(); // No parameters in initial command
    });

    it("should return null for empty input", () => {
      const result = parser.parseCommand("", "user1", "employee");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only input", () => {
      const result = parser.parseCommand("   ", "user1", "employee");
      expect(result).toBeNull();
    });

    it("should handle unrecognized command gracefully", () => {
      const result = parser.parseCommand("xyz abc", "user1", "employee");
      expect(result).toBeNull();
    });

    it("should include timestamp in parsed command", () => {
      const before = new Date();
      const result = parser.parseCommand(
        "catat penjualan",
        "user1",
        "employee",
      );
      const after = new Date();
      expect(result).not.toBeNull();
      expect(result?.timestamp).toBeInstanceOf(Date);
      expect(result?.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should preserve raw text in parsed command", () => {
      const rawText = "catat penjualan";
      const result = parser.parseCommand(rawText, "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.rawText).toBe(rawText);
    });
  });

  describe("Command suggestions", () => {
    it("should provide suggestions for unrecognized commands", () => {
      const suggestions = parser.getSuggestions("catat penjualn", 3);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions[0].command).toBe(COMMANDS.RECORD_SALE);
      expect(suggestions[0].description).toBeDefined();
      expect(suggestions[0].confidence).toBeGreaterThan(0.3);
    });

    it("should limit suggestions to specified limit", () => {
      const suggestions = parser.getSuggestions("lihat", 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for completely unrelated input", () => {
      const suggestions = parser.getSuggestions("xyz123", 3);
      expect(suggestions.length).toBe(0);
    });
  });

  describe("Confidence threshold", () => {
    it("should auto-execute commands with confidence >= 70%", () => {
      const highConfidence = 0.85;
      expect(parser.shouldAutoExecute(highConfidence)).toBe(true);
    });

    it("should not auto-execute commands with confidence < 70%", () => {
      const lowConfidence = 0.65;
      expect(parser.shouldAutoExecute(lowConfidence)).toBe(false);
    });

    it("should auto-execute commands with confidence exactly 70%", () => {
      expect(parser.shouldAutoExecute(CONFIDENCE_THRESHOLD)).toBe(true);
    });
  });

  describe("Convenience functions", () => {
    it("parseCommand should work as convenience function", () => {
      const result = parseCommand("catat penjualan", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_SALE);
    });

    it("getCommandSuggestions should work as convenience function", () => {
      const suggestions = getCommandSuggestions("catat penjualn", 3);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("Multiple command types", () => {
    it("should recognize 'catat pengeluaran' as RECORD_EXPENSE", () => {
      const result = parser.parseCommand(
        "catat pengeluaran",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.RECORD_EXPENSE);
    });

    it("should recognize 'lihat laporan hari ini' as VIEW_REPORT_TODAY", () => {
      const result = parser.parseCommand(
        "lihat laporan hari ini",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_TODAY);
    });

    it("should recognize 'lihat saldo' as VIEW_BALANCE", () => {
      const result = parser.parseCommand("lihat saldo", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_BALANCE);
    });
  });

  describe("T025: Report command parser", () => {
    it("should recognize 'lihat laporan hari ini' as VIEW_REPORT_TODAY", () => {
      const result = parser.parseCommand(
        "lihat laporan hari ini",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_TODAY);
      expect(result?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it("should recognize 'lihat laporan minggu ini' as VIEW_REPORT_WEEK", () => {
      const result = parser.parseCommand(
        "lihat laporan minggu ini",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_WEEK);
      expect(result?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it("should recognize 'lihat laporan bulan ini' as VIEW_REPORT_MONTH", () => {
      const result = parser.parseCommand(
        "lihat laporan bulan ini",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_MONTH);
      expect(result?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it("should recognize 'laporan' as VIEW_REPORT_TODAY (synonym)", () => {
      const result = parser.parseCommand("laporan", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_TODAY);
      expect(result?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it("should recognize 'll' as VIEW_REPORT_TODAY (abbreviation)", () => {
      const result = parser.parseCommand("ll", "user1", "employee");
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_TODAY);
      expect(result?.confidence).toBeGreaterThanOrEqual(0.95); // Abbreviation confidence
    });

    it("should handle typos in report commands", () => {
      const result = parser.parseCommand(
        "lihat laporn hari ini",
        "user1",
        "employee",
      );
      expect(result).not.toBeNull();
      expect(result?.recognizedIntent).toBe(COMMANDS.VIEW_REPORT_TODAY);
      expect(result?.confidence).toBeGreaterThan(0.3); // Fuzzy match
    });
  });
});
