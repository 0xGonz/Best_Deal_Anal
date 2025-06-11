import { IStorage, MemStorage } from './storage';
import { DatabaseStorage } from './database-storage';
import { db, pool } from './db';
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
  ClosingScheduleEvent, InsertClosingScheduleEvent
} from "@shared/schema";

/**
 * HybridStorage combines both database and memory storage
 * to ensure data persistence during database outages
 */
export class HybridStorage implements IStorage {
  // Storage implementations
  private dbStorage: DatabaseStorage;
  private memStorage: MemStorage;
  
  // Track the current state - made public for system health monitoring
  public usingDatabase: boolean = true;
  public pendingWrites: Map<string, any[]> = new Map();
  
  // Recovery tracking
  private lastDbCheck: number = 0;
  private dbCheckInterval: number = 10000; // 10 seconds
  public recoveryInProgress: boolean = false;
  
  constructor() {
    this.dbStorage = new DatabaseStorage();
    this.memStorage = new MemStorage();
  }
  
  /**
   * Switches to memory storage mode while tracking operations that need to be
   * replayed when the database becomes available again
   */
  private switchToMemoryMode(): void {
    if (this.usingDatabase) {
      console.log('HybridStorage: Switching to memory storage mode');
      this.usingDatabase = false;
      
      // Schedule periodic database recovery checks
      this.scheduleRecoveryCheck();
    }
  }
  
  /**
   * Schedules periodic checks to see if database is available again
   */
  private scheduleRecoveryCheck(): void {
    if (!this.recoveryInProgress) {
      this.checkDatabaseRecovery();
      
      setInterval(() => {
        this.checkDatabaseRecovery();
      }, this.dbCheckInterval);
      
      this.recoveryInProgress = true;
    }
  }
  
  /**
   * Checks if database has recovered and syncs any pending data
   */
  private async checkDatabaseRecovery(): Promise<void> {
    const now = Date.now();
    
    // Only check periodically to avoid excess load
    if (now - this.lastDbCheck < this.dbCheckInterval) {
      return;
    }
    
    this.lastDbCheck = now;
    
    // Skip if we're already using database storage
    if (this.usingDatabase) {
      return;
    }
    
    // Check if database is accessible
    try {
      await pool.query('SELECT 1');
      
      // Database is back - attempt to sync all pending writes
      console.log('HybridStorage: Database connection restored, syncing pending data...');
      await this.syncPendingWrites();
      
      // Switch back to database mode
      this.usingDatabase = true;
      console.log('HybridStorage: Switched back to database storage mode');
    } catch (error) {
      // Database still unavailable
      console.log('HybridStorage: Database recovery check failed, remaining in memory mode');
    }
  }
  
  /**
   * Syncs all pending writes to the database
   * This method is made public to allow manual synchronization
   */
  public async syncPendingWrites(): Promise<void> {
    // Process each operation type
    for (const [operationType, operations] of this.pendingWrites.entries()) {
      console.log(`HybridStorage: Syncing ${operations.length} ${operationType} operations`);
      
      try {
        // Handle each operation based on type
        switch (operationType) {
          case 'createUser':
            for (const args of operations) {
              await this.dbStorage.createUser(args[0]);
            }
            break;
          case 'createDeal':
            for (const args of operations) {
              await this.dbStorage.createDeal(args[0]);
            }
            break;
          case 'updateDeal':
            for (const args of operations) {
              await this.dbStorage.updateDeal(args[0], args[1]);
            }
            break;
          case 'createTimelineEvent':
            for (const args of operations) {
              await this.dbStorage.createTimelineEvent(args[0]);
            }
            break;
          case 'createDocument':
            for (const args of operations) {
              await this.dbStorage.createDocument(args[0]);
            }
            break;
          case 'createMiniMemo': 
            for (const args of operations) {
              await this.dbStorage.createMiniMemo(args[0]);
            }
            break;
          case 'createFund':
            for (const args of operations) {
              await this.dbStorage.createFund(args[0]);
            }
            break;
          case 'createFundAllocation':
            for (const args of operations) {
              await this.dbStorage.createFundAllocation(args[0]);
            }
            break;
          case 'createCapitalCall':
            for (const args of operations) {
              await this.dbStorage.createCapitalCall(args[0]);
            }
            break;
          // Add other operation types as needed
        }
        
        // Clear the processed operations
        this.pendingWrites.delete(operationType);
      } catch (error) {
        console.error(`HybridStorage: Failed to sync ${operationType} operations:`, error);
        // Keep the operations in the pending list for next attempt
      }
    }
  }
  
