/**
 * Server-side calculation constants, keeping consistency with client-side constants
 */

/**
 * Financial calculation constants
 */
export const FINANCIAL_CALCULATION = {
  MILLION: 1000000,
  PRECISION: {
    CURRENCY: 2,    // Decimal places for currency values
    PERCENTAGE: 2,  // Decimal places for percentage values
    MULTIPLE: 2,    // Decimal places for multiples (e.g., MOIC)
    IRR: 1          // Decimal places for IRR displays
  },
  DEFAULT_IRR: 0,     // Default IRR value for new investments
  DEFAULT_MOIC: 1,    // Default MOIC value for new investments
  MIN_DAYS_FOR_IRR: 30, // Minimum days required for meaningful IRR calculation
};
