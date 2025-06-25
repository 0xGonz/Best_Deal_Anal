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
      // Use the new core service for rock-solid allocation creation
      const newAllocation = await allocationCoreService.createAllocation({
        fundId: allocationData.fundId,
        dealId: allocationData.dealId,
        amount: allocationData.amount,
        amountType: allocationData.amountType,
        securityType: allocationData.securityType,
        allocationDate: allocationData.allocationDate || new Date().toISOString(),
        notes: allocationData.notes,
        status: allocationData.status || 'committed',
        interestPaid: allocationData.interestPaid,
        distributionPaid: allocationData.distributionPaid,
        marketValue: allocationData.marketValue,
        moic: allocationData.moic,
        irr: allocationData.irr
      });

      // Log allocation creation for audit trail
      const auditService = new AuditService();
      try {
        await auditService.logAllocationCreation(
          newAllocation.id,
          allocationData.dealId,
          allocationData.fundId,
          allocationData.amount,
          userId,
          { 
            securityType: allocationData.securityType, 
            notes: allocationData.notes,
            status: allocationData.status 
          }
        );
      } catch (auditError) {
        console.warn('Audit logging failed (non-critical):', auditError);
      }

      // Update deal stage to "invested"
      const deal = await storage.getDeal(allocationData.dealId);
      const fund = await storage.getFund(allocationData.fundId);
      
      if (deal && deal.stage !== 'invested') {
        await storage.updateDeal(deal.id, { 
          stage: 'invested',
          createdBy: userId
        });
        
        // Create timeline event
        await storage.createTimelineEvent({
          dealId: deal.id,
          eventType: 'closing_scheduled',
          content: `Deal was allocated to fund: ${fund?.name}`,
          createdBy: userId,
          metadata: {} as any
        });
      }
      
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

// GET /api/allocations/fund/:fundId - Get all allocations for a specific fund (ROCK SOLID)
router.get('/fund/:fundId', requireAuth, async (req: Request, res: Response) => {
  try {
    const fundId = Number(req.params.fundId);
    
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    console.log(`Getting allocations for fund ${fundId} with rock-solid architecture`);
    
    // Use the new core service for consistent data retrieval
    const allocations = await allocationCoreService.getFundAllocations(fundId);
    
    console.log(`Retrieved ${allocations.length} allocations for fund ${fundId}`);
    
    res.json(allocations);
  } catch (error) {
    console.error('Error getting fund allocations:', error);
    res.status(500).json({ 
      error: 'Failed to get fund allocations',
      message: error instanceof Error ? error.message : String(error)
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