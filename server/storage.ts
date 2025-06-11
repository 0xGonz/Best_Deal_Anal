import { 
  User, InsertUser, 
  Deal, InsertDeal, 
  TimelineEvent, InsertTimelineEvent,
  DealStar, InsertDealStar,
  MiniMemo, InsertMiniMemo,
  Fund, InsertFund,
  FundAllocation, InsertFundAllocation,
  DealAssignment, InsertDealAssignment,
  Notification, InsertNotification,
  Document, InsertDocument,
  MemoComment, InsertMemoComment,
  CapitalCall, InsertCapitalCall,
  CapitalCallPayment, InsertCapitalCallPayment,
  ClosingScheduleEvent, InsertClosingScheduleEvent
} from "@shared/schema";

// This file defines the storage interface and in-memory implementation
// For database storage, see database-storage.ts
// For factory pattern to choose storage type, see storage-factory.ts

// Interface for storage operations
export interface IStorage {
  // Get database client for direct SQL queries
  getDbClient(): any;
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;

  // Deal operations
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDeal(id: number): Promise<Deal | undefined>;
  getDeals(): Promise<Deal[]>;
  getDealsByStage(stage: Deal['stage']): Promise<Deal[]>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<boolean>;

  // Timeline events
  createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent>;
  getTimelineEventsByDeal(dealId: number): Promise<TimelineEvent[]>;
  updateTimelineEvent(id: number, update: Partial<InsertTimelineEvent>): Promise<TimelineEvent | undefined>;
  deleteTimelineEvent(id: number): Promise<boolean>;
  
  // Deal stars (leaderboard)
  starDeal(dealStar: InsertDealStar): Promise<DealStar>;
  unstarDeal(dealId: number, userId: number): Promise<boolean>;
  getDealStars(dealId: number): Promise<DealStar[]>;
  getDealStarsBatch(dealIds: number[]): Promise<DealStar[]>;
  getUserStars(userId: number): Promise<DealStar[]>;
  
  // Mini memos
  createMiniMemo(memo: InsertMiniMemo): Promise<MiniMemo>;
  getMiniMemo(id: number): Promise<MiniMemo | undefined>;
  getMiniMemosByDeal(dealId: number): Promise<MiniMemo[]>;
  getMiniMemosBatch(dealIds: number[]): Promise<MiniMemo[]>;
  updateMiniMemo(id: number, memo: Partial<InsertMiniMemo>): Promise<MiniMemo | undefined>;
  deleteMiniMemo(id: number): Promise<boolean>;
  
  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByDeal(dealId: number): Promise<Document[]>;
  getDocumentsByType(dealId: number, documentType: string): Promise<Document[]>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Funds
  createFund(fund: InsertFund): Promise<Fund>;
  getFund(id: number): Promise<Fund | undefined>;
  getFunds(): Promise<Fund[]>;
  updateFund(id: number, fund: Partial<InsertFund>): Promise<Fund | undefined>;
  deleteFund(id: number): Promise<boolean>;
  
  // Fund allocations
  createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation>;
  getAllocationsByFund(fundId: number): Promise<FundAllocation[]>;
  getAllocationsByDeal(dealId: number): Promise<FundAllocation[]>;
  getAllocationsBatch(fundIds: number[]): Promise<FundAllocation[]>;
  getFundAllocation(id: number): Promise<FundAllocation | undefined>;
  updateFundAllocation(id: number, allocation: Partial<InsertFundAllocation>): Promise<FundAllocation | undefined>;
  deleteFundAllocation(id: number): Promise<boolean>;
  
