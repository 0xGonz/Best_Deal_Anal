/**
 * Capital Call Lifecycle Service
 * 
 * Comprehensive capital call management that handles:
 * - Multiple capital calls per allocation
 * - Automatic status updates based on payment progress
 * - Percentage and dollar-based capital calls
 * - Complete payment tracking and validation
 */

import { StorageFactory } from "../storage-factory";
import { AllocationService } from "./allocation.service";

interface CapitalCallRequest {
  allocationId: number;
  callAmount: number;
  amountType: 'percentage' | 'dollar';
  callDate: Date;
  status?: string;
  dueDate?: Date;
  notes?: string;
}

interface PaymentRequest {
  capitalCallId: number;
  paymentAmount: number;
  paymentDate?: Date;
  notes?: string;
}

interface AllocationProgress {
  allocationId: number;
  committedAmount: number;
  totalCalled: number;
  totalPaid: number;
  percentageCalled: number;
  percentagePaid: number;
  currentStatus: string;
  capitalCalls: CapitalCallSummary[];
}

interface CapitalCallSummary {
  id: number;
  callAmount: number;
  amountType: string;
  callDate: Date;
  dueDate?: Date;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  notes?: string;
}

export class CapitalCallLifecycleService {
  private storage = StorageFactory.getStorage();
  private allocationService = new AllocationService();

