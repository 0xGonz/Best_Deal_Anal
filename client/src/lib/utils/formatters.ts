/**
 * Centralized formatting utilities to ensure consistency across the application
 * Eliminates multiple currency formatting implementations that can differ
 */

export const formatMoney = (
  amount: number | null | undefined,
  options: {
    showCents?: boolean;
    compact?: boolean;
    prefix?: string;
  } = {}
): string => {
  const { showCents = true, compact = false, prefix = '' } = options;
  
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${prefix}$0${showCents ? '.00' : ''}`;
  }

  if (compact && Math.abs(amount) >= 1000000) {
    const millions = amount / 1000000;
    return `${prefix}$${millions.toFixed(1)}M`;
  }

  if (compact && Math.abs(amount) >= 1000) {
    const thousands = amount / 1000;
    return `${prefix}$${thousands.toFixed(1)}K`;
  }

  return `${prefix}${amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })}`;
};

export const formatPercentage = (
  value: number | null | undefined,
  options: {
    decimals?: number;
    showSign?: boolean;
  } = {}
): string => {
  const { decimals = 1, showSign = false } = options;
  
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  const formatted = `${value.toFixed(decimals)}%`;
  
  if (showSign && value > 0) {
    return `+${formatted}`;
  }
  
  return formatted;
};

export const formatNumber = (
  value: number | null | undefined,
  options: {
    decimals?: number;
    compact?: boolean;
  } = {}
): string => {
  const { decimals = 0, compact = false } = options;
  
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  if (compact && Math.abs(value) >= 1000000) {
    const millions = value / 1000000;
    return `${millions.toFixed(1)}M`;
  }

  if (compact && Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `${thousands.toFixed(1)}K`;
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatDate = (
  date: string | Date | null | undefined,
  options: {
    format?: 'short' | 'medium' | 'long';
    showTime?: boolean;
  } = {}
): string => {
  const { format = 'short', showTime = false } = options;
  
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'short' ? 'numeric' : format === 'medium' ? 'short' : 'long',
    day: 'numeric',
  };

  if (showTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
  }

  return dateObj.toLocaleDateString('en-US', formatOptions);
};

export const formatMultiple = (
  value: number | null | undefined,
  suffix: string = 'x'
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return `0${suffix}`;
  }
  
  return `${value.toFixed(2)}${suffix}`;
};

export const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Business-specific formatters
export const formatAUM = (aum: number | null | undefined): string => {
  return formatMoney(aum, { compact: true, showCents: false });
};

export const formatIRR = (irr: number | null | undefined): string => {
  return formatPercentage(irr, { decimals: 1 });
};

export const formatMOIC = (moic: number | null | undefined): string => {
  return formatMultiple(moic);
};

// Legacy compatibility - alias formatCurrency to formatMoney for existing imports
export const formatCurrency = formatMoney;