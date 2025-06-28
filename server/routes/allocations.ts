import { Router, Request, Response } from 'express';
import { insertCapitalCallSchema, insertFundAllocationSchema } from '@shared/schema';
import { StorageFactory } from '../storage-factory';
import { synchronizeAllocationDates } from '../utils/date-integration';
import { capitalCallService } from '../services/capital-call.service';
import { allocationService } from '../services/allocation.service';
import { allocationCoreService } from '../services/allocation-core.service';
import { AuditService } from '../services/audit.service';
import { ValidationService } from '../services/validation.service';
import { metricsCalculator } from '../services/metrics-calculator.service';
import { ErrorHandlerService, ValidationRules } from '../services/error-handler.service';
import { multiFundAllocationService } from '../services/multi-fund-allocation.service';
import { AllocationStatusService } from '../services/allocation-status.service';
import { PaymentWorkflowService } from '../services/payment-workflow.service';
import { AllocationSyncService } from '../services/allocation-sync.service';
import { z } from 'zod';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import { requireFundAccess } from '../middleware/fund-authorization.middleware';
import { capitalCallMetricsService } from '../services/capital-call-metrics.service';

const router = Router();
const storage = StorageFactory.getStorage();

// Rock-solid helper functions using the new core architecture
async function updateAllocationStatusBasedOnCapitalCalls(allocationId: number): Promise<void> {
  await allocationService.updateAllocationStatus(allocationId);
}

// Use the new core service for portfolio weight calculations
async function recalculatePortfolioWeights(fundId: number): Promise<void> {
  await allocationCoreService.updatePortfolioWeights(fundId);
}

// Multi-fund allocation endpoints

