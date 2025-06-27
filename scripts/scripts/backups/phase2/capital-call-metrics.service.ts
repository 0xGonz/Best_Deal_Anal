/**
 * Capital Call Metrics Service
 * Provides accurate, real-time calculation of capital call percentages
 * Eliminates the dual source of truth problem by always using actual capital call data
 */

import { DatabaseStorage } from '../database-storage';
import { db } from '../db';
import { capitalCalls, fundAllocations } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface AllocationMetrics {
  allocationId: number;
  committedAmount: number;
  calledAmount: number;
  paidAmount: number;
  calledPercentage: number;
  paidPercentage: number;
  uncalledAmount: number;
  status: string;
}

export class CapitalCallMetricsService {
  private storage = new DatabaseStorage();

  /**
   * Calculate accurate metrics for a single allocation based on actual capital calls
   */
  async calculateAllocationMetrics(allocationId: number): Promise<AllocationMetrics | null> {
    const result = await db
      .select({
        allocationId: fundAllocations.id,
        committedAmount: fundAllocations.amount,
        status: fundAllocations.status,
        calledAmount: sql<number>`COALESCE(SUM(${capitalCalls.callAmount}), 0)`,
        paidAmount: sql<number>`COALESCE(SUM(${capitalCalls.paidAmount}), 0)`,
      })
      .from(fundAllocations)
      .leftJoin(capitalCalls, eq(capitalCalls.allocationId, fundAllocations.id))
      .where(eq(fundAllocations.id, allocationId))
      .groupBy(fundAllocations.id, fundAllocations.amount, fundAllocations.status);

    if (result.length === 0) return null;

    const data = result[0];
    const committedAmount = Number(data.committedAmount);
    const calledAmount = Number(data.calledAmount);
    const paidAmount = Number(data.paidAmount);

    return {
      allocationId: data.allocationId,
      committedAmount,
      calledAmount,
      paidAmount,
      calledPercentage: committedAmount > 0 ? Math.round((calledAmount / committedAmount) * 100 * 10) / 10 : 0,
      paidPercentage: committedAmount > 0 ? Math.round((paidAmount / committedAmount) * 100 * 10) / 10 : 0,
      uncalledAmount: committedAmount - calledAmount,
      status: data.status
    };
  }

  /**
   * Calculate metrics for all allocations in a fund
   */
  async calculateFundMetrics(fundId: number): Promise<AllocationMetrics[]> {
    const result = await db
      .select({
        allocationId: fundAllocations.id,
        committedAmount: fundAllocations.amount,
        status: fundAllocations.status,
        calledAmount: sql<number>`COALESCE(SUM(${capitalCalls.callAmount}), 0)`,
        paidAmount: sql<number>`COALESCE(SUM(${capitalCalls.paidAmount}), 0)`,
      })
      .from(fundAllocations)
      .leftJoin(capitalCalls, eq(capitalCalls.allocationId, fundAllocations.id))
      .where(eq(fundAllocations.fundId, fundId))
      .groupBy(fundAllocations.id, fundAllocations.amount, fundAllocations.status);

    return result.map(data => {
      const committedAmount = Number(data.committedAmount);
      const calledAmount = Number(data.calledAmount);
      const paidAmount = Number(data.paidAmount);

      return {
        allocationId: data.allocationId,
        committedAmount,
        calledAmount,
        paidAmount,
        calledPercentage: committedAmount > 0 ? Math.round((calledAmount / committedAmount) * 100 * 10) / 10 : 0,
        paidPercentage: committedAmount > 0 ? Math.round((paidAmount / committedAmount) * 100 * 10) / 10 : 0,
        uncalledAmount: committedAmount - calledAmount,
        status: data.status
      };
    });
  }

  /**
   * Sync allocation paid_amount with actual capital call data
   * This eliminates the data synchronization gap
   */
  async syncAllocationPaidAmounts(fundId?: number): Promise<void> {
    const updateQuery = db
      .update(fundAllocations)
      .set({
        paidAmount: sql`(
          SELECT COALESCE(SUM(cc.paid_amount), 0)
          FROM capital_calls cc 
          WHERE cc.allocation_id = fund_allocations.id
        )`
      });

    if (fundId) {
      await updateQuery.where(eq(fundAllocations.fundId, fundId));
    } else {
      await updateQuery;
    }
  }

  /**
   * Get accurate status based on actual capital call data
   */
  calculateAccurateStatus(metrics: AllocationMetrics): string {
    const { calledAmount, paidAmount, committedAmount } = metrics;

    if (paidAmount === 0) {
      return calledAmount > 0 ? 'called' : 'committed';
    }
    
    if (paidAmount >= committedAmount) {
      return 'funded';
    }
    
    return 'partially_paid';
  }
}

export const capitalCallMetricsService = new CapitalCallMetricsService();