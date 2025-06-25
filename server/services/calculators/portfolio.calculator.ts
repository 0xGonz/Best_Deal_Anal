/**
 * Portfolio Calculator Service
 * High-performance calculation engine for portfolio weights and fund metrics
 */

import { eq, sum, count } from 'drizzle-orm';
import { db } from '../../db';
import { fundAllocations, capitalCalls } from '@shared/schema';
import type { FundAllocation } from '@shared/schema';

export interface PortfolioWeight {
  allocationId: number;
  amount: number;
  weight: number;
}

export interface FundMetrics {
  fundId: number;
  totalCommittedCapital: number;
  totalAllocations: number;
  calledCapital: number;
  uncalledCapital: number;
  portfolioWeights: PortfolioWeight[];
}

export class PortfolioCalculator {
  /**
   * Calculate portfolio weights for a fund with optimized queries
   */
  async calculatePortfolioWeights(fundId: number): Promise<PortfolioWeight[]> {
    // Get all allocations for the fund in one query
    const allocations = await db
      .select({
        id: fundAllocations.id,
        amount: fundAllocations.amount
      })
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    if (allocations.length === 0) {
      return [];
    }

    // Calculate total committed capital
    const totalCommittedCapital = allocations.reduce((sum, allocation) => {
      return sum + (allocation.amount || 0);
    }, 0);

    // Avoid division by zero
    if (totalCommittedCapital === 0) {
      return allocations.map(allocation => ({
        allocationId: allocation.id,
        amount: allocation.amount,
        weight: 0
      }));
    }

    // Calculate individual weights
    return allocations.map(allocation => {
      const weight = (allocation.amount / totalCommittedCapital) * 100;
      return {
        allocationId: allocation.id,
        amount: allocation.amount,
        weight: parseFloat(weight.toFixed(1)) // Round to 1 decimal place
      };
    });
  }

  /**
   * Calculate comprehensive fund metrics
   */
  async calculateFundMetrics(fundId: number): Promise<FundMetrics> {
    // Get all allocations
    const allocations = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    // Calculate basic metrics
    const totalCommittedCapital = allocations.reduce((sum, allocation) => {
      return sum + (allocation.amount || 0);
    }, 0);

    // Calculate called capital based on allocation statuses
    let calledCapital = 0;
    for (const allocation of allocations) {
      if (allocation.status === 'funded') {
        calledCapital += allocation.amount;
      } else if (allocation.status === 'partially_paid') {
        calledCapital += allocation.paidAmount || 0;
      }
    }

    // Calculate portfolio weights
    const portfolioWeights = await this.calculatePortfolioWeights(fundId);

    return {
      fundId,
      totalCommittedCapital,
      totalAllocations: allocations.length,
      calledCapital,
      uncalledCapital: totalCommittedCapital - calledCapital,
      portfolioWeights
    };
  }

  /**
   * Calculate fund metrics for multiple funds (batch operation)
   */
  async calculateMultipleFundMetrics(fundIds: number[]): Promise<Map<number, FundMetrics>> {
    const results = new Map<number, FundMetrics>();

    // Process in parallel for better performance
    const metricsPromises = fundIds.map(async (fundId) => {
      const metrics = await this.calculateFundMetrics(fundId);
      return [fundId, metrics] as const;
    });

    const metricsResults = await Promise.all(metricsPromises);
    
    for (const [fundId, metrics] of metricsResults) {
      results.set(fundId, metrics);
    }

    return results;
  }

  /**
   * Calculate allocation-level metrics
   */
  async calculateAllocationMetrics(allocationId: number): Promise<{
    totalCalled: number;
    totalPaid: number;
    outstanding: number;
    callCount: number;
  }> {
    // Get all capital calls for this allocation
    const calls = await db
      .select({
        callAmount: capitalCalls.callAmount,
        paidAmount: capitalCalls.paidAmount,
        status: capitalCalls.status
      })
      .from(capitalCalls)
      .where(eq(capitalCalls.allocationId, allocationId));

    let totalCalled = 0;
    let totalPaid = 0;

    for (const call of calls) {
      if (call.status !== 'scheduled') {
        totalCalled += call.callAmount || 0;
      }
      if (call.status === 'paid' || call.status === 'partially_paid') {
        totalPaid += call.paidAmount || 0;
      }
    }

    return {
      totalCalled,
      totalPaid,
      outstanding: totalCalled - totalPaid,
      callCount: calls.length
    };
  }

