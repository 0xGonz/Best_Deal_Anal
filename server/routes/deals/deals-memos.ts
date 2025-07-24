import { Router, Request, Response } from "express";
import { insertMiniMemoSchema, insertMemoCommentSchema } from "@shared/schema";
import { requireAuth } from "../../utils/auth";
import { requirePermission } from "../../utils/permissions";
import { StorageFactory } from "../../storage-factory";

const router = Router();

function getStorage() {
  return StorageFactory.getStorage();
}

// Get memos for a deal
router.get('/:id/memos', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const storage = getStorage();
    
    const memos = await storage.getMiniMemosByDeal(dealId);
    res.json(memos);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memos' });
  }
});

// Create a memo for a deal
router.post('/:id/memos', requirePermission('create', 'deal'), async (req: Request, res: Response) => {
  try {
    const dealId = Number(req.params.id);
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'You must be logged in' });
    }
    
    const memoData = insertMiniMemoSchema.parse({
      ...req.body,
      dealId,
      authorId: user.id
    });
    
    const storage = getStorage();
    const newMemo = await storage.createMiniMemo(memoData);
    
    res.status(201).json(newMemo);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create memo' });
  }
});

export default router; 