  /**
   * Records a pending operation for future database sync
   */
  private recordPendingWrite(operationType: string, args: any[]): void {
    if (!this.usingDatabase) {
      // Get or create the operations array for this type
      const operations = this.pendingWrites.get(operationType) || [];
      operations.push(args);
      this.pendingWrites.set(operationType, operations);
    }
  }
  
  /**
   * Generic method to handle operations with failover and sync
   */
  private async withFailover<T>(
    operationType: string,
    dbOperation: () => Promise<T>,
    memOperation: () => Promise<T>,
    args: any[] = []
  ): Promise<T> {
    // If we're already in memory mode, use memory storage directly
    if (!this.usingDatabase) {
      const result = await memOperation();
      this.recordPendingWrite(operationType, args);
      return result;
    }
    
    // Attempt database operation first
    try {
      return await dbOperation();
    } catch (error) {
      console.error(`HybridStorage: Database error during ${operationType}:`, error);
      
      // Switch to memory mode on database error
      this.switchToMemoryMode();
      
      // Execute operation on memory storage
      const result = await memOperation();
      this.recordPendingWrite(operationType, args);
      return result;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.withFailover<User | undefined>(
      'getUser',
      () => this.dbStorage.getUser(id),
      () => this.memStorage.getUser(id)
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withFailover<User | undefined>(
      'getUserByUsername',
      () => this.dbStorage.getUserByUsername(username),
      () => this.memStorage.getUserByUsername(username)
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.withFailover<User>(
      'createUser',
      () => this.dbStorage.createUser(user),
      () => this.memStorage.createUser(user),
      [user]
    );
  }

  async getUsers(): Promise<User[]> {
    return this.withFailover<User[]>(
      'getUsers',
      () => this.dbStorage.getUsers(),
      () => this.memStorage.getUsers()
    );
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    return this.withFailover<User | undefined>(
      'updateUser',
      () => this.dbStorage.updateUser(id, userUpdate),
      () => this.memStorage.updateUser(id, userUpdate),
      [id, userUpdate]
    );
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteUser',
      () => this.dbStorage.deleteUser(id),
      () => this.memStorage.deleteUser(id),
      [id]
    );
  }

  // Deal operations
  async createDeal(deal: any): Promise<any> {
    return this.withFailover(
      'createDeal',
      () => this.dbStorage.createDeal(deal),
      () => this.memStorage.createDeal(deal),
      [deal]
    );
  }

  async getDeal(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getDeal',
      () => this.dbStorage.getDeal(id),
      () => this.memStorage.getDeal(id)
    );
  }

  async getDeals(): Promise<any[]> {
    return this.withFailover(
      'getDeals',
      () => this.dbStorage.getDeals(),
      () => this.memStorage.getDeals()
    );
  }

  async getDealsByStage(stage: any): Promise<any[]> {
    return this.withFailover(
      'getDealsByStage',
      () => this.dbStorage.getDealsByStage(stage),
      () => this.memStorage.getDealsByStage(stage)
    );
  }

  async updateDeal(id: number, dealUpdate: any): Promise<any | undefined> {
    return this.withFailover(
      'updateDeal',
      () => this.dbStorage.updateDeal(id, dealUpdate),
      () => this.memStorage.updateDeal(id, dealUpdate),
      [id, dealUpdate]
    );
  }

  async deleteDeal(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteDeal',
      () => this.dbStorage.deleteDeal(id),
      () => this.memStorage.deleteDeal(id),
      [id]
    );
  }

  // Timeline events
  async createTimelineEvent(event: any): Promise<any> {
    return this.withFailover(
      'createTimelineEvent',
      () => this.dbStorage.createTimelineEvent(event),
      () => this.memStorage.createTimelineEvent(event),
      [event]
    );
  }

