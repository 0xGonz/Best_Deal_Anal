/**
 * Multi-Fund Allocation Service
 * Handles deals being allocated to multiple funds with proper validation and coordination
 */

import { db } from '../db';
import { fundAllocations, funds, deals, capitalCalls } from '@shared/schema';
import { eq, and, sum } from 'drizzle-orm';
import { StorageFactory } from '../storage-factory';
import { metricsCalculator } from './metrics-calculator.service';
import { AuditService } from './audit.service';
import { ErrorHandlerService, ValidationRules } from './error-handler.service';
import { ApplicationError, ValidationError, DatabaseError } from './type-definitions';

interface MultiFundAllocation {
  dealId: number;
  dealName?: string;
  allocations: {
    fundId: number;
    fundName?: string;
    amount: number;
    amountType: 'dollar' | 'percentage';
    securityType: string;
    allocationDate: Date;
    notes?: string;
  }[];
}

interface AllocationSummary {
  dealId: number;
  dealName: string;
  totalAllocated: number;
  fundCount: number;
  allocations: {
    fundId: number;
    fundName: string;
    amount: number;
    percentage: number;
    status: string;
  }[];
}

export class MultiFundAllocationService {
  private storage = StorageFactory.getStorage();

  /**
   * Create allocations for a deal across multiple funds
   */
  async createMultiFundAllocation(
    allocationRequest: MultiFundAllocation,
    userId: number,
    request: any
  ): Promise<any[]> {
    // Use transaction-safe service for atomic operations
    const { transactionSafeAllocationService } = await import('./transaction-safe-allocation.service');
    
    try {
      const result = await transactionSafeAllocationService.createMultipleAllocationsSafely(
        allocationRequest.dealId,
        allocationRequest.allocations.map(a => ({
          fundId: a.fundId,
          amount: a.amount,
          amountType: a.amountType,
          securityType: a.securityType,
          allocationDate: a.allocationDate,
          notes: a.notes,
          status: 'committed'
        })),
        userId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create allocations');
      }

      const createdAllocations = Array.isArray(result.allocation) ? result.allocation : [result.allocation];
      
      console.log(`✅ Created ${createdAllocations.length} allocations with transaction safety for deal ${allocationRequest.dealId}`);
      
      return createdAllocations;
    } catch (error) {
      console.error('Error creating multi-fund allocation:', error);
      throw error;
    }
  }

  /**
   * Get allocation summary for a deal across all funds
   */
  async getDealAllocationSummary(dealId: number): Promise<AllocationSummary> {
    try {
      // Get deal info
      const deal = await this.storage.getDeal(dealId);
      if (!deal) {
        throw new ValidationError('Deal not found', 'dealId');
      }

      // Get all allocations for this deal
      const allocations = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.dealId, dealId));

      if (allocations.length === 0) {
        return {
          dealId,
          dealName: deal.name,
          totalAllocated: 0,
          fundCount: 0,
          allocations: []
        };
      }

      // Get fund information for all allocations
      const fundIds = allocations.map(a => a.fundId);
      const fundData = await Promise.all(
        fundIds.map(id => this.storage.getFund(id))
      );

