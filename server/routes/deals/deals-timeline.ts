import { Router, Request, Response } from "express";
import { insertTimelineEventSchema } from "@shared/schema";
import { requireAuth } from "../../utils/auth";
import { requirePermission } from "../../utils/permissions";
import { StorageFactory } from "../../storage-factory";

const router = Router();

function getStorage() {
  return StorageFactory.getStorage();
}

// Get timeline events for a deal
router.get('/:id/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const storage = getStorage();
    
    const timelineEvents = await storage.getTimelineEventsByDeal(dealId);
    res.json(timelineEvents);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timeline events' });
  }
});

// Add a timeline event to a deal
router.post('/:id/timeline', requirePermission('edit', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'You must be logged in' });
    }
    
    const eventData = insertTimelineEventSchema.parse({
      ...req.body,
      dealId,
      createdBy: user.id
    });
    
    const storage = getStorage();
    const newEvent = await storage.createTimelineEvent(eventData);
    
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create timeline event' });
  }
});

export default router; 