// GET /api/allocations - Get all allocations
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get all funds first, then get allocations for each fund
    const funds = await storage.getFunds();
    const allAllocations = [];
    
    for (const fund of funds) {
      const allocations = await storage.getAllocationsByFund(fund.id);
      allAllocations.push(...allocations);
    }
    
    res.json(allAllocations);
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch allocations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/allocations/deal/:dealId - Get all allocations for a specific deal
router.get('/deal/:dealId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`Getting allocations for deal ${dealId}`);
    
    // Get all allocations for this deal with fund information
    const allocations = await storage.getAllocationsByDeal(dealId);
    
    // The database storage already includes fund details, but let's ensure consistency
    const enrichedAllocations = allocations.map(allocation => ({
      ...allocation,
      // Ensure fund information is available
      fund: allocation.fund || null
    }));
    
    console.log(`Retrieved ${enrichedAllocations.length} allocations for deal ${dealId}`);
    
    res.json(enrichedAllocations);
  } catch (error) {
    console.error('Error getting deal allocations:', error);
    res.status(500).json({ 
      error: 'Failed to get deal allocations',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/allocations/deal/:dealId/summary - Get allocation summary for a deal across all funds
router.get('/deal/:dealId/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const summary = await multiFundAllocationService.getDealAllocationSummary(dealId);
    res.json(summary);
  } catch (error) {
    console.error('Error getting deal allocation summary:', error);
    res.status(500).json({ 
      error: 'Failed to get allocation summary',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/allocations/multi-fund - Create allocations for a deal across multiple funds
router.post('/multi-fund', requireAuth, requirePermission('create', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const allocationRequest = req.body;
    
    // Validate the request structure
    if (!allocationRequest.dealId || !Array.isArray(allocationRequest.allocations)) {
      return res.status(400).json({ 
        error: 'Invalid request format. Expected dealId and allocations array.' 
      });
    }

    const createdAllocations = await multiFundAllocationService.createMultiFundAllocation(
      allocationRequest,
      userId,
      req
    );

    res.status(201).json({
      success: true,
      message: `Created ${createdAllocations.length} allocations across multiple funds`,
      data: createdAllocations
    });
  } catch (error) {
    console.error('Error creating multi-fund allocation:', error);
    const errorResponse = ErrorHandlerService.createErrorResponse(error);
    res.status(errorResponse.error?.code === 'VALIDATION_ERROR' ? 400 : 500).json(errorResponse);
  }
});

// GET /api/allocations/deals/multi-fund-status - Get all deals with their multi-fund allocation status
router.get('/deals/multi-fund-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealsWithStatus = await multiFundAllocationService.getDealsWithMultiFundStatus();
    res.json(dealsWithStatus);
  } catch (error) {
    console.error('Error getting deals with multi-fund status:', error);
    res.status(500).json({ 
      error: 'Failed to get deals with multi-fund status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/allocations - Create a new fund allocation (ROCK SOLID ARCHITECTURE)
router.post('/', requireAuth, requirePermission('create', 'allocation'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('Creating allocation with rock-solid architecture:', req.body);
    
    // Parse and validate the request body using Zod
    const { amountType, ...cleanRequestBody } = req.body;
    const allocationData = insertFundAllocationSchema.parse({
      ...cleanRequestBody,
      amountType: 'dollar'
    });
    
    // For single payment schedules, automatically mark as 'funded'
    if (req.body.capitalCallSchedule === 'single') {
      allocationData.status = 'funded';
    }
    
    try {
      // Use transaction-safe allocation service for atomic operations
      const { transactionSafeAllocationService } = await import('../services/transaction-safe-allocation.service');
      
      const result = await transactionSafeAllocationService.createAllocationSafely({
        fundId: allocationData.fundId,
        dealId: allocationData.dealId,
        amount: allocationData.amount,
        amountType: allocationData.amountType,
        securityType: allocationData.securityType,
        allocationDate: allocationData.allocationDate || new Date(),
        notes: allocationData.notes,
        status: allocationData.status || 'committed'
      }, userId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create allocation');
      }

      const newAllocation = result.allocation;

      // Audit logging is now handled in the transaction service

      // Deal stage update and timeline events are now handled in the transaction service
      
      console.log(`Allocation created successfully with rock-solid architecture: ID ${newAllocation.id}`);
      
      res.status(201).json({
        success: true,
        message: 'Fund allocation created successfully',
        data: newAllocation
      });

    } catch (allocationError: any) {
      // Handle specific duplicate allocation errors
      if (allocationError.message?.startsWith('DUPLICATE_ALLOCATION:')) {
        const errorMessage = allocationError.message.replace('DUPLICATE_ALLOCATION:', '');
        return res.status(409).json({ 
          message: 'Fund allocation already exists',
          error: errorMessage
        });
      }
      
      // Handle other allocation creation errors
      console.error('Allocation creation failed:', allocationError);
      return res.status(500).json({
        message: 'Failed to create fund allocation',
        error: allocationError.message || 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Error in allocation creation endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    const errorResponse = ErrorHandlerService.createErrorResponse(error);
    res.status(500).json(errorResponse);
  }
});

// GET /api/allocations/fund/:fundId - Get all allocations with accurate capital call metrics
router.get('/fund/:fundId', requireAuth, requireFundAccess(), async (req: Request, res: Response) => {
  try {
    const fundId = Number(req.params.fundId);
    
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    console.log(`Getting allocations for fund ${fundId} with accurate capital call metrics`);
    
    // Sync paid amounts to ensure data consistency
    await capitalCallMetricsService.syncAllocationPaidAmounts(fundId);
    
    // Get allocations with accurate capital call data
    const allocations = await storage.getAllocationsByFund(fundId);
    const metrics = await capitalCallMetricsService.calculateFundMetrics(fundId);
    
    // Enhance allocations with accurate metrics from actual capital calls
    const enhancedAllocations = allocations.map(allocation => {
      const metric = metrics.find(m => m.allocationId === allocation.id);
      return {
        ...allocation,
        calledAmount: metric?.calledAmount || 0,
        calledPercentage: metric?.calledPercentage || 0,
        paidAmount: metric?.paidAmount || allocation.paidAmount || 0,
        paidPercentage: metric?.paidPercentage || 0
      };
    });
    
    console.log(`Found ${enhancedAllocations.length} allocations with accurate metrics for fund ${fundId}`);
    
    res.json(enhancedAllocations);
  } catch (error) {
    console.error('Error fetching fund allocations:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch allocations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/allocations/fund/:fundId/invalid - Get invalid allocations for a fund
router.get('/fund/:fundId/invalid', async (req: Request, res: Response) => {
  try {
    const fundId = Number(req.params.fundId);
    
    // Get all deals to validate allocations
    const deals = await storage.getDeals();
    const validDealIds = deals.map(deal => deal.id);
    
    // Then get the allocations with updated weights
    const allocations = await storage.getAllocationsByFund(fundId);
    
    // Filter for invalid allocations (those referencing non-existent deals)
    const invalidAllocations = allocations.filter(allocation => 
      !validDealIds.includes(allocation.dealId)
    );
    
    res.json(invalidAllocations);
  } catch (error) {
    console.error('Error fetching invalid allocations:', error);
    res.status(500).json({ message: 'Failed to fetch allocations' });
  }
});

// DELETE /api/allocations/:id - Delete an allocation (ROCK SOLID)
router.delete('/:id', requireAuth, requirePermission('delete', 'allocation'), async (req: Request, res: Response) => {
  try {
    const allocationId = Number(req.params.id);
    
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    console.log(`Deleting allocation ${allocationId} with rock-solid architecture`);

    try {
      // Use the new core service for safe deletion
      await allocationCoreService.deleteAllocation(allocationId);
      
      console.log(`Allocation ${allocationId} deleted successfully with automatic weight recalculation`);
      
      res.json({ 
        success: true, 
        message: 'Allocation deleted successfully' 
      });
    } catch (deleteError: any) {
      if (deleteError.message?.includes('not found')) {
        return res.status(404).json({ error: 'Allocation not found' });
      }
      
      console.error('Allocation deletion failed:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete allocation',
        message: deleteError.message || 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Error in allocation deletion endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to delete allocation',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;