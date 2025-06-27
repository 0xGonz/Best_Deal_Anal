/**
 * Unified Capital Call Service
 * 
 * Systematic, scalable solution that seamlessly handles both percentage and dollar
 * allocation types with perfect integration across all payment workflows.
 */

import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { fundAllocations, capitalCalls } from '../../shared/schema.js';
import { addMonths, addQuarters, addYears } from 'date-fns';

type FundAllocation = typeof fundAllocations.$inferSelect;
type CapitalCall = typeof capitalCalls.$inferSelect;

interface CapitalCallRequest {
  allocation: FundAllocation;
  schedule: 'single' | 'scheduled';
  frequency?: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  firstCallDate: Date;
  callCount?: number;
  callPercentage?: number;
  callAmountType: 'percentage' | 'dollar';
  callDollarAmount?: number;
}

export class UnifiedCapitalCallService {

  /**
   * Create capital calls that work seamlessly with both percentage and dollar allocations
   */
  async createCapitalCalls(request: CapitalCallRequest): Promise<CapitalCall[]> {
    const { allocation, schedule, frequency, firstCallDate, callCount = 1 } = request;
    
    console.log('Creating capital calls:', {
      allocationId: allocation.id,
      allocationType: allocation.amountType,
      allocationAmount: allocation.amount,
      callAmountType: request.callAmountType,
      schedule,
      callCount
    });

    if (schedule === 'single') {
      return this.createSingleCapitalCall(request);
    } else {
      return this.createScheduledCapitalCalls(request);
    }
  }

  /**
   * Create a single capital call with proper type integration
   */
  private async createSingleCapitalCall(request: CapitalCallRequest): Promise<CapitalCall[]> {
    const { allocation, callAmountType, callPercentage = 100, callDollarAmount = 0, firstCallDate } = request;
    
    // Calculate the actual call amount based on the call type and allocation type
    const callAmount = this.calculateCallAmount(
      allocation,
      callAmountType,
      callPercentage,
      callDollarAmount
    );

    // Determine the amount type for the capital call record
    const capitalCallAmountType = this.determineCapitalCallAmountType(allocation, callAmountType);

    const normalizedDate = this.normalizeToNoonUTC(firstCallDate);

    const result = await db.execute(sql`
      INSERT INTO capital_calls (
        allocation_id, call_amount, amount_type, call_date, due_date, 
        status, paid_amount, paid_date, outstanding_amount, notes
      ) VALUES (
        ${allocation.id}, ${callAmount}, ${capitalCallAmountType}, 
        ${normalizedDate}, ${normalizedDate}, 'paid', ${callAmount}, 
        ${normalizedDate}, 0, 'Single payment allocation - automatically paid'
      ) RETURNING *
    `);

    const capitalCall = result.rows[0] as CapitalCall;

    // Update allocation status to funded
    await db.execute(sql`
      UPDATE fund_allocations 
      SET status = 'funded' 
      WHERE id = ${allocation.id}
    `);

    console.log('Created single capital call:', {
      id: capitalCall[0].id,
      amount: callAmount,
      type: capitalCallAmountType
    });

    return capitalCall;
  }

  /**
   * Create scheduled capital calls with proper type integration
   */
  private async createScheduledCapitalCalls(request: CapitalCallRequest): Promise<CapitalCall[]> {
    const { 
      allocation, 
      frequency = 'monthly', 
      firstCallDate, 
      callCount = 1, 
      callAmountType,
      callPercentage = 100,
      callDollarAmount = 0
    } = request;

    const calls: CapitalCall[] = [];
    const capitalCallAmountType = this.determineCapitalCallAmountType(allocation, callAmountType);

    // Calculate individual call amounts
    const totalCallAmount = this.calculateCallAmount(
      allocation,
      callAmountType,
      callPercentage,
      callDollarAmount
    );

    const individualCallAmount = totalCallAmount / callCount;

    for (let i = 0; i < callCount; i++) {
      const callDate = this.calculateCallDate(firstCallDate, frequency, i);
      const dueDate = this.calculateDueDate(callDate);

      const capitalCall = await db.insert(db.capitalCalls).values({
        allocationId: allocation.id,
        callAmount: individualCallAmount,
        amountType: capitalCallAmountType,
        callDate,
        dueDate,
        status: 'scheduled',
        paidAmount: 0,
        outstandingAmount: individualCallAmount,
        notes: `Scheduled payment ${i + 1} of ${callCount}`
      }).returning();

      calls.push(capitalCall[0]);
    }

    console.log('Created scheduled capital calls:', {
      count: calls.length,
      totalAmount: totalCallAmount,
      individualAmount: individualCallAmount,
      type: capitalCallAmountType
    });

    return calls;
  }

