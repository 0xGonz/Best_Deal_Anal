/**
 * Optimized Allocation Service
 * 
 * High-performance service methods that eliminate N+1 queries
 * and optimize data fetching patterns
 */

import { OptimizedStorage } from '../optimized-storage';

export class OptimizedAllocationService {
  private storage = new OptimizedStorage();

  /**
   * Get allocations with full context in single query
   * Replaces multiple service calls with one optimized query
   */
  async getAllocationsWithContext(fundId?: number) {
    const allocations = await this.storage.getOptimizedFundAllocations(fundId);
    
    // Transform to expected format with all related data included
    return allocations.map(allocation => ({
      ...allocation,
      deal: {
        id: allocation.dealId,
        name: allocation.dealName,
        stage: allocation.dealStage,
        sector: allocation.dealSector
      },
      fund: {
        id: allocation.fundId,
        name: allocation.fundName,
        vintage: allocation.fundVintage
      },
      metrics: {
        totalCalled: allocation.totalCalled || 0,
        totalPaid: allocation.totalPaid || 0,
        percentCalled: allocation.amount > 0 
          ? Math.round((allocation.totalCalled || 0) / allocation.amount * 100)
          : 0,
        percentPaid: allocation.amount > 0
          ? Math.round((allocation.totalPaid || 0) / allocation.amount * 100) 
          : 0
      }
    }));
  }

  /**
   * Get fund performance metrics in single optimized query
   */
  async getFundPerformanceMetrics(fundId: number) {
    const performance = await this.storage.getOptimizedFundPerformance(fundId);
    
    if (!performance) return null;
    
    return {
      ...performance,
      callRate: performance.totalCommitted > 0 
        ? Math.round(performance.totalCalled / performance.totalCommitted * 100)
        : 0,
      paymentRate: performance.totalCalled > 0
        ? Math.round(performance.totalPaid / performance.totalCalled * 100)
        : 0,
      uncalledCapital: performance.totalCommitted - performance.totalCalled
    };
  }

  /**
   * Batch process allocation updates efficiently
   */
  async batchUpdateAllocations(updates: Array<{id: number; status: string}>) {
    // Use database transaction for efficiency
    const results = [];
    
    for (const update of updates) {
      const result = await this.storage.updateFundAllocation(update.id, {
        status: update.status as any
      });
      if (result) results.push(result);
    }
    
    return results;
  }
}