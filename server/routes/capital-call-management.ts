/**
 * Capital Call Management Routes
 * 
 * Handles the complete capital call lifecycle:
 * - committed: 0% called
 * - partially_paid: some % called  
 * - funded: 100% called
 * 
 * Multiple capital calls per allocation with automatic status updates
 */

import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { requireAuth } from '../utils/auth';
import { DatabaseStorage } from '../database-storage';
import { AllocationService } from '../services/allocation.service';

const router = Router();
const storage = new DatabaseStorage();
const allocationService = new AllocationService();

// Validation schemas
const createCapitalCallSchema = z.object({
  allocationId: z.number().positive(),
  callAmount: z.number().positive(),
  amountType: z.enum(['percentage', 'dollar']),
  dueDate: z.string().transform(val => new Date(val)),
  notes: z.string().optional()
});

const recordPaymentSchema = z.object({
  paymentAmount: z.number().positive(),
  paymentDate: z.string().optional().transform(val => val ? new Date(val) : new Date()),
  notes: z.string().optional()
});

/**
 * POST /api/capital-call-management - Create new capital call
 * Creates a capital call and automatically updates allocation status
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request
    const validationResult = createCapitalCallSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { allocationId, callAmount, amountType, dueDate, notes } = validationResult.data;

    // Get allocation details
    const allocation = await storage.getFundAllocation(allocationId);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    // Convert percentage to dollar amount if needed
    let callAmountInDollars = callAmount;
    if (amountType === 'percentage') {
      if (callAmount < 0 || callAmount > 100) {
        return res.status(400).json({ error: 'Percentage must be between 0 and 100' });
      }
      callAmountInDollars = (allocation.amount * callAmount) / 100;
    }

    // Validate against committed amount
    const existingCalls = await storage.getCapitalCallsByAllocation(allocationId);
    const totalCalled = existingCalls.reduce((sum, call) => sum + call.callAmount, 0);
    
    if (totalCalled + callAmountInDollars > allocation.amount) {
      const remaining = allocation.amount - totalCalled;
      return res.status(400).json({ 
        error: `Capital call would exceed committed amount. Maximum remaining: ${remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` 
      });
    }

    // Create capital call
    const capitalCall = await storage.createCapitalCall({
      allocationId,
      callAmount: callAmountInDollars,
      amountType,
      dueDate,
      callDate: new Date(),
      paidAmount: 0,
      outstanding_amount: callAmountInDollars.toString(),
      status: 'called',
      notes,
      callPct: amountType === 'percentage' ? callAmount : null
    });

    // Update allocation status
    await allocationService.updateAllocationStatus(allocationId);

    // Create timeline event
    await storage.createTimelineEvent({
      dealId: allocation.dealId,
      eventType: 'capital_call',
      content: `Capital call created for ${callAmountInDollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      createdBy: userId,
      metadata: {
        allocationId,
        capitalCallId: capitalCall.id,
        amount: callAmountInDollars,
        amountType,
        fundId: allocation.fundId,
        dueDate: dueDate.toISOString(),
        callDate: capitalCall.callDate.toISOString()
      }
    });

    res.status(201).json({
      success: true,
      capitalCall,
      message: `Capital call of ${callAmountInDollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} created successfully`
    });

  } catch (error) {
    console.error('Error creating capital call:', error);
    
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/capital-call-management/:id/payment - Record payment for capital call
 * Records payment and automatically updates allocation status
 */
