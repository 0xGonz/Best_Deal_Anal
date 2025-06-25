/**
 * Production-Ready Allocation Service
 * Unified, scalable service for all allocation operations with proper error handling
 */

import { eq, and, sum, inArray } from 'drizzle-orm';
import { db } from '../db';
import { fundAllocations, funds, deals, capitalCalls } from '@shared/schema';
import type { FundAllocation, Fund, Deal, InsertFundAllocation } from '@shared/schema';
import { AllocationValidator } from './validators/allocation.validator';
import { PortfolioCalculator } from './calculators/portfolio.calculator';
import { DatabaseTransaction } from './database/transaction.service';
import { AuditLogger } from './audit/audit-logger.service';
import { CacheManager } from './cache/cache-manager.service';

export interface AllocationCreationRequest {
  fundId: number;
  dealId: number;
  amount: number;
  amountType?: "percentage" | "dollar";
  securityType: string;
  dealSector?: string;
  allocationDate: string;
  notes?: string;
  status: "committed" | "funded" | "unfunded" | "partially_paid";
  interestPaid?: number;
  distributionPaid?: number;
  marketValue?: number;
  moic?: number;
  irr?: number;
}

export interface AllocationOperationResult {
  success: boolean;
  allocation?: FundAllocation;
  error?: string;
  validationErrors?: string[];
  auditId?: string;
}

export interface FundMetrics {
  fundId: number;
  totalCommittedCapital: number;
  totalAllocations: number;
  calledCapital: number;
  uncalledCapital: number;
  portfolioWeights: Array<{
    allocationId: number;
    amount: number;
    weight: number;
  }>;
}

export class ProductionAllocationService {
  private validator = new AllocationValidator();
  private calculator = new PortfolioCalculator();
  private transaction = new DatabaseTransaction();
  private audit = new AuditLogger();
  private cache = new CacheManager();

