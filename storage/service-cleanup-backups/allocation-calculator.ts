/**
 * Pure function allocation calculator service
 * Eliminates hardcoded business logic and provides consistent calculations
 */

import { FUND_CONFIG } from '../config/fund-config.js';

export interface AllocationInput {
  commitment: number;
  calls: Array<{
    amount: number;
    paid: number;
    status: string;
  }>;
}

export interface AllocationCalculationResult {
  called: number;
  paid: number;
  outstanding: number;
  uncalled: number;
  status: 'committed' | 'funded' | 'unfunded' | 'partially_paid' | 'written_off';
  callPercentage: number;
  paidPercentage: number;
}

/**
 * Pure function calculator for allocation metrics
 * No side effects, fully testable, reusable across services
 */
export class AllocationCalculator {
  /**
   * Calculate allocation metrics from commitment and capital calls
   */
  static calculate(input: AllocationInput): AllocationCalculationResult {
    const { commitment, calls } = input;
    
    // Calculate totals
    const called = calls.reduce((sum, call) => sum + call.amount, 0);
    const paid = calls.reduce((sum, call) => sum + call.paid, 0);
    const outstanding = called - paid;
    const uncalled = Math.max(0, commitment - called);
    
    // Calculate percentages
    const callPercentage = commitment > 0 ? (called / commitment) * 100 : 0;
    const paidPercentage = called > 0 ? (paid / called) * 100 : 0;
    
    // Determine status based on configurable business rules
    const status = this.determineStatus(commitment, called, paid, outstanding);
    
    return {
      called: Number(called.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      uncalled: Number(uncalled.toFixed(2)),
      status,
      callPercentage: Number(callPercentage.toFixed(FUND_CONFIG.PERCENTAGE_PRECISION)),
      paidPercentage: Number(paidPercentage.toFixed(FUND_CONFIG.PERCENTAGE_PRECISION)),
    };
  }
  
  /**
   * Determine allocation status based on configurable business rules
   */
  private static determineStatus(
    commitment: number,
    called: number,
    paid: number,
    outstanding: number
  ): AllocationCalculationResult['status'] {
    // No calls made yet
    if (called === 0) {
      return 'committed';
    }
    
    // All called capital has been paid
    if (outstanding <= 0.01 && called > 0) { // Allow for small rounding differences
      return called >= commitment ? 'funded' : 'partially_paid';
    }
    
    // Some payments made but not all
    if (paid > 0 && outstanding > 0.01) {
      return 'partially_paid';
    }
    
    // Capital called but no payments made
    if (paid === 0 && called > 0) {
      return 'unfunded';
    }
    
    return 'committed';
  }
  
  /**
   * Validate allocation transition
   */
  static validateStatusTransition(
    from: AllocationCalculationResult['status'],
    to: AllocationCalculationResult['status']
  ): { isValid: boolean; error?: string } {
    const allowedTransitions = FUND_CONFIG.ALLOWED_STATUS_TRANSITIONS[from];
    
    if (!allowedTransitions.some(status => status === to)) {
      return {
        isValid: false,
        error: `Invalid status transition from ${from} to ${to}. Allowed transitions: ${allowedTransitions.join(', ')}`
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Calculate portfolio weight based on allocation amount and fund size
   */
  static calculatePortfolioWeight(allocationAmount: number, totalFundSize: number): number {
    if (totalFundSize <= 0) return 0;
    return Number(((allocationAmount / totalFundSize) * 100).toFixed(FUND_CONFIG.PERCENTAGE_PRECISION));
  }
  
  /**
   * Calculate IRR precision based on configuration
   */
  static formatIRR(irr: number): number {
    return Number(irr.toFixed(FUND_CONFIG.IRR_CALCULATION_PRECISION));
  }
  
  /**
   * Calculate MOIC precision based on configuration
   */
  static formatMOIC(moic: number): number {
    return Number(moic.toFixed(FUND_CONFIG.MOIC_CALCULATION_PRECISION));
  }
  
  /**
   * Validate commitment amount against configuration limits
   */
  static validateCommitment(amount: number): { isValid: boolean; error?: string } {
    if (amount < FUND_CONFIG.MIN_COMMITMENT) {
      return {
        isValid: false,
        error: `Commitment amount must be at least $${FUND_CONFIG.MIN_COMMITMENT.toLocaleString()}`
      };
    }
    
    if (amount > FUND_CONFIG.MAX_COMMITMENT) {
      return {
        isValid: false,
        error: `Commitment amount cannot exceed $${FUND_CONFIG.MAX_COMMITMENT.toLocaleString()}`
      };
    }
    
    return { isValid: true };
  }
}