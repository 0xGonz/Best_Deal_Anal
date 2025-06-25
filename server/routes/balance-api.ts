/**
 * Balance API Routes
 * 
 * Implements the verb-based API contract from the "everything has to balance" playbook:
 * - POST /allocations (ALLOCATE)
 * - POST /allocations/{id}/calls (CREATE_CALL)  
 * - POST /capital-calls/{id}/payments (PAYMENT_RECEIVED)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { StorageFactory } from '../storage-factory';
import { AllocationStateMachine } from '../services/allocation-state-machine.service';
import { requireAuth } from '../middleware/authentication';

const router = Router();
const storage = StorageFactory.getStorage();

// Validation schemas
const allocateSchema = z.object({
  fundId: z.number().positive(),
  dealId: z.number().positive(),
  committed: z.number().positive(),
  securityType: z.string().default('equity')
});

const createCallSchema = z.object({
  amount: z.number().positive(),
  dueDate: z.string().transform(val => new Date(val)),
  notes: z.string().optional()
});

const paymentReceivedSchema = z.object({
  amount: z.number().positive(),
  txRef: z.string().optional(),
  paymentDate: z.string().optional().transform(val => val ? new Date(val) : new Date())
});

/**
 * POST /allocations - ALLOCATE verb
 * Creates a new allocation in 'committed' status
 */
