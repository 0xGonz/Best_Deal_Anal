import { Router, Request, Response } from "express";
import { 
  insertDealSchema, 
  insertTimelineEventSchema, 
  insertDealStarSchema,
  insertMiniMemoSchema,
  insertMemoCommentSchema,
  DealStageLabels
} from "@shared/schema";
import type { DealAssignment, DealStar, MiniMemo } from "@shared/schema";
import { z } from "zod";
import { IStorage } from "../storage";
import { requireAuth } from "../utils/auth";
import { requirePermission } from "../utils/permissions";
import { dealService } from "../services";
import { StorageFactory } from "../storage-factory";

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
    console.error('Error fetching deals:', error);
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
    console.error('Error creating deal:', error);
    res.status(500).json({ message: 'Failed to create deal', error: String(error) });
  }
});

// Update a deal
router.patch('/:id', requirePermission('edit', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    // Get user from request if available, or use a default system user ID if not
    const user = (req as any).user || { id: 1 }; // Default to admin user if no user in request
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Validate the partial update data
    const updateSchema = insertDealSchema.partial();
    let dealUpdate = updateSchema.parse({
      ...req.body,
      // If stage is updated, record who changed it
      ...(req.body.stage && { createdBy: user.id })
    });
    
    // Handle stage changes
    if (dealUpdate.stage && dealUpdate.stage !== deal.stage) {
      // If changing to rejected stage
      if (dealUpdate.stage === 'rejected') {
        // Add rejected timestamp
        dealUpdate = {
          ...dealUpdate,
          rejectedAt: new Date()
        };
        
        // Create a timeline event for rejection
        if (dealUpdate.rejectionReason) {
          await storage.createTimelineEvent({
            dealId,
            eventType: 'stage_change',
            content: `Deal rejected: ${dealUpdate.rejectionReason}`,
            createdBy: user.id,
            metadata: {
              previousStage: [deal.stage],
              newStage: ['rejected']
            }
          });
        }
      } else if (deal.stage === 'rejected' && dealUpdate.stage && (['initial_review', 'screening', 'diligence', 'ic_review', 'closing', 'closed', 'invested'] as const).includes(dealUpdate.stage as any)) {
        // If moving from rejected to another stage, clear rejection fields
        dealUpdate = {
          ...dealUpdate,
          rejectionReason: null,
          rejectedAt: null
        };
      }
      
      // Add a timeline event for any stage change
      await storage.createTimelineEvent({
        dealId,
        eventType: 'stage_change',
        content: `Deal moved from ${DealStageLabels[deal.stage]} to ${DealStageLabels[dealUpdate.stage as keyof typeof DealStageLabels]}`,
        createdBy: user.id,
        metadata: {
          previousStage: [deal.stage],
          newStage: dealUpdate.stage ? [dealUpdate.stage] : ['unknown']
        }
      });
    }
    
    const updatedDeal = await storage.updateDeal(dealId, dealUpdate);
    res.json(updatedDeal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid deal data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update deal' });
  }
});

// Get timeline events for a deal
router.get('/:dealId/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const events = await storage.getTimelineEventsByDeal(dealId);
    
    // Get user info for each event
    const userIds = Array.from(new Set(events.map(e => e.createdBy)));
    const users = await Promise.all(userIds.map(id => storage.getUser(id)));
    
    const eventsWithUserInfo = events.map(event => {
      const user = users.find(u => u?.id === event.createdBy);
      return {
        ...event,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          initials: user.initials,
          avatarColor: user.avatarColor,
          role: user.role
        } : null
      };
    });
    
    res.json(eventsWithUserInfo);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timeline events' });
  }
});

// Create a timeline event for a deal
router.post('/:dealId/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const eventData = insertTimelineEventSchema.parse({
      ...req.body,
      dealId,
      createdBy: user.id
    });
    
    const newEvent = await storage.createTimelineEvent(eventData);
    
    // Return with user info
    const userInfo = await storage.getUser(user.id);
    res.status(201).json({
      ...newEvent,
      user: userInfo ? {
        id: userInfo.id,
        fullName: userInfo.fullName,
        initials: userInfo.initials,
        avatarColor: userInfo.avatarColor,
        role: userInfo.role
      } : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid event data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create timeline event' });
  }
});

