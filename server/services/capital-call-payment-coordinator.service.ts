/**
 * Capital Call Payment Coordinator Service
 * 
 * CORE BUSINESS RULE: Capital Call = Payment (if 20% called, then 20% paid)
 * 
 * This service ensures the fundamental relationship between capital calls and payments
 * is maintained across the entire platform with atomic operations and data consistency.
 */

import { DatabaseStorage } from '../database-storage.ts';

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
import type { CapitalCall, CapitalCallPayment, FundAllocation } from '../../shared/schema.ts';

export interface CapitalCallPaymentTransaction {
  allocationId: number;
  callPercentage: number;
  callAmount: number;
  dueDate: Date;
  notes?: string;
}

export interface PaymentResult {
  capitalCall: CapitalCall;
  payment: CapitalCallPayment;
  updatedAllocation: FundAllocation;
  newStatus: string;
}

/**
 * Coordinates capital calls and payments to maintain the called = paid business rule
 */
export class CapitalCallPaymentCoordinator {
  private storage = new DatabaseStorage();

  /**
   * Creates a capital call and immediately processes the payment
   * This enforces the business rule: if capital is called, it's automatically paid
   */
  async createCapitalCallWithPayment(transaction: CapitalCallPaymentTransaction): Promise<PaymentResult> {
    try {
      // Get allocation to validate
      const allocation = await this.storage.getAllocation(transaction.allocationId);
      if (!allocation) {
        throw new DatabaseError(`Allocation ${transaction.allocationId} not found`);
      }

      // Calculate amounts based on allocation
      const totalCommitment = allocation.amount;
      const callAmount = transaction.callAmount || (totalCommitment * transaction.callPercentage / 100);
      const currentPaid = allocation.paidAmount || 0;
      const newPaidAmount = currentPaid + callAmount;

      // Validate we don't exceed commitment
      if (newPaidAmount > totalCommitment) {
        throw new DatabaseError(`Payment would exceed commitment: ${newPaidAmount} > ${totalCommitment}`);
      }

      // Create capital call
      const capitalCall = await this.storage.createCapitalCall({
        allocationId: transaction.allocationId,
        callAmount,
        amountType: 'dollar',
        callDate: new Date(),
        dueDate: transaction.dueDate,
        status: 'paid', // Immediately mark as paid per business rule
        notes: transaction.notes || `Called and paid ${callAmount} (${(callAmount/totalCommitment*100).toFixed(1)}%)`
      });

      // Create corresponding payment record
      const payment = await this.storage.createCapitalCallPayment({
        capitalCallId: capitalCall.id,
        paymentAmount: callAmount,
        paymentDate: new Date(),
        paymentType: 'wire',
        notes: `Automatic payment for capital call ${capitalCall.id}`
      });

      // Update allocation with new paid amount and status
      const paymentPercentage = (newPaidAmount / totalCommitment) * 100;
      let newStatus: string;
      
      if (paymentPercentage >= 99.9) {
        newStatus = 'funded';
      } else if (paymentPercentage > 0.1) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'committed';
      }

      const updatedAllocation = await this.storage.updateAllocation(transaction.allocationId, {
        paidAmount: newPaidAmount,
        status: newStatus as any
      });

      return {
        capitalCall,
        payment,
        updatedAllocation,
        newStatus
      };

    } catch (error) {
      console.error('Error in createCapitalCallWithPayment:', error);
      throw new DatabaseError(`Failed to create capital call with payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes a payment for an existing capital call
   * Maintains the called = paid relationship
   */
  async processPaymentForCapitalCall(capitalCallId: number, paymentAmount?: number): Promise<PaymentResult> {
    try {
      const capitalCall = await this.storage.getCapitalCall(capitalCallId);
      if (!capitalCall) {
        throw new DatabaseError(`Capital call ${capitalCallId} not found`);
      }

      const allocation = await this.storage.getAllocation(capitalCall.allocationId);
      if (!allocation) {
        throw new DatabaseError(`Allocation ${capitalCall.allocationId} not found`);
      }

      // Use call amount if payment amount not specified (enforces called = paid rule)
      const amountToPay = paymentAmount || capitalCall.callAmount;
      
      // Create payment record
      const payment = await this.storage.createCapitalCallPayment({
        capitalCallId: capitalCall.id,
        paymentAmount: amountToPay,
        paymentDate: new Date(),
        paymentType: 'wire',
        notes: `Payment for capital call ${capitalCall.id}`
      });

      // Update capital call status
      await this.storage.updateCapitalCall(capitalCallId, {
        paidAmount: amountToPay,
        status: 'paid'
      });

      // Update allocation
      const currentPaid = allocation.paidAmount || 0;
      const newPaidAmount = currentPaid + amountToPay;
      const paymentPercentage = (newPaidAmount / allocation.amount) * 100;
      
      let newStatus: string;
      if (paymentPercentage >= 99.9) {
        newStatus = 'funded';
      } else if (paymentPercentage > 0.1) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'committed';
      }

      const updatedAllocation = await this.storage.updateAllocation(allocation.id, {
        paidAmount: newPaidAmount,
        status: newStatus as any
      });

      return {
        capitalCall: { ...capitalCall, paidAmount: amountToPay, status: 'paid' as any },
        payment,
        updatedAllocation,
        newStatus
      };

    } catch (error) {
      console.error('Error in processPaymentForCapitalCall:', error);
      throw new DatabaseError(`Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets the payment status for all allocations in a fund
   * Provides real-time called vs uncalled calculations
   */
  async getFundPaymentSummary(fundId: number) {
    try {
      const allocations = await this.storage.getAllocationsByFund(fundId);
      
      let totalCommitted = 0;
      let totalCalled = 0;
      let totalPaid = 0;
      const allocationSummaries = [];

      for (const allocation of allocations) {
        const amount = allocation.amount || 0;
        const paidAmount = allocation.paidAmount || 0;
        
        // Get capital calls for this allocation
        const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
        const calledAmount = capitalCalls.reduce((sum, call) => sum + (call.callAmount || 0), 0);

        totalCommitted += amount;
        totalCalled += calledAmount;
        totalPaid += paidAmount;

        allocationSummaries.push({
          allocationId: allocation.id,
          dealName: allocation.dealName || 'Unknown Deal',
          committed: amount,
          called: calledAmount,
          paid: paidAmount,
          uncalled: amount - calledAmount,
          paymentPercentage: amount > 0 ? (paidAmount / amount) * 100 : 0,
          status: allocation.status,
          isConsistent: Math.abs(calledAmount - paidAmount) < 0.01 // Check called = paid rule
        });
      }

      return {
        fundId,
        summary: {
          totalCommitted,
          totalCalled,
          totalPaid,
          totalUncalled: totalCommitted - totalCalled,
          consistencyCheck: Math.abs(totalCalled - totalPaid) < 0.01
        },
        allocations: allocationSummaries
      };

    } catch (error) {
      console.error('Error in getFundPaymentSummary:', error);
      throw new DatabaseError(`Failed to get fund payment summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates and fixes any inconsistencies between called and paid amounts
   * Ensures the called = paid business rule is maintained
   */
  async validateAndFixConsistency(fundId?: number) {
    try {
      let allocations;
      
      if (fundId) {
        allocations = await this.storage.getAllocationsByFund(fundId);
      } else {
        // Get all allocations across all funds
        allocations = await this.storage.getAllocations();
      }

      const inconsistencies = [];
      const fixes = [];

      for (const allocation of allocations) {
        const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
        const totalCalled = capitalCalls.reduce((sum, call) => sum + (call.callAmount || 0), 0);
        const totalPaid = allocation.paidAmount || 0;

        // Check if called != paid (allowing for small rounding differences)
        if (Math.abs(totalCalled - totalPaid) > 0.01) {
          inconsistencies.push({
            allocationId: allocation.id,
            dealName: allocation.dealName || 'Unknown Deal',
            totalCalled,
            totalPaid,
            difference: totalCalled - totalPaid
          });

          // Fix by updating paid amount to match called amount
          if (totalCalled > 0) {
            await this.storage.updateAllocation(allocation.id, {
              paidAmount: totalCalled
            });

            fixes.push({
              allocationId: allocation.id,
              oldPaidAmount: totalPaid,
              newPaidAmount: totalCalled,
              action: 'Updated paid amount to match called amount'
            });
          }
        }
      }

      return {
        inconsistenciesFound: inconsistencies.length,
        inconsistencies,
        fixesApplied: fixes.length,
        fixes
      };

    } catch (error) {
      console.error('Error in validateAndFixConsistency:', error);
      throw new DatabaseError(`Failed to validate consistency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const capitalCallPaymentCoordinator = new CapitalCallPaymentCoordinator();