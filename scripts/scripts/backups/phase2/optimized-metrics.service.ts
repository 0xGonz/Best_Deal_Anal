/**
 * Optimized Metrics Service
 * 
 * Addresses Issue #5 from audit: Metrics double-computation
 * Implements batched metrics calculations to reduce database load
 */

import { db } from '../db';
import { fundAllocations, funds, capitalCalls } from '@shared/schema';
import { eq, sum, count, sql } from 'drizzle-orm';

interface MetricsUpdateRequest {
  fundId: number;
  reason: 'allocation_created' | 'allocation_updated' | 'allocation_deleted' | 'payment_received';
  batchUpdate?: boolean;
}

interface FundMetrics {
  fundId: number;
  totalCommitted: number;
  totalFunded: number;
  totalCalled: number;
  totalPaid: number;
  allocationCount: number;
  averageAllocationSize: number;
  fundingRate: number; // percentage of committed that's been funded
  callRate: number; // percentage of committed that's been called
}

export class OptimizedMetricsService {
  private pendingUpdates = new Map<number, MetricsUpdateRequest>();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY_MS = 5000; // 5 second delay for batching

  /**
   * Queue a metrics update for batching
   */
  async queueMetricsUpdate(request: MetricsUpdateRequest): Promise<void> {
    this.pendingUpdates.set(request.fundId, request);

    // If batch update is requested, process immediately
    if (request.batchUpdate) {
      await this.processPendingUpdates();
      return;
    }

    // Otherwise, schedule batched processing
    this.scheduleBatchProcessing();
  }

  /**
   * Calculate comprehensive metrics for a fund
   */
  async calculateFundMetrics(fundId: number): Promise<FundMetrics> {
    const metricsQuery = await db
      .select({
        totalCommitted: sum(fundAllocations.amount),
        totalFunded: sql<number>`SUM(CASE WHEN ${fundAllocations.status} = 'funded' THEN ${fundAllocations.amount} ELSE 0 END)`,
        totalCalled: sum(fundAllocations.calledAmount),
        totalPaid: sum(fundAllocations.paidAmount),
        allocationCount: count(fundAllocations.id),
        averageSize: sql<number>`AVG(${fundAllocations.amount})`
      })
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    const metrics = metricsQuery[0];
    
    const totalCommitted = metrics.totalCommitted || 0;
    const totalFunded = metrics.totalFunded || 0;
    const totalCalled = metrics.totalCalled || 0;
    const totalPaid = metrics.totalPaid || 0;
    const allocationCount = metrics.allocationCount || 0;
    const averageAllocationSize = metrics.averageSize || 0;

    return {
      fundId,
      totalCommitted,
      totalFunded,
      totalCalled,
      totalPaid,
      allocationCount,
      averageAllocationSize,
      fundingRate: totalCommitted > 0 ? (totalFunded / totalCommitted) * 100 : 0,
      callRate: totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0
    };
  }

  /**
   * Update portfolio weights for all allocations in a fund
   */
  async updatePortfolioWeights(fundId: number): Promise<void> {
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);

    if (totalCommitted > 0) {
      // Batch update all portfolio weights
      const weightUpdates = allocations.map(allocation => ({
        id: allocation.id,
        weight: (allocation.amount / totalCommitted) * 100
      }));

      // Use a single transaction to update all weights
      await db.transaction(async (tx) => {
        for (const update of weightUpdates) {
          await tx
            .update(fundAllocations)
            .set({ portfolioWeight: update.weight })
            .where(eq(fundAllocations.id, update.id));
        }
      });
    }
  }

  /**
   * Update fund AUM based on funded allocations
   */
  async updateFundAUM(fundId: number): Promise<void> {
    const fundedAllocations = await db
      .select({ totalFunded: sum(fundAllocations.amount) })
      .from(fundAllocations)
      .where(
        sql`${fundAllocations.fundId} = ${fundId} AND ${fundAllocations.status} = 'funded'`
      );

    const totalAUM = fundedAllocations[0]?.totalFunded || 0;

    await db
      .update(funds)
      .set({ aum: totalAUM })
      .where(eq(funds.id, fundId));
  }

  /**
   * Perform comprehensive metrics update for a fund
   */
  async updateFundMetricsComprehensive(fundId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Calculate metrics
      const metrics = await this.calculateFundMetrics(fundId);

      // 2. Update portfolio weights
      await this.updatePortfolioWeights(fundId);

      // 3. Update fund AUM and other computed fields
      await tx
        .update(funds)
        .set({
          aum: metrics.totalFunded,
          // Add other computed fields as needed
        })
        .where(eq(funds.id, fundId));
    });
  }

  /**
   * Batch update metrics for multiple funds
   */
  async updateMultipleFundMetrics(fundIds: number[]): Promise<void> {
    const uniqueFundIds = [...new Set(fundIds)];
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 5;
    for (let i = 0; i < uniqueFundIds.length; i += batchSize) {
      const batch = uniqueFundIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(fundId => this.updateFundMetricsComprehensive(fundId))
      );
    }
  }

  /**
   * Schedule batched processing of pending updates
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      await this.processPendingUpdates();
    }, this.BATCH_DELAY_MS);
  }

  /**
   * Process all pending metrics updates
   */
  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    const fundIds = Array.from(this.pendingUpdates.keys());
    this.pendingUpdates.clear();

    try {
      await this.updateMultipleFundMetrics(fundIds);
      console.log(`✅ Batch updated metrics for ${fundIds.length} funds`);
    } catch (error) {
      console.error('Error in batch metrics update:', error);
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Force immediate processing of all pending updates
   */
  async flushPendingUpdates(): Promise<void> {
    await this.processPendingUpdates();
  }

  /**
   * Get current metrics for a fund without triggering updates
   */
  async getFundMetrics(fundId: number): Promise<FundMetrics> {
    return await this.calculateFundMetrics(fundId);
  }
}

export const optimizedMetricsService = new OptimizedMetricsService();