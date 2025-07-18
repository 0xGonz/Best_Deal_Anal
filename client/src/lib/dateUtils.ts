/**
 * Utility functions for consistent date handling
 */
import { format, parseISO } from 'date-fns';

/**
 * Format a date to display in a consistent format
 * @param date The date to format
 * @param formatStr Optional format string (defaults to 'MMM d, yyyy')
 * @returns Formatted date string
 */
export function formatDate(date: string | Date | null | undefined, formatStr = 'MMM d, yyyy'): string {
  if (!date) return '';
  
  try {
    // Parse string dates
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 * @param date The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  try {
    // Parse string dates
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

/**
 * Converts a date input to ISO string for API requests, preserving the day
 * @param date The date to format
 * @returns ISO string with noon UTC time to preserve the day across timezones
 */
export function formatDateForAPI(date: string | Date | null | undefined): string {
  if (!date) {
    return new Date().toISOString();
  }
  
  try {
    let parsedDate: Date;
    
    // If it's a string, handle it appropriately
    if (typeof date === 'string') {
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Add noon UTC time to preserve the day across timezones
        parsedDate = new Date(`${date}T12:00:00Z`);
      } else {
        parsedDate = new Date(date);
      }
    } else {
      // It's already a Date object
      parsedDate = date;
    }
    
    // Make sure the date is valid
    if (isNaN(parsedDate.getTime())) {
      return new Date().toISOString();
    }
    
    // Set to noon UTC to ensure the date doesn't change due to timezone
    const noonUTC = new Date(Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      12, 0, 0, 0
    ));
    
    return noonUTC.toISOString();
  } catch (error) {
    console.error('Error formatting date for API:', error);
    return new Date().toISOString();
  }
}