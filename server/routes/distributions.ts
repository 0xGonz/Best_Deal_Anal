import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { createInsertSchema } from 'drizzle-zod';
import { distributions } from '../../shared/schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

const router = Router();

// Distribution validation schema
const insertDistributionSchema = createInsertSchema(distributions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Get distributions for an allocation
router.get('/allocation/:allocationId', requireAuth, async (req, res) => {
  try {
    const { allocationId } = req.params;
    const allocationDistributions = await db
      .select()
      .from(distributions)
      .where(eq(distributions.allocationId, parseInt(allocationId)));
    res.json(allocationDistributions);
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({ message: 'Failed to fetch distributions' });
  }
});

// Create new distribution
router.post('/', requireAuth, async (req, res) => {
  try {
    const validatedData = insertDistributionSchema.parse(req.body);
    const distribution = await storage.createDistribution(validatedData);
    
    // Recalculate allocation metrics after adding distribution
    await storage.recalculateAllocationMetrics(validatedData.allocationId);
    
    res.status(201).json(distribution);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid distribution data', 
        errors: error.errors 
      });
    }
    
    console.error('Error creating distribution:', error);
    res.status(500).json({ message: 'Failed to create distribution' });
  }
});

// Update distribution
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertDistributionSchema.partial().parse(req.body);
    
    const updatedDistribution = await storage.updateDistribution(parseInt(id), validatedData);
    
    if (!updatedDistribution) {
      return res.status(404).json({ message: 'Distribution not found' });
    }
    
    // Recalculate allocation metrics after updating distribution
    await storage.recalculateAllocationMetrics(updatedDistribution.allocationId);
    
    res.json(updatedDistribution);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid distribution data', 
        errors: error.errors 
      });
    }
    
    console.error('Error updating distribution:', error);
    res.status(500).json({ message: 'Failed to update distribution' });
  }
});

// Delete distribution
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const distribution = await storage.getDistribution(parseInt(id));
    
    if (!distribution) {
      return res.status(404).json({ message: 'Distribution not found' });
    }
    
    await storage.deleteDistribution(parseInt(id));
    
    // Recalculate allocation metrics after deleting distribution
    await storage.recalculateAllocationMetrics(distribution.allocationId);
    
    res.json({ message: 'Distribution deleted successfully' });
  } catch (error) {
    console.error('Error deleting distribution:', error);
    res.status(500).json({ message: 'Failed to delete distribution' });
  }
});

export default router;