// User types
export interface User {
  id: number;
  username: string;
  fullName: string;
  initials: string;
  email: string;
  role: "admin" | "partner" | "analyst" | "observer" | "intern";
  avatarColor: string;
}

// Deal types
// Deal star type
export interface DealStar {
  id: number;
  dealId: number;
  userId: number;
  createdAt: string;
}

export interface Deal {
  id: number;
  name: string;
  description: string;
  sector: string;
  stage: "initial_review" | "screening" | "diligence" | "ic_review" | "closing" | "closed" | "invested" | "rejected";
  stageLabel?: string; // Frontend computed property
  round: string | null;
  targetRaise?: string | null;
  valuation?: string | null;
  leadInvestor?: string | null;
  contactEmail?: string | null;
  targetReturn?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  tags: string[];
  // Investment details
  amount?: number | null; // Deal size
  ownershipPercentage?: number | null; // Ownership percentage
  companyStage?: string | null; // Stage of the target company
  investmentThesis?: string | null; // Investment thesis
  riskFactors?: string | null; // Risk factors
  projectedIrr?: number | null; // Projected IRR as percentage
  projectedMultiple?: number | null; // Projected return multiple
  // Frontend computed properties
  assignedUsers?: number[] | User[]; // Could be IDs or User objects depending on context
  starCount?: number; // Frontend computed from stars count
  score?: number; // Frontend computed from average memo scores
  miniMemos?: MiniMemo[]; // Frontend relationship
  allocations?: FundAllocation[]; // Frontend relationship
  timelineEvents?: TimelineEvent[]; // Frontend relationship
}

// Timeline event types
export interface TimelineEvent {
  id: number;
  dealId: number;
  eventType: "note" | "stage_change" | "document_upload" | "memo_added" | "star_added" | "ai_analysis" | "deal_creation" | "closing_scheduled";
  content: string;
  createdBy: number;
  createdAt: string;
  metadata: Record<string, any>;
  user?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string;
  };
}

// Mini memo types
export interface MiniMemo {
  id: number;
  dealId: number;
  userId: number;
  thesis: string;
  risksAndMitigations?: string | null;
  pricingConsideration?: string | null;
  score: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    initials: string;
    avatarColor: string;
    role: string;
  };
}

// Fund types
export interface Fund {
  id: number;
  name: string;
  description: string | null;
  aum: number;
  vintage?: number | null;
  createdAt: string;
  distributionRate: number;
  appreciationRate: number;
  // These fields are computed on the server
  calculatedAum?: number;
  committedCapital?: number;
  calledCapital?: number;
  uncalledCapital?: number;
  totalFundSize?: number;
  allocationCount?: number;
}

// Fund allocation types
export interface FundAllocation {
  id: number;
  fundId: number;
  dealId: number;
  amount: number;
  paidAmount: number;
  calledAmount?: number;
  amountType: "percentage" | "dollar" | "committed";
  securityType: string;
  allocationDate: string | Date;
  notes?: string | null;
  status: "committed" | "funded" | "unfunded" | "partially_paid";
  portfolioWeight: number;
  interestPaid: number;
  distributionPaid: number;
  totalReturned: number;
  marketValue: number;
  moic: number;
  irr: number;
  deal?: Deal; // Related deal object
  dealName?: string; // Deal name for display
  dealSector?: string; // Deal sector for display
  weight?: number; // Legacy field for compatibility
}

// Capital Call types
export interface CapitalCall {
  id: number;
  allocationId: number;
  callAmount: number;
  paidAmount?: number | null;
  callDate: string | Date;
  dueDate: string | Date;
  status: "scheduled" | "called" | "paid" | "overdue" | "partial" | "defaulted";
  notes?: string | null;
  created: string;
  paidDate?: Date | null;
  allocation?: FundAllocation; // Related allocation
}

// Allocation type for compatibility with CapitalCallsByAllocation
export interface Allocation {
  id: number;
  fundId: number;
  dealId: number;
  amount: number;
  paidAmount: number;
  calledAmount?: number;
  amountType: "percentage" | "dollar" | "committed";
  securityType: string;
  allocationDate: string | Date;
  notes?: string | null;
  status: "committed" | "funded" | "unfunded" | "partially_paid";
  portfolioWeight: number;
  interestPaid: number;
  distributionPaid: number;
  totalReturned: number;
  marketValue: number;
  moic: number;
  irr: number;
  deal?: Deal;
  dealName?: string;
  dealSector?: string;
}

// Dashboard stats
export interface DashboardStats {
  activeDeals: number;
  newDeals: number;
  inIcReview: number;
  totalAum: number;
  activeDealsTrend: number;
  newDealsTrend: number;
  icReviewTrend: number;
  aumTrend: number;
}

// Leaderboard item
export interface LeaderboardItem {
  id: number;
  name: string;
  stage: string;
  stageLabel: string;
  score: number;
  starCount: number;
  change: number;
  recentActivity?: number; // Number of recent timeline events (last 14 days)
}

// Document types
export interface Document {
  id: number;
  dealId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: number;
  uploadedAt: string;
  documentType: string;
  description?: string | null;
}

// Assignment types
export interface DealAssignment {
  id: number;
  dealId: number;
  userId: number;
  assignedAt: string;
  user?: User;
}

// Notification types
export interface Notification {
  id: number;
  userId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
  linkUrl?: string | null;
  metadata?: Record<string, any> | null;
}

// Closing schedule event types
export interface ClosingScheduleEvent {
  id: number;
  dealId: number;
  eventType: "custom" | "first_close" | "second_close" | "final_close" | "extension";
  scheduledDate: string | Date;
  actualDate?: string | Date | null;
  scheduledAmount: number | null;
  actualAmount?: number | null;
  status: "scheduled" | "completed" | "cancelled" | "pending";
  notes?: string | null;
  createdAt: string;
  createdBy: number;
}

// Memo comments
export interface MemoComment {
  id: number;
  memoId: number;
  userId: number;
  content: string;
  createdAt: string;
  user?: User;
}
