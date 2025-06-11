// Comprehensive date handling utilities for perfect alignment across all investment operations
// Prevents timezone shifts that cause dates to show as "next day"

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

/**
 * Parse date input to UTC date object at start of day
 * Prevents timezone shifts for date-only values
 */
export function parseUTCDate(dateInput: string | Date): Date {
  if (!dateInput) return new Date();
  
  if (typeof dateInput === 'string') {
    // Handle YYYY-MM-DD format specifically to avoid timezone issues
    const dateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    }
  }
  
  const date = new Date(dateInput);
  // Convert to UTC start of day to prevent timezone shifts
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Format date for display, ensuring consistent presentation
 */
export function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC' // Use UTC to prevent timezone shifts
  });
}

/**
 * Format date for form inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return toUTCDateString(d);
}

/**
 * Get today's date in UTC format for consistent defaults
 */
export function getTodayUTC(): string {
  return toUTCDateString(new Date());
}

/**
 * Compare two dates ignoring time components
 */
export function isSameDate(date1: Date | string, date2: Date | string): boolean {
  return toUTCDateString(date1) === toUTCDateString(date2);
}

/**
 * Validate that a date string is in valid format
 */
export function isValidDateString(dateStr: string): boolean {
  const date = parseUTCDate(dateStr);
  return !isNaN(date.getTime()) && toUTCDateString(date) === dateStr;
}

/**
 * Create a date object for database storage
 * Ensures consistent UTC storage without timezone issues
 */
export function createDatabaseDate(dateInput: string | Date): Date {
  return parseUTCDate(dateInput);
}