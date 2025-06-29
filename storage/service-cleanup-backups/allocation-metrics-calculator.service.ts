/**
 * Allocation Metrics Calculator Service
 * 
 * Automatically calculates and updates all allocation-related metrics
 * No hardcoded values - everything computed from actual data
 */

import { DatabaseStorage } from '../database-storage';
import { fundAllocations, funds, deals } from '../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db';

export interface FundMetrics {
  fundId: number;
  totalCommitted: number;
  totalCalled: number;
  totalPaid: number;
  uncalledCapital: number;
  allocationCount: number;
  averageAllocationSize: number;
  largestAllocation: number;
  portfolioConcentration: number;
  deploymentRatio: number;
}

export interface AllocationMetrics {
  allocationId: number;
  portfolioWeight: number;
  deploymentStatus: 'committed' | 'partially_deployed' | 'fully_deployed';
  paymentRatio: number;
  remainingCommitment: number;
}

export class AllocationMetricsCalculator {
  private storage = new DatabaseStorage();

  /**
   * Automatically calculate all fund metrics from actual allocation data
   */
  async calculateFundMetrics(fundId: number): Promise<FundMetrics> {
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    if (allocations.length === 0) {
      return {
        fundId,
        totalCommitted: 0,
        totalCalled: 0,
        totalPaid: 0,
        uncalledCapital: 0,
        allocationCount: 0,
        averageAllocationSize: 0,
        largestAllocation: 0,
        portfolioConcentration: 0,
        deploymentRatio: 0
      };
    }

    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);
    const totalCalled = allocations.reduce((sum, a) => sum + (a.calledAmount || 0), 0);
    const totalPaid = allocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
    const uncalledCapital = totalCommitted - totalCalled;
    const allocationCount = allocations.length;
    const averageAllocationSize = totalCommitted / allocationCount;
    const largestAllocation = Math.max(...allocations.map(a => a.amount));
    
    // Portfolio concentration (largest allocation as % of total)
    const portfolioConcentration = totalCommitted > 0 ? (largestAllocation / totalCommitted) * 100 : 0;
    
    // Deployment ratio (paid / committed)
    const deploymentRatio = totalCommitted > 0 ? (totalPaid / totalCommitted) * 100 : 0;

    return {
      fundId,
      totalCommitted,
      totalCalled,
      totalPaid,
      uncalledCapital,
      allocationCount,
      averageAllocationSize,
      largestAllocation,
      portfolioConcentration,
      deploymentRatio
    };
  }

  /**
   * Automatically calculate allocation-specific metrics
   */
  async calculateAllocationMetrics(allocationId: number): Promise<AllocationMetrics | null> {
    const allocation = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.id, allocationId))
      .limit(1);

    if (allocation.length === 0) return null;

    const alloc = allocation[0];
    const fundMetrics = await this.calculateFundMetrics(alloc.fundId);
    
    const portfolioWeight = fundMetrics.totalCommitted > 0 ? 
      (alloc.amount / fundMetrics.totalCommitted) * 100 : 0;
    
    const paidAmount = alloc.paidAmount || 0;
    const paymentRatio = alloc.amount > 0 ? (paidAmount / alloc.amount) * 100 : 0;
    const remainingCommitment = alloc.amount - paidAmount;
    
    let deploymentStatus: 'committed' | 'partially_deployed' | 'fully_deployed';
    if (paidAmount === 0) {
      deploymentStatus = 'committed';
    } else if (paidAmount >= alloc.amount) {
      deploymentStatus = 'fully_deployed';
    } else {
      deploymentStatus = 'partially_deployed';
    }

    return {
      allocationId,
      portfolioWeight,
      deploymentStatus,
      paymentRatio,
      remainingCommitment
    };
  }

  /**
   * Automatically update all allocation metrics for a fund
   */
  async updateAllAllocationMetrics(fundId: number): Promise<void> {
    const fundMetrics = await this.calculateFundMetrics(fundId);
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    // Update each allocation with calculated metrics
    for (const allocation of allocations) {
      const metrics = await this.calculateAllocationMetrics(allocation.id);
      if (metrics) {
        await db
          .update(fundAllocations)
          .set({
            portfolioWeight: metrics.portfolioWeight,
            status: this.mapDeploymentStatusToAllocationStatus(metrics.deploymentStatus, allocation.status)
          })
          .where(eq(fundAllocations.id, allocation.id));
      }
    }

    // Update fund with calculated metrics
    await db
      .update(funds)
      .set({
        committedCapital: fundMetrics.totalCommitted,
        calledCapital: fundMetrics.totalCalled,
        uncalledCapital: fundMetrics.uncalledCapital,
        aum: fundMetrics.totalPaid,
        totalFundSize: fundMetrics.totalCommitted,
        allocationCount: fundMetrics.allocationCount
      })
      .where(eq(funds.id, fundId));
  }

  /**
   * Automatically calculate deal-level metrics from allocations
   */
  async calculateDealMetrics(dealId: number): Promise<{
    totalAllocated: number;
    fundCount: number;
    largestAllocation: number;
    averageAllocation: number;
    deploymentRate: number;
  }> {
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.dealId, dealId));

    if (allocations.length === 0) {
      return {
        totalAllocated: 0,
        fundCount: 0,
        largestAllocation: 0,
        averageAllocation: 0,
        deploymentRate: 0
      };
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const totalPaid = allocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
    const fundCount = new Set(allocations.map(a => a.fundId)).size;
    const largestAllocation = Math.max(...allocations.map(a => a.amount));
    const averageAllocation = totalAllocated / allocations.length;
    const deploymentRate = totalAllocated > 0 ? (totalPaid / totalAllocated) * 100 : 0;

    return {
      totalAllocated,
      fundCount,
      largestAllocation,
      averageAllocation,
      deploymentRate
    };
  }

  /**
   * Map deployment status to allocation status intelligently
   */
  private mapDeploymentStatusToAllocationStatus(
    deploymentStatus: 'committed' | 'partially_deployed' | 'fully_deployed',
    currentStatus: string
  ): string {
    switch (deploymentStatus) {
      case 'committed':
        return 'committed';
      case 'partially_deployed':
        return 'partially_paid';
      case 'fully_deployed':
        return 'funded';
      default:
        return currentStatus; // Keep existing status if unknown
    }
  }

  /**
   * Automatically recalculate all metrics system-wide
   */
  async recalculateAllMetrics(): Promise<{
    fundsUpdated: number;
    allocationsUpdated: number;
    dealsAnalyzed: number;
  }> {
    const result = {
      fundsUpdated: 0,
      allocationsUpdated: 0,
      dealsAnalyzed: 0
    };

    try {
      // Get all funds with allocations
      const fundIds = await db
        .selectDistinct({ fundId: fundAllocations.fundId })
        .from(fundAllocations);

      for (const { fundId } of fundIds) {
        await this.updateAllAllocationMetrics(fundId);
        result.fundsUpdated++;
      }

      // Get allocation count
      const allocationCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(fundAllocations);
      
      result.allocationsUpdated = allocationCount[0]?.count || 0;

      // Get deal count
      const dealCount = await db
        .selectDistinct({ dealId: fundAllocations.dealId })
        .from(fundAllocations);
      
      result.dealsAnalyzed = dealCount.length;

      console.log(`Metrics recalculation complete: ${result.fundsUpdated} funds, ${result.allocationsUpdated} allocations, ${result.dealsAnalyzed} deals`);
      
    } catch (error) {
      console.error('Metrics recalculation failed:', error);
      throw error;
    }

    return result;
  }
}

// Export singleton instance
export const allocationMetricsCalculator = new AllocationMetricsCalculator();