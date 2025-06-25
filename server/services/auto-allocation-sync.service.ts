/**
 * Automated Allocation Synchronization Service
 * 
 * Automatically maintains data consistency and handles scaling
 * without manual intervention or hardcoded values
 */

import { DatabaseStorage } from '../database-storage';
import { fundAllocations, funds, deals } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';

export interface AllocationSyncResult {
  syncedAllocations: number;
  updatedPortfolioWeights: number;
  resolvedConflicts: number;
  errors: string[];
}

export class AutoAllocationSyncService {
  private storage = new DatabaseStorage();
  
  /**
   * Automatically sync all allocation data with real-time consistency
   */
  async performFullSync(): Promise<AllocationSyncResult> {
    const result: AllocationSyncResult = {
      syncedAllocations: 0,
      updatedPortfolioWeights: 0,
      resolvedConflicts: 0,
      errors: []
    };

    try {
      // 1. Auto-sync portfolio weights based on actual amounts
      await this.autoSyncPortfolioWeights(result);
      
      // 2. Auto-resolve status inconsistencies
      await this.autoResolveStatusInconsistencies(result);
      
      // 3. Auto-sync fund metrics with real allocation data
      await this.autoSyncFundMetrics(result);
      
      // 4. Auto-detect and resolve allocation conflicts
      await this.autoResolveAllocationConflicts(result);
      
      console.log(`Auto-sync completed: ${result.syncedAllocations} allocations, ${result.updatedPortfolioWeights} weights updated`);
      
    } catch (error) {
      result.errors.push(`Auto-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Automatically calculate and update portfolio weights based on actual allocation amounts
   */
  private async autoSyncPortfolioWeights(result: AllocationSyncResult): Promise<void> {
    // Get all funds with their total committed capital
    const fundsWithAllocations = await db
      .select({
        fundId: fundAllocations.fundId,
        fundName: funds.name,
        totalCommitted: sql<number>`SUM(${fundAllocations.amount})`,
        allocationCount: sql<number>`COUNT(${fundAllocations.id})`
      })
      .from(fundAllocations)
      .leftJoin(funds, eq(fundAllocations.fundId, funds.id))
      .groupBy(fundAllocations.fundId, funds.name);

    for (const fund of fundsWithAllocations) {
      // Calculate accurate portfolio weights
      const allocations = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.fundId, fund.fundId));

      let updated = 0;
      for (const allocation of allocations) {
        const accurateWeight = (allocation.amount / fund.totalCommitted) * 100;
        
        // Only update if weight has changed significantly (avoid unnecessary updates)
        if (Math.abs((allocation.portfolioWeight || 0) - accurateWeight) > 0.1) {
          await db
            .update(fundAllocations)
            .set({ portfolioWeight: accurateWeight })
            .where(eq(fundAllocations.id, allocation.id));
          
          updated++;
        }
      }
      
      result.updatedPortfolioWeights += updated;
    }
  }

  /**
   * Automatically resolve status inconsistencies based on payment data
   */
  private async autoResolveStatusInconsistencies(result: AllocationSyncResult): Promise<void> {
    const allocations = await db.select().from(fundAllocations);
    
    for (const allocation of allocations) {
      const paidAmount = allocation.paidAmount || 0;
      const totalAmount = allocation.amount;
      
      let correctStatus: string;
      
      if (paidAmount === 0) {
        correctStatus = 'committed';
      } else if (paidAmount >= totalAmount) {
        correctStatus = 'funded';
      } else {
        correctStatus = 'partially_paid';
      }
      
      // Auto-update status if incorrect
      if (allocation.status !== correctStatus) {
        await db
          .update(fundAllocations)
          .set({ status: correctStatus })
          .where(eq(fundAllocations.id, allocation.id));
        
        result.syncedAllocations++;
      }
    }
  }

  /**
   * Automatically sync fund metrics with actual allocation data
   */
  private async autoSyncFundMetrics(result: AllocationSyncResult): Promise<void> {
    const fundMetrics = await db
      .select({
        fundId: fundAllocations.fundId,
        totalCommitted: sql<number>`SUM(${fundAllocations.amount})`,
        totalCalled: sql<number>`SUM(COALESCE(${fundAllocations.calledAmount}, 0))`,
        totalPaid: sql<number>`SUM(COALESCE(${fundAllocations.paidAmount}, 0))`,
        allocationCount: sql<number>`COUNT(${fundAllocations.id})`
      })
      .from(fundAllocations)
      .groupBy(fundAllocations.fundId);

    for (const metrics of fundMetrics) {
      // Auto-update fund with calculated metrics
      await db
        .update(funds)
        .set({
          committedCapital: metrics.totalCommitted,
          calledCapital: metrics.totalCalled,
          uncalledCapital: metrics.totalCommitted - metrics.totalCalled,
          aum: metrics.totalPaid,
          totalFundSize: metrics.totalCommitted,
          allocationCount: metrics.allocationCount
        })
        .where(eq(funds.id, metrics.fundId));
    }
  }

  /**
   * Automatically detect and resolve allocation conflicts
   */
  private async autoResolveAllocationConflicts(result: AllocationSyncResult): Promise<void> {
    // Find potential duplicates (same fund + deal combination)
    const duplicates = await db
      .select({
        fundId: fundAllocations.fundId,
        dealId: fundAllocations.dealId,
        count: sql<number>`COUNT(*)`
      })
      .from(fundAllocations)
      .groupBy(fundAllocations.fundId, fundAllocations.dealId)
      .having(sql`COUNT(*) > 1`);

    for (const duplicate of duplicates) {
      // Get all conflicting allocations
      const conflictingAllocations = await db
        .select()
        .from(fundAllocations)
        .where(
          sql`${fundAllocations.fundId} = ${duplicate.fundId} AND ${fundAllocations.dealId} = ${duplicate.dealId}`
        )
        .orderBy(fundAllocations.allocationDate);

      if (conflictingAllocations.length > 1) {
        // Keep the most recent allocation, merge amounts from older ones
        const keepAllocation = conflictingAllocations[conflictingAllocations.length - 1];
        const mergeAllocations = conflictingAllocations.slice(0, -1);
        
        const totalAmount = conflictingAllocations.reduce((sum, a) => sum + a.amount, 0);
        const totalPaid = conflictingAllocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
        
        // Update the kept allocation with merged amounts
        await db
          .update(fundAllocations)
          .set({
            amount: totalAmount,
            paidAmount: totalPaid,
            status: totalPaid >= totalAmount ? 'funded' : totalPaid > 0 ? 'partially_paid' : 'committed'
          })
          .where(eq(fundAllocations.id, keepAllocation.id));
        
        // Remove duplicate allocations
        for (const mergeAllocation of mergeAllocations) {
          await db
            .delete(fundAllocations)
            .where(eq(fundAllocations.id, mergeAllocation.id));
        }
        
        result.resolvedConflicts++;
      }
    }
  }

  /**
   * Real-time allocation update handler
   */
  async handleAllocationUpdate(allocationId: number): Promise<void> {
    const allocation = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.id, allocationId))
      .limit(1);

    if (allocation.length === 0) return;

    const alloc = allocation[0];
    
    // Auto-update status based on payment
    const correctStatus = this.calculateCorrectStatus(alloc.amount, alloc.paidAmount || 0);
    if (alloc.status !== correctStatus) {
      await db
        .update(fundAllocations)
        .set({ status: correctStatus })
        .where(eq(fundAllocations.id, allocationId));
    }

    // Auto-sync fund metrics
    await this.autoSyncFundMetrics({ 
      syncedAllocations: 0, 
      updatedPortfolioWeights: 0, 
      resolvedConflicts: 0, 
      errors: [] 
    });
  }

  /**
   * Calculate correct allocation status automatically
   */
  private calculateCorrectStatus(amount: number, paidAmount: number): string {
    if (paidAmount === 0) return 'committed';
    if (paidAmount >= amount) return 'funded';
    return 'partially_paid';
  }

  /**
   * Background sync job - DISABLED due to status corruption
   */
  async startBackgroundSync(intervalMinutes: number = 30): Promise<void> {
    console.log(`Background sync DISABLED - caused status overwrites`);
    // Commenting out the auto-sync that was overwriting funded status
    /*
    const runSync = async () => {
      try {
        const result = await this.performFullSync();
        if (result.errors.length > 0) {
          console.error('Auto-sync errors:', result.errors);
        }
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    };

    // Initial sync
    await runSync();
    
    // Schedule recurring syncs
    setInterval(runSync, intervalMinutes * 60 * 1000);
    */
  }
}

// Export singleton instance
export const autoAllocationSync = new AutoAllocationSyncService();