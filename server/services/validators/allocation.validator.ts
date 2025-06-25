/**
 * Comprehensive Allocation Validator
 * Handles all business rule validation for allocation operations
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { funds, deals, fundAllocations } from '@shared/schema';
import type { FundAllocation } from '@shared/schema';
import { AllocationCreationRequest } from '../production-allocation.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface BusinessRules {
  maxAllocationPerFund: number;
  maxAllocationPerDeal: number;
  minAllocationAmount: number;
  maxFundUtilization: number; // Percentage
  allowedSecurityTypes: string[];
  allowedStatuses: string[];
}

export class AllocationValidator {
  private businessRules: BusinessRules = {
    maxAllocationPerFund: 50_000_000, // $50M
    maxAllocationPerDeal: 10_000_000,  // $10M
    minAllocationAmount: 1_000,        // $1K
    maxFundUtilization: 95,            // 95%
    allowedSecurityTypes: ['equity', 'debt', 'convertible', 'warrant', 'option'],
    allowedStatuses: ['committed', 'funded', 'unfunded', 'partially_paid', 'written_off']
  };

  /**
   * Validate allocation creation request
   */
  async validateCreationRequest(request: AllocationCreationRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic field validation
      this.validateBasicFields(request, errors);

      // Business rule validation
      await this.validateBusinessRules(request, errors, warnings);

      // Entity existence validation
      await this.validateEntityExistence(request, errors);

      // Fund capacity validation - REMOVED per user request
      // Fund capacity limits are inappropriate for investment management

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Validate allocation update request
   */
  async validateUpdateRequest(
    current: FundAllocation,
    updates: Partial<FundAllocation>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Status transition validation
      if (updates.status && updates.status !== current.status) {
        this.validateStatusTransition(current.status, updates.status, errors);
      }

      // Amount validation
      if (updates.amount !== undefined) {
        this.validateAmount(updates.amount, errors);
        
        // Amount increase validation - removed fund capacity check
      }

      // Security type validation
      if (updates.securityType) {
        this.validateSecurityType(updates.securityType, errors);
      }

      // Date validation
      if (updates.allocationDate) {
        this.validateAllocationDate(updates.allocationDate, errors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`Update validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Private validation methods
   */
  private validateBasicFields(request: AllocationCreationRequest, errors: string[]): void {
    // Required fields
    if (!request.fundId || !Number.isInteger(request.fundId) || request.fundId <= 0) {
      errors.push('Valid fund ID is required');
    }

    if (!request.dealId || !Number.isInteger(request.dealId) || request.dealId <= 0) {
      errors.push('Valid deal ID is required');
    }

    if (!request.amount || typeof request.amount !== 'number' || request.amount <= 0) {
      errors.push('Valid allocation amount is required');
    }

    if (!request.securityType || typeof request.securityType !== 'string') {
      errors.push('Security type is required');
    }

    if (!request.status || typeof request.status !== 'string') {
      errors.push('Allocation status is required');
    }

    // Date validation
    if (request.allocationDate) {
      const date = new Date(request.allocationDate);
      if (isNaN(date.getTime())) {
        errors.push('Invalid allocation date format');
      }
    }
  }

  private async validateBusinessRules(
    request: AllocationCreationRequest,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Amount validation
    this.validateAmount(request.amount, errors);

    // Security type validation
    this.validateSecurityType(request.securityType, errors);

    // Status validation
    if (!this.businessRules.allowedStatuses.includes(request.status)) {
      errors.push(`Invalid status: ${request.status}. Allowed values: ${this.businessRules.allowedStatuses.join(', ')}`);
    }

    // Amount type validation
    if (request.amountType && !['percentage', 'dollar'].includes(request.amountType)) {
      errors.push('Amount type must be either "percentage" or "dollar"');
    }

    // Percentage validation
    if (request.amountType === 'percentage' && (request.amount < 0 || request.amount > 100)) {
      errors.push('Percentage amounts must be between 0 and 100');
    }

    // Large allocation warning
    if (request.amount > this.businessRules.maxAllocationPerDeal) {
      warnings?.push(`Large allocation detected: $${request.amount.toLocaleString()}. Consider approval workflow.`);
    }
  }

  private validateAmount(amount: number, errors: string[]): void {
    if (amount < this.businessRules.minAllocationAmount) {
      errors.push(`Allocation amount must be at least $${this.businessRules.minAllocationAmount.toLocaleString()}`);
    }

    if (amount > this.businessRules.maxAllocationPerFund) {
      errors.push(`Allocation amount exceeds maximum limit of $${this.businessRules.maxAllocationPerFund.toLocaleString()}`);
    }
  }

  private validateSecurityType(securityType: string, errors: string[]): void {
    if (!this.businessRules.allowedSecurityTypes.includes(securityType.toLowerCase())) {
      errors.push(`Invalid security type: ${securityType}. Allowed values: ${this.businessRules.allowedSecurityTypes.join(', ')}`);
    }
  }

  private validateAllocationDate(allocationDate: Date | string, errors: string[]): void {
    const date = new Date(allocationDate);
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    if (isNaN(date.getTime())) {
      errors.push('Invalid allocation date');
    } else if (date > oneYearFromNow) {
      errors.push('Allocation date cannot be more than one year in the future');
    }
  }

  private async validateEntityExistence(request: AllocationCreationRequest, errors: string[]): Promise<void> {
    // Check fund exists
    const [fund] = await db
      .select()
      .from(funds)
      .where(eq(funds.id, request.fundId))
      .limit(1);

    if (!fund) {
      errors.push(`Fund with ID ${request.fundId} does not exist`);
    }

    // Check deal exists
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, request.dealId))
      .limit(1);

    if (!deal) {
      errors.push(`Deal with ID ${request.dealId} does not exist`);
    }
  }

  // REMOVED: Fund capacity validation - inappropriate for investment management
  // Funds should not have artificial capacity limits

  private validateStatusTransition(currentStatus: string, newStatus: string, errors: string[]): void {
    const validTransitions: Record<string, string[]> = {
      'committed': ['funded', 'unfunded', 'partially_paid', 'written_off'],
      'unfunded': ['committed', 'funded', 'partially_paid', 'written_off'],
      'partially_paid': ['funded', 'written_off'],
      'funded': ['partially_paid', 'written_off'],
      'written_off': [] // Terminal state
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      errors.push(`Invalid status transition from '${currentStatus}' to '${newStatus}'`);
    }
  }

  // REMOVED: Amount increase validation - no capacity limits needed

  /**
   * Update business rules (for configuration management)
   */
  updateBusinessRules(newRules: Partial<BusinessRules>): void {
    this.businessRules = {
      ...this.businessRules,
      ...newRules
    };
  }

  /**
   * Get current business rules
   */
  getBusinessRules(): BusinessRules {
    return { ...this.businessRules };
  }
}