  // Capital Calls
  createCapitalCall(capitalCall: InsertCapitalCall): Promise<CapitalCall>;
  getCapitalCall(id: number): Promise<CapitalCall | undefined>;
  getAllCapitalCalls(): Promise<CapitalCall[]>;
  getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]>;
  getCapitalCallsByDeal(dealId: number): Promise<CapitalCall[]>;
  updateCapitalCall(id: number, updates: Partial<CapitalCall>): Promise<CapitalCall | undefined>;
  updateCapitalCallStatus(id: number, status: CapitalCall['status'], paidAmount?: number): Promise<CapitalCall | undefined>;
  updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<CapitalCall | undefined>;
  getCapitalCallsForCalendar(startDate: Date, endDate: Date): Promise<CapitalCall[]>;
  
  // Capital Call Payments
  createCapitalCallPayment(payment: InsertCapitalCallPayment): Promise<CapitalCallPayment>;
  getCapitalCallPayments(capitalCallId: number): Promise<CapitalCallPayment[]>;
  getCapitalCallPayment(id: number): Promise<CapitalCallPayment | undefined>;
  
  // Deal assignments
  assignUserToDeal(assignment: InsertDealAssignment): Promise<DealAssignment>;
  getDealAssignments(dealId: number): Promise<DealAssignment[]>;
  getUserAssignments(userId: number): Promise<DealAssignment[]>;
  unassignUserFromDeal(dealId: number, userId: number): Promise<boolean>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationAsRead(id: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  
  // Memo Comments
  createMemoComment(comment: InsertMemoComment): Promise<MemoComment>;
  getMemoComments(memoId: number): Promise<MemoComment[]>;
  getMemoCommentsByDeal(dealId: number): Promise<MemoComment[]>;
  
  // Closing Schedule Events
  createClosingScheduleEvent(event: InsertClosingScheduleEvent): Promise<ClosingScheduleEvent>;
  getClosingScheduleEvent(id: number): Promise<ClosingScheduleEvent | undefined>;
  getAllClosingScheduleEvents(): Promise<ClosingScheduleEvent[]>;
  getClosingScheduleEventsByDeal(dealId: number): Promise<ClosingScheduleEvent[]>;
  updateClosingScheduleEventStatus(id: number, status: ClosingScheduleEvent['status'], actualDate?: Date, actualAmount?: number): Promise<ClosingScheduleEvent | undefined>;
  updateClosingScheduleEventDate(id: number, scheduledDate: Date): Promise<ClosingScheduleEvent | undefined>;
  deleteClosingScheduleEvent(id: number): Promise<boolean>;

  // Distributions - Modular investment tracking
  createDistribution(distribution: any): Promise<any>;
  getDistribution(id: number): Promise<any | undefined>;
  getDistributionsByAllocation(allocationId: number): Promise<any[]>;
  updateDistribution(id: number, distribution: any): Promise<any | undefined>;
  deleteDistribution(id: number): Promise<boolean>;
  recalculateAllocationMetrics(allocationId: number): Promise<void>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private deals: Map<number, Deal>;
  private timelineEvents: Map<number, TimelineEvent>;
  private dealStars: Map<number, DealStar>;
  private miniMemos: Map<number, MiniMemo>;
  private documents: Map<number, Document>;
  private funds: Map<number, Fund>;
  private fundAllocations: Map<number, FundAllocation>;
  private dealAssignments: Map<number, DealAssignment>;
  private notifications: Map<number, Notification>;
  private memoComments: Map<number, MemoComment>;
  private capitalCalls: Map<number, CapitalCall>;
  private capitalCallPayments: Map<number, CapitalCallPayment>;
  private closingScheduleEvents: Map<number, ClosingScheduleEvent>;
  
  // Method to return the database client (or null for MemStorage)
  getDbClient(): any {
    console.warn('getDbClient called on MemStorage - no database available');
    return null;
  }
  
  private userIdCounter: number;
  private dealIdCounter: number;
  private eventIdCounter: number;
  private starIdCounter: number;
  private memoIdCounter: number;
  private documentIdCounter: number;
  private fundIdCounter: number;
  private allocationIdCounter: number;
  private assignmentIdCounter: number;
  private notificationIdCounter: number;
  private commentIdCounter: number;
  private capitalCallIdCounter: number;
  private capitalCallPaymentIdCounter: number;
  private closingEventIdCounter: number;

  constructor() {
    this.users = new Map();
    this.deals = new Map();
    this.timelineEvents = new Map();
    this.dealStars = new Map();
    this.miniMemos = new Map();
    this.documents = new Map();
    this.funds = new Map();
    this.fundAllocations = new Map();
    this.dealAssignments = new Map();
    this.notifications = new Map();
    this.memoComments = new Map();
    this.capitalCalls = new Map();
    this.capitalCallPayments = new Map();
    this.closingScheduleEvents = new Map();
    
    this.userIdCounter = 1;
    this.dealIdCounter = 1;
    this.eventIdCounter = 1;
    this.starIdCounter = 1;
    this.memoIdCounter = 1;
    this.documentIdCounter = 1;
    this.fundIdCounter = 1;
    this.allocationIdCounter = 1;
    this.assignmentIdCounter = 1;
    this.notificationIdCounter = 1;
    this.commentIdCounter = 1;
    this.capitalCallIdCounter = 1;
    this.capitalCallPaymentIdCounter = 1;
    this.closingEventIdCounter = 1;
  }


  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    // Ensure required fields have default values
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || 'analyst', // Default role if not provided
      avatarColor: insertUser.avatarColor || null
    };
    this.users.set(id, user);
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }
    
    const updatedUser = {
      ...existingUser,
      ...userUpdate,
    };
    
    this.users.set(id, updatedUser);
    
    // If timeline events exist with this user, update them automatically
    for (const [eventId, event] of this.timelineEvents.entries()) {
      if (event.createdBy === id) {
        // Just updating the timeline events is sufficient - no need to return them
        this.timelineEvents.set(eventId, {
          ...event
        });
      }
    }
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Deal operations
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const id = this.dealIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    // Ensure required fields have default values
    const newDeal: Deal = { 
      ...deal, 
      id, 
      createdAt, 
      updatedAt,
      description: deal.description || null,
      sector: deal.sector || null,
      notes: deal.notes || null,
      rejectionReason: deal.rejectionReason || null,
      rejectedAt: deal.rejectedAt || null,
      round: deal.round || null,
      targetRaise: deal.targetRaise || null,
      valuation: deal.valuation || null,
      leadInvestor: deal.leadInvestor || null,
      tags: deal.tags || []
    };
    
    this.deals.set(id, newDeal);
    
    // Create initial timeline event
    await this.createTimelineEvent({
      dealId: id,
      eventType: 'stage_change',
      content: `Deal created and set to ${deal.stage === 'initial_review' ? 'Initial Review' : 'Screening'}`,
      createdBy: deal.createdBy,
      metadata: { initialStage: deal.stage }
    });
    
    return newDeal;
  }
  
  async getDeal(id: number): Promise<Deal | undefined> {
    return this.deals.get(id);
  }
  
  async getDeals(): Promise<Deal[]> {
    return Array.from(this.deals.values());
  }
  
  async getDealsByStage(stage: Deal['stage']): Promise<Deal[]> {
    return Array.from(this.deals.values()).filter(deal => deal.stage === stage);
  }
  
  async updateDeal(id: number, dealUpdate: Partial<InsertDeal>): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal) return undefined;
    
    // If stage is changing, create a timeline event
    if (dealUpdate.stage && dealUpdate.stage !== deal.stage) {
      await this.createTimelineEvent({
        dealId: id,
        eventType: 'stage_change',
        content: `Deal moved from ${deal.stage} to ${dealUpdate.stage}`,
        createdBy: dealUpdate.createdBy || deal.createdBy,
        metadata: { prevStage: deal.stage, newStage: dealUpdate.stage }
      });
    }
    
    const updatedDeal: Deal = {
      ...deal,
      ...dealUpdate,
      updatedAt: new Date()
    };
    this.deals.set(id, updatedDeal);
    return updatedDeal;
  }
  
  async deleteDeal(id: number): Promise<boolean> {
    return this.deals.delete(id);
  }
  
  // Timeline events
  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    const id = this.eventIdCounter++;
    const createdAt = new Date();
    
    // Ensure required fields have default values
    const newEvent: TimelineEvent = { 
      ...event,
      id,
      createdAt,
      content: event.content || null,
      metadata: event.metadata || null
    };
    
    this.timelineEvents.set(id, newEvent);
    return newEvent;
  }
  
  async getTimelineEventsByDeal(dealId: number): Promise<TimelineEvent[]> {
    return Array.from(this.timelineEvents.values())
      .filter(event => event.dealId === dealId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async updateTimelineEvent(id: number, update: Partial<InsertTimelineEvent>): Promise<TimelineEvent | undefined> {
    const event = this.timelineEvents.get(id);
    if (!event) return undefined;
    
    const updatedEvent: TimelineEvent = {
      ...event,
      ...update
    };
    this.timelineEvents.set(id, updatedEvent);
    return updatedEvent;
  }
  
  async deleteTimelineEvent(id: number): Promise<boolean> {
    return this.timelineEvents.delete(id);
  }
  
  // Deal stars
  async starDeal(starData: InsertDealStar): Promise<DealStar> {
    // Check if already starred
    const existing = Array.from(this.dealStars.values()).find(
      star => star.dealId === starData.dealId && star.userId === starData.userId
    );
    
    if (existing) return existing;
    
    const id = this.starIdCounter++;
    const createdAt = new Date();
    const newStar: DealStar = { ...starData, id, createdAt };
    this.dealStars.set(id, newStar);
    
    // Create timeline event
    await this.createTimelineEvent({
      dealId: starData.dealId,
      eventType: 'star_added',
      content: `Deal starred by user ${starData.userId}`,
      createdBy: starData.userId,
      metadata: { starId: id }
    });
    
    return newStar;
  }
  
  async unstarDeal(dealId: number, userId: number): Promise<boolean> {
    const star = Array.from(this.dealStars.values()).find(
      s => s.dealId === dealId && s.userId === userId
    );
    
    if (!star) return false;
    return this.dealStars.delete(star.id);
  }
  
  async getDealStars(dealId: number): Promise<DealStar[]> {
    return Array.from(this.dealStars.values()).filter(star => star.dealId === dealId);
  }
  
  async getUserStars(userId: number): Promise<DealStar[]> {
    return Array.from(this.dealStars.values()).filter(star => star.userId === userId);
  }
  
  // Mini memos
  async createMiniMemo(memo: InsertMiniMemo): Promise<MiniMemo> {
    const id = this.memoIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    // Ensure all required fields have default values
    const newMemo: MiniMemo = { 
      ...memo, 
      id, 
      createdAt, 
      updatedAt,
      score: memo.score || 0,  // Default score to 0 if not provided
      risksAndMitigations: memo.risksAndMitigations || null,
      pricingConsideration: memo.pricingConsideration || null,
      marketRiskScore: memo.marketRiskScore || 0,
      executionRiskScore: memo.executionRiskScore || 0,
      dueDiligenceChecklist: memo.dueDiligenceChecklist || null
    };
    
    this.miniMemos.set(id, newMemo);
    
    // Create timeline event
    await this.createTimelineEvent({
      dealId: memo.dealId,
      eventType: 'memo_added',
      content: `Mini-Memo added by user ${memo.userId}`,
      createdBy: memo.userId,
      metadata: { memoId: id }
    });
    
    return newMemo;
  }
  
  async getMiniMemo(id: number): Promise<MiniMemo | undefined> {
    return this.miniMemos.get(id);
  }
  
  async getMiniMemosByDeal(dealId: number): Promise<MiniMemo[]> {
    return Array.from(this.miniMemos.values()).filter(memo => memo.dealId === dealId);
  }
  
  async updateMiniMemo(id: number, memoUpdate: Partial<InsertMiniMemo>): Promise<MiniMemo | undefined> {
    const memo = this.miniMemos.get(id);
    if (!memo) return undefined;
    
    const updatedMemo: MiniMemo = {
      ...memo,
      ...memoUpdate,
      updatedAt: new Date()
    };
    this.miniMemos.set(id, updatedMemo);
    return updatedMemo;
  }
  
  async deleteMiniMemo(id: number): Promise<boolean> {
    const exists = this.miniMemos.has(id);
    if (exists) {
      const memo = this.miniMemos.get(id);
      this.miniMemos.delete(id);
      
      // Create timeline event for the deletion
      if (memo) {
        await this.createTimelineEvent({
          dealId: memo.dealId,
          eventType: 'memo_deleted',
          content: `Mini-Memo deleted by user ${memo.userId}`,
          createdBy: memo.userId,
          metadata: { memoId: id }
        });
      }
      
      return true;
    }
    return false;
  }
  
  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const uploadedAt = new Date();
    
    // Ensure required fields have default values
    const newDocument: Document = { 
      ...document, 
      id, 
      uploadedAt,
      description: document.description || null
    };
    
    this.documents.set(id, newDocument);
    
    // Create a timeline event for document upload
    await this.createTimelineEvent({
      dealId: document.dealId,
      eventType: 'document_upload',
      content: `New document uploaded: ${document.fileName}`,
      createdBy: document.uploadedBy,
      metadata: { documentId: id, documentType: document.documentType }
    });
    
    return newDocument;
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByDeal(dealId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.dealId === dealId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }
  
  async getDocumentsByType(dealId: number, documentType: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.dealId === dealId && doc.documentType === documentType)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }
  
  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) {
      return undefined;
    }
    
    const updatedDocument: Document = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }
  
  // Funds
  async createFund(fund: InsertFund): Promise<Fund> {
    const id = this.fundIdCounter++;
    const createdAt = new Date();
    
    // Ensure required fields have default values
    const newFund: Fund = { 
      ...fund, 
      id, 
      createdAt,
      description: fund.description || null,
      aum: fund.aum || 0,
      vintage: fund.vintage || null,
      distributionRate: fund.distributionRate || null,
      appreciationRate: fund.appreciationRate || null
    };
    
    this.funds.set(id, newFund);
    return newFund;
  }
  
  async getFund(id: number): Promise<Fund | undefined> {
    return this.funds.get(id);
  }
  
  async getFunds(): Promise<Fund[]> {
    return Array.from(this.funds.values());
  }
  
  async updateFund(id: number, fundUpdate: Partial<InsertFund>): Promise<Fund | undefined> {
    const fund = this.funds.get(id);
    if (!fund) return undefined;
    
    const updatedFund: Fund = {
      ...fund,
      ...fundUpdate,
    };
    this.funds.set(id, updatedFund);
    return updatedFund;
  }
  
  async deleteFund(id: number): Promise<boolean> {
    // First check if the fund exists
    const fund = this.funds.get(id);
    if (!fund) return false;
    
    // Check if there are any allocations for this fund
    const allocations = await this.getAllocationsByFund(id);
    if (allocations.length > 0) {
      // We don't want to delete a fund with allocations
      return false;
    }
    
    // If no allocations, proceed with deletion
    return this.funds.delete(id);
  }
  
  // Fund allocations
  async createFundAllocation(allocation: InsertFundAllocation): Promise<FundAllocation> {
    const id = this.allocationIdCounter++;
    const allocationDate = new Date();
    
    // Ensure required fields have default values
    const newAllocation: FundAllocation = { 
      ...allocation, 
      id,
      status: allocation.status || 'committed',
      notes: allocation.notes || null,
      allocationDate: allocation.allocationDate || allocationDate,
      portfolioWeight: allocation.portfolioWeight || null,
      currentValue: allocation.currentValue || null,
      multiple: allocation.multiple || null,
      distributionAmount: allocation.distributionAmount || null,
      appreciationAmount: allocation.appreciationAmount || null,
      irr: allocation.irr || null
    };
    
    this.fundAllocations.set(id, newAllocation);
    
    // Update fund AUM, but only if the allocation is 'funded'
    // Only funded allocations should count towards AUM
    if (allocation.status === 'funded') {
      const fund = await this.getFund(allocation.fundId);
      if (fund) {
        await this.updateFund(fund.id, { aum: fund.aum + allocation.amount });
      }
    }
    
    return newAllocation;
  }
  
  async getAllocationsByFund(fundId: number): Promise<FundAllocation[]> {
    return Array.from(this.fundAllocations.values()).filter(alloc => alloc.fundId === fundId);
  }

  async getAllocationsBatch(fundIds: number[]): Promise<FundAllocation[]> {
    return Array.from(this.fundAllocations.values()).filter(alloc => fundIds.includes(alloc.fundId));
  }
  
  async getAllocationsByDeal(dealId: number): Promise<FundAllocation[]> {
    return Array.from(this.fundAllocations.values()).filter(alloc => alloc.dealId === dealId);
  }
  
  async deleteFundAllocation(id: number): Promise<boolean> {
    const allocation = this.fundAllocations.get(id);
    if (!allocation) return false;
    
    // If the allocation was funded, subtract its amount from the fund's AUM
    if (allocation.status === 'funded') {
      const fund = await this.getFund(allocation.fundId);
      if (fund) {
        await this.updateFund(fund.id, { aum: Math.max(0, fund.aum - allocation.amount) });
      }
    }
    
    this.fundAllocations.delete(id);
    return true;
  }
  
  // Deal assignments
  async assignUserToDeal(assignment: InsertDealAssignment): Promise<DealAssignment> {
    // Check if already assigned
    const existing = Array.from(this.dealAssignments.values()).find(
      a => a.dealId === assignment.dealId && a.userId === assignment.userId
    );
    
    if (existing) return existing;
    
    const id = this.assignmentIdCounter++;
    const createdAt = new Date();
    const newAssignment: DealAssignment = { ...assignment, id, createdAt };
    this.dealAssignments.set(id, newAssignment);
    return newAssignment;
  }
  
  async getDealAssignments(dealId: number): Promise<DealAssignment[]> {
    return Array.from(this.dealAssignments.values()).filter(a => a.dealId === dealId);
  }
  
  async getUserAssignments(userId: number): Promise<DealAssignment[]> {
    return Array.from(this.dealAssignments.values()).filter(a => a.userId === userId);
  }
  
  async unassignUserFromDeal(dealId: number, userId: number): Promise<boolean> {
    const assignment = Array.from(this.dealAssignments.values()).find(
      a => a.dealId === dealId && a.userId === userId
    );
    
    if (!assignment) return false;
    return this.dealAssignments.delete(assignment.id);
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const createdAt = new Date();
    
    // Ensure required fields have default values
    const newNotification: Notification = { 
      ...notification, 
      id, 
      createdAt,
      type: notification.type || 'system',
      relatedId: notification.relatedId || null,
      isRead: notification.isRead || null
    };
    
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && !notification.isRead)
      .length;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;
    
    notification.isRead = true;
    this.notifications.set(id, notification);
    return true;
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);
    
    userNotifications.forEach(notification => {
      notification.isRead = true;
      this.notifications.set(notification.id, notification);
    });
    
    return true;
  }
  
  // Memo Comments
  async createMemoComment(comment: InsertMemoComment): Promise<MemoComment> {
    const id = this.commentIdCounter++;
    const createdAt = new Date();
    const newComment: MemoComment = { ...comment, id, createdAt };
    this.memoComments.set(id, newComment);
    return newComment;
  }
  
  async getMemoComments(memoId: number): Promise<MemoComment[]> {
    return Array.from(this.memoComments.values())
      .filter(comment => comment.memoId === memoId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  async getMemoCommentsByDeal(dealId: number): Promise<MemoComment[]> {
    return Array.from(this.memoComments.values())
      .filter(comment => comment.dealId === dealId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Capital Calls implementation
  async createCapitalCall(capitalCall: InsertCapitalCall): Promise<CapitalCall> {
    const id = this.capitalCallIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const callDate = new Date();
    
    // Ensure required fields have default values
    const newCapitalCall: CapitalCall = { 
      ...capitalCall, 
      id, 
      createdAt, 
      updatedAt,
      status: capitalCall.status || 'scheduled',
      notes: capitalCall.notes || null,
      callDate: capitalCall.callDate || callDate,
      paidAmount: capitalCall.paidAmount || null,
      paidDate: capitalCall.paidDate || null
    };
    
    this.capitalCalls.set(id, newCapitalCall);
    return newCapitalCall;
  }

  async getCapitalCall(id: number): Promise<CapitalCall | undefined> {
    return this.capitalCalls.get(id);
  }

  async getAllCapitalCalls(): Promise<CapitalCall[]> {
    return Array.from(this.capitalCalls.values());
  }

  async getFundAllocation(id: number): Promise<FundAllocation | undefined> {
    return this.fundAllocations.get(id);
  }
  
  async updateFundAllocation(id: number, allocationUpdate: Partial<InsertFundAllocation>): Promise<FundAllocation | undefined> {
    const allocation = this.fundAllocations.get(id);
    if (!allocation) return undefined;
    
    // Store the original status to track changes
    const originalStatus = allocation.status;
    
    const updatedAllocation: FundAllocation = {
      ...allocation,
      ...allocationUpdate
    };
    
    this.fundAllocations.set(id, updatedAllocation);
    
    // If status has changed, update the fund's AUM accordingly
    if (allocationUpdate.status && allocationUpdate.status !== originalStatus) {
      const fund = await this.getFund(allocation.fundId);
      if (fund) {
        // If the allocation was not funded before but is now, add to AUM
        if (originalStatus !== 'funded' && allocationUpdate.status === 'funded') {
          await this.updateFund(fund.id, { aum: fund.aum + allocation.amount });
        }
        // If the allocation was funded before but is not anymore, subtract from AUM
        else if (originalStatus === 'funded' && allocationUpdate.status !== 'funded') {
          await this.updateFund(fund.id, { aum: Math.max(0, fund.aum - allocation.amount) });
        }
      }
    }
    
    return updatedAllocation;
  }

  async getCapitalCallsByAllocation(allocationId: number): Promise<CapitalCall[]> {
    return Array.from(this.capitalCalls.values())
      .filter(call => call.allocationId === allocationId)
      .sort((a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime());
  }

  async getCapitalCallsByDeal(dealId: number): Promise<CapitalCall[]> {
    // First get all allocations for the deal
    const allocations = await this.getAllocationsByDeal(dealId);
    if (!allocations.length) return [];
    
    // Then get all capital calls for those allocations
    const allocationIds = allocations.map(allocation => allocation.id);
    return Array.from(this.capitalCalls.values())
      .filter(call => allocationIds.includes(call.allocationId))
      .sort((a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime());
  }

  async updateCapitalCallStatus(id: number, status: CapitalCall['status'], paidAmount?: number): Promise<CapitalCall | undefined> {
    const capitalCall = this.capitalCalls.get(id);
    if (!capitalCall) return undefined;
    
    const updatedCapitalCall: CapitalCall = {
      ...capitalCall,
      status,
      updatedAt: new Date(),
      ...(paidAmount !== undefined && { paidAmount }),
      ...(status === 'paid' && { paidDate: new Date() })
    };
    
    this.capitalCalls.set(id, updatedCapitalCall);
    return updatedCapitalCall;
  }
  
  async updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<CapitalCall | undefined> {
    const capitalCall = this.capitalCalls.get(id);
    if (!capitalCall) return undefined;
    
    const updatedCapitalCall: CapitalCall = {
      ...capitalCall,
      callDate,
      dueDate,
      updatedAt: new Date()
    };
    
    this.capitalCalls.set(id, updatedCapitalCall);
    return updatedCapitalCall;
  }
  
  async updateCapitalCall(id: number, updates: Partial<CapitalCall>): Promise<CapitalCall | undefined> {
    const capitalCall = this.capitalCalls.get(id);
    if (!capitalCall) return undefined;
    
    const updatedCapitalCall: CapitalCall = {
      ...capitalCall,
      ...updates,
      updatedAt: new Date()
    };
    
    this.capitalCalls.set(id, updatedCapitalCall);
    return updatedCapitalCall;
  }
  
  async getCapitalCallsForCalendar(startDate: Date, endDate: Date): Promise<CapitalCall[]> {
    // Get all capital calls within the date range
    return Array.from(this.capitalCalls.values())
      .filter(call => {
        const callDate = new Date(call.callDate);
        return callDate >= startDate && callDate <= endDate;
      })
      .sort((a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime());
  }
  
  // Capital Call Payments
  async createCapitalCallPayment(payment: InsertCapitalCallPayment): Promise<CapitalCallPayment> {
    const id = this.capitalCallPaymentIdCounter++;
    const createdAt = new Date();
    
    const newPayment: CapitalCallPayment = {
      ...payment,
      id,
      createdAt
    };
    
    this.capitalCallPayments.set(id, newPayment);
    return newPayment;
  }
  
  async getCapitalCallPayments(capitalCallId: number): Promise<CapitalCallPayment[]> {
    return Array.from(this.capitalCallPayments.values())
      .filter(payment => payment.capitalCallId === capitalCallId)
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
  }
  
  async getCapitalCallPayment(id: number): Promise<CapitalCallPayment | undefined> {
    return this.capitalCallPayments.get(id);
  }
  
  // Closing Schedule Events
  async createClosingScheduleEvent(event: InsertClosingScheduleEvent): Promise<ClosingScheduleEvent> {
    const id = this.closingEventIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    // Ensure required fields have default values
    const newEvent: ClosingScheduleEvent = { 
      ...event, 
      id, 
      createdAt, 
      updatedAt,
      status: event.status || 'scheduled',
      notes: event.notes || null,
      actualAmount: event.actualAmount || null,
      actualDate: event.actualDate || null
    };
    
    this.closingScheduleEvents.set(id, newEvent);
    return newEvent;
  }
  
  async getClosingScheduleEvent(id: number): Promise<ClosingScheduleEvent | undefined> {
    return this.closingScheduleEvents.get(id);
  }
  
  async getAllClosingScheduleEvents(): Promise<ClosingScheduleEvent[]> {
    return Array.from(this.closingScheduleEvents.values());
  }
  
  async getClosingScheduleEventsByDeal(dealId: number): Promise<ClosingScheduleEvent[]> {
    return Array.from(this.closingScheduleEvents.values())
      .filter(event => event.dealId === dealId)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }
  
  async updateClosingScheduleEventStatus(id: number, status: ClosingScheduleEvent['status'], actualDate?: Date, actualAmount?: number): Promise<ClosingScheduleEvent | undefined> {
    const event = this.closingScheduleEvents.get(id);
    if (!event) return undefined;
    
    const updatedEvent: ClosingScheduleEvent = {
      ...event,
      status,
      updatedAt: new Date(),
      actualDate: actualDate || event.actualDate,
      actualAmount: actualAmount !== undefined ? actualAmount : event.actualAmount
    };
    
    this.closingScheduleEvents.set(id, updatedEvent);
    return updatedEvent;
  }
  
  async updateClosingScheduleEventDate(id: number, scheduledDate: Date): Promise<ClosingScheduleEvent | undefined> {
    const event = this.closingScheduleEvents.get(id);
    if (!event) return undefined;
    
    const updatedEvent: ClosingScheduleEvent = {
      ...event,
      scheduledDate,
      updatedAt: new Date()
    };
    
    this.closingScheduleEvents.set(id, updatedEvent);
    return updatedEvent;
  }
  
  async deleteClosingScheduleEvent(id: number): Promise<boolean> {
    const exists = this.closingScheduleEvents.has(id);
    if (exists) {
      this.closingScheduleEvents.delete(id);
    }
    return exists;
  }
}

// We're using MemStorage for now for development
// In production, you should use DatabaseStorage with PostgreSQL
// Export a storage instance for backward compatibility
// This will be replaced by the StorageFactory

// Uncomment to use database storage
// export const storage = new DatabaseStorage();
