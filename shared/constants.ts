/**
 * Shared constants for fund allocation and capital calls
 * Used by both frontend and backend
 */

export const ALLOCATION_STATUS = {
  COMMITTED: 'committed',
  INVESTED: 'invested',
  FUNDED: 'funded',
  PARTIALLY_PAID: 'partially_paid',
  PARTIALLY_CLOSED: 'partially_closed',
  CLOSED: 'closed',
  WRITTEN_OFF: 'written_off'
};

export const CAPITAL_CALL_SCHEDULES = {
  SINGLE: 'single',
  QUARTERLY: 'quarterly',
  MONTHLY: 'monthly',
  BIANNUAL: 'biannual',
  ANNUAL: 'annual',
  CUSTOM: 'custom'
};

export const CAPITAL_CALL_STATUS = {
  SCHEDULED: 'scheduled',
  CALLED: 'called',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  DEFAULTED: 'defaulted'
};

// Capital call timing constants
export const CAPITAL_CALL_TIMING = {
  DEFAULT_DUE_DAYS: 30, // Default days between call date and due date
  PAYMENT_GRACE_DAYS: 7, // Grace period for late payments
  REMINDER_DAYS_BEFORE: 7 // Days before due date to send reminders
};

// Default allocation values
export const ALLOCATION_DEFAULTS = {
  PORTFOLIO_WEIGHT: 0,
  INTEREST_PAID: 0,
  DISTRIBUTION_PAID: 0,
  INITIAL_MARKET_VALUE: 0, // Market value starts at 0, updated based on performance
  INITIAL_MOIC: 1, // Multiple of Invested Capital starts at 1x
  INITIAL_IRR: 0, // Internal Rate of Return starts at 0%
  PAID_AMOUNT: 0, // Initially no amount paid
  OUTSTANDING_AMOUNT: 0 // Initially no outstanding amount
};

// Security types
export const SECURITY_TYPES = {
  EQUITY: 'equity',
  DEBT: 'debt',
  CONVERTIBLE: 'convertible',
  PREFERRED: 'preferred',
  COMMON: 'common',
  WARRANT: 'warrant',
  OPTION: 'option',
  REAL_ESTATE: 'real_estate',
  VENTURE: 'venture',
  BUYOUT: 'buyout',
  ENERGY: 'energy',
  INFRASTRUCTURE: 'infrastructure',
  CREDIT: 'credit'
} as const;

export const DEFAULT_SECURITY_TYPE = SECURITY_TYPES.EQUITY;

// Payment defaults  
export const PAYMENT_DEFAULTS = {
  INITIAL_PAID_AMOUNT: 0,
  FULL_OUTSTANDING: 0 // When payment is complete, outstanding amount is 0
};