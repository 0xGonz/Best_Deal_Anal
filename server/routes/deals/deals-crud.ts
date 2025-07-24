import { Router, Request, Response } from "express";
import { 
  insertDealSchema, 
  DealStageLabels
} from "@shared/schema";
import type { DealAssignment, DealStar, MiniMemo } from "@shared/schema";
import { z } from "zod";
import { IStorage } from "../../storage";
import { requireAuth } from "../../utils/auth";
import { requirePermission } from "../../utils/permissions";
import { dealService } from "../../services";
import { StorageFactory } from "../../storage-factory";

const router = Router();

// Helper function to get a fresh storage instance in each request
function getStorage(): IStorage {
  return StorageFactory.getStorage();
}

// Get all deals or filter by stage
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const storage = getStorage();
    let deals;
    
    if (req.query.stage) {
      // Validate stage parameter
      const validStages = ["initial_review", "screening", "diligence", "ic_review", "closing", "closed", "invested", "rejected"];
      const stage = req.query.stage as string;
      if (!validStages.includes(stage)) {
        return res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
      }
      deals = await dealService.getDealsByStage(stage as any);
    } else {
      deals = await dealService.getAllDeals();
    }
    
    // Optimize: Get all supplementary data in 3 batch queries instead of N+1 queries
    const dealIds = deals.map(d => d.id);
    const [allAssignments, allStars, allMiniMemos] = await Promise.all([
      Promise.all(dealIds.map(id => storage.getDealAssignments(id))).then(results => results.flat()),
      storage.getDealStarsBatch(dealIds),
      storage.getMiniMemosBatch(dealIds)
    ]);
    
    // Group data by dealId for efficient lookup
    const assignmentsByDeal = new Map<number, DealAssignment[]>();
    const starsByDeal = new Map<number, DealStar[]>();
    const memosByDeal = new Map<number, MiniMemo[]>();
    
    allAssignments.forEach((assignment: DealAssignment) => {
      if (!assignmentsByDeal.has(assignment.dealId)) {
        assignmentsByDeal.set(assignment.dealId, []);
      }
      assignmentsByDeal.get(assignment.dealId)!.push(assignment);
    });
    
    allStars.forEach((star: DealStar) => {
      if (!starsByDeal.has(star.dealId)) {
        starsByDeal.set(star.dealId, []);
      }
      starsByDeal.get(star.dealId)!.push(star);
    });
    
    allMiniMemos.forEach((memo: MiniMemo) => {
      if (!memosByDeal.has(memo.dealId)) {
        memosByDeal.set(memo.dealId, []);
      }
      memosByDeal.get(memo.dealId)!.push(memo);
    });
    
    // Build enhanced deals with optimized data lookup
    const dealsWithExtras = deals.map(deal => {
      const assignments = assignmentsByDeal.get(deal.id) || [];
      const stars = starsByDeal.get(deal.id) || [];
      const miniMemos = memosByDeal.get(deal.id) || [];
      
      // Calculate score from mini memos
      let score = 0;
      if (miniMemos.length > 0) {
        score = Math.floor(miniMemos.reduce((sum: number, memo: MiniMemo) => sum + (memo.score || 0), 0) / miniMemos.length);
      }
      
      return {
        ...deal,
        stageLabel: DealStageLabels[deal.stage as keyof typeof DealStageLabels] || deal.stage,
        assignedUsers: assignments.map((a: DealAssignment) => a.userId),
        starCount: stars.length,
        score
      };
    });
    
    res.json(dealsWithExtras);
  } catch (error) {
    res.status(500).json({ 
      error: { 
        code: 'DEALS_FETCH_ERROR', 
        message: 'Failed to fetch deals',
        details: error instanceof Error ? error.message : 'Unknown error'
      } 
    });
  }
});

// Get a specific deal by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the ID is valid
    if (req.params.id === 'undefined' || req.params.id === 'null') {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }
    
    const dealId = Number(req.params.id);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    
    const storage = getStorage();
    const deal = await storage.getDeal(dealId);
    
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const assignments = await storage.getDealAssignments(deal.id);
    const stars = await storage.getDealStars(deal.id);
    const timelineEvents = await storage.getTimelineEventsByDeal(deal.id);
    const miniMemos = await storage.getMiniMemosByDeal(deal.id);
    const allocations = await storage.getAllocationsByDeal(deal.id);
    
    // Get assigned users with details
    const assignedUserIds = assignments.map(a => a.userId);
    const users = await storage.getUsers();
    const assignedUsers = users.filter(user => assignedUserIds.includes(user.id))
      .map(user => ({
        id: user.id,
        fullName: user.fullName,
        initials: user.initials,
        avatarColor: user.avatarColor,
        role: user.role
      }));
    
    // Calculate score from mini memos
    let score = 0;
    if (miniMemos.length > 0) {
      score = Math.floor(miniMemos.reduce((sum, memo) => sum + memo.score, 0) / miniMemos.length);
    }
    
    res.json({
      ...deal,
      stageLabel: DealStageLabels[deal.stage],
      assignedUsers,
      starCount: stars.length,
      timelineEvents,
      miniMemos,
      allocations,
      score
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deal' });
  }
});

// Create a new deal
router.post('/', requirePermission('create', 'deal'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Check if user is authenticated
    if (!user) {
      return res.status(401).json({ message: 'You must be logged in to create a deal' });
    }
    
    const dealData = insertDealSchema.parse({
      ...req.body,
      createdBy: user.id
    });
    
    const storage = getStorage();
    const newDeal = await storage.createDeal(dealData);
    
    // Automatically assign creator to the deal
    await storage.assignUserToDeal({
      dealId: newDeal.id,
      userId: user.id
    });
    
    // Add a timeline entry for the deal creation
    await storage.createTimelineEvent({
      dealId: newDeal.id,
      eventType: 'deal_creation',
      content: `${user.fullName} created this deal`,
      createdBy: user.id,
      metadata: {}
    });
    
    res.status(201).json(newDeal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid deal data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create deal', error: String(error) });
  }
});

// Update a deal
router.patch('/:id', requirePermission('edit', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const user = (req as any).user || { id: 1 };
    
    const storage = getStorage();
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Validate the partial update data
    const updateSchema = insertDealSchema.partial();
    let dealUpdate = updateSchema.parse({
      ...req.body,
      ...(req.body.stage && { createdBy: user.id })
    });
    
    const updatedDeal = await storage.updateDeal(dealId, dealUpdate);
    
    if (!updatedDeal) {
      return res.status(404).json({ message: 'Deal not found after update' });
    }
    
    // Create timeline event for significant changes
    if (req.body.stage && req.body.stage !== deal.stage) {
      await storage.createTimelineEvent({
        dealId: dealId,
        eventType: 'stage_change',
        content: `${user.fullName || 'System'} moved deal to ${DealStageLabels[req.body.stage as keyof typeof DealStageLabels] || req.body.stage}`,
        createdBy: user.id,
        metadata: {
          oldStage: deal.stage,
          newStage: req.body.stage
        }
      });
    }
    
    res.json(updatedDeal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid update data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update deal' });
  }
});

// Delete a deal
router.delete('/:id', requirePermission('delete', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const storage = getStorage();
    
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    await storage.deleteDeal(dealId);
    
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete deal' });
  }
});

export default router; 