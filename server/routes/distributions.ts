import { Router } from 'express';
import { db } from '../db';
import { createInsertSchema } from 'drizzle-zod';
import { distributions, fundAllocations, funds } from '../../shared/schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../utils/auth';
import { DatabaseStorage } from '../database-storage';

const router = Router();
const storage = new DatabaseStorage();

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

// Get distributions for a deal (across all allocations)
router.get('/deal/:dealId', requireAuth, async (req, res) => {
  try {
    const { dealId } = req.params;
    const dealDistributions = await db
      .select({
        id: distributions.id,
        allocationId: distributions.allocationId,
        distributionDate: distributions.distributionDate,
        amount: distributions.amount,
        distributionType: distributions.distributionType,
        notes: distributions.notes,
        createdAt: distributions.createdAt,
        fundName: funds.name,
        fundId: fundAllocations.fundId,
        allocationAmount: fundAllocations.amount,
      })
      .from(distributions)
      .innerJoin(fundAllocations, eq(distributions.allocationId, fundAllocations.id))
      .innerJoin(funds, eq(fundAllocations.fundId, funds.id))
      .where(eq(fundAllocations.dealId, parseInt(dealId)))
      .orderBy(distributions.distributionDate);
    res.json(dealDistributions);
  } catch (error) {
    console.error('Error fetching deal distributions:', error);
    res.status(500).json({ message: 'Failed to fetch deal distributions' });
  }
});

// Create new distribution
router.post('/', requireAuth, async (req, res) => {
  try {
    // Transform the amount to a string for Drizzle's numeric field
    const bodyData = {
      ...req.body,
      amount: req.body.amount?.toString()
    };
    
    const validatedData = insertDistributionSchema.parse(bodyData);
    const distribution = await storage.createDistribution(validatedData);
    
    // Recalculate allocation metrics to update distributionPaid field
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
    
    // Recalculate allocation metrics after update
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
    
    // Recalculate allocation metrics after deletion
    await storage.recalculateAllocationMetrics(distribution.allocationId);
    
    res.json({ message: 'Distribution deleted successfully' });
  } catch (error) {
    console.error('Error deleting distribution:', error);
    res.status(500).json({ message: 'Failed to delete distribution' });
  }
});

export default router;