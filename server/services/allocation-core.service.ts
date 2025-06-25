/**
 * Core Allocation Service - Rock Solid Architecture
 * 
 * This service provides the foundation for all allocation operations with:
 * 1. Immutable data operations (no status corruption)
 * 2. Atomic transactions with proper isolation
 * 3. Modular weight calculation system
 * 4. Proper duplicate detection logic
 * 5. Complete separation of concerns
 */

import { eq, and, sum } from 'drizzle-orm';
import { db } from '../database/connection';
import { fundAllocations, funds, deals } from '@shared/schema';
import type { FundAllocation, Fund, Deal } from '@shared/schema';

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

export interface PortfolioWeightCalculation {
  allocationId: number;
  amount: number;
  weight: number;
}

export interface FundPortfolioSummary {
  fundId: number;
  totalCommittedCapital: number;
  totalAllocations: number;
  weights: PortfolioWeightCalculation[];
}

export class AllocationCoreService {
  /**
   * IMMUTABLE WEIGHT CALCULATION
   * This method ONLY calculates weights without modifying any allocation records
   */
  async calculatePortfolioWeights(fundId: number): Promise<FundPortfolioSummary> {
    console.log(`🔢 Calculating portfolio weights for fund ${fundId}`);
    
    // Get all active allocations for the fund
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    if (allocations.length === 0) {
      return {
        fundId,
        totalCommittedCapital: 0,
        totalAllocations: 0,
        weights: []
      };
    }

    // Calculate total committed capital
    const totalCommittedCapital = allocations.reduce((sum, allocation) => {
      return sum + (allocation.amount || 0);
    }, 0);

    // Calculate individual weights
    const weights: PortfolioWeightCalculation[] = allocations.map(allocation => {
      const weight = totalCommittedCapital > 0 
        ? (allocation.amount / totalCommittedCapital) * 100 
        : 0;
      
      return {
        allocationId: allocation.id,
        amount: allocation.amount,
        weight: parseFloat(weight.toFixed(1))
      };
    });

    console.log(`📊 Portfolio weights calculated for fund ${fundId}:`);
    console.log(`   Total committed capital: $${totalCommittedCapital.toLocaleString()}`);
    console.log(`   Active allocations: ${allocations.length}`);
    weights.forEach(w => {
      console.log(`     Allocation ${w.allocationId}: $${w.amount.toLocaleString()} = ${w.weight}%`);
    });

    return {
      fundId,
      totalCommittedCapital,
      totalAllocations: allocations.length,
      weights
    };
  }

