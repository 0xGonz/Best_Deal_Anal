import { Request, Response } from "express";
import { z } from "zod";
import { 
  insertDealSchema, 
  insertTimelineEventSchema, 
  insertDealStarSchema,
  insertMiniMemoSchema,
  DealStageLabels
} from "@shared/schema";
import { dealService } from "../services";

/**
 * Deal Controller - Handles HTTP requests and responses for deal resources
 */
export class DealController {
  /**
   * Get all deals or filter by stage
   */
  async getDeals(req: Request, res: Response) {
    try {
      let deals;
      
      if (req.query.stage) {
        deals = await dealService.getDealsByStage(req.query.stage as string);
      } else {
        deals = await dealService.getAllDeals();
      }
      
      res.json(deals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      res.status(500).json({ message: 'Failed to fetch deals' });
    }
  }

  /**
   * Get a specific deal by ID with related data
   */
  async getDealById(req: Request, res: Response) {
    try {
      // Check if the ID is valid
      if (req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID format' });
      }
      
      const deal = await dealService.getDealWithRelations(dealId);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(deal);
    } catch (error) {
      console.error('Error fetching deal by ID:', error);
      res.status(500).json({ message: 'Failed to fetch deal' });
    }
  }

  /**
   * Create a new deal
   */
  async createDeal(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check if user is authenticated
      if (!user) {
        return res.status(401).json({ message: 'You must be logged in to create a deal' });
      }
      
      // Validate input
      const dealData = insertDealSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      // Create the deal
      const newDeal = await dealService.createDeal(dealData, user);
      
      // Verify we have a valid deal object with ID before returning
      if (!newDeal || typeof newDeal.id !== 'number') {
        console.error('Deal created but missing valid ID:', newDeal);
        return res.status(500).json({ message: 'Failed to create deal with valid ID' });
      }
      
      // Log success for debugging
      console.log(`Created new deal ID ${newDeal.id} for user ${user.id} (${user.username})`);
      
      // Return the full deal object with ID to the client
      res.status(201).json(newDeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid deal data', errors: error.errors });
      }
      console.error('Error creating deal:', error);
      res.status(500).json({ message: 'Failed to create deal', error: String(error) });
    }
  }

  /**
   * Update an existing deal
   */
  async updateDeal(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.id);
      // Get user from request if available, or use a default system user ID if not
      const user = (req as any).user || { id: 1 }; // Default to admin user if no user in request
      
      // Validate the partial update data
      const updateSchema = insertDealSchema.partial();
      let dealUpdate = updateSchema.parse({
        ...req.body,
        // If stage is updated, record who changed it
        ...(req.body.stage && { createdBy: user.id })
      });
      
      // Update the deal
      const updatedDeal = await dealService.updateDeal(dealId, dealUpdate, user);
      
