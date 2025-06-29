/**
 * Transaction-Safe Allocation Service
 * 
 * Implements proper transaction boundaries for allocation creation,
 * addressing Issue #2 from the audit: Missing transaction boundaries
 */

import { db } from '../db';
import { fundAllocations, funds, deals } from '@shared/schema';
import { eq, and, sum, sql } from 'drizzle-orm';
import { StorageFactory } from '../storage-factory';
import { metricsCalculator } from './metrics-calculator.service';
import { AuditService } from './audit.service';

interface AllocationRequest {
  fundId: number;
  dealId: number;
  amount: number;
  amountType: 'dollar' | 'percentage';
  securityType: string;
  allocationDate: Date;
  notes?: string;
  status?: string;
}

interface AllocationResult {
  success: boolean;
  allocation?: any;
  error?: string;
  rollbackReason?: string;
}

export class TransactionSafeAllocationService {
  private storage = StorageFactory.getStorage();
  private auditService = new AuditService();

  /**
   * Create a single allocation with full transaction safety
   */
  async createAllocationSafely(
    request: AllocationRequest,
    userId: number
  ): Promise<AllocationResult> {
    return await db.transaction(async (tx) => {
      try {
        // 1. Validate deal and fund exist within transaction
        const [deal] = await tx
          .select()
          .from(deals)
          .where(eq(deals.id, request.dealId))
          .limit(1);

        const [fund] = await tx
          .select()
          .from(funds)
          .where(eq(funds.id, request.fundId))
          .limit(1);

        if (!deal) {
          throw new Error(`Deal ${request.dealId} not found`);
        }

        if (!fund) {
          throw new Error(`Fund ${request.fundId} not found`);
        }

        // 2. Check for duplicate allocation
        const existingAllocation = await tx
          .select()
          .from(fundAllocations)
          .where(
            and(
              eq(fundAllocations.fundId, request.fundId),
              eq(fundAllocations.dealId, request.dealId)
            )
          )
          .limit(1);

        if (existingAllocation.length > 0) {
          throw new Error(`Allocation already exists between deal ${request.dealId} and fund ${request.fundId}`);
        }

        // 3. Fund capacity validation
        const capacityCheck = await this.validateFundCapacity(tx, request.fundId, request.amount, request.amountType, fund);
        if (!capacityCheck.valid) {
          throw new Error(capacityCheck.error);
        }

        // 4. Handle percentage to dollar conversion
        const finalAmount = await this.convertAmountToDollar(request.amount, request.amountType, fund);

        // 5. Create the allocation
        const [newAllocation] = await tx
          .insert(fundAllocations)
          .values({
            fundId: request.fundId,
            dealId: request.dealId,
            amount: finalAmount,
            amountType: 'dollar', // Always store as dollar after conversion
            securityType: request.securityType,
            allocationDate: request.allocationDate,
            notes: request.notes,
            status: request.status || 'committed',
            portfolioWeight: 0, // Will be calculated after creation
            interestPaid: 0,
            distributionPaid: 0,
            totalReturned: 0,
            marketValue: finalAmount,
            moic: 1,
            irr: 0,
            paidAmount: 0,
            calledAmount: 0
          })
          .returning();

        // 6. Update deal stage if needed
        if (deal.stage !== 'invested') {
          await tx
            .update(deals)
            .set({ stage: 'invested' })
            .where(eq(deals.id, request.dealId));
        }

        // 7. Recalculate metrics within transaction
        await this.recalculateFundMetricsInTransaction(tx, request.fundId);

        // 8. Log audit trail (final step)
        await this.auditService.logAllocationCreation(
          newAllocation.id,
          request.dealId,
          request.fundId,
          finalAmount,
          userId,
          { 
            securityType: request.securityType, 
            notes: request.notes,
            originalAmount: request.amount,
            originalAmountType: request.amountType
          }
        );

        return {
          success: true,
          allocation: newAllocation
        };

      } catch (error: any) {
        console.error('Transaction failed, rolling back:', error.message);
        throw error; // This will trigger automatic rollback
      }
    });
  }

