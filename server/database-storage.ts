import { db } from './db';
import { IStorage } from './storage';
import { StorageFactory } from './storage-factory';
import { eq, and, sql, inArray, asc, gte, lte } from 'drizzle-orm';
import { FundService } from './services/fund.service';
import {
  User, InsertUser,
  Deal, InsertDeal,
  TimelineEvent, InsertTimelineEvent,
  DealStar, InsertDealStar,
  MiniMemo, InsertMiniMemo,
  Document, InsertDocument,
  Fund, InsertFund,
  FundAllocation, InsertFundAllocation,
  DealAssignment, InsertDealAssignment,
  Notification, InsertNotification,
  CapitalCall, InsertCapitalCall,
  CapitalCallPayment, InsertCapitalCallPayment,
  MemoComment, InsertMemoComment,
  ClosingScheduleEvent, InsertClosingScheduleEvent,
  users, deals, timelineEvents, dealStars, miniMemos, documents,
  funds, fundAllocations, dealAssignments, notifications, capitalCalls, capitalCallPayments, memoComments, closingScheduleEvents, distributions
} from '@shared/schema';

/**
 * PostgreSQL database implementation of the storage interface
 */
export class DatabaseStorage implements IStorage {
  /**
   * Get the database client for direct SQL queries
   */
  getDbClient(): any {
    return db;
  }
  
  // User operations
  // Track database errors
  private dbErrors = 0;
  private static MAX_DB_ERRORS = 5;

  // Helper method to track errors
  private handleDbError(error: Error, operation: string): void {
    console.error(`Database error during ${operation}:`, error);
    this.dbErrors++;
    
    // If we've hit the max errors, emit a global error event
    if (this.dbErrors >= DatabaseStorage.MAX_DB_ERRORS) {
      console.log(`DatabaseStorage: Max errors (${this.dbErrors}) reached, database might be unavailable`);
      // We'll just log the error here rather than attempting to access StorageFactory
      // to avoid circular dependencies
      console.error(`DATABASE_CONNECTION_CRITICAL_FAILURE: ${error.message}`);
      this.dbErrors = 0; // Reset our counter
    }
    
    throw error;
  }

