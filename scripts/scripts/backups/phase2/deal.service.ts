import { 
  Deal, 
  InsertDeal, 
  InsertTimelineEvent, 
  TimelineEvent, 
  DealStar,
  InsertDealStar,
  DealStageLabels
} from "@shared/schema";
import { IStorage } from "../storage";
import { StorageFactory } from "../storage-factory";

/**
 * Helper function to get a fresh storage instance
 */
function getStorage(): IStorage {
  return StorageFactory.getStorage();
}

interface TimelineEventUpdateData {
  content?: string;
  metadata?: Record<string, any>;
}

interface ServiceResponse<T> {
  status: 'success' | 'not_found' | 'forbidden' | 'invalid' | 'unstarred';
  message?: string;
  data?: T;
}

interface User {
  id: number;
  fullName?: string;
  role?: string;
}

/**
 * Deal Service - Handles business logic for deals
 */
export class DealService {
  /**
   * Get all deals with extra information
   */
  async getAllDeals(): Promise<any[]> {
    const storage = getStorage();
    const deals = await storage.getDeals();
    
    // For each deal, get the assignments, stars, and mini memos
    const dealsWithExtras = await Promise.all(deals.map(async (deal) => {
      const assignments = await storage.getDealAssignments(deal.id);
      const stars = await storage.getDealStars(deal.id);
      const miniMemos = await storage.getMiniMemosByDeal(deal.id);
      
      // Calculate score from mini memos
      let score = 0;
      if (miniMemos.length > 0) {
        score = Math.floor(miniMemos.reduce((sum, memo) => sum + memo.score, 0) / miniMemos.length);
      }
      
      return {
        ...deal,
        stageLabel: DealStageLabels[deal.stage],
        assignedUsers: assignments.map(a => a.userId),
        starCount: stars.length,
        score
      };
    }));
    
    return dealsWithExtras;
  }

  /**
   * Get deals filtered by stage
   */
  async getDealsByStage(stage: string): Promise<any[]> {
    const storage = getStorage();
    const deals = await storage.getDealsByStage(stage as any);
    
    // For each deal, get the assignments, stars, and mini memos
    const dealsWithExtras = await Promise.all(deals.map(async (deal) => {
      const assignments = await storage.getDealAssignments(deal.id);
      const stars = await storage.getDealStars(deal.id);
      const miniMemos = await storage.getMiniMemosByDeal(deal.id);
      
      // Calculate score from mini memos
      let score = 0;
      if (miniMemos.length > 0) {
        score = Math.floor(miniMemos.reduce((sum, memo) => sum + memo.score, 0) / miniMemos.length);
      }
      
      return {
        ...deal,
        stageLabel: DealStageLabels[deal.stage],
        assignedUsers: assignments.map(a => a.userId),
        starCount: stars.length,
        score
      };
    }));
    
    return dealsWithExtras;
  }

  /**
   * Get a deal by ID with all its related data
   */
  async getDealWithRelations(dealId: number): Promise<any | null> {
    const storage = getStorage();
    const deal = await storage.getDeal(dealId);
    
    if (!deal) {
      return null;
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
    
    return {
      ...deal,
      stageLabel: DealStageLabels[deal.stage],
      assignedUsers,
      starCount: stars.length,
      timelineEvents,
      miniMemos,
      allocations,
      score
    };
  }

  /**
   * Create a new deal with initial assignments and timeline event
   */
  async createDeal(dealData: InsertDeal, user: User): Promise<Deal> {
    const storage = getStorage();
    
    // Create the deal
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
      content: `${user.fullName || 'User'} created this deal`,
      createdBy: user.id,
      metadata: {}
    });
    