  /**
   * Create allocation with comprehensive validation and atomic operations
   */
  async createAllocation(request: AllocationCreationRequest, userId: number): Promise<AllocationOperationResult> {
    const auditId = await this.audit.startOperation('allocation_creation', userId, request);

    try {
      // 1. Comprehensive validation
      const validation = await this.validator.validateCreationRequest(request);
      if (!validation.isValid) {
        await this.audit.logError(auditId, 'Validation failed', validation.errors);
        return {
          success: false,
          validationErrors: validation.errors
        };
      }

      // 2. Check for duplicates with precise logic
      const duplicate = await this.findExactDuplicate(request.fundId, request.dealId);
      if (duplicate) {
        const error = `Allocation already exists: Fund ${request.fundId} → Deal ${request.dealId} (ID: ${duplicate.id})`;
        await this.audit.logError(auditId, error);
        return {
          success: false,
          error
        };
      }

      // 3. Create allocation in atomic transaction
      const allocation = await this.transaction.execute(async (tx) => {
        // Create the allocation
        const [created] = await tx
          .insert(fundAllocations)
          .values({
            fundId: request.fundId,
            dealId: request.dealId,
            amount: request.amount,
            amountType: request.amountType || 'dollar',
            securityType: request.securityType,
            allocationDate: new Date(request.allocationDate),
            notes: request.notes,
            status: request.status,
            portfolioWeight: 0, // Calculated after creation
            interestPaid: request.interestPaid || 0,
            distributionPaid: request.distributionPaid || 0,
            marketValue: request.marketValue || request.amount,
            moic: request.moic || 1,
            irr: request.irr || 0,
            paidAmount: 0,
            calledAmount: 0
          })
          .returning();

        // Update deal stage if needed
        await this.updateDealStageIfNeeded(tx, request.dealId);

        return created;
      });

      // 4. Recalculate portfolio weights (separate operation for performance)
      await this.recalculatePortfolioWeights(request.fundId);

      // 5. Invalidate relevant caches
      await this.cache.invalidatePattern(`fund:${request.fundId}:*`);
      await this.cache.invalidatePattern(`deal:${request.dealId}:*`);

      await this.audit.logSuccess(auditId, 'Allocation created successfully', { allocationId: allocation.id });

      return {
        success: true,
        allocation,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Allocation creation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Update allocation with comprehensive validation
   */
  async updateAllocation(
    allocationId: number,
    updates: Partial<FundAllocation>,
    userId: number
  ): Promise<AllocationOperationResult> {
    const auditId = await this.audit.startOperation('allocation_update', userId, { allocationId, updates });

    try {
      // Get current allocation
      const current = await this.getAllocationById(allocationId);
      if (!current) {
        return {
          success: false,
          error: `Allocation ${allocationId} not found`
        };
      }

      // Validate updates
      const validation = await this.validator.validateUpdateRequest(current, updates);
      if (!validation.isValid) {
        return {
          success: false,
          validationErrors: validation.errors
        };
      }

      // Update in transaction
      const updated = await this.transaction.execute(async (tx) => {
        const [result] = await tx
          .update(fundAllocations)
          .set({
            ...updates,
            updatedAt: new Date()
          })
          .where(eq(fundAllocations.id, allocationId))
          .returning();

        return result;
      });

      // Recalculate portfolio weights if amount changed
      if (updates.amount && updates.amount !== current.amount) {
        await this.recalculatePortfolioWeights(current.fundId);
      }

      // Invalidate caches
      await this.cache.invalidatePattern(`fund:${current.fundId}:*`);

      await this.audit.logSuccess(auditId, 'Allocation updated successfully');

      return {
        success: true,
        allocation: updated,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Allocation update failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete allocation with cascade handling
   */
  async deleteAllocation(allocationId: number, userId: number): Promise<AllocationOperationResult> {
    const auditId = await this.audit.startOperation('allocation_deletion', userId, { allocationId });

    try {
      const allocation = await this.getAllocationById(allocationId);
      if (!allocation) {
        return {
          success: false,
          error: `Allocation ${allocationId} not found`
        };
      }

      // Check for dependent capital calls
      const dependentCalls = await db
        .select()
        .from(capitalCalls)
        .where(eq(capitalCalls.allocationId, allocationId));

      if (dependentCalls.length > 0) {
        return {
          success: false,
          error: `Cannot delete allocation with ${dependentCalls.length} related capital calls. Delete capital calls first.`
        };
      }

      // Delete in transaction
      await this.transaction.execute(async (tx) => {
        await tx
          .delete(fundAllocations)
          .where(eq(fundAllocations.id, allocationId));
      });

      // Recalculate weights for affected fund
      await this.recalculatePortfolioWeights(allocation.fundId);

      // Invalidate caches
      await this.cache.invalidatePattern(`fund:${allocation.fundId}:*`);

      await this.audit.logSuccess(auditId, 'Allocation deleted successfully');

      return {
        success: true,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Allocation deletion failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get fund metrics with caching
   */
  async getFundMetrics(fundId: number): Promise<FundMetrics> {
    const cacheKey = `fund:${fundId}:metrics`;
    const cached = await this.cache.get<FundMetrics>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const metrics = await this.calculator.calculateFundMetrics(fundId);
    await this.cache.set(cacheKey, metrics, 300); // Cache for 5 minutes

    return metrics;
  }

  /**
   * Batch operation for multiple allocations - scales to hundreds of allocations
   */
  async batchCreateAllocations(
    requests: AllocationCreationRequest[],
    userId: number
  ): Promise<Array<AllocationOperationResult>> {
    const results: AllocationOperationResult[] = [];

    // Dynamic chunk sizing based on request volume for optimal performance
    const CHUNK_SIZE = requests.length > 100 ? 25 : requests.length > 50 ? 15 : 10;
    
    console.log(`Processing ${requests.length} allocations in chunks of ${CHUNK_SIZE}`);

    for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
      const chunk = requests.slice(i, i + CHUNK_SIZE);
      
      // Process chunk with progress logging for large batches
      if (requests.length > 20) {
        console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(requests.length / CHUNK_SIZE)}`);
      }
      
      const chunkResults = await Promise.all(
        chunk.map(request => this.createAllocation(request, userId))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Private helper methods
   */
  private async findExactDuplicate(fundId: number, dealId: number): Promise<FundAllocation | null> {
    const [existing] = await db
      .select()
      .from(fundAllocations)
      .where(
        and(
          eq(fundAllocations.fundId, fundId),
          eq(fundAllocations.dealId, dealId)
        )
      )
      .limit(1);

    return existing || null;
  }

  private async getAllocationById(id: number): Promise<FundAllocation | null> {
    const [allocation] = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.id, id))
      .limit(1);

    return allocation || null;
  }

  private async updateDealStageIfNeeded(tx: any, dealId: number): Promise<void> {
    // Update deal to 'invested' stage if it's currently 'closing'
    const [deal] = await tx
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .limit(1);

    if (deal && deal.stage === 'closing') {
      await tx
        .update(deals)
        .set({ stage: 'invested' })
        .where(eq(deals.id, dealId));
    }
  }

  private async recalculatePortfolioWeights(fundId: number): Promise<void> {
    const weights = await this.calculator.calculatePortfolioWeights(fundId);
    
    // Update all allocations with new weights in batch
    if (weights.length > 0) {
      await this.transaction.execute(async (tx) => {
        for (const weight of weights) {
          await tx
            .update(fundAllocations)
            .set({ portfolioWeight: weight.weight })
            .where(eq(fundAllocations.id, weight.allocationId));
        }
      });
    }
  }
}

export const productionAllocationService = new ProductionAllocationService();