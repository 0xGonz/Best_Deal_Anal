import { BaseService } from './BaseService';
import { Deal, InsertDeal, TimelineEvent, InsertTimelineEvent, deals, timelineEvents } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * Service for handling deal-related business logic
 */
export class DealService extends BaseService {
  /**
   * Create a new deal with initial timeline event
   */
  async createDeal(dealData: InsertDeal): Promise<Deal> {
    // Use executeWriteQuery to write to primary database and invalidate relevant caches
    return this.executeWriteQuery(
      async (db) => {
        const [deal] = await db.insert(deals).values([dealData]).returning();
        
        // Create an initial timeline event for deal creation
        const timelineEvent: InsertTimelineEvent = {
          dealId: deal.id,
          eventType: 'deal_creation', // Using valid event type
          content: `Deal created: ${deal.name}`,
          createdBy: deal.createdBy,
          metadata: { initialStage: deal.stage } as Record<string, any>
        };
        
        await db.insert(timelineEvents).values([timelineEvent]);
        
        return deal;
      },
      ['db:deal:list', 'db:deal:count', `db:deal:stage:${dealData.stage}`]
    );
  }
  
  /**
   * Get a deal by ID
   */
  async getDealById(id: number): Promise<Deal | undefined> {
    // Use executeReadQuery to leverage read replicas and caching
    return this.executeReadQuery(
      async (db) => {
        const [deal] = await db
          .select()
          .from(deals)
          .where(eq(deals.id, id));
        
        return deal || undefined;
      },
      'deal',
      'get',
      id
    );
  }
  
  /**
   * Get all deals
   */
  async getAllDeals(): Promise<Deal[]> {
    // Use executeReadQuery for efficient read operation
    return this.executeReadQuery(
      async (db) => {
        return db
          .select()
          .from(deals)
          .orderBy(desc(deals.createdAt));
      },
      'deal',
      'list'
    );
  }
  
  /**
   * Get deals by stage
   */
  async getDealsByStage(stage: Deal['stage']): Promise<Deal[]> {
    // Use executeReadQuery with stage parameter
    return this.executeReadQuery(
      async (db) => {
        return db
          .select()
          .from(deals)
          .where(eq(deals.stage, stage))
          .orderBy(desc(deals.createdAt));
      },
      'deal',
      'stage',
      stage,
      // Short TTL for stage-specific listings as they change frequently
      { stage },
      60
    );
  }
  
  /**
   * Update a deal, automatically creating a timeline event for stage changes
   */
  async updateDeal(id: number, dealUpdate: Partial<InsertDeal>): Promise<Deal | undefined> {
    // First get the current deal using read optimized query
    const currentDeal = await this.getDealById(id);
    if (!currentDeal) return undefined;
    
    // Handle stage changes and other business logic
    let stageCacheKeysToInvalidate: string[] = [];
    
    // Prepare for possible stage change
    if (dealUpdate.stage && dealUpdate.stage !== currentDeal.stage) {
      // Queue the stage change handling to be done within the transaction
      // Also track which stage cache keys need invalidation
      stageCacheKeysToInvalidate = [
        this.generateCacheKey('stage', currentDeal.stage),
        this.generateCacheKey('stage', dealUpdate.stage as string)
      ];
    }
    
    // Execute the write as a transaction with appropriate cache invalidation
    return this.executeWriteQuery(
      async (db) => {
        // Handle stage change if needed
        if (dealUpdate.stage && dealUpdate.stage !== currentDeal.stage) {
          await this.handleStageChange(db, currentDeal, dealUpdate);
        }
        
        // Update the deal with proper type handling
        // Create an update object that includes the updatedAt field
        const updateObj = {
          ...dealUpdate,
          updatedAt: new Date()
        };
        
        // Perform the update
        const [updatedDeal] = await db
          .update(deals)
          .set(updateObj)
          .where(eq(deals.id, id))
          .returning();
        
        return updatedDeal;
      },
      [
        // Invalidate deal-specific cache
        this.generateCacheKey('get', id),
        // Invalidate list caches
        this.generateCacheKey('list'),
        ...stageCacheKeysToInvalidate
      ]
    );
  }
  
  /**
   * Delete a deal
   */
  async deleteDeal(id: number): Promise<boolean> {
    return this.executeWriteQuery(
      async (db) => {
        // Get all allocations and delete them first
        await db
          .delete(deals)
          .where(eq(deals.id, id));
        
        // We don't have access to the result directly, so assume success
        return true;
      },
      [
        // Invalidate all affected caches
        this.generateCacheKey('get', id),
        this.generateCacheKey('list'),
        // Also invalidate stage caches - since we don't know which stage without querying,
        // we'll clear all deal-related caches
        ...this.cache.keys().filter(key => key.startsWith('db:deal:'))
      ]
    );
  }
  
  /**
   * Handle business logic for stage changes
   */
  private async handleStageChange(
    db: typeof this.primaryDB,
    currentDeal: Deal, 
    dealUpdate: Partial<InsertDeal>
  ): Promise<void> {
    // Create a timeline event for the stage change
    const timelineEvent: InsertTimelineEvent = {
      dealId: currentDeal.id,
      eventType: 'stage_change',
      content: `Deal moved from ${currentDeal.stage} to ${dealUpdate.stage}`,
      createdBy: dealUpdate.createdBy || currentDeal.createdBy,
      metadata: { 
        prevStage: currentDeal.stage, 
        newStage: dealUpdate.stage as string,
      } as Record<string, any>
    };
    
    await db.insert(timelineEvents).values(timelineEvent);
    
    // Handle specific business logic based on stage transitions
    if (dealUpdate.stage === 'rejected') {
      // Ensure rejection reason is provided
      if (!dealUpdate.rejectionReason) {
        throw new Error('Rejection reason is required when moving a deal to rejected stage');
      }
      
      // Set rejection date if not provided
      if (!dealUpdate.rejectedAt) {
        dealUpdate.rejectedAt = new Date();
      }
    }
    
    // If moving to invested stage, validate that there's at least one fund allocation
    if (dealUpdate.stage === 'invested') {
      const allocations = await this.storage.getAllocationsByDeal(currentDeal.id);
      if (allocations.length === 0) {
        throw new Error('Deal must have at least one fund allocation before moving to invested stage');
      }
    }
  }
}