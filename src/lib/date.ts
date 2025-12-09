import { DateTime } from 'luxon';
import { TIMEZONE } from '../config/constants';

/**
 * Date/time utilities for WITA timezone (Asia/Makassar, UTC+8)
 */

/**
 * Get current date/time in WITA timezone
 */
export function nowWITA(): DateTime {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Convert UTC date to WITA
 */
export function toWITA(date: Date | DateTime): DateTime {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  return dt.setZone(TIMEZONE);
}

/**
 * Convert WITA date to UTC
 */
export function toUTC(date: Date | DateTime): DateTime {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  return dt.setZone('UTC');
}

/**
 * Get start of day in WITA (00:00:00)
 */
export function startOfDayWITA(date?: Date | DateTime): DateTime {
  const dt = date 
    ? (date instanceof Date ? DateTime.fromJSDate(date) : date).setZone(TIMEZONE)
    : nowWITA();
  return dt.startOf('day');
}

/**
 * Get end of day in WITA (23:59:59.999)
 */
export function endOfDayWITA(date?: Date | DateTime): DateTime {
  const dt = date 
    ? (date instanceof Date ? DateTime.fromJSDate(date) : date).setZone(TIMEZONE)
    : nowWITA();
  return dt.endOf('day');
}

/**
 * Format date for display in Indonesian format
 */
export function formatDateWITA(date: Date | DateTime, format: string = 'dd MMMM yyyy, HH:mm'): string {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  return dt.setZone(TIMEZONE).toFormat(format);
}

/**
 * Parse date string in WITA timezone
 */
export function parseDateWITA(dateString: string, format: string = 'yyyy-MM-dd'): DateTime {
  return DateTime.fromFormat(dateString, format, { zone: TIMEZONE });
}

/**
 * Get date range for a day in WITA (start and end as UTC for database queries)
 */
export function getDayRangeWITA(date?: Date | DateTime): { start: Date; end: Date } {
  const day = date 
    ? (date instanceof Date ? DateTime.fromJSDate(date) : date).setZone(TIMEZONE)
    : nowWITA();
  
  const start = day.startOf('day').toUTC().toJSDate();
  const end = day.endOf('day').toUTC().toJSDate();
  
  return { start, end };
}

/**
 * Check if date is today in WITA
 */
export function isTodayWITA(date: Date | DateTime): boolean {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  const today = nowWITA();
  return dt.setZone(TIMEZONE).hasSame(today, 'day');
}

/**
 * Get days difference between two dates
 */
export function daysDifference(date1: Date | DateTime, date2: Date | DateTime): number {
  const dt1 = date1 instanceof Date ? DateTime.fromJSDate(date1) : date1;
  const dt2 = date2 instanceof Date ? DateTime.fromJSDate(date2) : date2;
  return dt2.diff(dt1, 'days').days;
}

/**
 * Add days to date
 */
export function addDays(date: Date | DateTime, days: number): DateTime {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  return dt.plus({ days });
}

/**
 * Subtract days from date
 */
export function subtractDays(date: Date | DateTime, days: number): DateTime {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
  return dt.minus({ days });
}

