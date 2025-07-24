import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../../utils/auth";
import { requirePermission } from "../../utils/permissions";
import { StorageFactory } from "../../storage-factory";

const router = Router();

function getStorage() {
  return StorageFactory.getStorage();
}

// Assign a user to a deal
router.post('/:id/assign', requirePermission('edit', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const storage = getStorage();
    
    // Check if deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if assignment already exists
    const existingAssignments = await storage.getDealAssignments(dealId);
    const alreadyAssigned = existingAssignments.some(assignment => assignment.userId === userId);
    
    if (alreadyAssigned) {
      return res.status(400).json({ message: 'User is already assigned to this deal' });
    }
    
    await storage.assignUserToDeal({
      dealId,
      userId
    });
    
    // Add timeline event
    const currentUser = (req as any).user;
    await storage.createTimelineEvent({
      dealId,
      eventType: 'note',
      content: `${currentUser?.fullName || 'System'} assigned ${user.fullName} to this deal`,
      createdBy: currentUser?.id || 1,
      metadata: { assignedUserId: userId }
    });
    
    res.json({ message: 'User assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign user to deal' });
  }
});

// Remove user assignment from a deal
router.delete('/:id/assign/:userId', requirePermission('edit', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const userId = Number(req.params.userId);
    
    const storage = getStorage();
    
    // Check if deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await storage.unassignUserFromDeal(dealId, userId);
    
    // Add timeline event
    const currentUser = (req as any).user;
    await storage.createTimelineEvent({
      dealId,
      eventType: 'note',
      content: `${currentUser?.fullName || 'System'} removed ${user.fullName} from this deal`,
      createdBy: currentUser?.id || 1,
      metadata: { unassignedUserId: userId }
    });
    
    res.json({ message: 'User unassigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unassign user from deal' });
  }
});

// Get all assignments for a deal
router.get('/:id/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const storage = getStorage();
    
    const assignments = await storage.getDealAssignments(dealId);
    const users = await storage.getUsers();
    
    const assignedUsers = assignments.map(assignment => {
      const user = users.find(u => u.id === assignment.userId);
      return user ? {
        id: user.id,
        fullName: user.fullName,
        initials: user.initials,
        avatarColor: user.avatarColor,
        role: user.role
      } : null;
    }).filter(Boolean);
    
    res.json(assignedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deal assignments' });
  }
});

export default router; 