  /**
   * Validate portfolio weight calculations
   */
  async validatePortfolioWeights(fundId: number): Promise<{
    isValid: boolean;
    totalWeight: number;
    issues: string[];
  }> {
    const weights = await this.calculatePortfolioWeights(fundId);
    const issues: string[] = [];
    
    // Calculate total weight
    const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
    
    // Validate total equals 100% (within rounding tolerance)
    const tolerance = 0.1;
    if (Math.abs(totalWeight - 100) > tolerance && weights.length > 0) {
      issues.push(`Portfolio weights total ${totalWeight.toFixed(1)}% instead of 100%`);
    }

    // Check for negative weights
    const negativeWeights = weights.filter(w => w.weight < 0);
    if (negativeWeights.length > 0) {
      issues.push(`Found ${negativeWeights.length} allocations with negative weights`);
    }

    // Check for zero amounts with non-zero weights
    const zeroAmountNonZeroWeight = weights.filter(w => w.amount === 0 && w.weight > 0);
    if (zeroAmountNonZeroWeight.length > 0) {
      issues.push(`Found ${zeroAmountNonZeroWeight.length} allocations with zero amount but non-zero weight`);
    }

    return {
      isValid: issues.length === 0,
      totalWeight,
      issues
    };
  }

  /**
   * Performance optimization: batch weight updates
   */
  async batchUpdatePortfolioWeights(fundId: number): Promise<void> {
    const weights = await this.calculatePortfolioWeights(fundId);
    
    if (weights.length === 0) {
      return;
    }

    // Use a transaction for atomic updates
    await db.transaction(async (tx) => {
      // Update all weights in batch
      for (const weight of weights) {
        await tx
          .update(fundAllocations)
          .set({ 
            portfolioWeight: weight.weight,
            updatedAt: new Date()
          })
          .where(eq(fundAllocations.id, weight.allocationId));
      }
    });
  }

  /**
   * Calculate sector allocation breakdown
   */
  async calculateSectorBreakdown(fundId: number): Promise<Map<string, { amount: number; weight: number }>> {
    const allocations = await db
      .select({
        amount: fundAllocations.amount,
        dealSector: fundAllocations.dealSector
      })
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    const sectorMap = new Map<string, { amount: number; weight: number }>();
    const totalAmount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

    for (const allocation of allocations) {
      const sector = allocation.dealSector || 'Unknown';
      const current = sectorMap.get(sector) || { amount: 0, weight: 0 };
      
      current.amount += allocation.amount;
      current.weight = totalAmount > 0 ? (current.amount / totalAmount) * 100 : 0;
      
      sectorMap.set(sector, current);
    }

    return sectorMap;
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics(fundId: number): Promise<{
    averageMOIC: number;
    averageIRR: number;
    totalReturned: number;
    unrealizedGainLoss: number;
  }> {
    const allocations = await db
      .select({
        amount: fundAllocations.amount,
        moic: fundAllocations.moic,
        irr: fundAllocations.irr,
        totalReturned: fundAllocations.totalReturned,
        marketValue: fundAllocations.marketValue
      })
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));

    if (allocations.length === 0) {
      return {
        averageMOIC: 0,
        averageIRR: 0,
        totalReturned: 0,
        unrealizedGainLoss: 0
      };
    }

    // Calculate weighted averages
    const totalAmount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    
    let weightedMOIC = 0;
    let weightedIRR = 0;
    let totalReturned = 0;
    let totalMarketValue = 0;

    for (const allocation of allocations) {
      const weight = totalAmount > 0 ? allocation.amount / totalAmount : 0;
      weightedMOIC += (allocation.moic || 1) * weight;
      weightedIRR += (allocation.irr || 0) * weight;
      totalReturned += allocation.totalReturned || 0;
      totalMarketValue += allocation.marketValue || 0;
    }

    return {
      averageMOIC: parseFloat(weightedMOIC.toFixed(2)),
      averageIRR: parseFloat(weightedIRR.toFixed(2)),
      totalReturned,
      unrealizedGainLoss: totalMarketValue - totalAmount
    };
  }
}