/**
 * Capital Calls API Routes
 * 
 * Comprehensive capital call management with multiple calls per allocation
 * and automatic status tracking
 */

import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import { CapitalCallLifecycleService } from '../services/capital-call-lifecycle.service';

const router = Router();
const capitalCallService = new CapitalCallLifecycleService();

// Validation schemas
const createCapitalCallSchema = z.object({
  allocationId: z.number().positive(),
  callAmount: z.number().positive(),
  amountType: z.enum(['percentage', 'dollar']),
  callDate: z.string().transform(val => new Date(val)),
  status: z.enum(['scheduled', 'called', 'partially_paid', 'paid', 'defaulted', 'overdue']).optional().default('called'),
  notes: z.string().optional()
});

const recordPaymentSchema = z.object({
  capitalCallId: z.number().positive(),
  paymentAmount: z.number().positive(),
  paymentDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional()
});

/**
 * GET /api/capital-calls - Get all capital calls with fund and deal info
 */
router.get('/', requireAuth, requirePermission('read', 'capital_call'), async (req: Request, res: Response) => {
  try {
    // Get all capital calls with related allocation, fund, and deal information
    const capitalCalls = await capitalCallService.getAllCapitalCallsWithDetails();
    
    res.status(200).json(capitalCalls);
  } catch (error) {
    console.error('Error getting all capital calls:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/capital-calls - Create new capital call
 */
router.post('/', requireAuth, requirePermission('create', 'capital_call'), async (req: Request, res: Response) => {
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

    const result = await capitalCallService.createCapitalCall(validationResult.data, userId);

    if (!result.success) {
      if (result.validationErrors) {
        return res.status(400).json({
          error: result.error,
          details: result.validationErrors
        });
      }
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      capitalCall: result.capitalCall
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
 * POST /api/capital-calls/:id/payments - Record payment for capital call
 */
router.post('/:id/payments', requireAuth, requirePermission('create', 'payment'), async (req: Request, res: Response) => {
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
    const validationResult = recordPaymentSchema.safeParse({
      ...req.body,
      capitalCallId
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const result = await capitalCallService.recordPayment(validationResult.data, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      success: true,
      payment: result.payment
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
 * GET /api/capital-calls/allocation/:id - Get all capital calls for allocation
 */
router.get('/allocation/:id', requireAuth, requirePermission('read', 'capital_call'), async (req: Request, res: Response) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const progress = await capitalCallService.getAllocationProgress(allocationId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

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
 * GET /api/capital-calls/deal/:id - Get all capital calls for deal
 */
router.get('/deal/:id', requireAuth, requirePermission('read', 'capital_call'), async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.id);
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const capitalCalls = await capitalCallService.getCapitalCallsByDeal(dealId);
    
    res.status(200).json(capitalCalls);

  } catch (error) {
    console.error('Error getting deal capital calls:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/capital-calls/fund/:id - Get all capital calls for fund
 */
router.get('/fund/:id', requireAuth, requirePermission('read', 'capital_call'), async (req: Request, res: Response) => {
  try {
    const fundId = parseInt(req.params.id);
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    const fundData = await capitalCallService.getCapitalCallsByFund(fundId);
    
    res.status(200).json(fundData);

  } catch (error) {
    console.error('Error getting fund capital calls:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/capital-calls/allocation/:id/progress - Get allocation progress summary
 */
router.get('/allocation/:id/progress', requireAuth, requirePermission('read', 'allocation'), async (req: Request, res: Response) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const progress = await capitalCallService.getAllocationProgress(allocationId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    // Return summary data
    const summary = {
      allocationId: progress.allocationId,
      committedAmount: progress.committedAmount,
      totalCalled: progress.totalCalled,
      totalPaid: progress.totalPaid,
      percentageCalled: progress.percentageCalled,
      percentagePaid: progress.percentagePaid,
      currentStatus: progress.currentStatus,
      capitalCallCount: progress.capitalCalls.length,
      nextDueDate: progress.capitalCalls
        .filter(call => call.status !== 'paid')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]?.dueDate
    };

    res.status(200).json(summary);

  } catch (error) {
    console.error('Error getting allocation progress:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;