// Update a timeline event
router.put('/:dealId/timeline/:eventId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const eventId = Number(req.params.eventId);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Make sure event exists
    const events = await storage.getTimelineEventsByDeal(dealId);
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Timeline event not found' });
    }
    
    // Check if user is allowed to edit this event
    if (event.createdBy !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to edit this event' });
    }
    
    // Only allow editing content for notes
    if (event.eventType !== 'note') {
      return res.status(400).json({ message: 'Only note events can be edited' });
    }
    
    // Prepare update data
    const updateData: any = {
      content: req.body.content
    };
    
    // If metadata is provided in the request, include it in the update
    if (req.body.metadata) {
      updateData.metadata = req.body.metadata;
    }
    
    const updatedEvent = await storage.updateTimelineEvent(eventId, updateData);
    
    // Return with user info
    const userInfo = await storage.getUser(event.createdBy);
    res.json({
      ...updatedEvent,
      user: userInfo ? {
        id: userInfo.id,
        fullName: userInfo.fullName,
        initials: userInfo.initials,
        avatarColor: userInfo.avatarColor,
        role: userInfo.role
      } : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid event data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update timeline event' });
  }
});

// Delete a timeline event
router.delete('/:dealId/timeline/:eventId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const eventId = Number(req.params.eventId);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Make sure event exists
    const events = await storage.getTimelineEventsByDeal(dealId);
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Timeline event not found' });
    }
    
    // Check if user is allowed to delete this event
    if (event.createdBy !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to delete this event' });
    }
    
    // Only allow deleting notes
    if (event.eventType !== 'note') {
      return res.status(400).json({ message: 'Only note events can be deleted' });
    }
    
    const success = await storage.deleteTimelineEvent(eventId);
    
    if (success) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ message: 'Failed to delete timeline event' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete timeline event' });
  }
});

// Get all stars for a deal
router.get('/:dealId/stars', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const stars = await storage.getDealStars(dealId);
    res.json(stars);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deal stars' });
  }
});

// Toggle star on a deal
router.post('/:dealId/star', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to star deals' });
    }
    
    const userId = user.id;
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if user has already starred this deal
    const stars = await storage.getDealStars(dealId);
    const existingStar = stars.find(star => star.userId === userId);
    
    if (existingStar) {
      // If user has already starred, remove the star
      await storage.unstarDeal(dealId, userId);
      return res.json({ success: true, action: 'unstarred' });
    } else {
      // Otherwise, add a new star
      const starData = insertDealStarSchema.parse({
        dealId,
        userId
      });
      
      const star = await storage.starDeal(starData);
      return res.status(201).json({ ...star, action: 'starred' });
    }
  } catch (error) {
    console.error('Error toggling deal star:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid star data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to toggle deal star' });
  }
});

// Unstar a deal
router.delete('/:dealId/star', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to unstar deals' });
    }
    
    const storage = getStorage();
    const success = await storage.unstarDeal(dealId, user.id);
    if (!success) {
      return res.status(404).json({ message: 'Star not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error unstarring deal:', error);
    res.status(500).json({ message: 'Failed to unstar deal' });
  }
});