  async getUser(id: number): Promise<User | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      // Reset error count on successful operations
      this.dbErrors = 0;
      return user || undefined;
    } catch (error) {
      this.handleDbError(error as Error, 'getUser');
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      // Reset error count on successful operations
      this.dbErrors = 0;
      return user || undefined;
    } catch (error) {
      this.handleDbError(error as Error, 'getUserByUsername');
      return undefined;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return await db.select().from(users);
  }
  
  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userUpdate)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return !!result;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
  
  // Deal operations
  async createDeal(deal: InsertDeal): Promise<Deal> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      // Extract properties to ensure proper typing
      const dealData = {
        name: deal.name,
        createdBy: deal.createdBy,
        description: deal.description || null,
        notes: deal.notes || '',
        sector: deal.sector || null,
        stage: deal.stage || 'initial_review',
        contactEmail: deal.contactEmail || null,
        targetReturn: deal.targetReturn || null,
        projectedIrr: deal.projectedIrr || null,
        projectedMultiple: deal.projectedMultiple || null,
        score: deal.score || 0,
        tags: (deal.tags as string[]) || [],
        round: deal.round || null,
        targetRaise: deal.targetRaise || null,
        valuation: deal.valuation || null,
        leadInvestor: deal.leadInvestor || null
      };
      
      const [newDeal] = await db.insert(deals).values([dealData]).returning();
      return newDeal;
    } catch (error) {
      console.error('Error creating deal:', error);
      throw error;
    }
  }
  
  async getDeal(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }
  
  async getDeals(): Promise<Deal[]> {
    return await db.select().from(deals);
  }
  
  async getDealsByStage(stage: Deal['stage']): Promise<Deal[]> {
    return await db.select().from(deals).where(eq(deals.stage, stage));
  }
  
  async updateDeal(id: number, dealUpdate: Partial<InsertDeal>): Promise<Deal | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      // Ensure proper typing by creating a new object with only valid properties
      const validUpdateData: Record<string, any> = {};
      
      // Only add properties that exist in dealUpdate
      if (dealUpdate.name !== undefined) validUpdateData.name = dealUpdate.name;
      if (dealUpdate.description !== undefined) validUpdateData.description = dealUpdate.description;
      if (dealUpdate.notes !== undefined) validUpdateData.notes = dealUpdate.notes;
      if (dealUpdate.sector !== undefined) validUpdateData.sector = dealUpdate.sector;
      if (dealUpdate.stage !== undefined) validUpdateData.stage = dealUpdate.stage;
      if (dealUpdate.contactEmail !== undefined) validUpdateData.contactEmail = dealUpdate.contactEmail;
      if (dealUpdate.targetReturn !== undefined) validUpdateData.targetReturn = dealUpdate.targetReturn;
      if (dealUpdate.projectedIrr !== undefined) validUpdateData.projectedIrr = dealUpdate.projectedIrr;
      if (dealUpdate.projectedMultiple !== undefined) validUpdateData.projectedMultiple = dealUpdate.projectedMultiple;
      if (dealUpdate.score !== undefined) validUpdateData.score = dealUpdate.score;
      if (dealUpdate.tags !== undefined) validUpdateData.tags = dealUpdate.tags;
      if (dealUpdate.round !== undefined) validUpdateData.round = dealUpdate.round;
      if (dealUpdate.targetRaise !== undefined) validUpdateData.targetRaise = dealUpdate.targetRaise;
      if (dealUpdate.valuation !== undefined) validUpdateData.valuation = dealUpdate.valuation;
      if (dealUpdate.leadInvestor !== undefined) validUpdateData.leadInvestor = dealUpdate.leadInvestor;
      if (dealUpdate.rejectionReason !== undefined) validUpdateData.rejectionReason = dealUpdate.rejectionReason;
      if (dealUpdate.rejectedAt !== undefined) validUpdateData.rejectedAt = dealUpdate.rejectedAt;
      if (dealUpdate.createdBy !== undefined) validUpdateData.createdBy = dealUpdate.createdBy;
      
      // Only update if there are valid properties to update
      if (Object.keys(validUpdateData).length === 0) {
        const [existingDeal] = await db.select().from(deals).where(eq(deals.id, id));
        return existingDeal || undefined;
      }
      
      // Update with the valid data
      const [updatedDeal] = await db
        .update(deals)
        .set(validUpdateData)
        .where(eq(deals.id, id))
        .returning();
        
      return updatedDeal || undefined;
    } catch (error) {
      console.error('Error updating deal:', error);
      return undefined;
    }
  }
  
  async deleteDeal(id: number): Promise<boolean> {
    const result = await db.delete(deals).where(eq(deals.id, id));
    return !!result;
  }
  
  // Timeline events
  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      // Ensure we're not passing an array
      const [newEvent] = await db.insert(timelineEvents).values({
        dealId: event.dealId,
        eventType: event.eventType,
        content: event.content,
        createdBy: event.createdBy,
        metadata: event.metadata || {}
      }).returning();
      return newEvent;
    } catch (error) {
      console.error('Error creating timeline event:', error);
      throw error;
    }
  }
  
  async getTimelineEventsByDeal(dealId: number): Promise<TimelineEvent[]> {
    return await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.dealId, dealId));
  }

  async updateTimelineEvent(id: number, update: Partial<InsertTimelineEvent>): Promise<TimelineEvent | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      const [updatedEvent] = await db.update(timelineEvents)
        .set(update)
        .where(eq(timelineEvents.id, id))
        .returning();
      return updatedEvent;
    } catch (error) {
      console.error('Error updating timeline event:', error);
      return undefined;
    }
  }

  async deleteTimelineEvent(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      await db.delete(timelineEvents)
        .where(eq(timelineEvents.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      return false;
    }
  }
  
  // Deal stars
  async starDeal(starData: InsertDealStar): Promise<DealStar> {
    // Check if the user has already starred this deal
    const existingStars = await db
      .select()
      .from(dealStars)
      .where(
        and(
          eq(dealStars.dealId, starData.dealId),
          eq(dealStars.userId, starData.userId)
        )
      );
    
    // If the user has already starred this deal, return the existing star
    if (existingStars.length > 0) {
      return existingStars[0];
    }
    
    // Otherwise, create a new star
    const [star] = await db.insert(dealStars).values(starData).returning();
    return star;
  }
  
  async unstarDeal(dealId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(dealStars)
      .where(
        and(
          eq(dealStars.dealId, dealId),
          eq(dealStars.userId, userId)
        )
      );
    return !!result;
  }
  
  async getDealStars(dealId: number): Promise<DealStar[]> {
    return await db
      .select()
      .from(dealStars)
      .where(eq(dealStars.dealId, dealId));
  }
  
  async getUserStars(userId: number): Promise<DealStar[]> {
    return await db
      .select()
      .from(dealStars)
      .where(eq(dealStars.userId, userId));
  }
  
  // Mini memos
  async createMiniMemo(memo: InsertMiniMemo): Promise<MiniMemo> {
    const [newMemo] = await db.insert(miniMemos).values(memo).returning();
    
    // Create timeline event for the memo creation
    await this.createTimelineEvent({
      dealId: memo.dealId,
      eventType: 'memo_added',
      content: `Mini-Memo added`,
      createdBy: memo.userId,
      metadata: { memoId: newMemo.id } as Record<string, any>
    });
    
    return newMemo;
  }
  
  async getMiniMemo(id: number): Promise<MiniMemo | undefined> {
    const [memo] = await db.select().from(miniMemos).where(eq(miniMemos.id, id));
    return memo || undefined;
  }
  
  async getMiniMemosByDeal(dealId: number): Promise<MiniMemo[]> {
    return await db
      .select()
      .from(miniMemos)
      .where(eq(miniMemos.dealId, dealId));
  }
  
  async updateMiniMemo(id: number, memoUpdate: Partial<InsertMiniMemo>): Promise<MiniMemo | undefined> {
    const [updatedMemo] = await db
      .update(miniMemos)
      .set(memoUpdate)
      .where(eq(miniMemos.id, id))
      .returning();
    return updatedMemo || undefined;
  }
  
  async deleteMiniMemo(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      await db.delete(miniMemos).where(eq(miniMemos.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting mini memo:', error);
      return false;
    }
  }
  
  // Documents
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    console.log(`🔍 DatabaseStorage: Fetching document ${id}`);
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    console.log(`📄 DatabaseStorage: Raw document result:`, document);
    console.log(`🔑 DatabaseStorage: Document keys:`, Object.keys(document || {}));
    return document || undefined;
  }



  async updateDocument(id: number, documentUpdate: Partial<InsertDocument>): Promise<Document | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [updatedDocument] = await db
      .update(documents)
      .set(documentUpdate)
      .where(eq(documents.id, id))
      .returning();
      
    return updatedDocument || undefined;
  }
  
  async getDocumentsByDeal(dealId: number): Promise<Document[]> {
    const { DocumentService } = await import('./modules/documents/service');
    return await DocumentService.getDocumentsByDeal(dealId);
  }
  
  async getDocumentsByType(dealId: number, documentType: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.dealId, dealId),
          eq(documents.documentType, documentType as any)
        )
      );
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return !!result;
  }
  
  // Funds
  async createFund(fund: InsertFund): Promise<Fund> {
    const [newFund] = await db.insert(funds).values(fund).returning();
    return newFund;
  }
  
  async getFund(id: number): Promise<Fund | undefined> {
    const [fund] = await db.select().from(funds).where(eq(funds.id, id));
    return fund || undefined;
  }
  
  async getFunds(): Promise<Fund[]> {
    return await db.select().from(funds);
  }
  
  async updateFund(id: number, fundUpdate: Partial<InsertFund>): Promise<Fund | undefined> {
    const [updatedFund] = await db
      .update(funds)
      .set(fundUpdate)
      .where(eq(funds.id, id))
      .returning();
    return updatedFund || undefined;
  }
  
  async deleteFund(id: number): Promise<boolean> {
    try {
      await db.delete(funds).where(eq(funds.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting fund:', error);
      return false;
    }
  }
  
  // Fund allocations
  async createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Prepare allocation data with default values for optional fields
    const allocationData = {
      ...allocation,
      status: allocation.status || 'committed',
      notes: allocation.notes || null,
      allocationDate: allocation.allocationDate || new Date(),
      portfolioWeight: allocation.portfolioWeight || 0,
      interestPaid: allocation.interestPaid || 0,
      distributionPaid: allocation.distributionPaid || 0,
      totalReturned: allocation.totalReturned || 0,
      marketValue: allocation.marketValue || 0,
      moic: allocation.moic || 1,
      irr: allocation.irr || 0
    };
    
    const [newAllocation] = await db
      .insert(fundAllocations)
      .values(allocationData)
      .returning();
      
    // Use the FundService to update the fund AUM
    // This centralizes our AUM calculation logic
    const fundService = new FundService();
    await fundService.updateFundAUM(allocation.fundId);
      
    return newAllocation;
  }
  
  async getAllocationsByFund(fundId: number): Promise<FundAllocation[]> {
    return await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));
  }

  async getAllocationsBatch(fundIds: number[]): Promise<FundAllocation[]> {
    if (fundIds.length === 0) return [];
    return await db
      .select()
      .from(fundAllocations)
      .where(inArray(fundAllocations.fundId, fundIds));
  }
  
  async getAllocationsByDeal(dealId: number): Promise<FundAllocation[]> {
    return await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.dealId, dealId));
  }
  
  async deleteFundAllocation(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      // First get the allocation to be deleted
      const [allocation] = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.id, id));
      
      if (!allocation) {
        return false;
      }
      
      // Store the fund ID and deal ID before deleting the allocation
      const fundId = allocation.fundId;
      const dealId = allocation.dealId;
      
      // Delete the allocation
      await db.delete(fundAllocations)
        .where(eq(fundAllocations.id, id));
      
      // Use the FundService to recalculate and update the fund's AUM
      // This ensures consistent AUM calculation across the application
      const fundService = new FundService();
      await fundService.updateFundAUM(fundId);
      
      // Check if this was the last allocation for this deal
      const remainingAllocations = await this.getAllocationsByDeal(dealId);
      if (remainingAllocations.length === 0) {
        // Check the current deal stage
        const [deal] = await db
          .select()
          .from(deals)
          .where(eq(deals.id, dealId));
          
        if (deal && deal.stage === 'invested') {
          // Update the deal stage to 'closing' since there are no more allocations
          await db
            .update(deals)
            .set({ stage: 'closing' })
            .where(eq(deals.id, dealId));
            
          console.log(`[INFO] Deal ${dealId} (${deal.name}) automatically moved back to 'closing' stage after all allocations were removed`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting fund allocation:', error);
      return false;
    }
  }
  
  // Deal assignments
  async assignUserToDeal(assignment: InsertDealAssignment): Promise<DealAssignment> {
    const [newAssignment] = await db.insert(dealAssignments).values(assignment).returning();
    return newAssignment;
  }
  
  async getDealAssignments(dealId: number): Promise<DealAssignment[]> {
    return await db
      .select()
      .from(dealAssignments)
      .where(eq(dealAssignments.dealId, dealId));
  }
  
  async getUserAssignments(userId: number): Promise<DealAssignment[]> {
    return await db
      .select()
      .from(dealAssignments)
      .where(eq(dealAssignments.userId, userId));
  }
  
  async unassignUserFromDeal(dealId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(dealAssignments)
      .where(
        and(
          eq(dealAssignments.dealId, dealId),
          eq(dealAssignments.userId, userId)
        )
      );
    return !!result;
  }
  
  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }
  
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return unreadNotifications.length;
  }
  
  async markNotificationAsRead(id: number): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return !!result;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    return !!result;
  }
  
  // Memo Comments
  async createMemoComment(comment: InsertMemoComment): Promise<MemoComment> {
    const [newComment] = await db.insert(memoComments).values(comment).returning();
    return newComment;
  }
  
  async getMemoComments(memoId: number): Promise<MemoComment[]> {
    return await db
      .select()
      .from(memoComments)
      .where(eq(memoComments.memoId, memoId));
  }
  
  async getMemoCommentsByDeal(dealId: number): Promise<MemoComment[]> {
    return await db
      .select()
      .from(memoComments)
      .where(eq(memoComments.dealId, dealId));
  }
  
  // Capital Calls
  async createCapitalCall(capitalCall: InsertCapitalCall): Promise<CapitalCall> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [newCapitalCall] = await db.insert(capitalCalls).values(capitalCall).returning();
    return newCapitalCall;
  }
  
  async getCapitalCall(id: number): Promise<CapitalCall | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [capitalCall] = await db.select().from(capitalCalls).where(eq(capitalCalls.id, id));
    return capitalCall || undefined;
  }
  
  async getAllCapitalCalls(): Promise<CapitalCall[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Get all capital calls with allocation details
    const results = await db
      .select({
        capital_call: capitalCalls,
        allocation: fundAllocations,
        deal: deals,
        fund: funds
      })
      .from(capitalCalls)
      .leftJoin(fundAllocations, eq(capitalCalls.allocationId, fundAllocations.id))
      .leftJoin(deals, eq(fundAllocations.dealId, deals.id))
      .leftJoin(funds, eq(fundAllocations.fundId, funds.id));
      
    // Transform the results to include deal and fund names
    return results.map(result => ({
      ...result.capital_call,
      dealName: result.deal?.name || 'Unknown Deal',
      fundName: result.fund?.name || 'Unknown Fund'
    }));
  }
  
  async getFundAllocation(id: number): Promise<FundAllocation | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [allocation] = await db.select().from(fundAllocations).where(eq(fundAllocations.id, id));
    return allocation || undefined;
  }
  
  async updateFundAllocation(id: number, allocationUpdate: Partial<InsertFundAllocation>): Promise<FundAllocation | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      console.log(`Updating allocation ${id} with data:`, allocationUpdate);
      
      // Get the original allocation
      const [originalAllocation] = await db
        .select()
        .from(fundAllocations)
        .where(eq(fundAllocations.id, id));
      
      if (!originalAllocation) {
        console.error(`Allocation ${id} not found in database`);
        return undefined;
      }
      
      console.log(`Found original allocation:`, originalAllocation);
      
      // Update the allocation
      const [updatedAllocation] = await db
        .update(fundAllocations)
        .set(allocationUpdate)
        .where(eq(fundAllocations.id, id))
        .returning();
      
      if (!updatedAllocation) {
        console.error(`Failed to update allocation ${id}`);
        return undefined;
      }
      
      console.log(`Successfully updated allocation ${id}:`, updatedAllocation);
      
      // Note: AUM recalculation is handled separately to avoid circular dependencies
      console.log(`Allocation update completed for fund ${originalAllocation.fundId}`)
      
      return updatedAllocation;
    } catch (error) {
      console.error('Error updating fund allocation:', error);
      throw error; // Re-throw so the route can handle it properly
    }
  }
  
  async getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return await db
      .select()
      .from(capitalCalls)
      .where(eq(capitalCalls.allocationId, allocationId));
  }
  
  async getCapitalCallsByDeal(dealId: number): Promise<CapitalCall[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    // First get all allocations for the deal
    const allocations = await this.getAllocationsByDeal(dealId);
    if (!allocations.length) return [];
    
    // Then get all capital calls for those allocations
    const allocationIds = allocations.map(allocation => allocation.id);
    
    // We need to get capital calls where allocationId is in the list
    return await db
      .select()
      .from(capitalCalls)
      .where(inArray(capitalCalls.allocationId, allocationIds));
  }
  
  async updateCapitalCallStatus(id: number, status: CapitalCall['status'], paidAmount?: number): Promise<CapitalCall | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const updateData: any = { status };
    
    if (paidAmount !== undefined) {
      updateData.paidAmount = paidAmount;
    }
    
    if (status === 'paid') {
      updateData.paidDate = new Date();
    }
    
    const [updatedCapitalCall] = await db
      .update(capitalCalls)
      .set(updateData)
      .where(eq(capitalCalls.id, id))
      .returning();
      
    return updatedCapitalCall || undefined;
  }
  
  async updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<CapitalCall | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const updateData = {
      callDate,
      dueDate,
      updatedAt: new Date()
    };
    
    const [updatedCapitalCall] = await db
      .update(capitalCalls)
      .set(updateData)
      .where(eq(capitalCalls.id, id))
      .returning();
      
    return updatedCapitalCall || undefined;
  }

  async updateCapitalCall(id: number, updates: Partial<CapitalCall>): Promise<CapitalCall | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Ensure we update the timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [updatedCapitalCall] = await db
      .update(capitalCalls)
      .set(updateData)
      .where(eq(capitalCalls.id, id))
      .returning();
      
    return updatedCapitalCall || undefined;
  }
  
  async getCapitalCallsForCalendar(startDate: Date, endDate: Date): Promise<CapitalCall[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    return await db
      .select()
      .from(capitalCalls)
      .where(
        and(
          gte(capitalCalls.callDate, startDate),
          lte(capitalCalls.callDate, endDate)
        )
      );
  }
  
  // Capital Call Payments
  async createCapitalCallPayment(payment: InsertCapitalCallPayment): Promise<CapitalCallPayment> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [newPayment] = await db
      .insert(capitalCallPayments)
      .values(payment)
      .returning();
      
    return newPayment;
  }
  
  async getCapitalCallPayments(capitalCallId: number): Promise<CapitalCallPayment[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    return await db
      .select()
      .from(capitalCallPayments)
      .where(eq(capitalCallPayments.capitalCallId, capitalCallId))
      .orderBy(capitalCallPayments.paymentDate);
  }
  
  async getCapitalCallPayment(id: number): Promise<CapitalCallPayment | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [payment] = await db
      .select()
      .from(capitalCallPayments)
      .where(eq(capitalCallPayments.id, id));
      
    return payment || undefined;
  }
  
  // Closing Schedule Events
  async createClosingScheduleEvent(event: InsertClosingScheduleEvent): Promise<ClosingScheduleEvent> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [newEvent] = await db
      .insert(closingScheduleEvents)
      .values(event)
      .returning();
    return newEvent;
  }
  
  async getClosingScheduleEvent(id: number): Promise<ClosingScheduleEvent | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [event] = await db
      .select()
      .from(closingScheduleEvents)
      .where(eq(closingScheduleEvents.id, id));
    return event || undefined;
  }
  
  async getAllClosingScheduleEvents(): Promise<ClosingScheduleEvent[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return await db
      .select()
      .from(closingScheduleEvents);
  }
  
  async getClosingScheduleEventsByDeal(dealId: number): Promise<ClosingScheduleEvent[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return await db
      .select()
      .from(closingScheduleEvents)
      .where(eq(closingScheduleEvents.dealId, dealId))
      .orderBy(asc(closingScheduleEvents.scheduledDate));
  }
  
  async updateClosingScheduleEventStatus(id: number, status: ClosingScheduleEvent['status'], actualDate?: Date, actualAmount?: number): Promise<ClosingScheduleEvent | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const updateData: any = { status };
    
    if (actualDate) {
      updateData.actualDate = actualDate;
    }
    
    if (actualAmount !== undefined) {
      updateData.actualAmount = actualAmount;
    }
    
    const [updatedEvent] = await db
      .update(closingScheduleEvents)
      .set(updateData)
      .where(eq(closingScheduleEvents.id, id))
      .returning();
      
    return updatedEvent || undefined;
  }
  
  async updateClosingScheduleEventDate(id: number, scheduledDate: Date): Promise<ClosingScheduleEvent | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const updateData = {
      scheduledDate,
      updatedAt: new Date()
    };
    
    const [updatedEvent] = await db
      .update(closingScheduleEvents)
      .set(updateData)
      .where(eq(closingScheduleEvents.id, id))
      .returning();
      
    return updatedEvent || undefined;
  }
  
  async deleteClosingScheduleEvent(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const result = await db
      .delete(closingScheduleEvents)
      .where(eq(closingScheduleEvents.id, id));
      
    return (result.rowCount || 0) > 0;
  }

  // Missing methods for deployment readiness
  async getDealStarsBatch(dealIds: number[]): Promise<DealStar[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    if (dealIds.length === 0) return [];
    
    return await db
      .select()
      .from(dealStars)
      .where(inArray(dealStars.dealId, dealIds));
  }

  async getMiniMemosBatch(dealIds: number[]): Promise<MiniMemo[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    if (dealIds.length === 0) return [];
    
    return await db
      .select()
      .from(miniMemos)
      .where(inArray(miniMemos.dealId, dealIds));
  }

  async createDistribution(distribution: any): Promise<any> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [newDistribution] = await db
      .insert(distributions)
      .values(distribution)
      .returning();
      
    return newDistribution;
  }

  async getDistribution(id: number): Promise<any | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [distribution] = await db
      .select()
      .from(distributions)
      .where(eq(distributions.id, id));
      
    return distribution || undefined;
  }

  async getDistributionsByAllocation(allocationId: number): Promise<any[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    return await db
      .select()
      .from(distributions)
      .where(eq(distributions.allocationId, allocationId));
  }

  async updateDistribution(id: number, distribution: any): Promise<any | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [updatedDistribution] = await db
      .update(distributions)
      .set({ ...distribution, updatedAt: new Date() })
      .where(eq(distributions.id, id))
      .returning();
      
    return updatedDistribution || undefined;
  }

  async deleteDistribution(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const result = await db
      .delete(distributions)
      .where(eq(distributions.id, id));
      
    return (result.rowCount || 0) > 0;
  }

  async recalculateAllocationMetrics(allocationId: number): Promise<void> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Get the allocation
      const [allocation] = await db.select().from(fundAllocations).where(eq(fundAllocations.id, allocationId));
      if (!allocation) return;
      
      // Get all distributions for this allocation
      const allocationDistributions = await db
        .select()
        .from(distributions)
        .where(eq(distributions.allocationId, allocationId));
      
      // Calculate total distributions received
      const totalDistributions = allocationDistributions.reduce((sum, dist) => {
        return sum + Number(dist.amount || 0);
      }, 0);
      
      // Get all capital calls for this allocation to calculate total called/paid
      const capitalCalls = await this.getCapitalCallsByAllocation(allocationId);
      const totalCalled = capitalCalls.reduce((sum, call) => sum + call.callAmount, 0);
      const totalPaid = capitalCalls.reduce((sum, call) => sum + (call.paidAmount || 0), 0);
      
      // Calculate MOIC if we have investment amount
      let moic = 1;
      if (totalPaid > 0) {
        moic = ((allocation.marketValue ?? 0) + totalDistributions) / totalPaid;
      }
      
      // Update allocation with calculated metrics
      await db
        .update(fundAllocations)
        .set({
          totalReturned: totalDistributions,
          distributionPaid: totalDistributions,
          moic: moic
        })
        .where(eq(fundAllocations.id, allocationId));
        
      console.log(`Updated metrics for allocation ${allocationId}: MOIC=${moic.toFixed(2)}, Distributions=$${totalDistributions.toLocaleString()}`);
    } catch (error) {
      console.error(`Error recalculating metrics for allocation ${allocationId}:`, error);
      throw error;
    }
  }
}
