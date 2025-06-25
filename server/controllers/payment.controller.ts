/**
 * Payment Controller - Fixed Version
 * Eliminates ad-hoc payments without capital calls
 * Enforces strict payment workflow through capital call system
 */

import { Request, Response } from 'express';
import { StorageFactory } from '../storage-factory';
import { z } from 'zod';

const storage = StorageFactory.getStorage();

// Strict payment schema - requires capital call ID
const paymentSchema = z.object({
  capitalCallId: z.number().positive('Capital call ID is required'),
  amount: z.string().or(z.number().transform(n => n.toString())).refine(val => {
    const num = parseFloat(val.toString());
    return num > 0;
  }, 'Payment amount must be positive'),
  notes: z.string().optional(),
  paymentDate: z.string().optional().transform(val => val ? new Date(val) : new Date())
});

/**
 * Record Payment - FIXED VERSION
 * Now requires capitalCallId to prevent ad-hoc payments
 */
export async function recordPayment(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = paymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid payment data',
        details: validationResult.error.errors
      });
    }

    const { capitalCallId, amount, notes, paymentDate } = validationResult.data;
    const userId = (req as any).user?.id || 0;

    // Get capital call to validate it exists
    const capitalCall = await storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      return res.status(404).json({
        error: 'Capital call not found',
        message: 'Payment must be linked to an existing capital call'
      });
    }

    // Validate payment amount doesn't exceed outstanding amount
    const paymentAmount = parseFloat(amount);
    const outstandingAmount = parseFloat(capitalCall.outstanding_amount.toString());
    
    if (paymentAmount > outstandingAmount) {
      return res.status(400).json({
        error: 'Payment exceeds outstanding amount',
        message: `Payment of $${paymentAmount.toLocaleString()} exceeds outstanding amount of $${outstandingAmount.toLocaleString()}`
      });
    }

    // Process payment through capital call system
    const currentPaidAmount = parseFloat(capitalCall.paidAmount.toString()) || 0;
    const newPaidAmount = currentPaidAmount + paymentAmount;
    const newOutstandingAmount = parseFloat(capitalCall.callAmount.toString()) - newPaidAmount;

    // Determine new status
    let newStatus = capitalCall.status;
    if (newPaidAmount >= parseFloat(capitalCall.callAmount.toString())) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partially_paid';
    }

    // Update capital call with payment
    const updatedCapitalCall = await storage.updateCapitalCall(capitalCallId, {
      paidAmount: newPaidAmount.toString(),
      outstanding_amount: newOutstandingAmount.toString(),
      status: newStatus,
      paidDate: paymentDate,
      updatedAt: new Date()
    });

    if (!updatedCapitalCall) {
      return res.status(500).json({
        error: 'Failed to process payment',
        message: 'Could not update capital call record'
      });
    }

    // Update allocation paid amount (this will be synced by triggers)
    const allocation = await storage.getFundAllocation(capitalCall.allocationId);
    if (allocation) {
      // Calculate total paid across all capital calls for this allocation
      const allCapitalCalls = await storage.getCapitalCallsByAllocation(allocation.id);
      const totalPaid = allCapitalCalls.reduce((sum, call) => {
        return sum + (parseFloat(call.paidAmount.toString()) || 0);
      }, 0);

      // Update allocation with total paid amount and recalculate status
      let allocationStatus = allocation.status;
      const allocationAmount = parseFloat(allocation.amount.toString());
      const paidPercentage = (totalPaid / allocationAmount) * 100;

      if (paidPercentage >= 100) {
        allocationStatus = 'funded';
      } else if (paidPercentage > 0) {
        allocationStatus = 'partially_paid';
      }

      await storage.updateFundAllocation(allocation.id, {
        paidAmount: totalPaid.toString(),
        status: allocationStatus
      });
    }

    return res.status(200).json({
      message: 'Payment recorded successfully',
      payment: {
        capitalCallId,
        amount: paymentAmount,
        totalPaid: newPaidAmount,
        outstanding: newOutstandingAmount,
        status: newStatus
      }
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    return res.status(500).json({
      error: 'Failed to record payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get payment history for a capital call
 */
export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const capitalCallId = parseInt(req.params.capitalCallId);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ error: 'Invalid capital call ID' });
    }

    const payments = await storage.getCapitalCallPayments(capitalCallId);
    return res.status(200).json(payments);

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return res.status(500).json({
      error: 'Failed to fetch payment history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}