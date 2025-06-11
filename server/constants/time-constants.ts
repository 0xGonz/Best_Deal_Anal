/**
 * Time-related constants for the server
 * Centralizes all time values for consistent use
 */

// Date formats
export const DATE_FORMATS = {
  DEFAULT: 'MMM d, yyyy',
  SHORT: 'MM/dd/yyyy',
  ISO: 'yyyy-MM-dd',
  MONTH_YEAR: 'MMM yyyy',
  YEAR: 'yyyy',
  MONTH_DAY: 'MMM d',
  FULL: 'MMMM d, yyyy',
  DATE_TIME: 'MMM d, yyyy h:mm a',
  TIME: 'h:mm a',
} as const;

// Time values in milliseconds
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
  YEAR: 365 * 24 * 60 * 60 * 1000, // Approximate
} as const;

// Time durations in seconds
export const TIME_SECONDS = {
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
  WEEK: 7 * 24 * 60 * 60,
  MONTH: 30 * 24 * 60 * 60, // Approximate
  YEAR: 365 * 24 * 60 * 60, // Approximate
} as const;

// Session expiration times
export const SESSION_EXPIRATION = {
  DEFAULT: 24 * 60 * 60 * 1000, // 24 hours
  EXTENDED: 7 * 24 * 60 * 60 * 1000, // 1 week
  REMEMBER_ME: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

// Default durations for various business operations
export const DEFAULT_DURATIONS = {
  // Capital call related durations
  CAPITAL_CALL_DUE_DAYS: 14, // Default days between call date and due date
  REMINDER_DAYS: 7, // Default days before due date to send reminder
  GRACE_PERIOD_DAYS: 5, // Default days after due date before marking as late
  
  // Deal review and investment periods
  DEFAULT_DEAL_REVIEW_DAYS: 30, // Default days for deal review period
  DEFAULT_INVESTMENT_PERIOD_YEARS: 5, // Default investment period in years
  
  // Buffer days for date integration between components
  ALLOCATION_BUFFER_DAYS: 7, // Days to add when calculating the next allocation date
  CAPITAL_CALL_BUFFER_DAYS: 14, // Days to add when calculating the next capital call date
  CLOSING_BUFFER_DAYS: 30, // Days to add when calculating the next closing schedule date
  
  // Default spacing between events in schedules
  DEFAULT_MONTHLY_SPACING: 30, // Approximate days in a month for scheduling
  DEFAULT_QUARTERLY_SPACING: 90, // Approximate days in a quarter for scheduling
  DEFAULT_BIANNUAL_SPACING: 180, // Approximate days in half a year for scheduling
  DEFAULT_ANNUAL_SPACING: 365, // Approximate days in a year for scheduling
} as const;