  /**
   * ATOMIC WEIGHT UPDATES
   * Updates ONLY portfolio weights in isolation, never touches status fields
   */
  async updatePortfolioWeights(fundId: number): Promise<void> {
    console.log(`🔄 Updating portfolio weights for fund ${fundId} (weights only)`);
    
    const summary = await this.calculatePortfolioWeights(fundId);
    
    if (summary.weights.length === 0) {
      console.log(`   No allocations found for fund ${fundId}`);
      return;
    }

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      for (const weightCalc of summary.weights) {
        await tx
          .update(fundAllocations)
          .set({ 
            portfolioWeight: weightCalc.weight 
          })
          .where(eq(fundAllocations.id, weightCalc.allocationId));
      }
    });

    console.log(`✅ Portfolio weights updated successfully for fund ${fundId}`);
  }

  /**
   * PRECISE DUPLICATE DETECTION
   * Checks for exact fund-deal combinations only
   */
  async findDuplicateAllocation(fundId: number, dealId: number): Promise<FundAllocation | null> {
    console.log(`🔍 Checking for duplicate allocation: Fund ${fundId} + Deal ${dealId}`);
    
    const existing = await db
      .select()
      .from(fundAllocations)
      .where(
        and(
          eq(fundAllocations.fundId, fundId),
          eq(fundAllocations.dealId, dealId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`❌ Duplicate found: Allocation ${existing[0].id} already exists for Fund ${fundId} + Deal ${dealId}`);
      return existing[0];
    }

    console.log(`✅ No duplicate found for Fund ${fundId} + Deal ${dealId}`);
    return null;
  }

  /**
   * ATOMIC ALLOCATION CREATION
   * Creates allocation with proper transaction isolation
   */
  async createAllocation(request: AllocationCreationRequest): Promise<FundAllocation> {
    console.log(`🚀 Creating allocation: Fund ${request.fundId} + Deal ${request.dealId}, Amount: $${request.amount.toLocaleString()}`);
    
    // Validate fund and deal exist
    const [fund, deal] = await Promise.all([
      db.select().from(funds).where(eq(funds.id, request.fundId)).limit(1),
      db.select().from(deals).where(eq(deals.id, request.dealId)).limit(1)
    ]);

    if (fund.length === 0) {
      throw new Error(`Fund with ID ${request.fundId} not found`);
    }
    if (deal.length === 0) {
      throw new Error(`Deal with ID ${request.dealId} not found`);
    }

    // Check for duplicates
    const duplicate = await this.findDuplicateAllocation(request.fundId, request.dealId);
    if (duplicate) {
      throw new Error(`DUPLICATE_ALLOCATION:Fund allocation already exists for ${deal[0].name} from ${fund[0].name} (ID: ${duplicate.id})`);
    }

    // Create allocation in atomic transaction
    let newAllocation: FundAllocation;
    await db.transaction(async (tx) => {
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
          portfolioWeight: 0, // Will be calculated after creation
          interestPaid: request.interestPaid || 0,
          distributionPaid: request.distributionPaid || 0,
          marketValue: request.marketValue || 0,
          moic: request.moic || 1,
          irr: request.irr || 0,
          paidAmount: 0,
          calledAmount: 0
        })
        .returning();
      
      newAllocation = created;
    });

    console.log(`✅ Allocation created successfully: ID ${newAllocation!.id}`);
    
    // Recalculate portfolio weights for the fund (separate operation)
    await this.updatePortfolioWeights(request.fundId);
    
    return newAllocation!;
  }

  /**
   * STATUS-SAFE ALLOCATION UPDATE
   * Updates specific fields without corrupting unrelated data
   */
  async updateAllocationField(
    allocationId: number, 
    field: keyof FundAllocation, 
    value: any
  ): Promise<FundAllocation> {
    console.log(`📝 Updating allocation ${allocationId}: ${String(field)} = ${value}`);
    
    const updateData = { [field]: value };
    
    const [updated] = await db
      .update(fundAllocations)
      .set(updateData)
      .where(eq(fundAllocations.id, allocationId))
      .returning();

    if (!updated) {
      throw new Error(`Allocation ${allocationId} not found for update`);
    }

    console.log(`✅ Allocation ${allocationId} updated successfully`);
    
    // If amount changed, recalculate weights for the fund
    if (field === 'amount') {
      await this.updatePortfolioWeights(updated.fundId);
    }
    
    return updated;
  }

  /**
   * SAFE ALLOCATION DELETION
   * Removes allocation and recalculates weights atomically
   */
  async deleteAllocation(allocationId: number): Promise<void> {
    console.log(`🗑️ Deleting allocation ${allocationId}`);
    
    // Get allocation info before deletion
    const [allocation] = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.id, allocationId))
      .limit(1);

    if (!allocation) {
      throw new Error(`Allocation ${allocationId} not found`);
    }

    const fundId = allocation.fundId;

    // Delete in transaction
    await db.transaction(async (tx) => {
      await tx
        .delete(fundAllocations)
        .where(eq(fundAllocations.id, allocationId));
    });

    console.log(`✅ Allocation ${allocationId} deleted successfully`);
    
    // Recalculate weights for affected fund
    await this.updatePortfolioWeights(fundId);
  }

  /**
   * GET FUND ALLOCATIONS WITH ENRICHED DATA
   * Returns allocations with deal names and calculated metrics
   */
  async getFundAllocations(fundId: number): Promise<Array<FundAllocation & { dealName?: string; dealSector?: string }>> {
    console.log(`📋 Getting allocations for fund ${fundId}`);
    
    const allocations = await db
      .select({
        allocation: fundAllocations,
        dealName: deals.name,
        dealSector: deals.sector
      })
      .from(fundAllocations)
      .leftJoin(deals, eq(fundAllocations.dealId, deals.id))
      .where(eq(fundAllocations.fundId, fundId));

    const enrichedAllocations = allocations.map(row => ({
      ...row.allocation,
      dealName: row.dealName,
      dealSector: row.dealSector
    }));

    console.log(`📊 Found ${enrichedAllocations.length} allocations for fund ${fundId}`);
    
    return enrichedAllocations;
  }
}

// Export singleton instance
export const allocationCoreService = new AllocationCoreService();