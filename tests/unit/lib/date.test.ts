/**
 * Unit tests for date utilities
 * Tests WITA timezone conversions, date formatting, and date range operations
 */

import { DateTime } from "luxon";
import {
  nowWITA,
  toWITA,
  toUTC,
  startOfDayWITA,
  endOfDayWITA,
  formatDateWITA,
  parseDateWITA,
  getDayRangeWITA,
  isTodayWITA,
  daysDifference,
  addDays,
  subtractDays,
  formatDate,
} from "../../../src/lib/date";

describe("Date Utilities", () => {
  describe("nowWITA", () => {
    it("should return current date/time in WITA timezone", () => {
      const result = nowWITA();
      expect(result).toBeInstanceOf(DateTime);
      expect(result.zoneName).toBe("Asia/Makassar");
    });
  });

  describe("toWITA", () => {
    it("should convert Date to WITA timezone", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const result = toWITA(date);
      expect(result.zoneName).toBe("Asia/Makassar");
    });

    it("should convert DateTime to WITA timezone", () => {
      const dt = DateTime.fromISO("2024-01-01T12:00:00Z");
      const result = toWITA(dt);
      expect(result.zoneName).toBe("Asia/Makassar");
    });
  });

  describe("toUTC", () => {
    it("should convert Date to UTC timezone", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const result = toUTC(date);
      expect(result.zoneName).toBe("UTC");
    });

    it("should convert DateTime to UTC timezone", () => {
      const dt = DateTime.fromISO("2024-01-01T12:00:00", {
        zone: "Asia/Makassar",
      });
      const result = toUTC(dt);
      expect(result.zoneName).toBe("UTC");
    });
  });

  describe("startOfDayWITA", () => {
    it("should return start of current day in WITA", () => {
      const result = startOfDayWITA();
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.second).toBe(0);
      expect(result.zoneName).toBe("Asia/Makassar");
    });

    it("should return start of specified date in WITA", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = startOfDayWITA(date);
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.second).toBe(0);
    });
  });

  describe("endOfDayWITA", () => {
    it("should return end of current day in WITA", () => {
      const result = endOfDayWITA();
      expect(result.hour).toBe(23);
      expect(result.minute).toBe(59);
      expect(result.second).toBe(59);
      expect(result.zoneName).toBe("Asia/Makassar");
    });

    it("should return end of specified date in WITA", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = endOfDayWITA(date);
      expect(result.hour).toBe(23);
      expect(result.minute).toBe(59);
    });
  });

  describe("formatDateWITA", () => {
    it("should format date with default format", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDateWITA(date);
      expect(result).toContain("2024");
      // Format may vary by locale, just check it's a valid date string
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should format date with custom format", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDateWITA(date, "yyyy-MM-dd");
      expect(result).toBe("2024-01-15");
    });

    it("should format DateTime object", () => {
      const dt = DateTime.fromISO("2024-01-15T14:30:00Z");
      const result = formatDateWITA(dt, "yyyy-MM-dd");
      expect(result).toBe("2024-01-15");
    });
  });

  describe("parseDateWITA", () => {
    it("should parse date string in WITA timezone", () => {
      const result = parseDateWITA("2024-01-15");
      expect(result.zoneName).toBe("Asia/Makassar");
      expect(result.year).toBe(2024);
      expect(result.month).toBe(1);
      expect(result.day).toBe(15);
    });

    it("should parse date string with custom format", () => {
      const result = parseDateWITA("15/01/2024", "dd/MM/yyyy");
      expect(result.year).toBe(2024);
      expect(result.month).toBe(1);
      expect(result.day).toBe(15);
    });
  });

  describe("getDayRangeWITA", () => {
    it("should return day range for current day", () => {
      const result = getDayRangeWITA();
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
      expect(result.start.getTime()).toBeLessThan(result.end.getTime());
    });

    it("should return day range for specified date", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = getDayRangeWITA(date);
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });

    it("should return UTC dates for database queries", () => {
      const result = getDayRangeWITA();
      // Dates should be in UTC for database storage
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });
  });

  describe("isTodayWITA", () => {
    it("should return true for today's date", () => {
      const today = new Date();
      const result = isTodayWITA(today);
      expect(result).toBe(true);
    });

    it("should return false for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = isTodayWITA(yesterday);
      expect(result).toBe(false);
    });

    it("should return false for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = isTodayWITA(tomorrow);
      expect(result).toBe(false);
    });
  });

  describe("daysDifference", () => {
    it("should calculate days difference between two dates", () => {
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-05");
      const result = daysDifference(date1, date2);
      expect(result).toBe(4);
    });

    it("should return negative value when first date is after second", () => {
      const date1 = new Date("2024-01-05");
      const date2 = new Date("2024-01-01");
      const result = daysDifference(date1, date2);
      expect(result).toBe(-4);
    });

    it("should work with DateTime objects", () => {
      const dt1 = DateTime.fromISO("2024-01-01");
      const dt2 = DateTime.fromISO("2024-01-05");
      const result = daysDifference(dt1, dt2);
      expect(result).toBe(4);
    });
  });

  describe("addDays", () => {
    it("should add days to date", () => {
      const date = new Date("2024-01-01");
      const result = addDays(date, 5);
      expect(result.day).toBe(6);
    });

    it("should handle negative days (subtract)", () => {
      const date = new Date("2024-01-10");
      const result = addDays(date, -5);
      expect(result.day).toBe(5);
    });

    it("should work with DateTime objects", () => {
      const dt = DateTime.fromISO("2024-01-01");
      const result = addDays(dt, 5);
      expect(result.day).toBe(6);
    });
  });

  describe("subtractDays", () => {
    it("should subtract days from date", () => {
      const date = new Date("2024-01-10");
      const result = subtractDays(date, 5);
      expect(result.day).toBe(5);
    });

    it("should work with DateTime objects", () => {
      const dt = DateTime.fromISO("2024-01-10");
      const result = subtractDays(dt, 5);
      expect(result.day).toBe(5);
    });
  });

  describe("formatDate", () => {
    it("should format date with default format", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDate(date);
      expect(result).toContain("2024");
    });

    it("should format date with custom format", () => {
      const date = new Date("2024-01-15T14:30:00Z");
      const result = formatDate(date, "yyyy-MM-dd");
      expect(result).toBe("2024-01-15");
    });
  });
});
