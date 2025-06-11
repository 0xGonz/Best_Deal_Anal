import { StorageFactory } from '../storage-factory';
import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { 
  CapitalCall, 
  InsertCapitalCall,
  FundAllocation,
  InsertPayment,
  Payment,
  payments
} from '@shared/schema';
import { addMonths, addQuarters, addYears, addDays } from 'date-fns';
import { normalizeToNoonUTC, formatToNoonUTC } from '@shared/utils/date-utils';
import { capitalCallsConfig } from '../config/capital-calls-config';
import { createNormalizedDate, calculateDueDate, formatForDatabase } from '../utils/date-utils';
import { batchQueryService } from './batch-query.service';

// Define allocation statuses for use in the service
const ALLOCATION_STATUS = {
  COMMITTED: 'committed',
  INVESTED: 'invested',
  FUNDED: 'funded',
  PARTIALLY_CLOSED: 'partially_closed',
  CLOSED: 'closed',
  WRITTEN_OFF: 'written_off'
};

// Define the extended capital call type with fund and deal information
interface CapitalCallWithFundAllocation extends CapitalCall {
  fund_name: string;
  deal_name: string;
  allocation_amount: number;
}

/**
 * Validate if a status transition is allowed
 */
function validateStatusTransition(currentStatus: CapitalCall['status'], newStatus: CapitalCall['status']): boolean {
  const validTransitions = capitalCallsConfig.getValidStatusTransitions();
  const allowedTransitions = validTransitions[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Calculate outstanding amount based on call amount and paid amount
 */
function calculateOutstandingAmount(callAmount: number, paidAmount: number): number {
  return Math.max(0, callAmount - (paidAmount || 0));
}

/**
 * Service for capital call related operations
 */
export class CapitalCallService {
  /**
   * Create a new capital call with validation and automatic calculation
   */
  async createCapitalCall(capitalCall: InsertCapitalCall): Promise<CapitalCall> {
    const storage = StorageFactory.getStorage();
    
    // Calculate outstanding amount automatically
    const outstandingAmount = calculateOutstandingAmount(
      capitalCall.callAmount, 
      capitalCall.paidAmount || 0
    );
    
    // Create the capital call with calculated outstanding amount
    const enrichedCapitalCall = {
      ...capitalCall,
      outstanding_amount: outstandingAmount,
      paidAmount: capitalCall.paidAmount || 0
    };
    
    const result = await storage.createCapitalCall(enrichedCapitalCall);
    
    // Update allocation status after creating capital call
    // We'll handle this through lifecycle events rather than direct imports to avoid circular dependencies
    
    return result;
  }

  /**
   * Update a capital call with validation
   */
  async updateCapitalCall(id: number, updates: Partial<CapitalCall>): Promise<CapitalCall> {
    const storage = StorageFactory.getStorage();
    
    // Get current capital call for validation
    const currentCall = await storage.getCapitalCall(id);
    if (!currentCall) {
      throw new Error('Capital call not found');
    }
    
    // Validate status transition if status is being updated
    if (updates.status && updates.status !== currentCall.status) {
      if (!validateStatusTransition(currentCall.status, updates.status)) {
        throw new Error(`Invalid status transition from ${currentCall.status} to ${updates.status}`);
      }
    }
    
    // Recalculate outstanding amount if call amount or paid amount changed
    if (updates.callAmount !== undefined || updates.paidAmount !== undefined) {
      const newCallAmount = updates.callAmount ?? currentCall.callAmount;
      const newPaidAmount = updates.paidAmount ?? (currentCall.paidAmount || 0);
      updates.outstanding_amount = calculateOutstandingAmount(newCallAmount, newPaidAmount);
    }
    
    const result = await storage.updateCapitalCall(id, updates);
    
    // Update allocation status after updating capital call
    // Status updates will be handled through lifecycle events
    
    if (!result) {
      throw new Error('Failed to update capital call');
    }
    
    return result;
  }

  /**
   * Create multiple capital calls based on allocation parameters.
   * This uses a transaction to ensure all calls are created atomically.
   */
  async createCapitalCallsForAllocation(
    allocation: FundAllocation, 
    capitalCallSchedule: string,
    callFrequency: string,
    firstCallDate: Date,
    callCount: number,
    callPercentage: number,
    callAmountType: 'percentage' | 'dollar' = 'percentage',
    callDollarAmount: number = 0
  ): Promise<CapitalCall[]> {
    const storage = StorageFactory.getStorage();
    const calls: CapitalCall[] = [];
    
    // If it's a single payment, create a paid capital call immediately
    if (capitalCallSchedule === 'single') {
      // Calculate call amount based on type
      let callAmount: number;
      if (callAmountType === 'dollar') {
        callAmount = callDollarAmount;
      } else {
        // For percentage, calculate based on allocation amount
        if (allocation.amountType === 'dollar') {
          callAmount = (allocation.amount * callPercentage) / 100;
        } else {
          callAmount = callPercentage;
        }
      }
      
      // Log the incoming date for debugging
      console.log('Creating single payment capital call with date:', {
        originalDate: firstCallDate,
        isoString: firstCallDate.toISOString(),
        dateString: firstCallDate.toString()
      });
      
      // Use the firstCallDate passed from the form for the call date, due date, and paid date
      // Normalize all dates to noon UTC to avoid timezone issues
      const normalizedDate = normalizeToNoonUTC(firstCallDate);
      
      console.log('Creating single payment capital call with normalized date:', {
        originalDate: firstCallDate,
        normalizedDate: normalizedDate,
        isoString: normalizedDate.toISOString()
      });
      
      const singleCall = await storage.createCapitalCall({
        allocationId: allocation.id,
        callAmount: callAmount,
        amountType: callAmountType === 'dollar' ? 'dollar' : allocation.amountType,
        callDate: normalizedDate, // Use the normalized date
        dueDate: normalizedDate, // Use the normalized date
        status: 'paid',
        paidAmount: callAmount, // Fully paid
        paidDate: normalizedDate, // Use the normalized date
        outstanding_amount: 0, // Nothing left to pay
        notes: 'Single payment allocation - automatically paid'
      });
      
      calls.push(singleCall);
      
      // Update allocation status to funded
      await storage.updateFundAllocation(allocation.id, {
        ...allocation,
        status: 'funded' as const
      });
      
      return calls;
    }
    
    // For scheduled payments, create multiple capital calls
    const baseAmount = allocation.amount;
    let remainingPercentage = 100;
    
    // Create capital calls based on schedule
    for (let i = 0; i < callCount; i++) {
      let callDate: Date;
      
      // Calculate call date based on frequency
      if (i === 0) {
        callDate = normalizeToNoonUTC(firstCallDate);
      } else {
        // Create normalized base date
        const baseDate = normalizeToNoonUTC(firstCallDate);
        
        switch (callFrequency) {
          case 'monthly':
            callDate = normalizeToNoonUTC(addMonths(baseDate, i));
            break;
          case 'quarterly':
            callDate = normalizeToNoonUTC(addQuarters(baseDate, i));
            break;
          case 'biannual':
            callDate = normalizeToNoonUTC(addMonths(baseDate, i * 6));
            break;
          case 'annual':
            callDate = normalizeToNoonUTC(addYears(baseDate, i));
            break;
          default:
            callDate = normalizeToNoonUTC(addMonths(baseDate, i));
        }
      }
      
      // Calculate due date using configuration instead of hardcoded value
      const dueDate = calculateDueDate(callDate);
      // Normalize to noon UTC to avoid timezone issues
      const normalizedDueDate = normalizeToNoonUTC(dueDate);
      
      // Calculate call amount based on call amount type
      let callAmount: number;
      let callAmountTypeForCall: 'percentage' | 'dollar';
      
      if (callAmountType === 'dollar') {
        // Use dollar amount divided by call count
        callAmount = callDollarAmount / callCount;
        callAmountTypeForCall = 'dollar';
      } else {
        // For the last call, use remaining percentage to ensure we reach 100%
        const isLastCall = i === callCount - 1;
        const thisCallPercentage = isLastCall ? remainingPercentage : callPercentage;
        
        // Calculate call amount based on percentage and allocation type
        if (allocation.amountType === 'dollar') {
          callAmount = (baseAmount * thisCallPercentage) / 100;
          callAmountTypeForCall = 'dollar';
        } else {
          callAmount = thisCallPercentage; // For percentage allocations, use the percentage directly
          callAmountTypeForCall = 'percentage';
        }
      }
      
      // Create capital call
      const call = await storage.createCapitalCall({
        allocationId: allocation.id,
        callAmount,
        amountType: callAmountTypeForCall,
        callDate,
        dueDate: normalizedDueDate, // Use normalized due date
        status: 'scheduled',
        paidAmount: capitalCallsConfig.getInitialPaidAmount(),
        outstanding_amount: callAmount, // Full amount outstanding - match DB column name
        notes: `Scheduled payment ${i + 1} of ${callCount}`
      });
      
      calls.push(call);
      
      // Only subtract from remaining percentage if using percentage-based calls
      if (callAmountType === 'percentage') {
        const thisCallPercentage = i === callCount - 1 ? remainingPercentage : callPercentage;
        remainingPercentage -= thisCallPercentage;
      }
    }
    
    return calls;
  }

  /**
   * Get a capital call by id
   */
  async getCapitalCall(id: number): Promise<CapitalCall | null> {
    const storage = StorageFactory.getStorage();
    const capitalCall = await storage.getCapitalCall(id);
    return capitalCall || null;
  }

  /**
   * Get all capital calls
   */
  async getAllCapitalCalls(): Promise<CapitalCall[]> {
    const storage = StorageFactory.getStorage();
    return await storage.getAllCapitalCalls();
  }

  /**
   * Get capital calls for a specific allocation
   */
  async getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]> {
    const storage = StorageFactory.getStorage();
    return await storage.getCapitalCallsByAllocation(allocationId);
  }

  /**
   * Get capital calls for a specific deal
   */
  async getCapitalCallsByDeal(dealId: number): Promise<CapitalCall[]> {
    const storage = StorageFactory.getStorage();
    return await storage.getCapitalCallsByDeal(dealId);
  }

  /**
   * Add a payment to a capital call
   * Eliminates redundant payment recording and uses configurable payment handling
   */
  async addPaymentToCapitalCall(
    capitalCallId: number, 
    paymentAmount: number, 
    paymentDate: Date,
    paymentType: 'wire' | 'check' | 'ach' | 'other' | null = null,
    notes: string | null = null,
    createdBy: number
  ): Promise<CapitalCall | null> {
    const storage = StorageFactory.getStorage();
    const config = capitalCallsConfig.getConfig();
    
    // Get current capital call with error handling
    const currentCall = await storage.getCapitalCall(capitalCallId);
    if (!currentCall) {
      throw new Error(`Capital call with ID ${capitalCallId} not found`);
    }
    
    // Use configuration default if payment type not specified
    const effectivePaymentType = paymentType || config.payments.defaultPaymentType;
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    
    // Get total payments already made for this capital call
    const existingPayments = await this.getPaymentsForCapitalCall(capitalCallId);
    const totalPaidSoFar = existingPayments.reduce((sum, payment: any) => {
      const amount = payment.amount_usd || payment.paymentAmount || 0;
      return sum + Number(amount);
    }, 0);
    
    // Calculate potential new paid amount
    const potentialPaidAmount = totalPaidSoFar + paymentAmount;
    
    // Check for over-payment based on configuration
    if (!config.payments.allowOverpayments && potentialPaidAmount > currentCall.callAmount) {
      const maxAllowed = currentCall.callAmount - totalPaidSoFar;
      throw new Error(
        `Payment amount of ${paymentAmount} would exceed the call amount of ${currentCall.callAmount}. ` +
        `Maximum allowed payment is ${maxAllowed}`
      );
    }
    
    // Validate payment notes requirement
    if (config.payments.requirePaymentNotes && !notes) {
      throw new Error('Payment notes are required by configuration');
    }
    
    // Create single payment record (eliminate redundancy)
    const normalizedPaymentDate = createNormalizedDate(paymentDate);
    await storage.createCapitalCallPayment({
      capitalCallId,
      paymentAmount,
      paymentDate: normalizedPaymentDate,
      paymentType: effectivePaymentType,
      notes,
      createdBy
    });
    
    // Calculate new amounts
    const newPaidAmount = Math.min(potentialPaidAmount, currentCall.callAmount);
    const newOutstanding = Math.max(0, currentCall.callAmount - newPaidAmount);
    
    // Determine new status based on payment amount
    let newStatus: CapitalCall['status'];
    if (newOutstanding === 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0 && newOutstanding > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = currentCall.status;
    }
    
    // Update capital call with new amounts and status
    const updatedCall = await storage.updateCapitalCall(capitalCallId, {
      ...currentCall,
      paidAmount: newPaidAmount,
      outstanding_amount: newOutstanding,
      status: newStatus,
      paidDate: normalizedPaymentDate
    });
    
    // Update allocation status if needed (only if auto-update is enabled)
    if (config.statusTransitions.autoStatusUpdate && newStatus === 'paid') {
      await this.updateAllocationStatusIfComplete(currentCall.allocationId, capitalCallId);
    }
    
    return updatedCall || null;
  }
  
  /**
   * Helper method to update allocation status when all capital calls are complete
   */
  private async updateAllocationStatusIfComplete(allocationId: number, excludeCallId?: number): Promise<void> {
    const storage = StorageFactory.getStorage();
    
    try {
      const allocation = await storage.getFundAllocation(allocationId);
      if (!allocation || allocation.status === 'funded') {
        return;
      }
      
      const allCalls = await storage.getCapitalCallsByAllocation(allocationId);
      const hasUnpaidCalls = allCalls.some(call => 
        call.id !== excludeCallId && 
        call.status !== 'paid' && 
        call.status !== 'defaulted'
      );
      
      if (!hasUnpaidCalls) {
        await storage.updateFundAllocation(allocationId, {
          ...allocation,
          status: 'funded' as const
        });
      }
    } catch (error) {
      console.error(`Failed to update allocation status for allocation ${allocationId}:`, error);
      // Don't throw - this is a side effect, main payment should still succeed
    }
  }
  
  /**
   * Get all payments for a specific capital call
   */
  async getPaymentsForCapitalCall(capitalCallId: number): Promise<any[]> {
    // Use SQL template literals to avoid field name mapping issues
    // We're returning any[] instead of Payment[] because the raw SQL results use snake_case field names
    const result = await db.execute(sql`
      SELECT * FROM payments WHERE capital_call_id = ${capitalCallId}
    `);
    return result.rows || [];
  }

  /**
   * Update a capital call status with validation of state transitions
   */
  async updateCapitalCallStatus(id: number, newStatus: CapitalCall['status'], paidAmount?: number): Promise<CapitalCall | null> {
    const storage = StorageFactory.getStorage();
    
    // Get current capital call
    const currentCall = await storage.getCapitalCall(id);
    if (!currentCall) {
      throw new Error('Capital call not found');
    }
    
    // Validate status transition
    const currentStatus = currentCall.status;
    const validTransitions = capitalCallsConfig.getValidStatusTransitions();
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
      );
    }
    
    // Calculate new values based on status change
    let newPaidAmount = currentCall.paidAmount;
    let newOutstanding = currentCall.outstanding_amount;
    let paidDate = currentCall.paidDate;
    
    // Handle payment-related status changes
    if (newStatus === 'paid' && paidAmount) {
      newPaidAmount = paidAmount;
      newOutstanding = 0;
      paidDate = createNormalizedDate();
    } else if (newStatus === 'partial' && paidAmount) {
      // Additional validations for partial payments
      if (!paidAmount || paidAmount >= currentCall.callAmount) {
        throw new Error('Partial payment amount must be greater than 0 and less than the call amount');
      }
      
      newPaidAmount = paidAmount;
      newOutstanding = currentCall.callAmount - paidAmount;
      paidDate = createNormalizedDate();
    } else if (newStatus === 'defaulted') {
      // Defaulted calls have their outstanding amount written off
      newOutstanding = 0;
    }
    
    // Process the status update with potential side effects
    if (newStatus === 'paid') {
      // Get the allocation to update its status if needed
      const allocation = await storage.getFundAllocation(currentCall.allocationId);
      
      if (allocation) {
        // Check if this is the last unpaid call for this allocation
        const allCalls = await storage.getCapitalCallsByAllocation(allocation.id);
        const hasUnpaidCalls = allCalls.some(call => 
          call.id !== id && 
          call.status !== 'paid' && 
          call.status !== 'defaulted'
        );
        
        // If all calls are now paid or defaulted, update allocation status to funded
        if (!hasUnpaidCalls && allocation.status !== 'funded') {
          await storage.updateFundAllocation(allocation.id, {
            ...allocation,
            status: 'funded' as const
          });
        }
      }
    }
    
    // Update the capital call with all changes
    const updatedCall = await storage.updateCapitalCall(id, {
      ...currentCall,
      status: newStatus,
      paidAmount: newPaidAmount,
      outstanding_amount: newOutstanding,
      paidDate
    });
    
    return updatedCall || null;
  }

  /**
   * Update capital call dates with validation
   */
  async updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<CapitalCall | null> {
    const storage = StorageFactory.getStorage();
    
    // Validate dates
    if (dueDate < callDate) {
      throw new Error('Due date must be after call date');
    }
    
    // Get current capital call to ensure it exists
    const currentCall = await storage.getCapitalCall(id);
    if (!currentCall) {
      throw new Error('Capital call not found');
    }
    
    // Only allow date changes for scheduled or called capital calls
    if (currentCall.status !== 'scheduled' && currentCall.status !== 'called') {
      throw new Error(`Cannot update dates for capital call with status '${currentCall.status}'`);
    }
    
    // Format dates properly for consistent handling
    // First get ISO strings and split to get just the date part (YYYY-MM-DD)
    const formattedCallDate = new Date(callDate).toISOString().split('T')[0];
    const formattedDueDate = new Date(dueDate).toISOString().split('T')[0];
    
    // Then convert back to Date objects for the storage interface
    const callDateObj = new Date(formattedCallDate);
    const dueDateObj = new Date(formattedDueDate);
    
    // Update the dates with properly formatted Date objects
    const updatedCall = await storage.updateCapitalCallDates(id, callDateObj, dueDateObj);
    return updatedCall || null;
  }

  /**
   * Get capital calls for the calendar view
   * Including additional information about the fund and allocation
   * Uses optimized batch queries to eliminate N+1 query performance issues
   */
  async getCapitalCallsForCalendar(startDate: Date, endDate: Date): Promise<CapitalCallWithFundAllocation[]> {
    const storage = StorageFactory.getStorage();
    const capitalCalls = await storage.getAllCapitalCalls();
    
    if (!capitalCalls.length) {
      return [];
    }
    
    // Filter capital calls by date range
    const filteredCalls = capitalCalls.filter((call: CapitalCall) => {
      const callDate = new Date(call.callDate);
      return callDate >= startDate && callDate <= endDate;
    });
    
    if (!filteredCalls.length) {
      return [];
    }

    // Get all allocation IDs from capital calls
    const allocationIds = [...new Set(filteredCalls.map(call => call.allocationId))];
    
    // Use batch query service to fetch all related data efficiently
    const batchResults = await batchQueryService.batchFetchForCapitalCalls(allocationIds);
    
    // Now enhance each capital call with fund and deal information
    const result = filteredCalls.map(call => {
      const allocation = batchResults.allocations.get(call.allocationId);
      
      if (!allocation) {
        // Log missing allocation for debugging instead of returning fallback data
        console.warn(`Capital call ${call.id} references missing allocation ${call.allocationId}`);
        return null; // Return null instead of corrupt fallback data
      }
      
      const deal = batchResults.deals.get(allocation.dealId);
      const fund = batchResults.funds.get(allocation.fundId);
      
      if (!deal || !fund) {
        console.warn(`Missing related data for allocation ${allocation.id}: deal=${!!deal}, fund=${!!fund}`);
        return null; // Return null instead of corrupt fallback data
      }
      
      return {
        ...call,
        fund_name: fund.name,
        deal_name: deal.name,
        allocation_amount: allocation.amount,
        // For client compatibility
        dealId: allocation.dealId,
        fundId: allocation.fundId,
        dealName: deal.name,
        fundName: fund.name,
        // Ensure outstanding amount is calculated correctly
        outstanding_amount: call.outstanding_amount ?? Math.max(0, call.callAmount - (call.paidAmount || 0))
      };
    }).filter(call => call !== null); // Remove null entries
    
    return result;
  }
}

export const capitalCallService = new CapitalCallService();