// Assign a user to a deal
router.post('/:dealId/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const { userId } = req.body;
    const currentUser = (req as any).user;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Make sure user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check role-based permissions
    // Only admins and partners can assign admins or partners
    // Everyone can assign analysts and observers
    if ((user.role === 'admin' || user.role === 'partner') && 
        !(currentUser.role === 'admin' || currentUser.role === 'partner')) {
      return res.status(403).json({ 
        message: 'You do not have permission to assign users with this role'
      });
    }
    
    const assignment = await storage.assignUserToDeal({
      dealId,
      userId
    });
    
    // Create a timeline event for the assignment
    await storage.createTimelineEvent({
      dealId,
      eventType: 'note',
      content: `${user.fullName} (${user.role}) was assigned to this deal by ${currentUser.fullName}`,
      createdBy: currentUser.id,
      metadata: { assignedUserId: [userId] }
    });
    
    // Create a notification for the assigned user
    await storage.createNotification({
      userId,
      title: 'New assignment',
      message: `You've been assigned to deal: ${deal.name}`,
      type: 'assignment',
      relatedId: dealId
    });
    
    // Get assigned user details
    const assignedUser = {
      id: user.id,
      fullName: user.fullName,
      initials: user.initials,
      avatarColor: user.avatarColor,
      role: user.role
    };
    
    res.status(201).json({ ...assignment, user: assignedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign user to deal' });
  }
});

// Get assignments for a deal
router.get('/:dealId/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const assignments = await storage.getDealAssignments(dealId);
    
    // Get user details for each assignment
    const assignedUsers = await Promise.all(
      assignments.map(async (assignment) => {
        const user = await storage.getUser(assignment.userId);
        return user ? {
          assignment,
          user: {
            id: user.id,
            fullName: user.fullName,
            initials: user.initials,
            avatarColor: user.avatarColor,
            role: user.role
          }
        } : null;
      })
    );
    
    // Filter out null values (if any user wasn't found)
    res.json(assignedUsers.filter(Boolean));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deal assignments' });
  }
});

// Unassign a user from a deal
router.delete('/:dealId/assignments/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const userId = Number(req.params.userId);
    const currentUser = (req as any).user;
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Make sure user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check role-based permissions
    // Only admins and partners can unassign admins or partners
    // Everyone can unassign analysts and observers
    if ((user.role === 'admin' || user.role === 'partner') && 
        !(currentUser.role === 'admin' || currentUser.role === 'partner')) {
      return res.status(403).json({ 
        message: 'You do not have permission to unassign users with this role'
      });
    }
    
    // Users can unassign themselves regardless of role
    const isSelfUnassign = userId === currentUser.id;
    
    const success = await storage.unassignUserFromDeal(dealId, userId);
    if (!success) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Create a timeline event for the unassignment
    await storage.createTimelineEvent({
      dealId,
      eventType: 'note',
      content: isSelfUnassign 
        ? `${user.fullName} left the deal team` 
        : `${user.fullName} was removed from the deal team by ${currentUser.fullName}`,
      createdBy: currentUser.id,
      metadata: { unassignedUserId: [userId] }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unassign user from deal' });
  }
});

// Delete a deal
router.delete('/:id', requirePermission('delete', 'deal'), async (req: Request, res: Response) => {
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
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Delete the deal
    const success = await storage.deleteDeal(dealId);
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete deal' });
    }
    
    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete deal' });
  }
});

// Get mini memos for a deal
router.get('/:dealId/memos', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const memos = await storage.getMiniMemosByDeal(dealId);
    
    // Get user info for each memo
    const userIds = Array.from(new Set(memos.map(m => m.userId)));
    const users = await Promise.all(userIds.map(id => storage.getUser(id)));
    
    const memosWithUserInfo = memos.map(memo => {
      const user = users.find(u => u?.id === memo.userId);
      return {
        ...memo,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          initials: user.initials,
          avatarColor: user.avatarColor,
          role: user.role
        } : null
      };
    });
    
    res.json(memosWithUserInfo);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch mini memos' });
  }
});

// Create a mini memo for a deal
router.post('/:dealId/memos', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to create memos' });
    }
    
    const userId = user.id;
    
    const storage = getStorage();
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const memoData = insertMiniMemoSchema.parse({
      ...req.body,
      dealId,
      userId
    });
    
    const newMemo = await storage.createMiniMemo(memoData);
    
    // Return with user info
    const userInfo = await storage.getUser(userId);
    res.status(201).json({
      ...newMemo,
      user: userInfo ? {
        id: userInfo.id,
        fullName: userInfo.fullName,
        initials: userInfo.initials,
        avatarColor: userInfo.avatarColor,
        role: userInfo.role
      } : null
    });
  } catch (error) {
    console.error('Error creating mini memo:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid memo data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create mini memo' });
  }
});

