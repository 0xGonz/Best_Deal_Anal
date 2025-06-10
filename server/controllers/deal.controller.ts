import { Request, Response } from "express";
import { z } from "zod";
import { 
  insertDealSchema, 
  insertTimelineEventSchema, 
  insertDealStarSchema,
  insertMiniMemoSchema,
  DealStageLabels
} from "@shared/schema";
import { StorageFactory } from '../storage-factory';

/**
 * Deal Controller - Handles HTTP requests and responses for deal resources
 */
export class DealController {
  private getStorage() {
    return StorageFactory.getStorage();
  }

  /**
   * Get all deals or filter by stage
   */
  async getDeals(req: Request, res: Response) {
    try {
      const storage = this.getStorage();
      let deals;
      
      if (req.query.stage) {
        deals = await storage.getDealsByStage(req.query.stage as any);
      } else {
        deals = await storage.getDeals();
      }
      
      res.json(deals);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch deals' });
    }
  }

  /**
   * Get a specific deal by ID with related data
   */
  async getDealById(req: Request, res: Response) {
    try {
      if (req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID format' });
      }
      
      const storage = this.getStorage();
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(deal);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch deal' });
    }
  }

  /**
   * Create a new deal
   */
  async createDeal(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const validatedData = insertDealSchema.parse(req.body);
      const storage = this.getStorage();
      
      const dealData = {
        ...validatedData,
        createdBy: user.id
      };
      
      const newDeal = await storage.createDeal(dealData);
      
      if (!newDeal || typeof newDeal.id !== 'number') {
        return res.status(500).json({ message: 'Failed to create deal with valid ID' });
      }
      
      res.status(201).json(newDeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to create deal' });
    }
  }

  /**
   * Update an existing deal
   */
  async updateDeal(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const dealUpdate = insertDealSchema.partial().parse(req.body);
      const storage = this.getStorage();
      
      const updatedDeal = await storage.updateDeal(dealId, dealUpdate);
      
      if (!updatedDeal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(updatedDeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to update deal' });
    }
  }

  /**
   * Delete a deal
   */
  async deleteDeal(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      const success = await storage.deleteDeal(dealId);
      
      if (!success) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete deal' });
    }
  }

  /**
   * Get timeline events for a deal
   */
  async getDealTimeline(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      const events = await storage.getTimelineEventsByDeal(dealId);
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch timeline events' });
    }
  }

  /**
   * Create a timeline event for a deal
   */
  async createTimelineEvent(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const eventData = insertTimelineEventSchema.parse({
        ...req.body,
        dealId,
        createdBy: user.id
      });

      const storage = this.getStorage();
      const newEvent = await storage.createTimelineEvent(eventData);
      
      res.status(201).json(newEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to create timeline event' });
    }
  }

  /**
   * Update a timeline event
   */
  async updateTimelineEvent(req: Request, res: Response) {
    try {
      const eventId = Number(req.params.eventId);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }

      const updateData = insertTimelineEventSchema.partial().parse(req.body);
      const storage = this.getStorage();
      
      const result = await storage.updateTimelineEvent(eventId, updateData);
      
      if (!result) {
        return res.status(404).json({ message: 'Timeline event not found' });
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to update timeline event' });
    }
  }

  /**
   * Delete a timeline event
   */
  async deleteTimelineEvent(req: Request, res: Response) {
    try {
      const eventId = Number(req.params.eventId);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }

      const storage = this.getStorage();
      const result = await storage.deleteTimelineEvent(eventId);
      
      if (!result) {
        return res.status(404).json({ message: 'Timeline event not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete timeline event' });
    }
  }

  /**
   * Get stars for a deal
   */
  async getDealStars(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      const stars = await storage.getDealStars(dealId);
      
      res.json(stars);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch deal stars' });
    }
  }

  /**
   * Toggle star status for a deal
   */
  async toggleDealStar(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      
      // Check if already starred
      const existingStars = await storage.getDealStars(dealId);
      const userStar = existingStars.find(star => star.userId === user.id);
      
      if (userStar) {
        // Unstar
        await storage.unstarDeal(dealId, user.id);
        res.json({ starred: false });
      } else {
        // Star
        await storage.starDeal({ dealId, userId: user.id });
        res.json({ starred: true });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to toggle deal star' });
    }
  }

  /**
   * Get mini memos for a deal
   */
  async getMiniMemos(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      const memos = await storage.getMiniMemosByDeal(dealId);
      
      res.json(memos);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch mini memos' });
    }
  }

  /**
   * Create a mini memo for a deal
   */
  async createMiniMemo(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const storage = this.getStorage();
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      const memoData = insertMiniMemoSchema.parse({
        ...req.body,
        dealId,
        authorId: user.id
      });

      const newMemo = await storage.createMiniMemo(memoData);
      
      res.status(201).json(newMemo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to create mini memo' });
    }
  }
}