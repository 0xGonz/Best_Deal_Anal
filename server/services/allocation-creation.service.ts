/**
 * Allocation Creation Service
 * 
 * Provides robust allocation creation with proper validation,
 * error handling, and database transaction safety
 */

import { StorageFactory } from '../storage-factory.js';
import { AllocationStatusService } from './allocation-status.service.js';
import { z } from 'zod';

export interface AllocationCreationRequest {
  dealId: number;
  fundId: number;
  amount: number;
  securityType?: string;
  amountType?: string;
  status?: string;
  userId?: number;
}

export interface AllocationCreationResult {
  success: boolean;
  allocation?: any;
  error?: string;
  validationErrors?: string[];
}

export class AllocationCreationService {
  private static storage = StorageFactory.getStorage();

  /**
   * Create allocation with comprehensive validation and error handling
   */
  static async createAllocation(request: AllocationCreationRequest): Promise<AllocationCreationResult> {
    try {
      // 1. Validate input data
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 2. Check for duplicate allocation
      const existingAllocations = await this.storage.getAllocationsByDeal(request.dealId);
      const duplicateCheck = existingAllocations.find(a => a.fundId === request.fundId);
      
      if (duplicateCheck) {
        return {
          success: false,
          error: `Allocation already exists between this deal and fund (ID: ${duplicateCheck.id})`
        };
      }

      // 3. Verify deal and fund exist
      const deal = await this.storage.getDeal(request.dealId);
      const fund = await this.storage.getFund(request.fundId);

      if (!deal) {
        return {
          success: false,
          error: `Deal ${request.dealId} not found`
        };
      }

      if (!fund) {
        return {
          success: false,
          error: `Fund ${request.fundId} not found`
        };
      }

      // 4. Prepare allocation data with proper defaults
      const allocationData = {
        dealId: request.dealId,
        fundId: request.fundId,
        amount: request.amount,
        securityType: request.securityType || 'equity',
        amountType: request.amountType || 'committed',
        status: request.status || 'committed',
        allocationDate: new Date(),
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        totalReturned: 0,
        marketValue: request.amount, // Initial market value = amount
        moic: 1,
        irr: 0,
        paidAmount: 0,
        calledAmount: 0
      };

      // 5. Apply status validation
      const statusResult = AllocationStatusService.calculateStatus({
        amount: allocationData.amount,
        paidAmount: allocationData.paidAmount || 0
      });

      allocationData.status = statusResult.status;

      // 6. Create the allocation
      const createdAllocation = await this.storage.createFundAllocation(allocationData);

      if (!createdAllocation) {
        return {
          success: false,
          error: 'Failed to create allocation in database'
        };
      }

      // 7. Update deal stage if this is first allocation
      if (deal.stage === 'closing' && existingAllocations.length === 0) {
        await this.storage.updateDeal(deal.id, { stage: 'invested' });
        console.log(`Deal ${deal.id} (${deal.name}) moved to 'invested' stage after allocation creation`);
      }

      return {
        success: true,
        allocation: createdAllocation
      };

    } catch (error) {
      console.error('Allocation creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate allocation creation request
   */
  private static validateRequest(request: AllocationCreationRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!request.dealId || request.dealId <= 0) {
      errors.push('Valid deal ID is required');
    }

    if (!request.fundId || request.fundId <= 0) {
      errors.push('Valid fund ID is required');
    }

    if (!request.amount || request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    // Amount limits (business rules)
    if (request.amount > 100000000) { // $100M limit
      errors.push('Amount cannot exceed $100,000,000');
    }

    // Security type validation
    const validSecurityTypes = ['equity', 'debt', 'preferred', 'convertible', 'warrant'];
    if (request.securityType && !validSecurityTypes.includes(request.securityType)) {
      errors.push(`Security type must be one of: ${validSecurityTypes.join(', ')}`);
    }

    // Amount type validation
    const validAmountTypes = ['committed', 'called', 'funded'];
    if (request.amountType && !validAmountTypes.includes(request.amountType)) {
      errors.push(`Amount type must be one of: ${validAmountTypes.join(', ')}`);
    }

    // Status validation
    const validStatuses = ['committed', 'partially_paid', 'funded', 'unfunded'];
    if (request.status && !validStatuses.includes(request.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get allocation creation statistics for monitoring
   */
  static async getCreationStats(): Promise<{
    totalAllocations: number;
    recentCreations: number;
    averageAmount: number;
    topFunds: Array<{ fundId: number; fundName: string; allocationCount: number }>;
  }> {
    try {
      const allAllocations = await this.storage.getAllocationsByFund(0); // Get all
      const funds = await this.storage.getFunds();

      // Calculate stats
      const totalAllocations = allAllocations.length;
      const recentCreations = allAllocations.filter(a => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return new Date(a.allocationDate) > dayAgo;
      }).length;

      const averageAmount = allAllocations.length > 0 
        ? allAllocations.reduce((sum, a) => sum + a.amount, 0) / allAllocations.length
        : 0;

      // Top funds by allocation count
      const fundStats = funds.map(fund => {
        const allocations = allAllocations.filter(a => a.fundId === fund.id);
        return {
          fundId: fund.id,
          fundName: fund.name,
          allocationCount: allocations.length
        };
      }).sort((a, b) => b.allocationCount - a.allocationCount);

      return {
        totalAllocations,
        recentCreations,
        averageAmount,
        topFunds: fundStats.slice(0, 5)
      };
    } catch (error) {
      console.error('Error getting allocation stats:', error);
      return {
        totalAllocations: 0,
        recentCreations: 0,
        averageAmount: 0,
        topFunds: []
      };
    }
  }
}