router.post('/allocations', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = allocateSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Check for duplicate allocation
    const existingAllocations = await storage.getAllocationsByFund(validatedData.fundId);
    const duplicate = existingAllocations.find(a => a.dealId === validatedData.dealId);
    
    if (duplicate) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Allocation already exists for this fund-deal combination'
      });
    }

    // Create allocation in committed status
    const allocation = await storage.createFundAllocation({
      fundId: validatedData.fundId,
      dealId: validatedData.dealId,
      amount: validatedData.committed,
      paidAmount: 0,
      securityType: validatedData.securityType,
      status: 'committed',
      allocationDate: new Date()
    });

    res.status(201).json({
      success: true,
      allocation,
      fsm: {
        status: 'committed',
        validNextStates: AllocationStateMachine.getValidNextStates('committed')
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      });
    }

    console.error('ALLOCATE error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /allocations/{id}/calls - CREATE_CALL verb
 * Creates a capital call for an allocation
 */
router.post('/allocations/:id/calls', requireAuth, async (req: Request, res: Response) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const validatedData = createCallSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Get current allocation state
    const allocation = await storage.getFundAllocation(allocationId);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    // Calculate new called amount
    const existingCalls = await storage.getCapitalCallsByAllocation(allocationId);
    const currentCalledAmount = existingCalls.reduce((sum, call) => sum + call.callAmount, 0);
    const newCalledAmount = currentCalledAmount + validatedData.amount;

    // Validate against commitment
    if (newCalledAmount > allocation.amount) {
      return res.status(400).json({
        error: 'Call amount exceeds commitment',
        committed: allocation.amount,
        alreadyCalled: currentCalledAmount,
        requestedCall: validatedData.amount,
        wouldTotal: newCalledAmount
      });
    }

    // Use state machine to validate transition
    const transition = AllocationStateMachine.transition(
      {
        id: allocation.id,
        amount: allocation.amount,
        calledAmount: currentCalledAmount,
        fundedAmount: allocation.paidAmount || 0,
        status: allocation.status as any
      },
      'CREATE_CALL',
      { calledAmount: newCalledAmount }
    );

    if (!transition.success) {
      return res.status(409).json({
        error: 'Invalid State Transition',
        message: transition.error
      });
    }

    // Create the capital call
    const capitalCall = await storage.createCapitalCall({
      allocationId,
      callAmount: validatedData.amount,
      dueDate: validatedData.dueDate,
      notes: validatedData.notes || '',
      status: 'called',
      callDate: new Date(),
      paidAmount: 0,
      outstanding_amount: validatedData.amount.toString(),
      amountType: 'dollar'
    });

    // Update allocation status using computed status
    if (transition.newStatus) {
      await storage.updateFundAllocation(allocationId, {
        status: transition.newStatus
      });
    }

    res.status(201).json({
      success: true,
      capitalCall,
      fsm: {
        previousStatus: allocation.status,
        newStatus: transition.newStatus,
        validNextStates: AllocationStateMachine.getValidNextStates(transition.newStatus || allocation.status as any)
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      });
    }

    console.error('CREATE_CALL error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /capital-calls/{id}/payments - PAYMENT_RECEIVED verb
 * Records a payment against a capital call
 */
router.post('/capital-calls/:id/payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const capitalCallId = parseInt(req.params.id);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ error: 'Invalid capital call ID' });
    }

    const validatedData = paymentReceivedSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Get capital call and validate it exists
    const capitalCall = await storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      return res.status(404).json({ error: 'Capital call not found' });
    }

    // Get allocation
    const allocation = await storage.getFundAllocation(capitalCall.allocationId);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    // Calculate current funded amount for this allocation
    const allCalls = await storage.getCapitalCallsByAllocation(capitalCall.allocationId);
    const allPayments = await Promise.all(
      allCalls.map(call => storage.getPaymentsByCapitalCall(call.id))
    );
    const currentFundedAmount = allPayments
      .flat()
      .reduce((sum, payment) => sum + parseFloat(payment.amountUsd.toString()), 0);

    const newFundedAmount = currentFundedAmount + validatedData.amount;

    // Validate payment doesn't exceed called amount
    const totalCalledAmount = allCalls.reduce((sum, call) => sum + call.callAmount, 0);
    if (newFundedAmount > totalCalledAmount) {
      return res.status(400).json({
        error: 'Payment exceeds called amount',
        totalCalled: totalCalledAmount,
        alreadyFunded: currentFundedAmount,
        requestedPayment: validatedData.amount,
        wouldTotal: newFundedAmount
      });
    }

    // Use state machine to validate transition
    const transition = AllocationStateMachine.transition(
      {
        id: allocation.id,
        amount: allocation.amount,
        calledAmount: totalCalledAmount,
        fundedAmount: currentFundedAmount,
        status: allocation.status as any
      },
      'PAYMENT_RECEIVED',
      { fundedAmount: newFundedAmount }
    );

    if (!transition.success) {
      return res.status(409).json({
        error: 'Invalid State Transition',
        message: transition.error
      });
    }

    // Create the payment record
    const payment = await storage.createPayment({
      capitalCallId,
      paidDate: validatedData.paymentDate || new Date(),
      amountUsd: validatedData.amount.toString()
    });

    // Update capital call paid amount
    const newCapitalCallPaidAmount = capitalCall.paidAmount + validatedData.amount;
    await storage.updateCapitalCall(capitalCallId, {
      paidAmount: newCapitalCallPaidAmount,
      paidDate: validatedData.paymentDate || new Date(),
      status: newCapitalCallPaidAmount >= capitalCall.callAmount ? 'paid' : 'partially_paid'
    });

    // Update allocation status and paid amount
    if (transition.newStatus) {
      await storage.updateFundAllocation(allocation.id, {
        status: transition.newStatus,
        paidAmount: newFundedAmount
      });
    }

    res.status(201).json({
      success: true,
      payment,
      fsm: {
        previousStatus: allocation.status,
        newStatus: transition.newStatus,
        validNextStates: AllocationStateMachine.getValidNextStates(transition.newStatus || allocation.status as any)
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      });
    }

    console.error('PAYMENT_RECEIVED error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /fund-capital - Fund capital roll-up view
 * Uses the fund_capital view for accurate totals
 */
router.get('/fund-capital', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await storage.query(`
      SELECT 
        id,
        name,
        total_committed,
        total_called,
        total_funded,
        uncalled_capital,
        outstanding_calls
      FROM fund_capital
      ORDER BY name
    `);

    res.json({
      success: true,
      funds: result.rows
    });

  } catch (error) {
    console.error('Fund capital view error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /integrity-check - Run integrity validation
 */
router.get('/integrity-check', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await storage.query(`
      SELECT * FROM check_allocation_integrity()
    `);

    res.json({
      success: true,
      issues: result.rows,
      hasIssues: result.rows.length > 0
    });

  } catch (error) {
    console.error('Integrity check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;