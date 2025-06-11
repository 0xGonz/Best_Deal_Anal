/**
 * Centralized metrics calculation service for modular and reliable calculations
 * This service handles all performance metric calculations across the application
 */

import { db } from '../db';
import { fundAllocations, capitalCalls, distributions } from '@shared/schema';
import { eq, sum, and } from 'drizzle-orm';
import { AllocationMetrics, FundPerformanceMetrics, CapitalCallSummary, DatabaseError } from './type-definitions';

export class MetricsCalculatorService {
  /**
   * Calculate comprehensive allocation metrics
   */
  async calculateAllocationMetrics(allocationId: number): Promise<AllocationMetrics> {
    try {
      // Get allocation details
      const allocation = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.id, allocationId))
        .limit(1);

      if (!allocation.length) {
        throw new DatabaseError(`Allocation with ID ${allocationId} not found`);
      }

      const allocationData = allocation[0];

      // Get capital calls for this allocation
      const allocationCapitalCalls = await db
        .select()
        .from(capitalCalls)
        .where(eq(capitalCalls.allocationId, allocationId));

      // Get distributions for this allocation
      const allocationDistributions = await db
        .select()
        .from(distributions)
        .where(eq(distributions.allocationId, allocationId));

      // Calculate metrics with proper type safety
      const totalInvested = Number(allocationData.amount || 0);
      const currentValue = Number(allocationData.marketValue ?? 0);
      const totalDistributions = allocationDistributions.reduce((sum, dist) => sum + Number(dist.amount || 0), 0);
      const totalCalled = allocationCapitalCalls.reduce((sum, call) => sum + Number(call.callAmount), 0);
      const totalPaid = allocationCapitalCalls.reduce((sum, call) => sum + Number(call.paidAmount || 0), 0);

      // Calculate MOIC (Multiple of Invested Capital)
      let moic = 1;
      if (totalPaid > 0) {
        moic = (currentValue + totalDistributions) / totalPaid;
      }

      const metrics: AllocationMetrics = {
        totalInvested,
        currentValue,
        distributions: totalDistributions,
        totalCalled,
        totalPaid,
        moic,
        unrealized: currentValue
      };

      return metrics;
    } catch (error) {
      console.error('Error calculating allocation metrics:', error);
      throw new DatabaseError(`Failed to calculate allocation metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate fund-level performance metrics
   */
  async calculateFundMetrics(fundId: number): Promise<FundPerformanceMetrics> {
    try {
      // Get all allocations for this fund
      const allocations = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.fundId, fundId));

      if (!allocations.length) {
        return {
          totalCommitments: 0,
          totalCalled: 0,
          totalPaid: 0,
          totalDistributions: 0,
          netCashFlow: 0,
          moic: 1,
          dpi: 0,
          tvpi: 0
        };
      }

      // Calculate totals across all allocations
      let totalCommitments = 0;
      let totalCalled = 0;
      let totalPaid = 0;
      let totalDistributions = 0;
      let totalCurrentValue = 0;

      for (const allocation of allocations) {
        totalCommitments += Number(allocation.amount || 0);
        totalCurrentValue += Number(allocation.marketValue ?? 0);

        // Get capital calls for this allocation
        const allocationCapitalCalls = await db
          .select()
          .from(capitalCalls)
          .where(eq(capitalCalls.allocationId, allocation.id));

        totalCalled += allocationCapitalCalls.reduce((sum, call) => sum + Number(call.callAmount), 0);
        totalPaid += allocationCapitalCalls.reduce((sum, call) => sum + Number(call.paidAmount || 0), 0);

        // Get distributions for this allocation
        const allocationDistributions = await db
          .select()
          .from(distributions)
          .where(eq(distributions.allocationId, allocation.id));

        totalDistributions += allocationDistributions.reduce((sum, dist) => sum + Number(dist.amount || 0), 0);
      }

      // Calculate performance ratios
      const netCashFlow = totalDistributions - totalPaid;
      const moic = totalPaid > 0 ? (totalCurrentValue + totalDistributions) / totalPaid : 1;
      const dpi = totalPaid > 0 ? totalDistributions / totalPaid : 0; // Distributions to Paid-In
      const tvpi = totalPaid > 0 ? (totalCurrentValue + totalDistributions) / totalPaid : 0; // Total Value to Paid-In

      return {
        totalCommitments,
        totalCalled,
        totalPaid,
        totalDistributions,
        netCashFlow,
        moic,
        dpi,
        tvpi
      };
    } catch (error) {
      console.error('Error calculating fund metrics:', error);
      throw new DatabaseError(`Failed to calculate fund metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate capital call summary for an allocation
   */
  async calculateCapitalCallSummary(allocationId: number): Promise<CapitalCallSummary> {
    try {
      const calls = await db
        .select()
        .from(capitalCalls)
        .where(eq(capitalCalls.allocationId, allocationId));

      const totalCalls = calls.length;
      const totalAmount = calls.reduce((sum, call) => sum + call.callAmount, 0);
      const paidAmount = calls.reduce((sum, call) => sum + (call.paidAmount || 0), 0);
      const pendingAmount = calls
        .filter(call => call.status === 'called')
        .reduce((sum, call) => sum + (call.callAmount - (call.paidAmount || 0)), 0);

      // Calculate overdue amount (due date passed and not fully paid)
      const now = new Date();
      const overdueAmount = calls
        .filter(call => 
          call.dueDate < now && 
          call.status !== 'paid' && 
          (call.paidAmount || 0) < call.callAmount
        )
        .reduce((sum, call) => sum + (call.callAmount - (call.paidAmount || 0)), 0);

      return {
        totalCalls,
        totalAmount,
        paidAmount,
        pendingAmount,
        overdueAmount
      };
    } catch (error) {
      console.error('Error calculating capital call summary:', error);
      throw new DatabaseError(`Failed to calculate capital call summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update allocation metrics in the database
   */
  async updateAllocationMetrics(allocationId: number): Promise<void> {
    try {
      const metrics = await this.calculateAllocationMetrics(allocationId);

      await db
        .update(fundAllocations)
        .set({
          totalReturned: metrics.distributions,
          marketValue: metrics.currentValue,
          moic: metrics.moic
        })
        .where(eq(fundAllocations.id, allocationId));

      console.log(`✅ Updated metrics for allocation ${allocationId}:`, {
        moic: metrics.moic,
        totalReturned: metrics.distributions,
        marketValue: metrics.currentValue
      });
    } catch (error) {
      console.error('Error updating allocation metrics:', error);
      throw error;
    }
  }

  /**
   * Recalculate metrics for all allocations in a fund
   */
  async recalculateFundMetrics(fundId: number): Promise<void> {
    try {
      const allocations = await db
        .select({ id: fundAllocations.id })
        .from(fundAllocations)
        .where(eq(fundAllocations.fundId, fundId));

      for (const allocation of allocations) {
        await this.updateAllocationMetrics(allocation.id);
      }

      console.log(`✅ Recalculated metrics for ${allocations.length} allocations in fund ${fundId}`);
    } catch (error) {
      console.error('Error recalculating fund metrics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const metricsCalculator = new MetricsCalculatorService();