      const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);

      const allocationSummary = allocations.map((allocation, index) => {
        const fund = fundData[index];
        return {
          fundId: allocation.fundId,
          fundName: fund?.name || 'Unknown Fund',
          amount: Number(allocation.amount),
          percentage: totalAllocated > 0 ? (Number(allocation.amount) / totalAllocated) * 100 : 0,
          status: allocation.status || 'committed'
        };
      });

      return {
        dealId,
        dealName: deal.name,
        totalAllocated,
        fundCount: allocations.length,
        allocations: allocationSummary
      };
    } catch (error) {
      console.error('Error getting deal allocation summary:', error);
      throw error;
    }
  }

  /**
   * Update allocation across multiple funds
   */
  async updateMultiFundAllocation(
    dealId: number,
    updates: { fundId: number; changes: any }[],
    userId: number,
    request: any
  ): Promise<any[]> {
    try {
      const updatedAllocations = [];

      for (const update of updates) {
        // Get existing allocation
        const existingAllocations = await db
          .select()
          .from(fundAllocations)
          .where(
            and(
              eq(fundAllocations.dealId, dealId),
              eq(fundAllocations.fundId, update.fundId)
            )
          );

        if (existingAllocations.length === 0) {
          throw new ValidationError(
            `No allocation found for deal ${dealId} in fund ${update.fundId}`,
            'allocation'
          );
        }

        const allocation = existingAllocations[0];

        // Update the allocation
        const updated = await this.storage.updateFundAllocation(allocation.id, update.changes);
        if (!updated) {
          throw new DatabaseError(`Failed to update allocation ${allocation.id}`);
        }

        updatedAllocations.push(updated);

        // Log the update for audit
        await AuditService.logAllocationUpdate(
          allocation.id,
          allocation,
          update.changes,
          userId,
          request
        );

        // Update metrics for this allocation
        await metricsCalculator.updateAllocationMetrics(allocation.id);

        // Recalculate fund metrics
        await this.recalculateFundMetrics(update.fundId);
      }

      return updatedAllocations;
    } catch (error) {
      console.error('Error updating multi-fund allocation:', error);
      throw error;
    }
  }

  /**
   * Validate no duplicate allocations exist
   */
  private async validateNoDuplicateAllocations(dealId: number, fundIds: number[]): Promise<void> {
    for (const fundId of fundIds) {
      const existing = await db
        .select()
        .from(fundAllocations)
        .where(
          and(
            eq(fundAllocations.dealId, dealId),
            eq(fundAllocations.fundId, fundId)
          )
        );

      if (existing.length > 0) {
        throw new ValidationError(
          `Deal ${dealId} is already allocated to fund ${fundId}`,
          'duplicate'
        );
      }
    }
  }

  /**
   * Validate allocation amounts
   */
  private validateAllocationAmounts(allocations: MultiFundAllocation['allocations']): void {
    for (const allocation of allocations) {
      if (!ValidationRules.isPositiveNumber(allocation.amount)) {
        throw new ValidationError('Allocation amount must be positive', 'amount');
      }

      if (!ValidationRules.isAmountType(allocation.amountType)) {
        throw new ValidationError('Invalid amount type', 'amountType');
      }

      if (allocation.amountType === 'percentage') {
        if (allocation.amount > 100) {
          throw new ValidationError('Percentage allocation cannot exceed 100%', 'amount');
        }
      }
    }

    // Check that percentage allocations don't exceed 100% total
    const percentageAllocations = allocations.filter(a => a.amountType === 'percentage');
    if (percentageAllocations.length > 0) {
      const totalPercentage = percentageAllocations.reduce((sum, a) => sum + a.amount, 0);
      if (totalPercentage > 100) {
        throw new ValidationError(
          `Total percentage allocations (${totalPercentage}%) exceed 100%`,
          'totalPercentage'
        );
      }
    }
  }

  /**
   * Recalculate all metrics for a fund
   */
  private async recalculateFundMetrics(fundId: number): Promise<void> {
    try {
      await metricsCalculator.recalculateFundMetrics(fundId);
      console.log(`✅ Recalculated metrics for fund ${fundId}`);
    } catch (error) {
      console.error(`Error recalculating metrics for fund ${fundId}:`, error);
      // Don't throw - this shouldn't break the main operation
    }
  }

  /**
   * Get all deals with their multi-fund allocation status
   */
  async getDealsWithMultiFundStatus(): Promise<any[]> {
    try {
      // Get all deals
      const allDeals = await this.storage.getDeals();

      // Get allocation counts for each deal
      const dealsWithStatus = await Promise.all(
        allDeals.map(async (deal) => {
          const allocations = await db
            .select()
            .from(fundAllocations)
            .where(eq(fundAllocations.dealId, deal.id));

          const fundCount = allocations.length;
          const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);

          return {
            ...deal,
            fundCount,
            totalAllocated,
            isMultiFund: fundCount > 1,
            allocationStatus: fundCount === 0 ? 'unallocated' : 
                           fundCount === 1 ? 'single-fund' : 'multi-fund'
          };
        })
      );

      return dealsWithStatus;
    } catch (error) {
      console.error('Error getting deals with multi-fund status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const multiFundAllocationService = new MultiFundAllocationService();