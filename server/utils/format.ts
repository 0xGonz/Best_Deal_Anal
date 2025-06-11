/**
 * Server-side formatting utilities, consistent with client-side formatting
 */
import { FINANCIAL_CALCULATION } from '../constants/calculation-constants';

/**
 * Format a percentage value
 * @param value The value to format as percentage
 * @param decimals Number of decimal places (default from constants)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number | undefined | null, decimals = FINANCIAL_CALCULATION.PRECISION.PERCENTAGE): string => {
  if (value === undefined || value === null) {
    return '0%';
  }
  
  // Convert to percentage and add % sign
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format a number as currency
 * @param amount The amount to format
 * @param currency The currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) {
    return "$0.00";
  }
  
  // Format large numbers with appropriate abbreviations
  const BILLION = FINANCIAL_CALCULATION.MILLION * 1000;
  const THOUSAND = 1000;
  
  if (amount >= BILLION) {
    return `$${(amount / BILLION).toFixed(1)}B`;
  } else if (amount >= FINANCIAL_CALCULATION.MILLION) {
    return `$${(amount / FINANCIAL_CALCULATION.MILLION).toFixed(1)}M`;
  } else if (amount >= THOUSAND) {
    return `$${(amount / THOUSAND).toFixed(1)}K`;
  }
  
  // Format standard currency
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: FINANCIAL_CALCULATION.PRECISION.CURRENCY
  }).format(amount);
};