  /**
   * Create multiple allocations with transaction safety
   */
  async createMultipleAllocationsSafely(
    dealId: number,
    allocations: Omit<AllocationRequest, 'dealId'>[],
    userId: number
  ): Promise<AllocationResult> {
    return await db.transaction(async (tx) => {
      try {
        const createdAllocations = [];
        const affectedFunds = new Set<number>();

        // 1. Validate deal exists
        const [deal] = await tx
          .select()
          .from(deals)
          .where(eq(deals.id, dealId))
          .limit(1);

        if (!deal) {
          throw new Error(`Deal ${dealId} not found`);
        }

        // 2. Validate all funds exist
        const fundIds = allocations.map(a => a.fundId);
        const fundResults = await tx
          .select()
          .from(funds)
          .where(sql`id = ANY(${fundIds})`);

        if (fundResults.length !== fundIds.length) {
          const foundIds = fundResults.map(f => f.id);
          const missingIds = fundIds.filter(id => !foundIds.includes(id));
          throw new Error(`Funds not found: ${missingIds.join(', ')}`);
        }

        // 3. Check for any duplicate allocations
        const existingAllocations = await tx
          .select()
          .from(fundAllocations)
          .where(
            and(
              eq(fundAllocations.dealId, dealId),
              sql`fund_id = ANY(${fundIds})`
            )
          );

        if (existingAllocations.length > 0) {
          const duplicateFunds = existingAllocations.map(a => a.fundId);
          throw new Error(`Duplicate allocations found for funds: ${duplicateFunds.join(', ')}`);
        }

        // 4. Create all allocations
        for (const allocation of allocations) {
          const fund = fundResults.find(f => f.id === allocation.fundId)!;
          
          // Validate capacity
          const capacityCheck = await this.validateFundCapacity(tx, allocation.fundId, allocation.amount, allocation.amountType, fund);
          if (!capacityCheck.valid) {
            throw new Error(`Fund ${allocation.fundId}: ${capacityCheck.error}`);
          }

          // Convert amount
          const finalAmount = await this.convertAmountToDollar(allocation.amount, allocation.amountType, fund);

          // Create allocation
          const [newAllocation] = await tx
            .insert(fundAllocations)
            .values({
              fundId: allocation.fundId,
              dealId: dealId,
              amount: finalAmount,
              amountType: 'dollar',
              securityType: allocation.securityType,
              allocationDate: allocation.allocationDate,
              notes: allocation.notes,
              status: allocation.status || 'committed',
              portfolioWeight: 0,
              interestPaid: 0,
              distributionPaid: 0,
              totalReturned: 0,
              marketValue: finalAmount,
              moic: 1,
              irr: 0,
              paidAmount: 0,
              calledAmount: 0
            })
            .returning();

          createdAllocations.push(newAllocation);
          affectedFunds.add(allocation.fundId);
        }

        // 5. Update deal stage
        if (deal.stage !== 'invested') {
          await tx
            .update(deals)
            .set({ stage: 'invested' })
            .where(eq(deals.id, dealId));
        }

        // 6. Recalculate metrics for all affected funds (batch operation)
        for (const fundId of affectedFunds) {
          await this.recalculateFundMetricsInTransaction(tx, fundId);
        }

        // 7. Audit logging
        for (const allocation of createdAllocations) {
          await this.auditService.logAllocationCreation(
            allocation.id,
            dealId,
            allocation.fundId,
            allocation.amount,
            userId,
            { 
              securityType: allocation.securityType, 
              notes: allocation.notes,
              multiFundAllocation: true
            }
          );
        }

        return {
          success: true,
          allocation: createdAllocations
        };

      } catch (error: any) {
        console.error('Multi-allocation transaction failed, rolling back:', error.message);
        throw error;
      }
    });
  }

  /**
   * Validate fund capacity before allocation
   */
  private async validateFundCapacity(
    tx: any,
    fundId: number,
    amount: number,
    amountType: 'dollar' | 'percentage',
    fund: any
  ): Promise<{ valid: boolean; error?: string }> {
    if (!fund.targetSize || fund.targetSize <= 0) {
      return { valid: true }; // No capacity limit set
    }

    // Get current allocations for this fund
    const currentAllocations = await tx
      .select({ totalAmount: sum(fundAllocations.amount) })
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    const currentTotal = currentAllocations[0]?.totalAmount || 0;
    const requestedAmount = amountType === 'percentage' 
      ? (amount / 100) * fund.targetSize 
      : amount;

    const newTotal = currentTotal + requestedAmount;
    
    if (newTotal > fund.targetSize) {
      return {
        valid: false,
        error: `Allocation would exceed fund capacity. Current: $${currentTotal.toLocaleString()}, Requested: $${requestedAmount.toLocaleString()}, Target: $${fund.targetSize.toLocaleString()}`
      };
    }

    return { valid: true };
  }

  /**
   * Convert percentage amounts to dollar amounts
   */
  private async convertAmountToDollar(
    amount: number,
    amountType: 'dollar' | 'percentage',
    fund: any
  ): Promise<number> {
    if (amountType === 'dollar') {
      return amount;
    }

    if (!fund.targetSize || fund.targetSize <= 0) {
      throw new Error('Cannot convert percentage allocation: fund has no target size');
    }

    return (amount / 100) * fund.targetSize;
  }

  /**
   * Recalculate fund metrics within a transaction
   */
  private async recalculateFundMetricsInTransaction(tx: any, fundId: number): Promise<void> {
    // Get all allocations for this fund
    const allocations = await tx
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);
    const totalFunded = allocations
      .filter(a => a.status === 'funded')
      .reduce((sum, a) => sum + a.amount, 0);

    const totalAllocations = allocations.length;

    // Calculate portfolio weights
    if (totalCommitted > 0) {
      for (const allocation of allocations) {
        const weight = (allocation.amount / totalCommitted) * 100;
        await tx
          .update(fundAllocations)
          .set({ portfolioWeight: weight })
          .where(eq(fundAllocations.id, allocation.id));
      }
    }

    // Update fund AUM
    await tx
      .update(funds)
      .set({ 
        aum: totalFunded,
        // Update other computed fields as needed
      })
      .where(eq(funds.id, fundId));
  }
}

export const transactionSafeAllocationService = new TransactionSafeAllocationService();