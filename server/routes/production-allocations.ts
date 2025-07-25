/**
 * Production-Ready Allocation Routes
 * Clean, unified API with proper error handling and comprehensive validation
 */

import { Router, Request, Response } from 'express';
import { AllocationService } from '../services/allocation.service';
import { CapitalCallService } from '../services/capital-call.service';
import { AllocationDeletionService } from '../services/allocation-deletion.service.js';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { fundAllocations, deals, funds } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

// Initialize services
const allocationService = new AllocationService();
const capitalCallService = new CapitalCallService();
const allocationDeletionService = new AllocationDeletionService();

// Validation schemas
const createAllocationSchema = z.object({
  fundId: z.number().positive('Fund ID must be positive'),
  dealId: z.number().positive('Deal ID must be positive'),
  amount: z.number().positive('Amount must be positive'),
  amountType: z.enum(['percentage', 'dollar']).optional().default('dollar'),
  securityType: z.string().min(1, 'Security type is required'),
  dealSector: z.string().optional(),
  allocationDate: z.string().datetime('Invalid allocation date'),
  notes: z.string().optional(),
  status: z.enum(['committed', 'funded', 'unfunded', 'partially_paid']).default('committed'),
  interestPaid: z.number().optional().default(0),
  distributionPaid: z.number().optional().default(0),
  marketValue: z.number().optional(),
  moic: z.number().optional().default(1),
  irr: z.number().optional().default(0)
});

const updateAllocationSchema = createAllocationSchema.partial();

const createCapitalCallSchema = z.object({
  allocationId: z.number().positive('Allocation ID must be positive'),
  callAmount: z.number().positive('Call amount must be positive'),
  amountType: z.enum(['percentage', 'dollar']).optional().default('dollar'),
  callDate: z.string().datetime('Invalid call date'),
  dueDate: z.string().datetime('Invalid due date'),
  status: z.enum(['scheduled', 'called', 'partially_paid', 'paid', 'defaulted', 'overdue']).optional().default('scheduled'),
  paidAmount: z.number().min(0, 'Paid amount cannot be negative').optional().default(0),
  paidDate: z.string().datetime('Invalid paid date').optional(),
  notes: z.string().optional(),
  callPct: z.number().min(0).max(100).optional()
});

// Allocation endpoints

/**
 * GET /api/allocations - List all allocations
 */