// Update a mini memo - only allowed for the original creator
router.patch('/:dealId/memos/:memoId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const memoId = Number(req.params.memoId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to update memos' });
    }
    
    const userId = user.id;
    
    const storage = getStorage();
    // Make sure memo exists
    const memo = await storage.getMiniMemo(memoId);
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }
    
    // Security check: Only the original creator can update the memo
    if (memo.userId !== userId) {
      return res.status(403).json({ 
        message: 'You are not authorized to edit this memo. Only the creator can modify it.' 
      });
    }
    
    // Make sure dealId in route matches memo's dealId
    if (memo.dealId !== dealId) {
      return res.status(400).json({ message: 'Deal ID mismatch' });
    }
    
    const memoUpdate = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const updatedMemo = await storage.updateMiniMemo(memoId, memoUpdate);
    res.json(updatedMemo);
  } catch (error) {
    console.error('Error updating mini memo:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid memo data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update mini memo' });
  }
});

// Delete a mini memo - only allowed for the original creator
router.delete('/:dealId/memos/:memoId', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const memoId = Number(req.params.memoId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to delete memos' });
    }
    
    const userId = user.id;
    
    const storage = getStorage();
    // Make sure memo exists
    const memo = await storage.getMiniMemo(memoId);
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }
    
    // Security check: Only the original creator can delete the memo
    if (memo.userId !== userId) {
      return res.status(403).json({ 
        message: 'You are not authorized to delete this memo. Only the creator can delete it.' 
      });
    }
    
    // Make sure dealId in route matches memo's dealId
    if (memo.dealId !== dealId) {
      return res.status(400).json({ message: 'Deal ID mismatch' });
    }
    
    const success = await storage.deleteMiniMemo(memoId);
    if (success) {
      res.status(204).send();
    } else {
      res.status(500).json({ message: 'Failed to delete mini memo' });
    }
  } catch (error) {
    console.error('Error deleting mini memo:', error);
    res.status(500).json({ message: 'Failed to delete mini memo' });
  }
});

// Get comments for a memo
router.get('/:dealId/memos/:memoId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const memoId = Number(req.params.memoId);
    
    const storage = getStorage();
    const comments = await storage.getMemoComments(memoId);
    
    // Get user info for each comment
    const userIds = Array.from(new Set(comments.map(c => c.userId)));
    const users = await Promise.all(userIds.map(id => storage.getUser(id)));
    
    const commentsWithUserInfo = comments.map(comment => {
      const user = users.find(u => u?.id === comment.userId);
      return {
        ...comment,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          initials: user.initials,
          avatarColor: user.avatarColor,
          role: user.role
        } : null
      };
    });
    
    res.json(commentsWithUserInfo);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memo comments' });
  }
});

// Add a comment to a memo
router.post('/:dealId/memos/:memoId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.dealId);
    const memoId = Number(req.params.memoId);
    const user = (req as any).user;
    
    // User must be authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required to add comments' });
    }
    
    const userId = user.id;
    
    const storage = getStorage();
    // Make sure memo exists
    const memo = await storage.getMiniMemo(memoId);
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }
    
    const commentData = insertMemoCommentSchema.parse({
      ...req.body,
      dealId,
      memoId,
      userId
    });
    
    const newComment = await storage.createMemoComment(commentData);
    
    // Return with user info
    const userInfo = await storage.getUser(userId);
    res.status(201).json({
      ...newComment,
      user: userInfo ? {
        id: userInfo.id,
        fullName: userInfo.fullName,
        initials: userInfo.initials,
        avatarColor: userInfo.avatarColor,
        role: userInfo.role
      } : null
    });
  } catch (error) {
    console.error('Error creating memo comment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid comment data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create memo comment' });
  }
});

export default router;