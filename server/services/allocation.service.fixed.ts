/**
 * Allocation Service - Fixed Version
 * Eliminates string-number concatenation bugs
 * Uses proper NUMERIC arithmetic throughout
 */

import { StorageFactory } from '../storage-factory';
import Decimal from 'decimal.js';

export class AllocationServiceFixed {
  private storage = StorageFactory.getStorage();

  /**
   * Apply Payment to Allocation - FIXED VERSION
   * Eliminates string concatenation by using Decimal arithmetic
   */
  async applyPaymentToAllocation(
    allocationId: number, 
    paymentAmount: number | string
  ): Promise<{
    success: boolean;
    previousAmount: number;
    newAmount: number;
    error?: string;
  }> {
    try {
      // Get current allocation
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        return {
          success: false,
          previousAmount: 0,
          newAmount: 0,
          error: 'Allocation not found'
        };
      }

      // Use Decimal.js for precise arithmetic - no string concatenation
      const currentPaidAmount = new Decimal(allocation.paidAmount?.toString() || '0');
      const payment = new Decimal(paymentAmount.toString());
      const totalCommitted = new Decimal(allocation.amount.toString());

      // Calculate new paid amount with precise arithmetic
      const newPaidAmount = currentPaidAmount.plus(payment);

      // Validate payment doesn't exceed committed amount
      if (newPaidAmount.greaterThan(totalCommitted)) {
        return {
          success: false,
          previousAmount: currentPaidAmount.toNumber(),
          newAmount: currentPaidAmount.toNumber(),
          error: `Payment would exceed committed amount. Committed: ${totalCommitted.toString()}, Attempting to pay: ${newPaidAmount.toString()}`
        };
      }

      // Calculate status based on precise percentages
      const paidPercentage = newPaidAmount.dividedBy(totalCommitted).times(100);
      let newStatus = allocation.status;

      if (paidPercentage.greaterThanOrEqualTo(100)) {
        newStatus = 'funded';
      } else if (paidPercentage.greaterThan(0)) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'committed';
      }

      // Update allocation with precise numeric values
      const updated = await this.storage.updateFundAllocation(allocationId, {
        paidAmount: newPaidAmount.toString(), // Convert to string for NUMERIC storage
        status: newStatus
      });

      if (!updated) {
        return {
          success: false,
          previousAmount: currentPaidAmount.toNumber(),
          newAmount: currentPaidAmount.toNumber(),
          error: 'Failed to update allocation'
        };
      }

      return {
        success: true,
        previousAmount: currentPaidAmount.toNumber(),
        newAmount: newPaidAmount.toNumber()
      };

    } catch (error) {
      console.error('Error applying payment to allocation:', error);
      return {
        success: false,
        previousAmount: 0,
        newAmount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate allocation metrics with precise arithmetic
   */
  calculateAllocationMetrics(allocation: any): {
    commitedAmount: number;
    paidAmount: number;
    calledAmount: number;
    paidPercentage: number;
    calledPercentage: number;
    remainingCommitment: number;
  } {
    const committed = new Decimal(allocation.amount?.toString() || '0');
    const paid = new Decimal(allocation.paidAmount?.toString() || '0');
    const called = new Decimal(allocation.calledAmount?.toString() || '0');

    const paidPercentage = committed.greaterThan(0) 
      ? paid.dividedBy(committed).times(100).toNumber()
      : 0;

    const calledPercentage = committed.greaterThan(0)
      ? called.dividedBy(committed).times(100).toNumber()
      : 0;

    const remaining = committed.minus(paid);

    return {
      commitedAmount: committed.toNumber(),
      paidAmount: paid.toNumber(),
      calledAmount: called.toNumber(),
      paidPercentage: Math.round(paidPercentage * 10) / 10, // Round to 1 decimal
      calledPercentage: Math.round(calledPercentage * 10) / 10,
      remainingCommitment: remaining.toNumber()
    };
  }

  /**
   * Validate payment amount using precise arithmetic
   */
  validatePaymentAmount(
    allocationId: number,
    paymentAmount: number | string
  ): Promise<{
    isValid: boolean;
    error?: string;
    maxAllowedPayment?: number;
  }> {
    return new Promise(async (resolve) => {
      try {
        const allocation = await this.storage.getFundAllocation(allocationId);
        if (!allocation) {
          resolve({
            isValid: false,
            error: 'Allocation not found'
          });
          return;
        }

        const committed = new Decimal(allocation.amount.toString());
        const currentPaid = new Decimal(allocation.paidAmount?.toString() || '0');
        const payment = new Decimal(paymentAmount.toString());
        const maxAllowed = committed.minus(currentPaid);

        if (payment.lessThanOrEqualTo(0)) {
          resolve({
            isValid: false,
            error: 'Payment amount must be positive',
            maxAllowedPayment: maxAllowed.toNumber()
          });
          return;
        }

        if (payment.greaterThan(maxAllowed)) {
          resolve({
            isValid: false,
            error: `Payment exceeds remaining commitment. Maximum allowed: ${maxAllowed.toString()}`,
            maxAllowedPayment: maxAllowed.toNumber()
          });
          return;
        }

        resolve({
          isValid: true,
          maxAllowedPayment: maxAllowed.toNumber()
        });

      } catch (error) {
        resolve({
          isValid: false,
          error: error instanceof Error ? error.message : 'Validation error'
        });
      }
    });
  }

  /**
   * Sync allocation totals from capital calls - ensuring data consistency
   */
  async syncAllocationFromCapitalCalls(allocationId: number): Promise<boolean> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) return false;

      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      
      // Calculate totals using precise arithmetic
      let totalCalled = new Decimal(0);
      let totalPaid = new Decimal(0);

      for (const call of capitalCalls) {
        totalCalled = totalCalled.plus(new Decimal(call.callAmount.toString()));
        totalPaid = totalPaid.plus(new Decimal(call.paidAmount?.toString() || '0'));
      }

      // Update allocation with calculated totals
      const committed = new Decimal(allocation.amount.toString());
      const paidPercentage = committed.greaterThan(0) 
        ? totalPaid.dividedBy(committed).times(100)
        : new Decimal(0);

      let status = allocation.status;
      if (paidPercentage.greaterThanOrEqualTo(100)) {
        status = 'funded';
      } else if (paidPercentage.greaterThan(0)) {
        status = 'partially_paid';
      } else {
        status = 'committed';
      }

      await this.storage.updateFundAllocation(allocationId, {
        calledAmount: totalCalled.toString(),
        paidAmount: totalPaid.toString(),
        status
      });

      return true;
    } catch (error) {
      console.error('Error syncing allocation from capital calls:', error);
      return false;
    }
  }
}