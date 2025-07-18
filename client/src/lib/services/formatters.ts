/**
 * Centralized formatting service for consistent data display
 * All formatting logic should be placed here for modularity and reusability
 */

// Currency formatting with configurable options
export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'compact';
}

export function formatCurrency(
  value: number | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  const {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    notation = 'standard'
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
      notation
    }).format(value);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `$${value.toLocaleString()}`;
  }
}

// Percentage formatting
export function formatPercentage(
  value: number | null | undefined,
  decimalPlaces: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  return `${value.toFixed(decimalPlaces)}%`;
}

// Date formatting with configurable options
export function formatDate(
  date: string | Date | null | undefined,
  format: 'short' | 'long' | 'iso' = 'short'
): string {
  if (!date) return 'N/A';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
      case 'long':
        return dateObj.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      case 'iso':
        return dateObj.toISOString().split('T')[0];
      default:
        return dateObj.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

// Number formatting with different scales
export function formatNumber(
  value: number | null | undefined,
  options: {
    notation?: 'standard' | 'compact';
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const {
    notation = 'standard',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options;

  try {
    return new Intl.NumberFormat('en-US', {
      notation,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value);
  } catch (error) {
    console.error('Error formatting number:', error);
    return value.toString();
  }
}

// Multiple (MOIC) formatting
export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '1.00x';
  }
  return `${value.toFixed(2)}x`;
}

// Text truncation with ellipsis
export function truncateText(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Status text formatting
export function formatStatusText(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  
  // Handle special cases
  if (status === 'partially_paid') return 'Partially Paid';
  if (status === 'ic_review') return 'IC Review';
  
  // Default: capitalize first letter of each word
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Initials generation from names
export function generateInitials(name: string | null | undefined, maxLength: number = 2): string {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, maxLength)
    .toUpperCase();
}

// Safe value extraction with fallback
export function safeValue<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}