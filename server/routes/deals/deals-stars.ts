import { Router, Request, Response } from "express";
import { requireAuth } from "../../utils/auth";
import { StorageFactory } from "../../storage-factory";

const router = Router();

function getStorage() {
  return StorageFactory.getStorage();
}

// Add/remove star for a deal
router.post('/:id/star', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'You must be logged in' });
    }
    
    const storage = getStorage();
    
    // Check if star already exists
    const existingStars = await storage.getDealStars(dealId);
    const existingStar = existingStars.find(star => star.userId === user.id);
    
    if (existingStar) {
      // Remove star
      await storage.deleteDealStar(dealId, user.id);
      res.json({ message: 'Star removed', starred: false });
    } else {
      // Add star
      await storage.createDealStar({
        dealId,
        userId: user.id
      });
      res.json({ message: 'Star added', starred: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle star' });
  }
});

// Get stars for a deal
router.get('/:id/stars', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const storage = getStorage();
    
    const stars = await storage.getDealStars(dealId);
    res.json(stars);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stars' });
  }
});

export default router; 