router.post('/:id/payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const capitalCallId = parseInt(req.params.id);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ error: 'Invalid capital call ID' });
    }

    // Validate payment request
    const validationResult = recordPaymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { paymentAmount, paymentDate, notes } = validationResult.data;

    // Get capital call
    const capitalCall = await storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      return res.status(404).json({ error: 'Capital call not found' });
    }

    // Validate payment amount
    const maxPayment = capitalCall.callAmount - (capitalCall.paidAmount || 0);
    if (paymentAmount > maxPayment) {
      return res.status(400).json({ 
        error: `Payment amount cannot exceed outstanding amount of ${maxPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` 
      });
    }

    // Update capital call with payment
    const newPaidAmount = (capitalCall.paidAmount || 0) + paymentAmount;
    const newOutstandingAmount = capitalCall.callAmount - newPaidAmount;
    const newStatus = newOutstandingAmount === 0 ? 'paid' : 'partially_paid';

    await storage.updateCapitalCall(capitalCallId, {
      paidAmount: newPaidAmount,
      outstanding_amount: newOutstandingAmount.toString(),
      paidDate: paymentDate,
      status: newStatus,
      notes: notes || capitalCall.notes
    });

    // Update allocation status based on all capital calls
    await allocationService.updateAllocationStatus(capitalCall.allocationId);

    // Get allocation for timeline event
    const allocation = await storage.getFundAllocation(capitalCall.allocationId);
    if (allocation) {
      await storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call_update',
        content: `Payment of ${paymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} recorded`,
        createdBy: userId,
        metadata: {
          capitalCallId,
          allocationId: capitalCall.allocationId,
          paymentAmount,
          fundId: allocation.fundId
        }
      });
    }

    res.status(200).json({
      success: true,
      payment: { 
        amount: paymentAmount, 
        status: newStatus,
        remainingAmount: newOutstandingAmount
      },
      message: `Payment of ${paymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} recorded successfully`
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/capital-call-management/allocation/:id - Get capital call progress for allocation
 */
router.get('/allocation/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    // Get allocation and capital calls
    const allocation = await storage.getFundAllocation(allocationId);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const capitalCalls = await storage.getCapitalCallsByAllocation(allocationId);
    
    // Calculate totals
    let totalCalled = 0;
    let totalPaid = 0;

    const callsSummary = capitalCalls.map(call => {
      totalCalled += call.callAmount;
      totalPaid += call.paidAmount || 0;

      return {
        id: call.id,
        callAmount: call.callAmount,
        amountType: call.amountType || 'dollar',
        callDate: call.callDate,
        dueDate: call.dueDate,
        paidAmount: call.paidAmount || 0,
        outstandingAmount: parseFloat(call.outstanding_amount || '0'),
        status: call.status,
        notes: call.notes
      };
    });

    const progress = {
      allocationId,
      dealName: allocation.dealName,
      fundName: allocation.fundName,
      committedAmount: allocation.amount,
      totalCalled,
      totalPaid,
      percentageCalled: allocation.amount > 0 ? (totalCalled / allocation.amount) * 100 : 0,
      percentagePaid: allocation.amount > 0 ? (totalPaid / allocation.amount) * 100 : 0,
      currentStatus: allocation.status,
      capitalCallsCount: capitalCalls.length,
      capitalCalls: callsSummary
    };

    res.status(200).json(progress);

  } catch (error) {
    console.error('Error getting allocation progress:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/capital-call-management/fund/:id - Get all capital calls for a fund
 */
router.get('/fund/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const fundId = parseInt(req.params.id);
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    // Get all allocations for the fund
    const allocations = await storage.getAllocationsByFund(fundId);
    
    let totalCommitted = 0;
    let totalCalled = 0;
    let totalPaid = 0;
    const allocationProgress = [];

    for (const allocation of allocations) {
      const capitalCalls = await storage.getCapitalCallsByAllocation(allocation.id);
      
      let allocationCalled = 0;
      let allocationPaid = 0;

      for (const call of capitalCalls) {
        allocationCalled += call.callAmount;
        allocationPaid += call.paidAmount || 0;
      }

      totalCommitted += allocation.amount;
      totalCalled += allocationCalled;
      totalPaid += allocationPaid;

      allocationProgress.push({
        allocationId: allocation.id,
        dealName: allocation.dealName,
        committedAmount: allocation.amount,
        calledAmount: allocationCalled,
        paidAmount: allocationPaid,
        status: allocation.status,
        capitalCallsCount: capitalCalls.length
      });
    }

    const fundSummary = {
      fundId,
      totalCommitted,
      totalCalled,
      totalPaid,
      totalOutstanding: totalCalled - totalPaid,
      percentageCalled: totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0,
      percentagePaid: totalCommitted > 0 ? (totalPaid / totalCommitted) * 100 : 0,
      allocations: allocationProgress
    };

    res.status(200).json(fundSummary);

  } catch (error) {
    console.error('Error getting fund capital calls:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;