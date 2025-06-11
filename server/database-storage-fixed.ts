import { db } from './db';
import { IStorage } from './storage';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
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
 * PostgreSQL database implementation with proper type safety
 */
export class DatabaseStorage implements IStorage {
  getDbClient(): any {
    return db;
  }

  private dbErrors = 0;
  private static MAX_DB_ERRORS = 5;

  private handleDbError(error: Error, operation: string): void {
    this.dbErrors++;
    console.error(`Database error in ${operation}:`, error);
    if (this.dbErrors >= DatabaseStorage.MAX_DB_ERRORS) {
      throw new Error(`Too many database errors. Last error: ${error.message}`);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      this.handleDbError(error as Error, 'getUser');
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      this.handleDbError(error as Error, 'getUserByUsername');
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(users);
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [user] = await db.update(users).set(userUpdate).where(eq(users.id, id)).returning();
      return user;
    } catch (error) {
      this.handleDbError(error as Error, 'updateUser');
      return undefined;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteUser');
      return false;
    }
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    if (!db) throw new Error('Database not initialized');
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getDeal(id: number): Promise<Deal | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [deal] = await db.select().from(deals).where(eq(deals.id, id));
      return deal;
    } catch (error) {
      this.handleDbError(error as Error, 'getDeal');
      return undefined;
    }
  }

  async getDeals(): Promise<Deal[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(deals);
  }

  async getDealsByStage(stage: Deal['stage']): Promise<Deal[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(deals).where(eq(deals.stage, stage));
  }

  async updateDeal(id: number, dealUpdate: Partial<InsertDeal>): Promise<Deal | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [deal] = await db.update(deals).set(dealUpdate).where(eq(deals.id, id)).returning();
      return deal;
    } catch (error) {
      this.handleDbError(error as Error, 'updateDeal');
      return undefined;
    }
  }

  async deleteDeal(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(deals).where(eq(deals.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteDeal');
      return false;
    }
  }

  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    if (!db) throw new Error('Database not initialized');
    const [timelineEvent] = await db.insert(timelineEvents).values(event).returning();
    return timelineEvent;
  }

  async getTimelineEventsByDeal(dealId: number): Promise<TimelineEvent[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(timelineEvents).where(eq(timelineEvents.dealId, dealId));
  }

  async updateTimelineEvent(id: number, update: Partial<InsertTimelineEvent>): Promise<TimelineEvent | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [event] = await db.update(timelineEvents).set(update).where(eq(timelineEvents.id, id)).returning();
      return event;
    } catch (error) {
      this.handleDbError(error as Error, 'updateTimelineEvent');
      return undefined;
    }
  }

  async deleteTimelineEvent(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(timelineEvents).where(eq(timelineEvents.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteTimelineEvent');
      return false;
    }
  }

  async starDeal(starData: InsertDealStar): Promise<DealStar> {
    if (!db) throw new Error('Database not initialized');
    const [star] = await db.insert(dealStars).values(starData).returning();
    return star;
  }

  async unstarDeal(dealId: number, userId: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(dealStars).where(and(eq(dealStars.dealId, dealId), eq(dealStars.userId, userId)));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'unstarDeal');
      return false;
    }
  }

  async getDealStars(dealId: number): Promise<DealStar[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(dealStars).where(eq(dealStars.dealId, dealId));
  }

  async getUserStars(userId: number): Promise<DealStar[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(dealStars).where(eq(dealStars.userId, userId));
  }

  async createMiniMemo(memo: InsertMiniMemo): Promise<MiniMemo> {
    if (!db) throw new Error('Database not initialized');
    const [miniMemo] = await db.insert(miniMemos).values(memo).returning();
    return miniMemo;
  }

  async getMiniMemo(id: number): Promise<MiniMemo | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [memo] = await db.select().from(miniMemos).where(eq(miniMemos.id, id));
      return memo;
    } catch (error) {
      this.handleDbError(error as Error, 'getMiniMemo');
      return undefined;
    }
  }

  async getMiniMemosByDeal(dealId: number): Promise<MiniMemo[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(miniMemos).where(eq(miniMemos.dealId, dealId));
  }

  async updateMiniMemo(id: number, memoUpdate: Partial<InsertMiniMemo>): Promise<MiniMemo | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [memo] = await db.update(miniMemos).set(memoUpdate).where(eq(miniMemos.id, id)).returning();
      return memo;
    } catch (error) {
      this.handleDbError(error as Error, 'updateMiniMemo');
      return undefined;
    }
  }

  async deleteMiniMemo(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(miniMemos).where(eq(miniMemos.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteMiniMemo');
      return false;
    }
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    if (!db) throw new Error('Database not initialized');
    const [doc] = await db.insert(documents).values(document).returning();
    return doc;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [doc] = await db.select().from(documents).where(eq(documents.id, id));
      return doc;
    } catch (error) {
      this.handleDbError(error as Error, 'getDocument');
      return undefined;
    }
  }

  async updateDocument(id: number, documentUpdate: Partial<InsertDocument>): Promise<Document | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [doc] = await db.update(documents).set(documentUpdate).where(eq(documents.id, id)).returning();
      return doc;
    } catch (error) {
      this.handleDbError(error as Error, 'updateDocument');
      return undefined;
    }
  }

  async getDocumentsByDeal(dealId: number): Promise<Document[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(documents).where(eq(documents.dealId, dealId));
  }

  async getDocumentsByType(dealId: number, documentType: string): Promise<Document[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(documents).where(and(eq(documents.dealId, dealId), eq(documents.documentType, documentType)));
  }

  async deleteDocument(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(documents).where(eq(documents.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteDocument');
      return false;
    }
  }

  async createFund(fund: InsertFund): Promise<Fund> {
    if (!db) throw new Error('Database not initialized');
    const [newFund] = await db.insert(funds).values(fund).returning();
    return newFund;
  }

  async getFund(id: number): Promise<Fund | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [fund] = await db.select().from(funds).where(eq(funds.id, id));
      return fund;
    } catch (error) {
      this.handleDbError(error as Error, 'getFund');
      return undefined;
    }
  }

  async getFunds(): Promise<Fund[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(funds);
  }

  async updateFund(id: number, fundUpdate: Partial<InsertFund>): Promise<Fund | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [fund] = await db.update(funds).set(fundUpdate).where(eq(funds.id, id)).returning();
      return fund;
    } catch (error) {
      this.handleDbError(error as Error, 'updateFund');
      return undefined;
    }
  }

  async deleteFund(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(funds).where(eq(funds.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteFund');
      return false;
    }
  }

  async createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation> {
    if (!db) throw new Error('Database not initialized');
    const [newAllocation] = await db.insert(fundAllocations).values(allocation).returning();
    return newAllocation;
  }

  async getAllocationsByFund(fundId: number): Promise<FundAllocation[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(fundAllocations).where(eq(fundAllocations.fundId, fundId));
  }

  async getAllocationsBatch(fundIds: number[]): Promise<FundAllocation[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(fundAllocations);
  }

  async getAllocationsByDeal(dealId: number): Promise<FundAllocation[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(fundAllocations).where(eq(fundAllocations.dealId, dealId));
  }

  async deleteFundAllocation(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(fundAllocations).where(eq(fundAllocations.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteFundAllocation');
      return false;
    }
  }

  async assignUserToDeal(assignment: InsertDealAssignment): Promise<DealAssignment> {
    if (!db) throw new Error('Database not initialized');
    const [newAssignment] = await db.insert(dealAssignments).values(assignment).returning();
    return newAssignment;
  }

  async getDealAssignments(dealId: number): Promise<DealAssignment[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(dealAssignments).where(eq(dealAssignments.dealId, dealId));
  }

  async getUserAssignments(userId: number): Promise<DealAssignment[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(dealAssignments).where(eq(dealAssignments.userId, userId));
  }

  async unassignUserFromDeal(dealId: number, userId: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(dealAssignments).where(and(eq(dealAssignments.dealId, dealId), eq(dealAssignments.userId, userId)));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'unassignUserFromDeal');
      return false;
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    if (!db) throw new Error('Database not initialized');
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    if (!db) throw new Error('Database not initialized');
    const result = await db.select({ count: sql`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'markNotificationAsRead');
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'markAllNotificationsAsRead');
      return false;
    }
  }

  async createMemoComment(comment: InsertMemoComment): Promise<MemoComment> {
    if (!db) throw new Error('Database not initialized');
    const [newComment] = await db.insert(memoComments).values(comment).returning();
    return newComment;
  }

  async getMemoComments(memoId: number): Promise<MemoComment[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(memoComments).where(eq(memoComments.memoId, memoId));
  }

  async getMemoCommentsByDeal(dealId: number): Promise<MemoComment[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(memoComments).where(eq(memoComments.dealId, dealId));
  }

  async createCapitalCall(capitalCall: InsertCapitalCall): Promise<CapitalCall> {
    if (!db) throw new Error('Database not initialized');
    const [newCall] = await db.insert(capitalCalls).values(capitalCall).returning();
    return newCall;
  }

  async getCapitalCall(id: number): Promise<CapitalCall | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [call] = await db.select().from(capitalCalls).where(eq(capitalCalls.id, id));
      return call;
    } catch (error) {
      this.handleDbError(error as Error, 'getCapitalCall');
      return undefined;
    }
  }

  async getAllCapitalCalls(): Promise<CapitalCall[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(capitalCalls);
  }

  async getFundAllocation(id: number): Promise<FundAllocation | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [allocation] = await db.select().from(fundAllocations).where(eq(fundAllocations.id, id));
      return allocation;
    } catch (error) {
      this.handleDbError(error as Error, 'getFundAllocation');
      return undefined;
    }
  }

  async updateFundAllocation(id: number, allocationUpdate: Partial<InsertFundAllocation>): Promise<FundAllocation | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [allocation] = await db.update(fundAllocations).set(allocationUpdate).where(eq(fundAllocations.id, id)).returning();
      return allocation;
    } catch (error) {
      this.handleDbError(error as Error, 'updateFundAllocation');
      return undefined;
    }
  }

  async getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(capitalCalls).where(eq(capitalCalls.allocationId, allocationId));
  }

  async getCapitalCallsByDeal(dealId: number): Promise<CapitalCall[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(capitalCalls);
  }

  async updateCapitalCallStatus(id: number, status: CapitalCall['status'], paidAmount?: number): Promise<CapitalCall | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const updateData: any = { status };
      if (paidAmount !== undefined) {
        updateData.paidAmount = paidAmount;
      }
      const [call] = await db.update(capitalCalls).set(updateData).where(eq(capitalCalls.id, id)).returning();
      return call;
    } catch (error) {
      this.handleDbError(error as Error, 'updateCapitalCallStatus');
      return undefined;
    }
  }

  async updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<CapitalCall | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [call] = await db.update(capitalCalls).set({ callDate, dueDate }).where(eq(capitalCalls.id, id)).returning();
      return call;
    } catch (error) {
      this.handleDbError(error as Error, 'updateCapitalCallDates');
      return undefined;
    }
  }

  async updateCapitalCall(id: number, updates: Partial<CapitalCall>): Promise<CapitalCall | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [call] = await db.update(capitalCalls).set(updates).where(eq(capitalCalls.id, id)).returning();
      return call;
    } catch (error) {
      this.handleDbError(error as Error, 'updateCapitalCall');
      return undefined;
    }
  }

  async getCapitalCallsForCalendar(startDate: Date, endDate: Date): Promise<CapitalCall[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(capitalCalls).where(and(gte(capitalCalls.dueDate, startDate), lte(capitalCalls.dueDate, endDate)));
  }

  async createCapitalCallPayment(payment: InsertCapitalCallPayment): Promise<CapitalCallPayment> {
    if (!db) throw new Error('Database not initialized');
    const [newPayment] = await db.insert(capitalCallPayments).values(payment).returning();
    return newPayment;
  }

  async getCapitalCallPayments(capitalCallId: number): Promise<CapitalCallPayment[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(capitalCallPayments).where(eq(capitalCallPayments.capitalCallId, capitalCallId));
  }

  async getCapitalCallPayment(id: number): Promise<CapitalCallPayment | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [payment] = await db.select().from(capitalCallPayments).where(eq(capitalCallPayments.id, id));
      return payment;
    } catch (error) {
      this.handleDbError(error as Error, 'getCapitalCallPayment');
      return undefined;
    }
  }

  async createClosingScheduleEvent(event: InsertClosingScheduleEvent): Promise<ClosingScheduleEvent> {
    if (!db) throw new Error('Database not initialized');
    const [newEvent] = await db.insert(closingScheduleEvents).values(event).returning();
    return newEvent;
  }

  async getClosingScheduleEvent(id: number): Promise<ClosingScheduleEvent | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [event] = await db.select().from(closingScheduleEvents).where(eq(closingScheduleEvents.id, id));
      return event;
    } catch (error) {
      this.handleDbError(error as Error, 'getClosingScheduleEvent');
      return undefined;
    }
  }

  async getAllClosingScheduleEvents(): Promise<ClosingScheduleEvent[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(closingScheduleEvents);
  }

  async getClosingScheduleEventsByDeal(dealId: number): Promise<ClosingScheduleEvent[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(closingScheduleEvents).where(eq(closingScheduleEvents.dealId, dealId));
  }

  async updateClosingScheduleEventStatus(id: number, status: ClosingScheduleEvent['status'], actualDate?: Date, actualAmount?: number): Promise<ClosingScheduleEvent | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const updateData: any = { status };
      if (actualDate !== undefined) {
        updateData.actualDate = actualDate;
      }
      if (actualAmount !== undefined) {
        updateData.actualAmount = actualAmount;
      }
      const [event] = await db.update(closingScheduleEvents).set(updateData).where(eq(closingScheduleEvents.id, id)).returning();
      return event;
    } catch (error) {
      this.handleDbError(error as Error, 'updateClosingScheduleEventStatus');
      return undefined;
    }
  }

  async updateClosingScheduleEventDate(id: number, scheduledDate: Date): Promise<ClosingScheduleEvent | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [event] = await db.update(closingScheduleEvents).set({ scheduledDate }).where(eq(closingScheduleEvents.id, id)).returning();
      return event;
    } catch (error) {
      this.handleDbError(error as Error, 'updateClosingScheduleEventDate');
      return undefined;
    }
  }

  async deleteClosingScheduleEvent(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(closingScheduleEvents).where(eq(closingScheduleEvents.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteClosingScheduleEvent');
      return false;
    }
  }

  async getDealStarsBatch(dealIds: number[]): Promise<DealStar[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(dealStars);
  }

  async getMiniMemosBatch(dealIds: number[]): Promise<MiniMemo[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(miniMemos);
  }

  async createDistribution(distribution: any): Promise<any> {
    if (!db) throw new Error('Database not initialized');
    const [newDistribution] = await db.insert(distributions).values(distribution).returning();
    return newDistribution;
  }

  async getDistribution(id: number): Promise<any | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [distribution] = await db.select().from(distributions).where(eq(distributions.id, id));
      return distribution;
    } catch (error) {
      this.handleDbError(error as Error, 'getDistribution');
      return undefined;
    }
  }

  async getDistributionsByAllocation(allocationId: number): Promise<any[]> {
    if (!db) throw new Error('Database not initialized');
    return await db.select().from(distributions).where(eq(distributions.allocationId, allocationId));
  }

  async updateDistribution(id: number, distribution: any): Promise<any | undefined> {
    try {
      if (!db) throw new Error('Database not initialized');
      const [updated] = await db.update(distributions).set(distribution).where(eq(distributions.id, id)).returning();
      return updated;
    } catch (error) {
      this.handleDbError(error as Error, 'updateDistribution');
      return undefined;
    }
  }

  async deleteDistribution(id: number): Promise<boolean> {
    try {
      if (!db) throw new Error('Database not initialized');
      await db.delete(distributions).where(eq(distributions.id, id));
      return true;
    } catch (error) {
      this.handleDbError(error as Error, 'deleteDistribution');
      return false;
    }
  }

  async recalculateAllocationMetrics(allocationId: number): Promise<void> {
    // Implementation for recalculating allocation metrics
    console.log(`Recalculating metrics for allocation ${allocationId}`);
  }
}