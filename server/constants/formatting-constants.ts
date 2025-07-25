/**
 * Formatting-related constants for server-side operations
 * Centralizes formatting options for consistency
 */

// Currency formatting options
export const CURRENCY_FORMAT = {
  DEFAULT: {
    LOCALE: 'en-US' as const,
    CURRENCY: 'USD' as const,
    MIN_FRACTION_DIGITS: 0 as const,
    MAX_FRACTION_DIGITS: 0 as const,
  },
  DETAILED: {
    LOCALE: 'en-US' as const,
    CURRENCY: 'USD' as const,
    MIN_FRACTION_DIGITS: 2 as const,
    MAX_FRACTION_DIGITS: 2 as const,
  },
};

// Number formatting options
export const NUMBER_FORMAT = {
  DEFAULT: {
    LOCALE: 'en-US' as const,
    MIN_FRACTION_DIGITS: 0 as const,
    MAX_FRACTION_DIGITS: 0 as const,
  },
  DECIMAL: {
    LOCALE: 'en-US' as const,
    MIN_FRACTION_DIGITS: 1 as const,
    MAX_FRACTION_DIGITS: 2 as const,
  },
};

// Percentage formatting options
export const PERCENTAGE_FORMAT = {
  DEFAULT: {
    DECIMAL_PLACES: 1 as const,
    INCLUDE_SYMBOL: true as const,
  },
  INTEGER: {
    DECIMAL_PLACES: 0 as const,
    INCLUDE_SYMBOL: true as const,
  },
  DETAILED: {
    DECIMAL_PLACES: 2 as const,
    INCLUDE_SYMBOL: true as const,
  },
};

// Status text constants
export const STATUS_TEXT = {
  NOT_APPLICABLE: 'N/A' as const,
  EMPTY: '-' as const,
  NOT_AVAILABLE: 'Not available' as const,
  PENDING: 'Pending' as const,
  LOADING: 'Loading...' as const,
  ERROR: 'Error' as const,
};

// Type definitions
export type CurrencyFormatOption = typeof CURRENCY_FORMAT[keyof typeof CURRENCY_FORMAT];
export type NumberFormatOption = typeof NUMBER_FORMAT[keyof typeof NUMBER_FORMAT];
export type PercentageFormatOption = typeof PERCENTAGE_FORMAT[keyof typeof PERCENTAGE_FORMAT];
export type StatusText = typeof STATUS_TEXT[keyof typeof STATUS_TEXT];