router.get('/', requireAuth, requirePermission('view', 'allocation'), async (req: Request, res: Response) => {
  try {
    const allocations = await allocationService.getAllAllocations();
    res.json(allocations);
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({
      error: 'Failed to fetch allocations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/allocations - Create new allocation
 */
router.post('/', requireAuth, requirePermission('create', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request body
    const validationResult = createAllocationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const request = validationResult.data;

    // Create allocation data with proper date conversion
    const allocationData = {
      ...request,
      allocationDate: request.allocationDate ? new Date(request.allocationDate) : new Date()
    } as any; // Type assertion to handle mixed string/Date interface

    // Debug logging to identify allocation attempts
    console.log(`[ALLOCATION CREATE] Attempting to create allocation:`, {
      dealId: allocationData.dealId,
      fundId: allocationData.fundId,
      amount: allocationData.amount,
      userId
    });
    
    // Get deal and fund names for better debugging
    const [deal] = await db.select().from(deals).where(eq(deals.id, allocationData.dealId));
    const [fund] = await db.select().from(funds).where(eq(funds.id, allocationData.fundId));
    
    console.log(`[ALLOCATION CREATE] Deal: "${deal?.name}" (ID: ${allocationData.dealId})`);
    console.log(`[ALLOCATION CREATE] Fund: "${fund?.name}" (ID: ${allocationData.fundId})`);

    // Create allocation with proper error handling
    const result = await allocationService.createAllocation(allocationData, userId);
    
    // Auto-trigger system updates disabled due to status corruption
    // TODO: Fix before re-enabling

    if (!result.success) {
      if (result.validationErrors) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.validationErrors
        });
      }

      if (result.error?.includes('already exists')) {
        console.warn("[ALLOCATE] conflict —", result.error, req.body);
        return res.status(409).json({
          error: 'Allocation already exists',
          message: result.error
        });
      }

      return res.status(500).json({
        error: 'Failed to create allocation',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.allocation,
      auditId: result.auditId
    });

  } catch (error) {
    console.error('Error in allocation creation:', error);
    
    // Handle Zod validation errors specifically
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
 * PUT /api/allocations/:id - Update allocation (full update)
 */
router.put('/:id', requireAuth, requirePermission('edit', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    // Validate request body
    const validationResult = updateAllocationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const updates = validationResult.data;

    // Update allocation
    const result = await allocationService.updateAllocation(allocationId, updates, userId);

    if (!result.success) {
      if (result.validationErrors) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.validationErrors
        });
      }

      if (result.error?.includes('not found')) {
        return res.status(404).json({
          error: 'Allocation not found'
        });
      }

      return res.status(500).json({
        error: 'Failed to update allocation',
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.allocation,
      auditId: result.auditId
    });

  } catch (error) {
    console.error('Error in allocation update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/allocations/:id - Update allocation (partial update)
 */
router.patch('/:id', requireAuth, requirePermission('edit', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    // Validate request body
    const validationResult = updateAllocationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const updates = validationResult.data;

    // Update allocation
    const result = await allocationService.updateAllocation(allocationId, updates, userId);

    if (!result.success) {
      if (result.validationErrors) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.validationErrors
        });
      }

      if (result.error?.includes('not found')) {
        return res.status(404).json({
          error: 'Allocation not found'
        });
      }

      return res.status(500).json({
        error: 'Failed to update allocation',
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.allocation,
      auditId: result.auditId
    });

  } catch (error) {
    console.error('Error in allocation update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/allocations/:id - Delete allocation
 */
router.delete('/:id', requireAuth, requirePermission('delete', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    // Use systematic deletion service that handles all blockers automatically
    const result = await allocationDeletionService.safeDelete(allocationId, userId);

    if (!result.success) {
      return res.status(409).json({
        error: 'Cannot delete allocation',
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Error in allocation deletion:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/allocations/deal/:dealId - Get allocations for a specific deal across all funds
 */
router.get('/deal/:dealId', requireAuth, requirePermission('view', 'allocation'), async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`Getting allocations for deal ${dealId}`);

    // Get detailed deal allocations with fund and deal information using derived status view
    const result = await db.execute(sql`
      SELECT 
        vw.id,
        vw.fund_id as "fundId",
        vw.deal_id as "dealId", 
        vw.amount,
        vw.paid_amount as "paidAmount",
        vw.amount_type as "amountType",
        vw.security_type as "securityType",
        vw.allocation_date as "allocationDate",
        vw.notes,
        vw.derived_status as status,  -- Use derived status instead of stored status
        vw.portfolio_weight as "portfolioWeight",
        vw.interest_paid as "interestPaid",
        vw.distribution_paid as "distributionPaid",
        vw.total_returned as "totalReturned",
        vw.market_value as "marketValue",
        vw.moic,
        vw.irr,
        vw.total_called as "calledAmount",
        CASE 
          WHEN vw.amount > 0 
          THEN ROUND((vw.total_called / vw.amount) * 100, 1)
          ELSE 0.0
        END as "calledPercentage",
        deals.name as "dealName",
        deals.sector as "dealSector",
        funds.name as "fundName"
      FROM vw_fund_allocations_with_status vw
      LEFT JOIN deals ON vw.deal_id = deals.id
      LEFT JOIN funds ON vw.fund_id = funds.id
      WHERE vw.deal_id = ${dealId}
      ORDER BY vw.allocation_date
    `);

    console.log(`Retrieved ${result.rows.length} allocations for deal ${dealId}`);
    res.json(result.rows);

  } catch (error) {
    console.error('Error getting deal allocations:', error);
    res.status(500).json({
      error: 'Failed to get deal allocations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/production/allocations/fund/:fundId - Get fund allocations with deal information
 */
router.get('/fund/:fundId', requireAuth, requirePermission('view', 'allocation'), async (req: Request, res: Response) => {
  try {
    const fundId = parseInt(req.params.fundId);
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    // Get detailed fund allocations with deal information using derived status view
    const result = await db.execute(sql`
      SELECT 
        vw.id,
        vw.fund_id as "fundId",
        vw.deal_id as "dealId", 
        vw.amount,
        vw.paid_amount as "paidAmount",
        vw.amount_type as "amountType",
        vw.security_type as "securityType",
        vw.allocation_date as "allocationDate",
        vw.notes,
        vw.derived_status as status,  -- Use derived status instead of stored status
        vw.portfolio_weight as "portfolioWeight",
        vw.interest_paid as "interestPaid",
        vw.distribution_paid as "distributionPaid",
        vw.total_returned as "totalReturned",
        vw.market_value as "marketValue",
        vw.moic,
        vw.irr,
        vw.total_called as "calledAmount",
        CASE 
          WHEN vw.amount > 0 
          THEN ROUND((vw.total_called / vw.amount) * 100, 1)
          ELSE 0.0
        END as "calledPercentage",
        deals.name as "dealName",
        deals.sector as "dealSector"
      FROM vw_fund_allocations_with_status vw
      LEFT JOIN deals ON vw.deal_id = deals.id
      WHERE vw.fund_id = ${fundId}
      ORDER BY vw.allocation_date
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error getting fund allocations:', error);
    res.status(500).json({
      error: 'Failed to get fund allocations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/allocations/batch - Batch create allocations
 */
router.post('/batch', requireAuth, requirePermission('create', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate batch request
    const batchSchema = z.array(createAllocationSchema);
    const validationResult = batchSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const requests = validationResult.data;

    // Process batch
    const results = await allocationService.batchCreateAllocations(requests, userId);

    // Separate successful and failed results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.status(207).json({ // 207 Multi-Status
      success: true,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results.map(r => ({
        success: r.success,
        allocation: r.allocation,
        error: r.error,
        validationErrors: r.validationErrors,
        auditId: r.auditId
      }))
    });

  } catch (error) {
    console.error('Error in batch allocation creation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Capital calls endpoints

/**
 * POST /api/allocations/:allocationId/capital-calls - Create capital call
 */
router.post('/:allocationId/capital-calls', requireAuth, requirePermission('create', 'capital-call'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allocationId = parseInt(req.params.allocationId);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    // Validate request body
    const validationResult = createCapitalCallSchema.safeParse({
      ...req.body,
      allocationId
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const request = validationResult.data;

    // Create capital call
    const result = await capitalCallService.createCapitalCall(request, userId);

    if (!result.success) {
      if (result.validationErrors) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.validationErrors
        });
      }

      return res.status(500).json({
        error: 'Failed to create capital call',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.capitalCall,
      auditId: result.auditId
    });

  } catch (error) {
    console.error('Error in capital call creation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/allocations/:allocationId/capital-calls - Get capital calls for allocation
 */
router.get('/:allocationId/capital-calls', requireAuth, async (req: Request, res: Response) => {
  try {
    const allocationId = parseInt(req.params.allocationId);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const capitalCalls = await capitalCallService.getCapitalCallsForAllocation(allocationId);

    res.json({
      success: true,
      data: capitalCalls
    });

  } catch (error) {
    console.error('Error getting capital calls:', error);
    res.status(500).json({
      error: 'Failed to get capital calls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/allocations/capital-calls/:capitalCallId/payment - Process payment
 */
router.post('/capital-calls/:capitalCallId/payment', requireAuth, requirePermission('edit', 'capital-call'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const capitalCallId = parseInt(req.params.capitalCallId);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ error: 'Invalid capital call ID' });
    }

    // Validate payment data
    const paymentSchema = z.object({
      amount: z.number().positive('Payment amount must be positive'),
      paymentDate: z.string().datetime('Invalid payment date'),
      notes: z.string().optional()
    });

    const validationResult = paymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { amount, paymentDate, notes } = validationResult.data;

    // Process payment
    const result = await capitalCallService.processPayment(
      capitalCallId,
      amount,
      new Date(paymentDate),
      userId,
      notes
    );

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return res.status(404).json({
          error: 'Capital call not found'
        });
      }

      if (result.error?.includes('exceed')) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          message: result.error
        });
      }

      return res.status(500).json({
        error: 'Failed to process payment',
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.capitalCall,
      auditId: result.auditId
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;