import { Router, Request, Response } from 'express';
import { insertFundAllocationSchema } from '@shared/schema';
import { StorageFactory } from '../storage-factory';
import { z } from 'zod';
import { requireAuth } from '../utils/auth';

const router = Router();
const storage = StorageFactory.getStorage();

// Get all allocations for a fund
router.get('/fund/:fundId', requireAuth, async (req: Request, res: Response) => {
  try {
    const fundId = parseInt(req.params.fundId);
    const allocations = await storage.getAllocationsByFund(fundId);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch allocations' });
  }
});

// Get allocations for a deal
router.get('/deal/:dealId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const allocations = await storage.getAllocationsByDeal(dealId);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch allocations' });
  }
});

// Create new allocation
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = insertFundAllocationSchema.parse(req.body);
    const allocation = await storage.createFundAllocation(validatedData);
    res.status(201).json(allocation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create allocation' });
  }
});

// Update allocation
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const allocation = await storage.updateFundAllocation(id, updates);
    
    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }
    
    res.json(allocation);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update allocation' });
  }
});

// Delete allocation
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteFundAllocation(id);
    
    if (!success) {
      return res.status(404).json({ message: 'Allocation not found' });
    }
    
    res.json({ message: 'Allocation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete allocation' });
  }
});

export default router;