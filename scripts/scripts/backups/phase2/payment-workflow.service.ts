/**
 * Payment Workflow Service
 * 
 * Handles end-to-end payment processing with data integrity safeguards
 * and modular status management to prevent data loss during updates.
 */

import { AllocationStatusService } from './allocation-status.service.js';
import { StorageFactory } from '../storage-factory.js';

export interface PaymentTransaction {
  allocationId: number;
  amount: number;
  description?: string;
  userId?: number;
}

export interface PaymentResult {
  success: boolean;
  allocationId: number;
  previousPaidAmount: number;
  newPaidAmount: number;
  previousStatus: string;
  newStatus: string;
  paymentPercentage: number;
  remainingAmount: number;
  error?: string;
}

export class PaymentWorkflowService {
  private static storage = StorageFactory.getStorage();

  /**
   * Process a payment with full data integrity checks
   */
  static async processPayment(transaction: PaymentTransaction): Promise<PaymentResult> {
    const { allocationId, amount, description, userId } = transaction;

    try {
      // 1. Get current allocation with data validation
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        return {
          success: false,
          allocationId,
          previousPaidAmount: 0,
          newPaidAmount: 0,
          previousStatus: 'unknown',
          newStatus: 'unknown',
          paymentPercentage: 0,
          remainingAmount: 0,
          error: 'Allocation not found'
        };
      }

      // 2. Validate payment amount
      const validation = AllocationStatusService.validatePayment(allocation, amount);
      if (!validation.isValid) {
        return {
          success: false,
          allocationId,
          previousPaidAmount: allocation.paidAmount || 0,
          newPaidAmount: allocation.paidAmount || 0,
          previousStatus: allocation.status || 'committed',
          newStatus: allocation.status || 'committed',
          paymentPercentage: 0,
          remainingAmount: allocation.amount - (allocation.paidAmount || 0),
          error: validation.error
        };
      }

      // 3. Calculate new payment state
      const previousPaidAmount = allocation.paidAmount || 0;
      const newPaidAmount = previousPaidAmount + amount;
      const previousStatus = allocation.status || 'committed';

      // 4. Use AllocationStatusService for consistent status calculation
      const statusResult = AllocationStatusService.calculateStatus({
        amount: allocation.amount,
        paidAmount: newPaidAmount,
        status: previousStatus
      });

      // 5. Update allocation with atomic transaction approach
      const updatedAllocation = await this.storage.updateFundAllocation(allocationId, {
        paidAmount: newPaidAmount,
        status: statusResult.status
      });

      if (!updatedAllocation) {
        return {
          success: false,
          allocationId,
          previousPaidAmount,
          newPaidAmount: previousPaidAmount,
          previousStatus,
          newStatus: previousStatus,
          paymentPercentage: 0,
          remainingAmount: allocation.amount - previousPaidAmount,
          error: 'Failed to update allocation'
        };
      }

      // 6. Log the payment for audit trail and timeline
      await PaymentWorkflowService.createPaymentTimelineEvent(
        updatedAllocation.dealId,
        allocationId,
        amount,
        statusResult,
        userId || 0
      );

      // 7. Create closing schedule event if this is a significant payment milestone
      await this.createPaymentClosingEvent(
        updatedAllocation.dealId,
        allocationId,
        amount,
        statusResult,
        userId || 0
      );

      console.log(`Payment processed: Allocation ${allocationId} - $${amount.toLocaleString()} payment`);
      console.log(`  Previous: $${previousPaidAmount.toLocaleString()} (${previousStatus})`);
      console.log(`  New: $${newPaidAmount.toLocaleString()} (${statusResult.status})`);
      console.log(`  Progress: ${statusResult.paidPercentage.toFixed(1)}% paid`);

      return {
        success: true,
        allocationId,
        previousPaidAmount,
        newPaidAmount,
        previousStatus,
        newStatus: statusResult.status,
        paymentPercentage: statusResult.paidPercentage,
        remainingAmount: statusResult.remainingAmount,
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        allocationId,
        previousPaidAmount: 0,
        newPaidAmount: 0,
        previousStatus: 'unknown',
        newStatus: 'unknown',
        paymentPercentage: 0,
        remainingAmount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify allocation data integrity
   */
  static async verifyAllocationIntegrity(allocationId: number): Promise<{
    isValid: boolean;
    issues: string[];
    allocation?: any;
  }> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        return {
          isValid: false,
          issues: ['Allocation not found']
        };
      }

      const issues: string[] = [];

      // Check for negative amounts
      if (allocation.amount < 0) {
        issues.push('Negative committed amount');
      }

      if ((allocation.paidAmount || 0) < 0) {
        issues.push('Negative paid amount');
      }

      // Check for overpayment
      if ((allocation.paidAmount || 0) > allocation.amount * 1.1) {
        issues.push('Paid amount exceeds committed amount by more than 10%');
      }

      // Verify status consistency
      const calculatedStatus = AllocationStatusService.calculateStatus({
        amount: allocation.amount,
        paidAmount: allocation.paidAmount,
        status: allocation.status
      });

      if (allocation.status !== calculatedStatus.status) {
        issues.push(`Status inconsistency: current "${allocation.status}", should be "${calculatedStatus.status}"`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        allocation
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Batch verify all allocations for integrity
   */
  static async verifyAllAllocationsIntegrity(): Promise<{
    totalAllocations: number;
    validAllocations: number;
    invalidAllocations: Array<{
      allocationId: number;
      issues: string[];
    }>;
  }> {
    try {
      // Get all allocations by querying each fund
      const funds = await this.storage.getFunds();
      const allAllocations = [];
      for (const fund of funds) {
        const fundAllocations = await this.storage.getAllocationsByFund(fund.id);
        allAllocations.push(...fundAllocations);
      }
      const invalidAllocations: Array<{ allocationId: number; issues: string[] }> = [];

      for (const allocation of allAllocations) {
        const verification = await this.verifyAllocationIntegrity(allocation.id);
        if (!verification.isValid) {
          invalidAllocations.push({
            allocationId: allocation.id,
            issues: verification.issues
          });
        }
      }

      return {
        totalAllocations: allAllocations.length,
        validAllocations: allAllocations.length - invalidAllocations.length,
        invalidAllocations
      };

    } catch (error) {
      console.error('Batch verification error:', error);
      return {
        totalAllocations: 0,
        validAllocations: 0,
        invalidAllocations: []
      };
    }
  }

  /**
   * Auto-repair allocation status inconsistencies
   */
  static async repairAllocationStatuses(): Promise<{
    repairedCount: number;
    errors: Array<{ allocationId: number; error: string }>;
  }> {
    try {
      const verification = await this.verifyAllAllocationsIntegrity();
      const errors: Array<{ allocationId: number; error: string }> = [];
      let repairedCount = 0;

      for (const invalid of verification.invalidAllocations) {
        try {
          const allocation = await this.storage.getFundAllocation(invalid.allocationId);
          if (!allocation) continue;

          // Calculate correct status
          const correctStatus = AllocationStatusService.calculateStatus({
            amount: allocation.amount,
            paidAmount: allocation.paidAmount,
            status: allocation.status
          });

          // Update if status is incorrect
          if (allocation.status !== correctStatus.status) {
            await this.storage.updateFundAllocation(invalid.allocationId, {
              status: correctStatus.status
            });
            repairedCount++;
            console.log(`Repaired allocation ${invalid.allocationId}: ${allocation.status} → ${correctStatus.status}`);
          }

        } catch (error) {
          errors.push({
            allocationId: invalid.allocationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { repairedCount, errors };

    } catch (error) {
      console.error('Repair process error:', error);
      return { repairedCount: 0, errors: [] };
    }
  }

  /**
   * Create timeline event for payment activity
   */
  private static async createPaymentTimelineEvent(
    dealId: number,
    allocationId: number,
    paymentAmount: number,
    statusResult: any,
    userId: number
  ): Promise<void> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      const fund = allocation ? await this.storage.getFund(allocation.fundId) : null;
      
      const content = `Payment of $${paymentAmount.toLocaleString()} received for ${fund?.name || 'fund'} allocation. Status: ${statusResult.status} (${statusResult.paidPercentage.toFixed(1)}% paid)`;
      
      await this.storage.createTimelineEvent({
        dealId,
        eventType: 'capital_call_update',
        content,
        createdBy: userId,
        metadata: {
          allocationId: allocationId,
          paymentAmount: paymentAmount,
          fundId: allocation?.fundId || 0,
          fundName: fund?.name || 'Unknown Fund',
          newStatus: statusResult.status,
          paidPercentage: statusResult.paidPercentage,
          remainingAmount: statusResult.remainingAmount
        }
      });
      
      console.log(`✅ Payment timeline event created for deal ${dealId}: ${content}`);
    } catch (error) {
      console.error('Failed to create payment timeline event:', error);
      // Don't throw - payment processing should continue even if timeline fails
    }
  }

  /**
   * Create closing schedule event for significant payment milestones
   */
  private static async createPaymentClosingEvent(
    dealId: number,
    allocationId: number,
    paymentAmount: number,
    statusResult: any,
    userId: number
  ): Promise<void> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      const fund = allocation ? await this.storage.getFund(allocation.fundId) : null;
      
      // Only create closing events for significant milestones
      const paidPercentage = statusResult.paidPercentage;
      let shouldCreateEvent = false;
      let eventName = '';
      
      if (statusResult.status === 'funded' && paidPercentage >= 100) {
        shouldCreateEvent = true;
        eventName = 'Payment Completed';
      } else if (paidPercentage >= 50 && paidPercentage < 100) {
        shouldCreateEvent = true;
        eventName = 'Halfway Payment Milestone';
      } else if (paidPercentage >= 25 && paidPercentage < 50) {
        shouldCreateEvent = true;
        eventName = 'Quarter Payment Milestone';
      }
      
      if (shouldCreateEvent) {
        // Schedule the closing event for 30 days from now
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30);
        
        await this.storage.createClosingScheduleEvent({
          dealId,
          eventType: 'custom',
          eventName,
          scheduledDate,
          targetAmount: paymentAmount,
          amountType: 'dollar',
          status: 'scheduled',
          notes: `Auto-created for ${fund?.name || 'fund'} payment milestone (${paidPercentage.toFixed(1)}% paid)`,
          createdBy: userId
        });
        
        console.log(`📅 Payment closing event created: ${eventName} for deal ${dealId}`);
      }
    } catch (error) {
      console.error('Failed to create payment closing event:', error);
      // Don't throw - payment processing should continue even if calendar fails
    }
  }
}