  async getTimelineEventsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getTimelineEventsByDeal',
      () => this.dbStorage.getTimelineEventsByDeal(dealId),
      () => this.memStorage.getTimelineEventsByDeal(dealId)
    );
  }

  async updateTimelineEvent(id: number, update: any): Promise<any | undefined> {
    return this.withFailover(
      'updateTimelineEvent',
      () => this.dbStorage.updateTimelineEvent(id, update),
      () => this.memStorage.updateTimelineEvent(id, update),
      [id, update]
    );
  }

  async deleteTimelineEvent(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteTimelineEvent',
      () => this.dbStorage.deleteTimelineEvent(id),
      () => this.memStorage.deleteTimelineEvent(id),
      [id]
    );
  }

  // Deal stars
  async starDeal(starData: any): Promise<any> {
    return this.withFailover(
      'starDeal',
      () => this.dbStorage.starDeal(starData),
      () => this.memStorage.starDeal(starData),
      [starData]
    );
  }

  async unstarDeal(dealId: number, userId: number): Promise<boolean> {
    return this.withFailover(
      'unstarDeal',
      () => this.dbStorage.unstarDeal(dealId, userId),
      () => this.memStorage.unstarDeal(dealId, userId),
      [dealId, userId]
    );
  }

  async getDealStars(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getDealStars',
      () => this.dbStorage.getDealStars(dealId),
      () => this.memStorage.getDealStars(dealId)
    );
  }

  async getUserStars(userId: number): Promise<any[]> {
    return this.withFailover(
      'getUserStars',
      () => this.dbStorage.getUserStars(userId),
      () => this.memStorage.getUserStars(userId)
    );
  }

  // Mini memos
  async createMiniMemo(memo: any): Promise<any> {
    return this.withFailover(
      'createMiniMemo',
      () => this.dbStorage.createMiniMemo(memo),
      () => this.memStorage.createMiniMemo(memo),
      [memo]
    );
  }

  async getMiniMemo(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getMiniMemo',
      () => this.dbStorage.getMiniMemo(id),
      () => this.memStorage.getMiniMemo(id)
    );
  }

  async getMiniMemosByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getMiniMemosByDeal',
      () => this.dbStorage.getMiniMemosByDeal(dealId),
      () => this.memStorage.getMiniMemosByDeal(dealId)
    );
  }

  async updateMiniMemo(id: number, memoUpdate: any): Promise<any | undefined> {
    return this.withFailover(
      'updateMiniMemo',
      () => this.dbStorage.updateMiniMemo(id, memoUpdate),
      () => this.memStorage.updateMiniMemo(id, memoUpdate),
      [id, memoUpdate]
    );
  }

  async deleteMiniMemo(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteMiniMemo',
      () => this.dbStorage.deleteMiniMemo(id),
      () => this.memStorage.deleteMiniMemo(id),
      [id]
    );
  }

  // Documents
  async createDocument(document: any): Promise<any> {
    return this.withFailover(
      'createDocument',
      () => this.dbStorage.createDocument(document),
      () => this.memStorage.createDocument(document),
      [document]
    );
  }

  async getDocument(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getDocument',
      () => this.dbStorage.getDocument(id),
      () => this.memStorage.getDocument(id)
    );
  }

  async getDocumentsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getDocumentsByDeal',
      () => this.dbStorage.getDocumentsByDeal(dealId),
      () => this.memStorage.getDocumentsByDeal(dealId)
    );
  }

  async getDocumentsByType(dealId: number, documentType: string): Promise<any[]> {
    return this.withFailover(
      'getDocumentsByType',
      () => this.dbStorage.getDocumentsByType(dealId, documentType),
      () => this.memStorage.getDocumentsByType(dealId, documentType)
    );
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteDocument',
      () => this.dbStorage.deleteDocument(id),
      () => this.memStorage.deleteDocument(id),
      [id]
    );
  }

  // Funds
  async createFund(fund: any): Promise<any> {
    return this.withFailover(
      'createFund',
      () => this.dbStorage.createFund(fund),
      () => this.memStorage.createFund(fund),
      [fund]
    );
  }

  async getFund(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getFund',
      () => this.dbStorage.getFund(id),
      () => this.memStorage.getFund(id)
    );
  }

  async getFunds(): Promise<any[]> {
    return this.withFailover(
      'getFunds',
      () => this.dbStorage.getFunds(),
      () => this.memStorage.getFunds()
    );
  }

  async updateFund(id: number, fundUpdate: any): Promise<any | undefined> {
    return this.withFailover(
      'updateFund',
      () => this.dbStorage.updateFund(id, fundUpdate),
      () => this.memStorage.updateFund(id, fundUpdate),
      [id, fundUpdate]
    );
  }

  async deleteFund(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteFund',
      () => this.dbStorage.deleteFund(id),
      () => this.memStorage.deleteFund(id),
      [id]
    );
  }

  // Fund allocations
  async createFundAllocation(allocation: any): Promise<any> {
    return this.withFailover(
      'createFundAllocation',
      () => this.dbStorage.createFundAllocation(allocation),
      () => this.memStorage.createFundAllocation(allocation),
      [allocation]
    );
  }

  async getAllocationsByFund(fundId: number): Promise<any[]> {
    return this.withFailover(
      'getAllocationsByFund',
      () => this.dbStorage.getAllocationsByFund(fundId),
      () => this.memStorage.getAllocationsByFund(fundId)
    );
  }

  async getAllocationsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getAllocationsByDeal',
      () => this.dbStorage.getAllocationsByDeal(dealId),
      () => this.memStorage.getAllocationsByDeal(dealId)
    );
  }

  async getAllocationsBatch(fundIds: number[]): Promise<any[]> {
    return this.withFailover(
      'getAllocationsBatch',
      () => this.dbStorage.getAllocationsBatch(fundIds),
      () => this.memStorage.getAllocationsBatch(fundIds)
    );
  }

  async getFundAllocation(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getFundAllocation',
      () => this.dbStorage.getFundAllocation(id),
      () => this.memStorage.getFundAllocation(id)
    );
  }

  async updateFundAllocation(id: number, allocationUpdate: any): Promise<any | undefined> {
    return this.withFailover(
      'updateFundAllocation',
      () => this.dbStorage.updateFundAllocation(id, allocationUpdate),
      () => this.memStorage.updateFundAllocation(id, allocationUpdate),
      [id, allocationUpdate]
    );
  }

  async deleteFundAllocation(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteFundAllocation',
      () => this.dbStorage.deleteFundAllocation(id),
      () => this.memStorage.deleteFundAllocation(id),
      [id]
    );
  }

  // Deal assignments
  async assignUserToDeal(assignment: any): Promise<any> {
    return this.withFailover(
      'assignUserToDeal',
      () => this.dbStorage.assignUserToDeal(assignment),
      () => this.memStorage.assignUserToDeal(assignment),
      [assignment]
    );
  }

  async getDealAssignments(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getDealAssignments',
      () => this.dbStorage.getDealAssignments(dealId),
      () => this.memStorage.getDealAssignments(dealId)
    );
  }

  async getUserAssignments(userId: number): Promise<any[]> {
    return this.withFailover(
      'getUserAssignments',
      () => this.dbStorage.getUserAssignments(userId),
      () => this.memStorage.getUserAssignments(userId)
    );
  }

  async unassignUserFromDeal(dealId: number, userId: number): Promise<boolean> {
    return this.withFailover(
      'unassignUserFromDeal',
      () => this.dbStorage.unassignUserFromDeal(dealId, userId),
      () => this.memStorage.unassignUserFromDeal(dealId, userId),
      [dealId, userId]
    );
  }

  // Notifications
  async createNotification(notification: any): Promise<any> {
    return this.withFailover(
      'createNotification',
      () => this.dbStorage.createNotification(notification),
      () => this.memStorage.createNotification(notification),
      [notification]
    );
  }

  async getUserNotifications(userId: number): Promise<any[]> {
    return this.withFailover(
      'getUserNotifications',
      () => this.dbStorage.getUserNotifications(userId),
      () => this.memStorage.getUserNotifications(userId)
    );
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return this.withFailover(
      'getUnreadNotificationsCount',
      () => this.dbStorage.getUnreadNotificationsCount(userId),
      () => this.memStorage.getUnreadNotificationsCount(userId)
    );
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    return this.withFailover(
      'markNotificationAsRead',
      () => this.dbStorage.markNotificationAsRead(id),
      () => this.memStorage.markNotificationAsRead(id),
      [id]
    );
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    return this.withFailover(
      'markAllNotificationsAsRead',
      () => this.dbStorage.markAllNotificationsAsRead(userId),
      () => this.memStorage.markAllNotificationsAsRead(userId),
      [userId]
    );
  }

  // Memo Comments
  async createMemoComment(comment: any): Promise<any> {
    return this.withFailover(
      'createMemoComment',
      () => this.dbStorage.createMemoComment(comment),
      () => this.memStorage.createMemoComment(comment),
      [comment]
    );
  }

  async getMemoComments(memoId: number): Promise<any[]> {
    return this.withFailover(
      'getMemoComments',
      () => this.dbStorage.getMemoComments(memoId),
      () => this.memStorage.getMemoComments(memoId)
    );
  }

  async getMemoCommentsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getMemoCommentsByDeal',
      () => this.dbStorage.getMemoCommentsByDeal(dealId),
      () => this.memStorage.getMemoCommentsByDeal(dealId)
    );
  }

  // Capital Calls
  async createCapitalCall(capitalCall: any): Promise<any> {
    return this.withFailover(
      'createCapitalCall',
      () => this.dbStorage.createCapitalCall(capitalCall),
      () => this.memStorage.createCapitalCall(capitalCall),
      [capitalCall]
    );
  }

  async getCapitalCall(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getCapitalCall',
      () => this.dbStorage.getCapitalCall(id),
      () => this.memStorage.getCapitalCall(id)
    );
  }

  async getAllCapitalCalls(): Promise<any[]> {
    return this.withFailover(
      'getAllCapitalCalls',
      () => this.dbStorage.getAllCapitalCalls(),
      () => this.memStorage.getAllCapitalCalls()
    );
  }

  async getCapitalCallsByAllocation(allocationId: number): Promise<any[]> {
    return this.withFailover(
      'getCapitalCallsByAllocation',
      () => this.dbStorage.getCapitalCallsByAllocation(allocationId),
      () => this.memStorage.getCapitalCallsByAllocation(allocationId)
    );
  }

  async getCapitalCallsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getCapitalCallsByDeal',
      () => this.dbStorage.getCapitalCallsByDeal(dealId),
      () => this.memStorage.getCapitalCallsByDeal(dealId)
    );
  }

  async updateCapitalCallStatus(id: number, status: any, paidAmount?: number): Promise<any | undefined> {
    return this.withFailover(
      'updateCapitalCallStatus',
      () => this.dbStorage.updateCapitalCallStatus(id, status, paidAmount),
      () => this.memStorage.updateCapitalCallStatus(id, status, paidAmount),
      [id, status, paidAmount]
    );
  }

  async updateCapitalCallDates(id: number, callDate: Date, dueDate: Date): Promise<any | undefined> {
    return this.withFailover(
      'updateCapitalCallDates',
      () => this.dbStorage.updateCapitalCallDates(id, callDate, dueDate),
      () => this.memStorage.updateCapitalCallDates(id, callDate, dueDate),
      [id, callDate, dueDate]
    );
  }

  // Closing Schedule Events
  async createClosingScheduleEvent(event: any): Promise<any> {
    return this.withFailover(
      'createClosingScheduleEvent',
      () => this.dbStorage.createClosingScheduleEvent(event),
      () => this.memStorage.createClosingScheduleEvent(event),
      [event]
    );
  }

  async getClosingScheduleEvent(id: number): Promise<any | undefined> {
    return this.withFailover(
      'getClosingScheduleEvent',
      () => this.dbStorage.getClosingScheduleEvent(id),
      () => this.memStorage.getClosingScheduleEvent(id)
    );
  }

  async getAllClosingScheduleEvents(): Promise<any[]> {
    return this.withFailover(
      'getAllClosingScheduleEvents',
      () => this.dbStorage.getAllClosingScheduleEvents(),
      () => this.memStorage.getAllClosingScheduleEvents()
    );
  }

  async getClosingScheduleEventsByDeal(dealId: number): Promise<any[]> {
    return this.withFailover(
      'getClosingScheduleEventsByDeal',
      () => this.dbStorage.getClosingScheduleEventsByDeal(dealId),
      () => this.memStorage.getClosingScheduleEventsByDeal(dealId)
    );
  }

  async updateClosingScheduleEventStatus(
    id: number, 
    status: any, 
    actualDate?: Date, 
    actualAmount?: number
  ): Promise<any | undefined> {
    return this.withFailover(
      'updateClosingScheduleEventStatus',
      () => this.dbStorage.updateClosingScheduleEventStatus(id, status, actualDate, actualAmount),
      () => this.memStorage.updateClosingScheduleEventStatus(id, status, actualDate, actualAmount),
      [id, status, actualDate, actualAmount]
    );
  }

  async updateClosingScheduleEventDate(id: number, scheduledDate: Date): Promise<any | undefined> {
    return this.withFailover(
      'updateClosingScheduleEventDate',
      () => this.dbStorage.updateClosingScheduleEventDate(id, scheduledDate),
      () => this.memStorage.updateClosingScheduleEventDate(id, scheduledDate),
      [id, scheduledDate]
    );
  }

  async deleteClosingScheduleEvent(id: number): Promise<boolean> {
    return this.withFailover(
      'deleteClosingScheduleEvent',
      () => this.dbStorage.deleteClosingScheduleEvent(id),
      () => this.memStorage.deleteClosingScheduleEvent(id),
      [id]
    );
  }
}