    return newDeal;
  }

  /**
   * Update a deal, handling stage changes appropriately
   */
  async updateDeal(dealId: number, dealUpdate: Partial<InsertDeal>, user: User): Promise<Deal | null> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return null;
    }
    
    let finalUpdate = { ...dealUpdate };
    
    // Handle stage changes
    if (dealUpdate.stage && dealUpdate.stage !== deal.stage) {
      // If changing to rejected stage
      if (dealUpdate.stage === 'rejected') {
        // Add rejected timestamp
        finalUpdate = {
          ...finalUpdate,
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
        finalUpdate = {
          ...finalUpdate,
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
    
    const updatedDeal = await storage.updateDeal(dealId, finalUpdate);
    return updatedDeal || null;
  }

  /**
   * Delete a deal
   */
  async deleteDeal(dealId: number): Promise<boolean> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return false;
    }
    
    // Delete the deal
    const success = await storage.deleteDeal(dealId);
    return success;
  }

  /**
   * Get timeline events for a deal with user info
   */
  async getDealTimeline(dealId: number): Promise<any[] | null> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return null;
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
    
    return eventsWithUserInfo;
  }

  /**
   * Create a timeline event for a deal
   */
  async createTimelineEvent(dealId: number, eventData: InsertTimelineEvent, user: User): Promise<any | null> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return null;
    }
    
    const newEvent = await storage.createTimelineEvent(eventData);
    
    // Return with user info
    const userInfo = await storage.getUser(user.id);
    return {
      ...newEvent,
      user: userInfo ? {
        id: userInfo.id,
        fullName: userInfo.fullName,
        initials: userInfo.initials,
        avatarColor: userInfo.avatarColor,
        role: userInfo.role
      } : null
    };
  }

  /**
   * Update a timeline event, with proper validation
   */
  async updateTimelineEvent(
    dealId: number, 
    eventId: number, 
    updateData: TimelineEventUpdateData,
    user: User
  ): Promise<ServiceResponse<any>> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return { status: 'not_found', message: 'Deal not found' };
    }
    
    // Make sure event exists
    const events = await storage.getTimelineEventsByDeal(dealId);
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return { status: 'not_found', message: 'Timeline event not found' };
    }
    
    // Check if user is allowed to edit this event
    if (event.createdBy !== user.id && user.role !== 'admin') {
      return { status: 'forbidden', message: 'You do not have permission to edit this event' };
    }
    
    // Only allow editing content for notes
    if (event.eventType !== 'note') {
      return { status: 'invalid', message: 'Only note events can be edited' };
    }
    
    // Prepare update data
    const finalUpdateData: any = {
      content: updateData.content
    };
    
    // If metadata is provided, include it in the update
    if (updateData.metadata) {
      finalUpdateData.metadata = updateData.metadata;
    }
    
    const updatedEvent = await storage.updateTimelineEvent(eventId, finalUpdateData);
    
    // Return with user info
    const userInfo = await storage.getUser(event.createdBy);
    return { 
      status: 'success', 
      data: {
        ...updatedEvent,
        user: userInfo ? {
          id: userInfo.id,
          fullName: userInfo.fullName,
          initials: userInfo.initials,
          avatarColor: userInfo.avatarColor,
          role: userInfo.role
        } : null
      } 
    };
  }

  /**
   * Delete a timeline event, with proper validation
   */
  async deleteTimelineEvent(
    dealId: number, 
    eventId: number, 
    user: User
  ): Promise<ServiceResponse<void>> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return { status: 'not_found', message: 'Deal not found' };
    }
    
    // Make sure event exists
    const events = await storage.getTimelineEventsByDeal(dealId);
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return { status: 'not_found', message: 'Timeline event not found' };
    }
    
    // Check if user is allowed to delete this event
    if (event.createdBy !== user.id && user.role !== 'admin') {
      return { status: 'forbidden', message: 'You do not have permission to delete this event' };
    }
    
    // Only allow deleting notes
    if (event.eventType !== 'note') {
      return { status: 'invalid', message: 'Only note events can be deleted' };
    }
    
    const success = await storage.deleteTimelineEvent(eventId);
    
    return success 
      ? { status: 'success' }
      : { status: 'not_found', message: 'Failed to delete timeline event' };
  }

  /**
   * Get stars for a deal
   */
  async getDealStars(dealId: number): Promise<DealStar[] | null> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return null;
    }
    
    const stars = await storage.getDealStars(dealId);
    return stars;
  }

  /**
   * Toggle star status for a deal (star if not starred, unstar if already starred)
   */
  async toggleDealStar(dealId: number, userId: number): Promise<ServiceResponse<DealStar>> {
    const storage = getStorage();
    
    // Make sure deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return { status: 'not_found', message: 'Deal not found' };
    }
    
    // Check if user has already starred this deal
    const stars = await storage.getDealStars(dealId);
    const existingStar = stars.find(star => star.userId === userId);
    
    if (existingStar) {
      // If user has already starred, remove the star
      await storage.unstarDeal(dealId, userId);
      return { status: 'success', message: 'Deal unstarred successfully' };
    } else {
      // Otherwise, add a new star
      const starData: InsertDealStar = {
        dealId,
        userId
      };
      
      const star = await storage.starDeal(starData);
      return { status: 'success', data: star };
    }
  }

  /**
   * Get mini memos for a deal
   */
  async getMiniMemosByDeal(dealId: number): Promise<any[]> {
    const storage = getStorage();
    return storage.getMiniMemosByDeal(dealId);
  }

  /**
   * Create a mini memo
   */
  async createMiniMemo(memoData: any): Promise<any> {
    const storage = getStorage();
    return storage.createMiniMemo(memoData);
  }

  /**
   * Get user by ID for user info in responses
   */
  async getUserById(userId: number): Promise<any | undefined> {
    const storage = getStorage();
    return storage.getUser(userId);
  }
  
  /**
   * Get a deal by ID
   */
  async getDealById(dealId: number): Promise<any | null> {
    const storage = getStorage();
    return storage.getDeal(dealId);
  }
}

export const dealService = new DealService();