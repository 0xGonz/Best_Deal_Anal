import type { InsertFundAllocation } from '../../shared/schema';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AllocationValidationContext {
  fundId: number;
  dealId: number;
  amount: number;
  fundName?: string;
  dealName?: string;
  existingAllocations?: number;
  fundTotalSize?: number;
}

export class ValidationService {
  /**
   * Validate allocation amount and provide warnings for unusual values
   */
  static validateAllocationAmount(context: AllocationValidationContext): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const { amount, fundName, dealName, existingAllocations = 0, fundTotalSize = 0 } = context;

    // Basic amount validation
    if (amount <= 0) {
      result.isValid = false;
      result.errors.push('Allocation amount must be greater than zero');
    }

    if (amount > 100000000) { // $100M cap
      result.isValid = false;
      result.errors.push('Allocation amount exceeds maximum limit of $100,000,000');
    }

    // Warning for suspiciously round numbers above $500K
    if (amount >= 500000 && this.isSuspiciouslyRoundNumber(amount)) {
      result.warnings.push(
        `Large round number detected: $${amount.toLocaleString()}. ` +
        `Please confirm this is the intended allocation amount for ${dealName || 'this deal'}.`
      );
    }

    // Warning for very large allocations
    if (amount >= 1000000) {
      result.warnings.push(
        `High-value allocation: $${amount.toLocaleString()} to ${dealName || 'deal'}. ` +
        `This allocation will be logged for audit purposes.`
      );
    }

    // Fund capacity validation
    if (fundTotalSize > 0) {
      const projectedTotal = existingAllocations + amount;
      const utilizationRate = (projectedTotal / fundTotalSize) * 100;

      if (projectedTotal > fundTotalSize) {
        result.warnings.push(
          `This allocation would exceed fund capacity. ` +
          `Fund ${fundName || 'selected fund'} size: $${fundTotalSize.toLocaleString()}, ` +
          `projected total: $${projectedTotal.toLocaleString()}`
        );
      } else if (utilizationRate > 90) {
        result.warnings.push(
          `High fund utilization: ${utilizationRate.toFixed(1)}% of fund capacity after this allocation`
        );
      }
    }

    return result;
  }

  /**
   * Validate capital call parameters
   */
  static validateCapitalCallParams(params: {
    callAmountType: 'percentage' | 'dollar';
    callPercentage?: number;
    callDollarAmount?: number;
    allocationAmount: number;
    callCount: number;
  }): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const { callAmountType, callPercentage, callDollarAmount, allocationAmount, callCount } = params;

    if (callAmountType === 'percentage') {
      if (!callPercentage || callPercentage <= 0 || callPercentage > 100) {
        result.isValid = false;
        result.errors.push('Call percentage must be between 1 and 100');
      }
    } else if (callAmountType === 'dollar') {
      if (!callDollarAmount || callDollarAmount <= 0) {
        result.isValid = false;
        result.errors.push('Call dollar amount must be greater than zero');
      }

      if (callDollarAmount && callDollarAmount > allocationAmount) {
        result.isValid = false;
        result.errors.push('Capital call amount cannot exceed allocation amount');
      }
    }

    if (callCount <= 0 || callCount > 20) {
      result.isValid = false;
      result.errors.push('Call count must be between 1 and 20');
    }

    return result;
  }

  /**
   * Comprehensive allocation validation
   */
  static async validateAllocation(
    allocationData: InsertFundAllocation,
    context: AllocationValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Amount validation
    const amountValidation = this.validateAllocationAmount(context);
    result.errors.push(...amountValidation.errors);
    result.warnings.push(...amountValidation.warnings);
    result.isValid = result.isValid && amountValidation.isValid;

    // Business rule validation
    if (allocationData.amountType !== 'dollar') {
      result.errors.push('Allocation amount type must be "dollar". Percentage-based allocations are not supported.');
      result.isValid = false;
    }

    // Security type validation
    if (!allocationData.securityType || allocationData.securityType.trim().length === 0) {
      result.errors.push('Security type is required');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Check if a number appears to be suspiciously round (likely default/test value)
   */
  private static isSuspiciouslyRoundNumber(amount: number): boolean {
    // Check for common default values
    const suspiciousValues = [
      1000000,   // $1M
      5000000,   // $5M
      10000000,  // $10M
      100000000  // $100M
    ];

    if (suspiciousValues.includes(amount)) {
      return true;
    }

    // Check for very round numbers (all zeros except first digit)
    const amountStr = amount.toString();
    if (amountStr.length >= 7) { // $1M or more
      const firstDigit = amountStr[0];
      const restDigits = amountStr.slice(1);
      if (restDigits.split('').every(digit => digit === '0')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Log validation results for audit purposes
   */
  static logValidationResult(
    result: ValidationResult,
    context: AllocationValidationContext,
    userId: number
  ): void {
    if (result.warnings.length > 0 || !result.isValid) {
      console.log('Allocation validation result:', {
        userId,
        dealId: context.dealId,
        fundId: context.fundId,
        amount: context.amount,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        timestamp: new Date().toISOString()
      });
    }
  }
}