  /**
   * Creates a new capital call for an allocation
   * Validates against committed amount and updates allocation status
   */
  async createCapitalCall(request: CapitalCallRequest, userId: number): Promise<{
    success: boolean;
    capitalCall?: any;
    error?: string;
    validationErrors?: string[];
  }> {
    try {
      // Get allocation details
      const allocation = await this.storage.getFundAllocation(request.allocationId);
      if (!allocation) {
        return { success: false, error: 'Allocation not found' };
      }

      // Validate capital call amount
      const validationResult = await this.validateCapitalCallAmount(
        request.allocationId, 
        request.callAmount, 
        request.amountType
      );

      if (!validationResult.valid) {
        return { 
          success: false, 
          error: 'Invalid capital call amount',
          validationErrors: validationResult.errors 
        };
      }

      // Convert percentage to dollar amount if needed
      let callAmountInDollars = request.callAmount;
      if (request.amountType === 'percentage') {
        callAmountInDollars = (allocation.amount * request.callAmount) / 100;
      }

      // Create capital call
      const capitalCall = await this.storage.createCapitalCall({
        allocationId: request.allocationId,
        callAmount: callAmountInDollars,
        amountType: request.amountType,
        dueDate: request.dueDate || null,
        callDate: request.callDate,
        paidAmount: 0,
        outstanding_amount: callAmountInDollars.toString(),
        status: request.status || 'called',
        notes: request.notes,
        callPct: request.amountType === 'percentage' ? request.callAmount : null
      });

      // Update allocation status
      await this.allocationService.updateAllocationStatus(request.allocationId);

      // Create timeline event
      await this.storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call',
        content: `Capital call created for ${callAmountInDollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        createdBy: userId,
        metadata: {
          allocationId: request.allocationId,
          capitalCallId: capitalCall.id,
          amount: callAmountInDollars,
          amountType: request.amountType,
          fundId: allocation.fundId
        }
      });

      return { success: true, capitalCall };
    } catch (error) {
      console.error('Error creating capital call:', error);
      return { success: false, error: 'Failed to create capital call' };
    }
  }

  /**
   * Records a payment against a capital call
   * Updates capital call status and allocation status automatically
   */
  async recordPayment(request: PaymentRequest, userId: number): Promise<{
    success: boolean;
    payment?: any;
    error?: string;
  }> {
    try {
      const capitalCall = await this.storage.getCapitalCall(request.capitalCallId);
      if (!capitalCall) {
        return { success: false, error: 'Capital call not found' };
      }

      // Validate payment amount
      const maxPayment = capitalCall.callAmount - (capitalCall.paidAmount || 0);
      if (request.paymentAmount > maxPayment) {
        return { 
          success: false, 
          error: `Payment amount cannot exceed outstanding amount of ${maxPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` 
        };
      }

      // Update capital call with payment
      const newPaidAmount = (capitalCall.paidAmount || 0) + request.paymentAmount;
      const newOutstandingAmount = capitalCall.callAmount - newPaidAmount;
      const newStatus = newOutstandingAmount === 0 ? 'paid' : 'partially_paid';

      await this.storage.updateCapitalCall(request.capitalCallId, {
        paidAmount: newPaidAmount,
        outstanding_amount: newOutstandingAmount.toString(),
        paidDate: request.paymentDate || new Date(),
        status: newStatus,
        notes: request.notes || capitalCall.notes
      });

      // Update allocation status based on all capital calls
      await this.allocationService.updateAllocationStatus(capitalCall.allocationId);

      // Get allocation for timeline event
      const allocation = await this.storage.getFundAllocation(capitalCall.allocationId);
      
      // Create timeline event
      await this.storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'payment',
        content: `Payment of ${request.paymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} recorded`,
        createdBy: userId,
        metadata: {
          capitalCallId: request.capitalCallId,
          allocationId: capitalCall.allocationId,
          paymentAmount: request.paymentAmount,
          fundId: allocation.fundId
        }
      });

      return { success: true, payment: { amount: request.paymentAmount, status: newStatus } };
    } catch (error) {
      console.error('Error recording payment:', error);
      return { success: false, error: 'Failed to record payment' };
    }
  }

  /**
   * Gets complete allocation progress including all capital calls
   */
  async getAllocationProgress(allocationId: number): Promise<AllocationProgress | null> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) return null;

      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      
      let totalCalled = 0;
      let totalPaid = 0;

      const capitalCallSummaries: CapitalCallSummary[] = capitalCalls.map(call => {
        totalCalled += call.callAmount;
        totalPaid += call.paidAmount || 0;

        return {
          id: call.id,
          callAmount: call.callAmount,
          amountType: call.amountType,
          callDate: call.callDate,
          dueDate: call.dueDate,
          paidAmount: call.paidAmount || 0,
          outstandingAmount: call.outstandingAmount,
          status: call.status,
          notes: call.notes
        };
      });

      return {
        allocationId,
        committedAmount: allocation.amount,
        totalCalled,
        totalPaid,
        percentageCalled: allocation.amount > 0 ? (totalCalled / allocation.amount) * 100 : 0,
        percentagePaid: allocation.amount > 0 ? (totalPaid / allocation.amount) * 100 : 0,
        currentStatus: allocation.status,
        capitalCalls: capitalCallSummaries
      };
    } catch (error) {
      console.error('Error getting allocation progress:', error);
      return null;
    }
  }

  /**
   * Validates that a capital call amount is valid for the allocation
   */
  private async validateCapitalCallAmount(
    allocationId: number, 
    amount: number, 
    amountType: 'percentage' | 'dollar'
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        errors.push('Allocation not found');
        return { valid: false, errors };
      }

      const existingCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      
      // Calculate total already called
      const totalCalled = existingCalls.reduce((sum, call) => sum + call.callAmount, 0);
      
      // Convert amount to dollars for validation
      let callAmountInDollars = amount;
      if (amountType === 'percentage') {
        if (amount < 0 || amount > 100) {
          errors.push('Percentage must be between 0 and 100');
          return { valid: false, errors };
        }
        callAmountInDollars = (allocation.amount * amount) / 100;
      }

      // Check if this call would exceed committed amount
      if (totalCalled + callAmountInDollars > allocation.amount) {
        const remaining = allocation.amount - totalCalled;
        errors.push(`Capital call would exceed committed amount. Maximum remaining: ${remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push('Error validating capital call amount');
      return { valid: false, errors };
    }
  }

  /**
   * Gets all capital calls for a deal
   */
  async getCapitalCallsByDeal(dealId: number): Promise<any[]> {
    try {
      // Get all allocations for this deal
      const allocations = await this.storage.getAllocationsByDeal(dealId);
      
      const allCapitalCalls: any[] = [];
      
      // Get capital calls for each allocation
      for (const allocation of allocations) {
        const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
        
        // Add allocation and fund info to each capital call
        for (const call of capitalCalls) {
          allCapitalCalls.push({
            ...call,
            allocation,
            fundId: allocation.fundId,
            fundName: allocation.fundName || '',
            dealId: allocation.dealId,
            dealName: allocation.dealName || ''
          });
        }
      }
      
      // Sort by due date
      return allCapitalCalls.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    } catch (error) {
      console.error('Error getting capital calls by deal:', error);
      return [];
    }
  }

  /**
   * Gets all capital calls for a fund with aggregated data
   */
  async getCapitalCallsByFund(fundId: number): Promise<{
    fundId: number;
    totalCommitted: number;
    totalCalled: number;
    totalPaid: number;
    totalOutstanding: number;
    callsByAllocation: { [key: number]: AllocationProgress };
  }> {
    try {
      const allocations = await this.storage.getAllocationsByFund(fundId);
      
      let totalCommitted = 0;
      let totalCalled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;
      const callsByAllocation: { [key: number]: AllocationProgress } = {};

      for (const allocation of allocations) {
        const progress = await this.getAllocationProgress(allocation.id);
        if (progress) {
          totalCommitted += progress.committedAmount;
          totalCalled += progress.totalCalled;
          totalPaid += progress.totalPaid;
          totalOutstanding += progress.totalCalled - progress.totalPaid;
          callsByAllocation[allocation.id] = progress;
        }
      }

      return {
        fundId,
        totalCommitted,
        totalCalled,
        totalPaid,
        totalOutstanding,
        callsByAllocation
      };
    } catch (error) {
      console.error('Error getting capital calls by fund:', error);
      return {
        fundId,
        totalCommitted: 0,
        totalCalled: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        callsByAllocation: {}
      };
    }
  }

  /**
   * Gets all capital calls with full fund and deal details
   */
  async getAllCapitalCallsWithDetails(): Promise<any[]> {
    try {
      // Get all allocations first to get fund and deal info
      const allocations = await this.storage.getAllAllocations();
      const allCapitalCalls: any[] = [];
      
      // Get capital calls for each allocation
      for (const allocation of allocations) {
        const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
        
        // Add allocation, fund, and deal info to each capital call
        for (const call of capitalCalls) {
          allCapitalCalls.push({
            id: call.id,
            allocationId: call.allocationId,
            callAmount: call.callAmount,
            amountType: call.amountType,
            callDate: call.callDate,
            dueDate: call.dueDate,
            paidAmount: call.paidAmount || 0,
            paidDate: call.paidDate,
            status: call.status,
            notes: call.notes,
            createdBy: call.createdBy,
            createdAt: call.createdAt,
            dealId: allocation.dealId,
            dealName: allocation.dealName || 'N/A',
            fundId: allocation.fundId,
            fundName: allocation.fundName || 'N/A'
          });
        }
      }
      
      // Sort by due date
      return allCapitalCalls.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    } catch (error) {
      console.error('Error getting all capital calls with details:', error);
      return [];
    }
  }
}