      if (!updatedDeal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(updatedDeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid deal data', errors: error.errors });
      }
      console.error('Error updating deal:', error);
      res.status(500).json({ message: 'Failed to update deal' });
    }
  }

  /**
   * Delete a deal
   */
  async deleteDeal(req: Request, res: Response) {
    try {
      // Check if the ID is valid
      if (req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const dealId = Number(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID format' });
      }
      
      const success = await dealService.deleteDeal(dealId);
      
      if (!success) {
        return res.status(404).json({ message: 'Deal not found or could not be deleted' });
      }
      
      res.json({ success: true, message: 'Deal deleted successfully' });
    } catch (error) {
      console.error('Error deleting deal:', error);
      res.status(500).json({ message: 'Failed to delete deal' });
    }
  }

  /**
   * Get timeline events for a deal
   */
  async getDealTimeline(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      
      const events = await dealService.getDealTimeline(dealId);
      
      if (events === null) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching timeline events:', error);
      res.status(500).json({ message: 'Failed to fetch timeline events' });
    }
  }

  /**
   * Create a timeline event for a deal
   */
  async createTimelineEvent(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Validate input
      const eventData = insertTimelineEventSchema.parse({
        ...req.body,
        dealId,
        createdBy: user.id
      });
      
      const newEvent = await dealService.createTimelineEvent(dealId, eventData, user);
      
      if (!newEvent) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.status(201).json(newEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid event data', errors: error.errors });
      }
      console.error('Error creating timeline event:', error);
      res.status(500).json({ message: 'Failed to create timeline event' });
    }
  }

  /**
   * Update a timeline event
   */
  async updateTimelineEvent(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      const eventId = Number(req.params.eventId);
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Prepare update data
      const updateData = {
        content: req.body.content,
        metadata: req.body.metadata
      };
      
      const result = await dealService.updateTimelineEvent(dealId, eventId, updateData, user);
      
      if (result.status === 'not_found') {
        return res.status(404).json({ message: result.message });
      }
      
      if (result.status === 'forbidden') {
        return res.status(403).json({ message: result.message });
      }
      
      if (result.status === 'invalid') {
        return res.status(400).json({ message: result.message });
      }
      
      res.json(result.data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid event data', errors: error.errors });
      }
      console.error('Error updating timeline event:', error);
      res.status(500).json({ message: 'Failed to update timeline event' });
    }
  }

  /**
   * Delete a timeline event
   */
  async deleteTimelineEvent(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      const eventId = Number(req.params.eventId);
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const result = await dealService.deleteTimelineEvent(dealId, eventId, user);
      
      if (result.status === 'not_found') {
        return res.status(404).json({ message: result.message });
      }
      
      if (result.status === 'forbidden') {
        return res.status(403).json({ message: result.message });
      }
      
      if (result.status === 'invalid') {
        return res.status(400).json({ message: result.message });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      res.status(500).json({ message: 'Failed to delete timeline event' });
    }
  }

  /**
   * Get stars for a deal
   */
  async getDealStars(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      
      const stars = await dealService.getDealStars(dealId);
      
      if (stars === null) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      res.json(stars);
    } catch (error) {
      console.error('Error fetching deal stars:', error);
      res.status(500).json({ message: 'Failed to fetch deal stars' });
    }
  }

  /**
   * Toggle star on a deal
   */
  async toggleDealStar(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      const user = (req as any).user;
      
      // User must be authenticated
      if (!user) {
        return res.status(401).json({ message: 'Authentication required to star deals' });
      }
      
      const result = await dealService.toggleDealStar(dealId, user.id);
      
      if (result.status === 'not_found') {
        return res.status(404).json({ message: result.message });
      }
      
      if (result.status === 'unstarred') {
        return res.json({ success: true, action: 'unstarred' });
      }
      
      return res.status(201).json({ ...result.data, action: 'starred' });
    } catch (error) {
      console.error('Error toggling deal star:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid star data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to toggle deal star' });
    }
  }

  /**
   * Get mini memos for a deal
   */
  async getDealMemos(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      
      // Verify deal exists
      const deal = await dealService.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      // Get all memos for this deal
      const memos = await dealService.getMiniMemosByDeal(dealId);
      
      // Fetch user details for each memo
      const userIds = Array.from(new Set(memos.map(m => m.userId)));
      const users = await Promise.all(userIds.map(id => dealService.getUserById(id)));
      
      // Attach user details to memos
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
      console.error('Error fetching mini memos:', error);
      res.status(500).json({ message: 'Failed to fetch mini memos' });
    }
  }

  /**
   * Create a mini memo for a deal
   */
  async createMiniMemo(req: Request, res: Response) {
    try {
      const dealId = Number(req.params.dealId);
      const user = (req as any).user;
      
      // User must be authenticated
      if (!user) {
        return res.status(401).json({ message: 'Authentication required to create memos' });
      }
      
      // Verify deal exists
      const deal = await dealService.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      // Validate and prepare memo data
      const memoData = insertMiniMemoSchema.parse({
        ...req.body,
        dealId,
        userId: user.id
      });
      
      // Create the memo
      const newMemo = await dealService.createMiniMemo(memoData);
      
      // Get user info to return with response
      const userInfo = await dealService.getUserById(user.id);
      
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
  }
}

export const dealController = new DealController();