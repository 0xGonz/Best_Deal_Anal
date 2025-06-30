/**
 * Capital Call Coordinator API Routes
 * 
 * Enforces the business rule: Capital Call = Payment (called = paid)
 * Provides scalable, production-ready endpoints for capital call management
 */

import express from 'express';
import { z } from 'zod';
import { capitalCallPaymentCoordinator } from '../services/capital-call-payment-coordinator.service.ts';
import { requireAuth } from '../middleware/auth.ts';
import { DatabaseError } from '../lib/errors.ts';

const router = express.Router();

// Input validation schemas
const createCapitalCallSchema = z.object({
  allocationId: z.number().int().positive(),
  callPercentage: z.number().min(0).max(100).optional(),
  callAmount: z.number().positive().optional(),
  dueDate: z.string().transform((str) => new Date(str)),
  notes: z.string().optional()
}).refine(data => data.callPercentage || data.callAmount, {
  message: "Either callPercentage or callAmount must be provided"
});

const processPaymentSchema = z.object({
  capitalCallId: z.number().int().positive(),
  paymentAmount: z.number().positive().optional()
});

const validateConsistencySchema = z.object({
  fundId: z.number().int().positive().optional()
});

/**
 * Create capital call with automatic payment
 * POST /api/capital-call-coordinator/create-with-payment
 * 
 * Enforces: if capital is called, it's immediately paid
 */
router.post('/create-with-payment', requireAuth, async (req, res) => {
  try {
    const validatedData = createCapitalCallSchema.parse(req.body);
    
    const result = await capitalCallPaymentCoordinator.createCapitalCallWithPayment(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'Capital call created and payment processed',
      data: result
    });

  } catch (error) {
    console.error('Error creating capital call with payment:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }
    
    if (error instanceof DatabaseError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Process payment for existing capital call
 * POST /api/capital-call-coordinator/process-payment
 * 
 * Maintains the called = paid relationship
 */
router.post('/process-payment', requireAuth, async (req, res) => {
  try {
    const validatedData = processPaymentSchema.parse(req.body);
    
    const result = await capitalCallPaymentCoordinator.processPaymentForCapitalCall(
      validatedData.capitalCallId,
      validatedData.paymentAmount
    );
    
    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }
    
    if (error instanceof DatabaseError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get fund payment summary
 * GET /api/capital-call-coordinator/fund/:fundId/summary
 * 
 * Provides real-time called vs uncalled calculations
 */
router.get('/fund/:fundId/summary', requireAuth, async (req, res) => {
  try {
    const fundId = parseInt(req.params.fundId);
    
    if (isNaN(fundId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fund ID'
      });
    }
    
    const summary = await capitalCallPaymentCoordinator.getFundPaymentSummary(fundId);
    
    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error getting fund payment summary:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Validate and fix consistency
 * POST /api/capital-call-coordinator/validate-consistency
 * 
 * Ensures called = paid business rule is maintained
 */
router.post('/validate-consistency', requireAuth, async (req, res) => {
  try {
    const validatedData = validateConsistencySchema.parse(req.body);
    
    const result = await capitalCallPaymentCoordinator.validateAndFixConsistency(validatedData.fundId);
    
    res.status(200).json({
      success: true,
      message: `Consistency check completed. Found ${result.inconsistenciesFound} issues, applied ${result.fixesApplied} fixes.`,
      data: result
    });

  } catch (error) {
    console.error('Error validating consistency:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }
    
    if (error instanceof DatabaseError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all fund summaries
 * GET /api/capital-call-coordinator/all-funds/summary
 * 
 * Provides platform-wide called vs uncalled overview
 */
router.get('/all-funds/summary', requireAuth, async (req, res) => {
  try {
    // Get all funds and their summaries
    const { getStorage } = await import('../storage.ts');
    const storage = getStorage();
    const funds = await storage.getFunds();
    
    const summaries = await Promise.all(
      funds.map(async (fund) => {
        const summary = await capitalCallPaymentCoordinator.getFundPaymentSummary(fund.id);
        return {
          fundId: fund.id,
          fundName: fund.name,
          ...summary.summary
        };
      })
    );
    
    // Calculate platform totals
    const platformSummary = summaries.reduce((total, fund) => ({
      totalCommitted: total.totalCommitted + fund.totalCommitted,
      totalCalled: total.totalCalled + fund.totalCalled,
      totalPaid: total.totalPaid + fund.totalPaid,
      totalUncalled: total.totalUncalled + fund.totalUncalled,
      fundsCount: total.fundsCount + 1,
      consistentFunds: total.consistentFunds + (fund.consistencyCheck ? 1 : 0)
    }), {
      totalCommitted: 0,
      totalCalled: 0,
      totalPaid: 0,
      totalUncalled: 0,
      fundsCount: 0,
      consistentFunds: 0
    });
    
    res.status(200).json({
      success: true,
      data: {
        platformSummary: {
          ...platformSummary,
          overallConsistency: platformSummary.fundsCount > 0 ? 
            (platformSummary.consistentFunds / platformSummary.fundsCount) * 100 : 100
        },
        fundSummaries: summaries
      }
    });

  } catch (error) {
    console.error('Error getting all funds summary:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;