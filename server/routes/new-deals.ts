import { Router, Request, Response } from "express";
import { dealController } from "../controllers/deal.controller";
import { requireAuth } from "../utils/auth";
import { requirePermission } from "../utils/permissions";
import { z } from "zod";
import { insertMiniMemoSchema, insertDealAssignmentSchema } from "@shared/schema";
import { StorageFactory } from "../storage-factory";

const router = Router();

// Helper function to get a fresh storage instance in each request
function getStorage() {
  return StorageFactory.getStorage();
}

// Deal routes
router.get('/', requireAuth, dealController.getDeals.bind(dealController));
router.get('/:id', requireAuth, dealController.getDealById.bind(dealController));
router.post('/', requireAuth, requirePermission('create', 'deal'), dealController.createDeal.bind(dealController));
router.patch('/:id', requireAuth, requirePermission('edit', 'deal'), dealController.updateDeal.bind(dealController));
router.delete('/:id', requireAuth, requirePermission('delete', 'deal'), dealController.deleteDeal.bind(dealController));

// Timeline routes
router.get('/:dealId/timeline', requireAuth, dealController.getDealTimeline.bind(dealController));
router.post('/:dealId/timeline', requireAuth, dealController.createTimelineEvent.bind(dealController));
router.put('/:dealId/timeline/:eventId', requireAuth, dealController.updateTimelineEvent.bind(dealController));
router.delete('/:dealId/timeline/:eventId', requireAuth, dealController.deleteTimelineEvent.bind(dealController));

// Star routes
router.get('/:dealId/stars', requireAuth, dealController.getDealStars.bind(dealController));
router.post('/:dealId/star', requireAuth, dealController.toggleDealStar.bind(dealController));

// Mini Memo routes
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
    console.error("Error fetching mini memos:", error);
    res.status(500).json({ message: 'Failed to fetch mini memos' });
  }
});

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
    console.error('Error fetching deal assignments:', error);
    res.status(500).json({ message: 'Failed to fetch deal assignments' });
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
    console.error('Error assigning user to deal:', error);
    res.status(500).json({ message: 'Failed to assign user to deal' });
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
    console.error('Error unassigning user from deal:', error);
    res.status(500).json({ message: 'Failed to unassign user from deal' });
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

export default router;