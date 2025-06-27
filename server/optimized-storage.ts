/**
 * Optimized Storage Methods
 * 
 * High-performance database operations with JOIN queries
 * to eliminate N+1 query patterns and improve response times
 */

import { eq, sql } from 'drizzle-orm';
import { DatabaseStorage } from './storage';
import { fundAllocations, funds, deals, capitalCalls } from '@shared/schema';

export class OptimizedStorage extends DatabaseStorage {

  /**
   * Optimized fund allocations query with eager loading
   * Eliminates N+1 queries by JOINing related tables
   */
  async getOptimizedFundAllocations(fundId?: number) {
    const query = this.db
      .select({
        // Allocation fields
        id: fundAllocations.id,
        dealId: fundAllocations.dealId,
        fundId: fundAllocations.fundId,
        amount: fundAllocations.amount,
        status: fundAllocations.status,
        createdAt: fundAllocations.createdAt,
        
        // Deal fields (eagerly loaded)
        dealName: deals.name,
        dealStage: deals.stage,
        dealSector: deals.sector,
        
        // Fund fields (eagerly loaded)
        fundName: funds.name,
        fundVintage: funds.vintage,
        
        // Calculated fields
        totalCalled: sql<number>`(
          SELECT COALESCE(SUM(call_amount), 0) 
          FROM capital_calls 
          WHERE allocation_id = ${fundAllocations.id}
        )`,
        totalPaid: sql<number>`(
          SELECT COALESCE(SUM(paid_amount), 0) 
          FROM capital_calls 
          WHERE allocation_id = ${fundAllocations.id}
        )`
      })
      .from(fundAllocations)
      .leftJoin(deals, eq(fundAllocations.dealId, deals.id))
      .leftJoin(funds, eq(fundAllocations.fundId, funds.id));
    
    if (fundId) {
      query.where(eq(fundAllocations.fundId, fundId));
    }
    
    return await query;
  }

  /**
   * Optimized deals query with allocation summaries
   * Single query replaces multiple database calls
   */
  async getOptimizedDealsWithAllocations() {
    return await this.db
      .select({
        id: deals.id,
        name: deals.name,
        stage: deals.stage,
        sector: deals.sector,
        createdAt: deals.createdAt,
        
        // Aggregated allocation data
        allocationCount: sql<number>`COUNT(DISTINCT ${fundAllocations.id})`,
        totalCommitted: sql<number>`COALESCE(SUM(${fundAllocations.amount}), 0)`,
        totalCalled: sql<number>`(
          SELECT COALESCE(SUM(cc.call_amount), 0)
          FROM capital_calls cc 
          JOIN fund_allocations fa ON cc.allocation_id = fa.id 
          WHERE fa.deal_id = ${deals.id}
        )`
      })
      .from(deals)
      .leftJoin(fundAllocations, eq(deals.id, fundAllocations.dealId))
      .groupBy(deals.id);
  }

  /**
   * Optimized fund performance query
   * Calculates metrics in single database query
   */
  async getOptimizedFundPerformance(fundId: number) {
    const result = await this.db
      .select({
        fundId: funds.id,
        fundName: funds.name,
        totalCommitted: sql<number>`COALESCE(SUM(${fundAllocations.amount}), 0)`,
        totalCalled: sql<number>`(
          SELECT COALESCE(SUM(cc.call_amount), 0)
          FROM capital_calls cc 
          JOIN fund_allocations fa ON cc.allocation_id = fa.id 
          WHERE fa.fund_id = ${fundId}
        )`,
        totalPaid: sql<number>`(
          SELECT COALESCE(SUM(cc.paid_amount), 0)
          FROM capital_calls cc 
          JOIN fund_allocations fa ON cc.allocation_id = fa.id 
          WHERE fa.fund_id = ${fundId}
        )`,
        allocationCount: sql<number>`COUNT(${fundAllocations.id})`,
        avgAllocationSize: sql<number>`AVG(${fundAllocations.amount})`
      })
      .from(funds)
      .leftJoin(fundAllocations, eq(funds.id, fundAllocations.fundId))
      .where(eq(funds.id, fundId))
      .groupBy(funds.id);
    
    return result[0];
  }
}