  /**
   * Calculate the actual call amount based on allocation and call types
   */
  private calculateCallAmount(
    allocation: FundAllocation,
    callAmountType: 'percentage' | 'dollar',
    callPercentage: number,
    callDollarAmount: number
  ): number {
    if (callAmountType === 'dollar') {
      // When calling a specific dollar amount, use it directly
      return callDollarAmount;
    } else {
      // When calling a percentage, calculate based on allocation amount
      if (allocation.amountType === 'dollar') {
        // Dollar allocation with percentage call
        return (allocation.amount * callPercentage) / 100;
      } else {
        // Percentage allocation with percentage call
        return callPercentage;
      }
    }
  }

  /**
   * Determine what amount type should be stored in the capital call record
   */
  private determineCapitalCallAmountType(
    allocation: FundAllocation,
    callAmountType: 'percentage' | 'dollar'
  ): 'percentage' | 'dollar' {
    // If the call is in dollars, store as dollar
    if (callAmountType === 'dollar') {
      return 'dollar';
    }
    
    // If the call is in percentage, store based on allocation type
    return allocation.amountType === 'dollar' ? 'dollar' : 'percentage';
  }

  /**
   * Calculate call date based on frequency
   */
  private calculateCallDate(baseDate: Date, frequency: string, index: number): Date {
    if (index === 0) {
      return this.normalizeToNoonUTC(baseDate);
    }

    const normalizedBase = this.normalizeToNoonUTC(baseDate);

    switch (frequency) {
      case 'monthly':
        return this.normalizeToNoonUTC(addMonths(normalizedBase, index));
      case 'quarterly':
        return this.normalizeToNoonUTC(addQuarters(normalizedBase, index));
      case 'biannual':
        return this.normalizeToNoonUTC(addMonths(normalizedBase, index * 6));
      case 'annual':
        return this.normalizeToNoonUTC(addYears(normalizedBase, index));
      default:
        return this.normalizeToNoonUTC(addMonths(normalizedBase, index));
    }
  }

  /**
   * Calculate due date (30 days after call date)
   */
  private calculateDueDate(callDate: Date): Date {
    return this.normalizeToNoonUTC(addMonths(callDate, 1));
  }

  /**
   * Normalize date to noon UTC to avoid timezone issues
   */
  private normalizeToNoonUTC(date: Date): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(12, 0, 0, 0);
    return normalized;
  }

  /**
   * Update capital call payment
   */
  async updateCapitalCallPayment(
    capitalCallId: number,
    paidAmount: number,
    paidDate: Date = new Date()
  ): Promise<{ success: boolean; message: string }> {
    try {
      const capitalCall = await db.query.capitalCalls.findFirst({
        where: sql`${db.capitalCalls.id} = ${capitalCallId}`
      });

      if (!capitalCall) {
        return { success: false, message: 'Capital call not found' };
      }

      const outstandingAmount = Math.max(0, capitalCall.callAmount - paidAmount);
      const status = outstandingAmount === 0 ? 'paid' : 'partially_paid';

      await db.update(db.capitalCalls)
        .set({
          paidAmount,
          paidDate: this.normalizeToNoonUTC(paidDate),
          outstandingAmount,
          status
        })
        .where(sql`id = ${capitalCallId}`);

      // Update allocation status based on all capital calls
      await this.updateAllocationStatus(capitalCall.allocationId);

      return { 
        success: true, 
        message: `Payment of $${paidAmount.toLocaleString()} recorded successfully` 
      };

    } catch (error) {
      console.error('Failed to update capital call payment:', error);
      return { 
        success: false, 
        message: `Payment update failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Update allocation status based on capital call payments
   */
  private async updateAllocationStatus(allocationId: number): Promise<void> {
    const allocation = await db.query.fundAllocations.findFirst({
      where: sql`${db.fundAllocations.id} = ${allocationId}`
    });

    if (!allocation) return;

    const capitalCalls = await db.query.capitalCalls.findMany({
      where: sql`${db.capitalCalls.allocationId} = ${allocationId}`
    });

    // Calculate total called and paid amounts
    let totalCalled = 0;
    let totalPaid = 0;

    for (const call of capitalCalls) {
      if (call.amountType === 'percentage' && allocation.amountType === 'dollar') {
        // Convert percentage to dollar amount
        totalCalled += (allocation.amount * call.callAmount) / 100;
      } else {
        totalCalled += call.callAmount;
      }
      totalPaid += call.paidAmount || 0;
    }

    // Determine status based on payments
    let status: 'committed' | 'partially_paid' | 'funded';
    
    if (totalPaid === 0) {
      status = 'committed';
    } else if (totalCalled <= totalPaid) {
      status = 'funded';
    } else {
      status = 'partially_paid';
    }

    await db.update(db.fundAllocations)
      .set({ 
        status,
        paidAmount: totalPaid
      })
      .where(sql`id = ${allocationId}`);

    console.log('Updated allocation status:', {
      allocationId,
      totalCalled,
      totalPaid,
      status
    });
  }

  /**
   * Get capital calls for an allocation
   */
  async getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]> {
    return await db.query.capitalCalls.findMany({
      where: sql`${db.capitalCalls.allocationId} = ${allocationId}`,
      orderBy: sql`${db.capitalCalls.callDate} ASC`
    });
  }
}