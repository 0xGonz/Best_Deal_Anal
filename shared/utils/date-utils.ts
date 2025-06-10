/**
 * Shared date utilities for consistent date handling across client and server
 */

/**
 * Normalize a date to noon UTC to avoid timezone issues
 * @param date Date or date string to normalize
 * @returns A Date object set to noon UTC on the same day
 */
export function normalizeToNoonUTC(date: Date | string): Date {
  const parseDate = typeof date === 'string' ? new Date(date) : date;
  
  return new Date(Date.UTC(
    parseDate.getFullYear(),
    parseDate.getMonth(),
    parseDate.getDate(),
    12, 0, 0, 0
  ));
}

/**
 * Format a date as an ISO string at noon UTC
 * @param date Date to format
 * @returns ISO string at noon UTC
 */
export function formatToNoonUTC(date: Date | string): string {
  return normalizeToNoonUTC(date).toISOString();
}

/**
 * Parse a date string safely to noon UTC
 * @param dateStr Date string in any format
 * @returns Date object or null if invalid
 */
export function parseDateSafe(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return normalizeToNoonUTC(date);
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Convert date to UTC date string in YYYY-MM-DD format
 * Ensures consistent date handling without timezone issues
 */
export function toUTCDateString(date: Date | string): string {
  const d = new Date(date);
  return d.getUTCFullYear() + '-' + 
         String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + 
         String(d.getUTCDate()).padStart(2, '0');
}