/**
 * Consolidated Date Utilities
 * 
 * Addresses Issue #8 from audit: Date utilities duplicated
 * Single source of truth for all date operations
 */

/**
 * Normalize date to noon UTC to avoid timezone issues
 */
export function normalizeToNoonUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // Set to noon UTC to avoid timezone-related date shifts
  d.setUTCHours(12, 0, 0, 0);
  
  return d;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'iso' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    case 'long':
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    case 'iso':
      return d.toISOString().split('T')[0];
    default:
      return d.toLocaleDateString();
  }
}

/**
 * Add business days to a date (skipping weekends)
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  
  return normalizeToNoonUTC(result);
}

/**
 * Check if a date falls on a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Get the start of the month for a given date
 */
export function getMonthStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return normalizeToNoonUTC(start);
}

/**
 * Get the end of the month for a given date
 */
export function getMonthEnd(date: Date): Date {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return normalizeToNoonUTC(end);
}

/**
 * Calculate difference in days between two dates
 */
export function daysDifference(date1: Date, date2: Date): number {
  const time1 = normalizeToNoonUTC(date1).getTime();
  const time2 = normalizeToNoonUTC(date2).getTime();
  
  return Math.abs(Math.ceil((time1 - time2) / (1000 * 60 * 60 * 24)));
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = normalizeToNoonUTC(date1);
  const d2 = normalizeToNoonUTC(date2);
  
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
}

/**
 * Get quarter information for a date
 */
export function getQuarter(date: Date): { quarter: number; year: number } {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  const quarter = Math.ceil(month / 3);
  
  return {
    quarter,
    year: date.getFullYear()
  };
}

/**
 * Parse date string safely
 */
export function parseDate(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return normalizeToNoonUTC(date);
  } catch {
    return null;
  }
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: 'week' | 'month' | 'quarter' | 'year', date: Date = new Date()): { start: Date; end: Date } {
  const now = normalizeToNoonUTC(date);
  
  switch (period) {
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // End of week (Saturday)
      
      return {
        start: normalizeToNoonUTC(start),
        end: normalizeToNoonUTC(end)
      };
    }
    
    case 'month':
      return {
        start: getMonthStart(now),
        end: getMonthEnd(now)
      };
    
    case 'quarter': {
      const quarter = getQuarter(now);
      const startMonth = (quarter.quarter - 1) * 3;
      const start = new Date(quarter.year, startMonth, 1);
      const end = new Date(quarter.year, startMonth + 3, 0);
      
      return {
        start: normalizeToNoonUTC(start),
        end: normalizeToNoonUTC(end)
      };
    }
    
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      
      return {
        start: normalizeToNoonUTC(start),
        end: normalizeToNoonUTC(end)
      };
    }
    
    default:
      throw new Error(`Unsupported period: ${period}`);
  }
}

/**
 * Holiday checking (basic implementation)
 * In production, this should be configurable and more comprehensive
 */
export function isHoliday(date: Date): boolean {
  const normalized = normalizeToNoonUTC(date);
  const month = normalized.getMonth() + 1;
  const day = normalized.getDate();
  
  // Basic US holidays (extend as needed)
  const holidays = [
    { month: 1, day: 1 },   // New Year's Day
    { month: 7, day: 4 },   // Independence Day
    { month: 12, day: 25 }  // Christmas Day
  ];
  
  return holidays.some(h => h.month === month && h.day === day);
}

/**
 * Add days while skipping weekends and holidays
 */
export function addBusinessDaysWithHolidays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    
    // Skip weekends and holidays
    if (!isWeekend(result) && !isHoliday(result)) {
      addedDays++;
    }
  }
  
  return normalizeToNoonUTC(result);
}

/**
 * Create normalized date (alias for normalizeToNoonUTC for backwards compatibility)
 */
export function createNormalizedDate(date: Date | string): Date {
  return normalizeToNoonUTC(date);
}

/**
 * Calculate due date by adding business days
 */
export function calculateDueDate(startDate: Date, businessDays: number): Date {
  return addBusinessDaysWithHolidays(startDate, businessDays);
}

/**
 * Format date for database storage
 */
export function formatForDatabase(date: Date): string {
  return normalizeToNoonUTC(date).toISOString();
}