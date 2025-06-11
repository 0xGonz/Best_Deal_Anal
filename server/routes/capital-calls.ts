import express from 'express';
import { z } from 'zod';
import { StorageFactory } from '../storage-factory';
import { insertCapitalCallSchema, insertCapitalCallPaymentSchema, capitalCalls } from '../../shared/schema';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import { eq } from 'drizzle-orm';
import { capitalCallService } from '../services/capital-call.service';
import { createDatabaseDate, parseUTCDate } from '../../shared/utils/dateUtils.js';

const router = express.Router();
const storage = StorageFactory.getStorage();

// Get all capital calls
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get query parameters for filtering
    const status = req.query.status as string || undefined;
    const fromDate = req.query.fromDate ? parseUTCDate(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? parseUTCDate(req.query.toDate as string) : undefined;
    const fundId = req.query.fundId ? Number(req.query.fundId) : undefined;
    
    // Get all capital calls from database
    const result = await storage.getAllCapitalCalls();
    
    // Filter results based on query params
    let filteredResult = result;
    if (status) {
      filteredResult = filteredResult.filter(call => call.status === status);
    }
    if (fromDate) {
      filteredResult = filteredResult.filter(call => 
        new Date(call.callDate) >= fromDate || 
        new Date(call.dueDate) >= fromDate
      );
    }
    if (toDate) {
      filteredResult = filteredResult.filter(call => 
        new Date(call.callDate) <= toDate || 
        new Date(call.dueDate) <= toDate
      );
    }
    
    // Enhance with deal and fund details
    const enhancedResults = await Promise.all(
      filteredResult.map(async (call) => {
        try {
          // Get the allocation
          const allocation = await storage.getFundAllocation(call.allocationId);
          if (!allocation) return call;
          
          // If we have a fundId filter and this call doesn't match, skip it
          if (fundId && allocation.fundId !== fundId) return null;
          
          // Get the deal and fund
          const deal = await storage.getDeal(allocation.dealId);
          const fund = await storage.getFund(allocation.fundId);
          
          return {
            ...call,
            dealId: allocation.dealId,
            dealName: deal?.name || 'Unknown Deal',
            fundId: allocation.fundId,
            fundName: fund?.name || 'Unknown Fund',
            outstanding: call.outstanding || Math.max(0, call.callAmount - (call.paidAmount || 0))
          };
        } catch (err) {
          console.error('Error enhancing capital call data:', err);
          return call;
        }
      })
    );
    
    // Filter out null results (calls that didn't match our filter)
    const finalResults = enhancedResults.filter(call => call !== null);
    
    return res.json(finalResults);
  } catch (error: any) {
    console.error('Error fetching all capital calls:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Schema for validation with additional validation rules
const createCapitalCallSchema = insertCapitalCallSchema.extend({
  callAmount: z.number().positive("Call amount must be greater than 0"),
  amountType: z.enum(["percentage", "dollar"]),
  callDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date())
});

// Get all capital calls for a deal
router.get('/deal/:dealId', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    // Get all capital calls for this deal
    const capitalCalls = await storage.getCapitalCallsByDeal(dealId);
    
    if (!capitalCalls.length) {
      return res.json([]);
    }
    
    // Enhance with deal and fund information
    const allocationIds = [...new Set(capitalCalls.map(call => call.allocationId))];
    const allocations = await Promise.all(
      allocationIds.map(id => storage.getFundAllocation(id))
    );
    
    // Create a lookup map for allocations
    const allocationMap = allocations.reduce((map, allocation) => {
      if (allocation) {
        map[allocation.id] = allocation;
      }
      return map;
    }, {} as Record<number, any>);
    
    // Get all relevant funds for these allocations
    const fundIds = [...new Set(
      allocations
        .filter(a => a !== null)
        .map(a => a!.fundId)
    )];
    const funds = await Promise.all(
      fundIds.map(id => storage.getFund(id))
    );
    
    // Create a lookup map for funds
    const fundMap = funds.reduce((map, fund) => {
      if (fund) {
        map[fund.id] = fund;
      }
      return map;
    }, {} as Record<number, any>);
    
    // Enhance capital calls with deal and fund info
    const enhancedCalls = capitalCalls.map(call => {
      const allocation = allocationMap[call.allocationId];
      if (allocation) {
        const fund = fundMap[allocation.fundId] || { name: 'Unknown Fund' };
        return {
          ...call,
          dealId,
          dealName: allocation.dealName || 'Deal',
          fundId: allocation.fundId,
          fundName: fund.name,
          // Use outstanding from database if available, otherwise calculate
          outstanding: call.outstanding || Math.max(0, call.callAmount - (call.paidAmount || 0))
        };
      }
      return call;
    });
    
    return res.json(enhancedCalls);
  } catch (error: any) {
    console.error('Error fetching capital calls:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Get all capital calls for an allocation
router.get('/allocation/:allocationId', requireAuth, async (req, res) => {
  try {
    const allocationId = parseInt(req.params.allocationId);
    if (isNaN(allocationId)) {
      return res.status(400).json({ message: 'Invalid allocation ID' });
    }

    const capitalCalls = await storage.getCapitalCallsByAllocation(allocationId);
    return res.json(capitalCalls);
  } catch (error: any) {
    console.error('Error fetching capital calls:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Create a new capital call
router.post('/', requireAuth, requirePermission('create', 'capital-call'), async (req, res) => {
  try {
    // Validate the request body
    const validatedData = createCapitalCallSchema.parse(req.body);

    // Get the allocation to validate it exists
    const allocation = await storage.getFundAllocation(validatedData.allocationId);
    if (!allocation) {
      return res.status(404).json({ message: 'Fund allocation not found' });
    }

    // Create the capital call
    const capitalCall = await storage.createCapitalCall({
      ...validatedData,
      callDate: new Date(validatedData.callDate),
      dueDate: new Date(validatedData.dueDate)
    });

    // Get fund name for the timeline event
    const fund = await storage.getFund(allocation.fundId);
    
    // Add a timeline event for the capital call creation
    await storage.createTimelineEvent({
      dealId: allocation.dealId,
      eventType: 'capital_call',
      content: `Capital call ${validatedData.status === 'scheduled' ? 'scheduled' : 'created'} for ${fund?.name || 'a fund'}`,
      createdBy: req.user?.id || 0,
      metadata: {
        // Using as any to work around TypeScript issues with metadata typing
        capitalCallId: capitalCall.id,
        allocationId: allocation.id,
        fundId: allocation.fundId,
        amount: validatedData.callAmount,
        amountType: validatedData.amountType
      } as any
    });

    return res.status(201).json(capitalCall);
  } catch (error: any) {
    console.error('Error creating capital call:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Update a capital call's status
router.patch('/:id/status', requireAuth, requirePermission('edit', 'capital-call'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }

    const { status, paidAmount } = req.body;
    if (!status || !['scheduled', 'called', 'partial', 'paid', 'defaulted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updatedCapitalCall = await storage.updateCapitalCallStatus(id, status, paidAmount);
    if (!updatedCapitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }

    // Get the allocation to include in the timeline event
    const allocation = await storage.getFundAllocation(updatedCapitalCall.allocationId);
    
    // Add a timeline event for the status update
    if (allocation) {
      await storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call_update',
        content: `Capital call status updated to ${status}`,
        createdBy: req.user?.id || 0,
        metadata: {
          capitalCallId: id,
          allocationId: allocation.id,
          fundId: allocation.fundId,
          newStatus: status,
          previousStatus: updatedCapitalCall.status,
          paidAmount: paidAmount || 0
        } as any
      });
    }

    return res.json(updatedCapitalCall);
  } catch (error: any) {
    console.error('Error updating capital call status:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Update capital call dates
router.patch('/:id/dates', requireAuth, requirePermission('edit', 'capital-call'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }

    const { callDate, dueDate } = req.body;
    if (!callDate || !dueDate) {
      return res.status(400).json({ message: 'Both callDate and dueDate are required' });
    }

    const updatedCapitalCall = await storage.updateCapitalCallDates(
      id, 
      new Date(callDate), 
      new Date(dueDate)
    );
    
    if (!updatedCapitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }

    return res.json(updatedCapitalCall);
  } catch (error: any) {
    console.error('Error updating capital call dates:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Create schema for updating a capital call
const updateCapitalCallSchema = z.object({
  callAmount: z.number().positive("Call amount must be greater than 0").optional(),
  amountType: z.enum(["percentage", "dollar"]).optional(),
  callDate: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()).optional(),
  status: z.enum(["scheduled", "called", "partial", "paid", "defaulted"]).optional(),
  notes: z.string().nullable().optional(),
  paidAmount: z.number().optional(),
  paidDate: z.string().or(z.date()).nullable().optional(),
});

// Update a capital call (comprehensive update)
router.patch('/:id', requireAuth, requirePermission('edit', 'capital-call'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }
    
    // Validate request body
    const validatedData = updateCapitalCallSchema.parse(req.body);
    
    // Get the existing capital call
    const existingCapitalCall = await storage.getCapitalCall(id);
    if (!existingCapitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }
    
    // Prepare update data
    const updateData: any = { ...validatedData };
    
    // Convert date strings to Date objects
    if (updateData.callDate) {
      updateData.callDate = new Date(updateData.callDate);
    }
    
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }
    
    if (updateData.paidDate) {
      updateData.paidDate = new Date(updateData.paidDate);
    }
    
    // Update the capital call in the database
    let updatedCapitalCall;
    
    try {
      // Try to update using existing method if possible
      if (updateData.status) {
        updatedCapitalCall = await storage.updateCapitalCallStatus(
          id, 
          updateData.status, 
          updateData.paidAmount
        );
      } else if (updateData.callDate && updateData.dueDate) {
        updatedCapitalCall = await storage.updateCapitalCallDates(
          id,
          updateData.callDate,
          updateData.dueDate
        );
      } else {
        // For more complex updates, use a combination of methods or create a new one
        const capitalCall = await storage.getCapitalCall(id);
        if (!capitalCall) {
          return res.status(404).json({ message: 'Capital call not found' });
        }
        
        // Apply updates one by one
        if (updateData.callDate && updateData.dueDate) {
          await storage.updateCapitalCallDates(id, updateData.callDate, updateData.dueDate);
        }
        if (updateData.status) {
          await storage.updateCapitalCallStatus(id, updateData.status, updateData.paidAmount);
        }
        
        // Get the updated capital call
        updatedCapitalCall = await storage.getCapitalCall(id);
      }
    } catch (error) {
      console.error('Error updating capital call:', error);
      return res.status(500).json({ message: 'Failed to update capital call' });
    }
    
    if (!updatedCapitalCall) {
      return res.status(500).json({ message: 'Failed to update capital call' });
    }
    
    // Get allocation for timeline event
    const allocation = await storage.getFundAllocation(updatedCapitalCall.allocationId);
    
    // Create timeline event if necessary
    if (allocation && (validatedData.status || validatedData.callAmount)) {
      await storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call_update',
        content: `Capital call updated${validatedData.status ? ` (status: ${validatedData.status})` : ''}`,
        createdBy: req.user?.id || 0,
        metadata: {
          capitalCallId: id,
          allocationId: allocation.id,
          fundId: allocation.fundId
        } as any
      });
    }
    
    return res.json(updatedCapitalCall);
  } catch (error: any) {
    console.error('Error updating capital call:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Delete a capital call
router.delete('/:id', requireAuth, requirePermission('delete', 'capital-call'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }
    
    // Get capital call to retrieve allocation info before deletion
    const capitalCall = await storage.getCapitalCall(id);
    if (!capitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }
    
    // Get allocation to get deal ID for timeline event
    const allocation = await storage.getFundAllocation(capitalCall.allocationId);
    
    // Since we don't have a dedicated deleteCapitalCall method, we'll do a workaround
    // We'll update it to defaulted status instead as a soft delete
    const updatedCapitalCall = await storage.updateCapitalCallStatus(id, 'defaulted');
    
    if (!updatedCapitalCall) {
      return res.status(500).json({ message: 'Failed to delete capital call' });
    }
    
    // Create timeline event for the deletion
    if (allocation) {
      await storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call_update', // Use the existing event type
        content: `Capital call deleted`,
        createdBy: req.user?.id || 0,
        metadata: {
          capitalCallId: id,
          allocationId: allocation.id,
          fundId: allocation.fundId,
          newStatus: 'defaulted', // Using a valid status
          previousStatus: capitalCall.status
        } as any
      });
    }
    
    return res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting capital call:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// --- Capital Call Payments Routes ---

// Get all payments for a capital call
router.get('/:id/payments', requireAuth, async (req, res) => {
  try {
    const capitalCallId = parseInt(req.params.id);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }

    // Check if capital call exists
    const capitalCall = await storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }

    const payments = await storage.getCapitalCallPayments(capitalCallId);
    return res.json(payments);
  } catch (error: any) {
    console.error('Error fetching capital call payments:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Schema for validating a payment
const createPaymentSchema = insertCapitalCallPaymentSchema.extend({
  paymentAmount: z.number().positive("Payment amount must be greater than 0"),
  paymentDate: z.string().or(z.date()),
  paymentType: z.enum(["wire", "check", "ach", "other"]).nullable(),
  notes: z.string().nullable().optional()
});

// Add a payment to a capital call
router.post('/:id/payments', requireAuth, requirePermission('edit', 'capital-call'), async (req, res) => {
  try {
    const capitalCallId = parseInt(req.params.id);
    if (isNaN(capitalCallId)) {
      return res.status(400).json({ message: 'Invalid capital call ID' });
    }

    // Validate the request body
    const validatedData = createPaymentSchema.parse(req.body);

    // Get the capital call to ensure it exists
    const capitalCall = await storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      return res.status(404).json({ message: 'Capital call not found' });
    }

    // Add the payment using the dedicated service method
    const updatedCapitalCall = await capitalCallService.addPaymentToCapitalCall(
      capitalCallId,
      validatedData.paymentAmount,
      new Date(validatedData.paymentDate),
      validatedData.paymentType || 'other',
      validatedData.notes || null,
      req.user?.id || 0
    );

    if (!updatedCapitalCall) {
      return res.status(500).json({ message: 'Failed to add payment' });
    }

    // Get all payments for this capital call to include in the response
    const payments = await storage.getCapitalCallPayments(capitalCallId);

    // Get allocation for timeline event
    const allocation = await storage.getFundAllocation(capitalCall.allocationId);
    
    // Create timeline event for the payment
    if (allocation) {
      await storage.createTimelineEvent({
        dealId: allocation.dealId,
        eventType: 'capital_call_update',
        content: `Payment of ${validatedData.paymentAmount} added to capital call`,
        createdBy: req.user?.id || 0,
        metadata: {
          capitalCallId,
          allocationId: allocation.id,
          fundId: allocation.fundId,
          paymentAmount: validatedData.paymentAmount,
          paymentType: validatedData.paymentType,
          newStatus: updatedCapitalCall.status,
          previousStatus: capitalCall.status
        } as any
      });
    }

    return res.status(201).json({
      capitalCall: updatedCapitalCall,
      payments
    });
  } catch (error: any) {
    console.error('Error adding payment to capital call:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Get details of a specific payment
router.get('/payments/:paymentId', requireAuth, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    if (isNaN(paymentId)) {
      return res.status(400).json({ message: 'Invalid payment ID' });
    }

    const payment = await storage.getCapitalCallPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    return res.json(payment);
  } catch (error: any) {
    console.error('Error fetching payment:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

export default router;