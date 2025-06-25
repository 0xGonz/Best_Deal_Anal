import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  initials: text("initials").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin", "partner", "analyst", "observer", "intern"] }).notNull().default("analyst"),
  avatarColor: text("avatar_color").default("#0E4DA4"),
  lastActive: timestamp("last_active").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Deal model
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""), // Allow empty description
  sector: text("sector").default(""), // Allow empty sector
  stage: text("stage", { 
    enum: ["initial_review", "screening", "diligence", "ic_review", "closing", "closed", "invested", "rejected"]
  }).notNull().default("initial_review"),
  rejectionReason: text("rejection_reason"),
  rejectedAt: timestamp("rejected_at"),
  targetReturn: text("target_return"),
  score: integer("score"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  // Keeping the existing columns
  round: text("round"),
  targetRaise: text("target_raise"),
  valuation: text("valuation"),
  leadInvestor: text("lead_investor"),
  // Adding projected returns fields
  projectedIrr: text("projected_irr"),
  projectedMultiple: text("projected_multiple"),
  // Adding company stage field to track the company's funding/growth stage
  companyStage: text("company_stage"), // e.g., "Seed", "Series A", "Series B", etc.
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Documents - Investment documents (pitch decks, financial models, legal docs)
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  fileData: text("file_data"), // Store actual file content as base64 encoded binary data
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  description: text("description"),
  documentType: text("document_type", { 
    enum: ["pitch_deck", "financial_model", "legal_document", "diligence_report", "investor_report", "term_sheet", "cap_table", "subscription_agreement", "other"] 
  }).notNull().default("other"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  version: integer("version").notNull().default(1),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

// Timeline events for deals
export const timelineEvents = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  eventType: text("event_type", { 
    enum: ["note", "stage_change", "document_upload", "memo_added", "star_added", "ai_analysis", "deal_creation", "closing_scheduled", "capital_call", "capital_call_update"]
  }).notNull(),
  content: text("content"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({
  id: true,
  createdAt: true,
});

// Deal stars (for leaderboard)
export const dealStars = pgTable("deal_stars", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealStarSchema = createInsertSchema(dealStars).omit({
  id: true,
  createdAt: true,
});

// Mini memos (for deal evaluation)
export const miniMemos = pgTable("mini_memos", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  userId: integer("user_id").notNull(),
  thesis: text("thesis").notNull(),
  risksAndMitigations: text("risks_and_mitigations"),
  pricingConsideration: text("pricing_consideration"),
  score: integer("score").notNull().default(0),
  // New fields for enhanced evaluation
  marketRiskScore: integer("market_risk_score"), // 1-10 score for market risk
  executionRiskScore: integer("execution_risk_score"), // 1-10 score for execution risk
  teamStrengthScore: integer("team_strength_score"), // 1-10 score for team strength
  productFitScore: integer("product_fit_score"), // 1-10 score for product market fit
  valuationScore: integer("valuation_score"), // 1-10 score for valuation attractiveness
  competitiveAdvantageScore: integer("competitive_advantage_score"), // 1-10 score for competitive advantage
  dueDiligenceChecklist: jsonb("due_diligence_checklist").$type<Record<string, boolean>>().default({}), // Checklist for due diligence items
  // GP-LP Alignment tracking fields
  raiseAmount: numeric("raise_amount", { precision: 14, scale: 2 }), // Total raise amount
  gpCommitment: numeric("gp_commitment", { precision: 14, scale: 2 }), // GP's financial commitment
  gpAlignmentPercentage: real("gp_alignment_percentage"), // 0-100% calculated alignment
  alignmentScore: integer("alignment_score"), // 1-10 alignment score derived from percentage
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMiniMemoSchema = createInsertSchema(miniMemos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Comments for mini memos
export const memoComments = pgTable("memo_comments", {
  id: serial("id").primaryKey(),
  memoId: integer("memo_id").notNull(),
  dealId: integer("deal_id").notNull(), // To enable easier filtering by deal
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMemoCommentSchema = createInsertSchema(memoComments).omit({
  id: true,
  createdAt: true,
});

// Default due diligence checklist items
export const DEFAULT_DUE_DILIGENCE_CHECKLIST = {
  "financialReview": false,
  "legalReview": false,
  "marketAnalysis": false,
  "teamAssessment": false,
  "customerInterviews": false,
  "competitorAnalysis": false,
  "technologyReview": false,
  "businessModelValidation": false,
  "regulatoryCompliance": false,
  "esgAssessment": false
};

// Funds
export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  aum: real("aum").notNull().default(0), // Will be calculated dynamically based on funded allocations
  vintage: integer("vintage"), // The fund's vintage year
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Performance metrics
  distributionRate: real("distribution_rate").default(0.3),
  appreciationRate: real("appreciation_rate").default(0.88),
});

export const insertFundSchema = createInsertSchema(funds).omit({
  id: true,
  createdAt: true,
});

// Fund allocations (deals allocated to funds)
export const fundAllocations = pgTable("fund_allocations", {
  id: serial("id").primaryKey(),
  fundId: integer("fund_id").notNull(),
  dealId: integer("deal_id").notNull(),
  amount: real("amount").notNull(), // Committed amount
  paidAmount: real("paid_amount").default(0), // Actually paid amount
  amountType: text("amount_type", { enum: ["percentage", "dollar"] }).default("dollar"),
  securityType: text("security_type").notNull(),
  allocationDate: timestamp("allocation_date").notNull().defaultNow(),
  notes: text("notes"),
  // Investment tracking fields - consolidated status enum
  status: text("status", { enum: ["committed", "funded", "unfunded", "partially_paid", "written_off"] }).default("committed"),
  portfolioWeight: real("portfolio_weight").default(0),
  interestPaid: real("interest_paid").default(0),
  distributionPaid: real("distribution_paid").default(0),
  totalReturned: real("total_returned").default(0),
  marketValue: real("market_value").default(0),
  moic: real("moic").default(1),
  irr: real("irr").default(0),
});

export const insertFundAllocationSchema = createInsertSchema(fundAllocations)
  .omit({
    id: true,
  })
  .extend({
    // Convert ISO string dates to Date objects for Zod validation
    allocationDate: z.string().transform(val => new Date(val)),
    // Handle firstCallDate if it exists in any capital call data
    firstCallDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    // Override the amount validation to allow much larger numbers
    amount: z.number().positive().max(1000000000), // Allow up to 1 billion
  });

// User assignments to deals
export const dealAssignments = pgTable("deal_assignments", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealAssignmentSchema = createInsertSchema(dealAssignments).omit({
  id: true,
  createdAt: true,
});

// Notifications
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  title: text("title").notNull(),
  date: timestamp("date").notNull(),
  attendees: text("attendees"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Convert ISO string dates to Date objects for Zod validation
    date: z.string().transform(val => new Date(val)),
  });

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { 
    enum: ["deal", "memo", "assignment", "system"] 
  }).notNull().default("system"),
  relatedId: integer("related_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Capital Calls - Track capital calls for investments
export const capitalCalls = pgTable("capital_calls", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id").notNull().references(() => fundAllocations.id, { onDelete: "cascade" }),
  callAmount: real("call_amount").notNull(), // Amount of the capital call
  amountType: text("amount_type", { enum: ["percentage", "dollar"] }).default("percentage"),
  callDate: timestamp("call_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  paidAmount: real("paid_amount").default(0), // Amount currently paid
  paidDate: timestamp("paid_date"), // Date of the last payment
  outstanding_amount: numeric("outstanding_amount", { precision: 14, scale: 2 }).notNull(), // Remaining amount to be paid
  status: text("status", { enum: ["scheduled", "called", "partially_paid", "paid", "defaulted", "overdue"] }).notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // This column will be added in the migration, along with the CHECK constraint
  callPct: real("call_pct"),
});

export const insertCapitalCallSchema = createInsertSchema(capitalCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Transform numeric fields to handle both string and number inputs
  outstanding_amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  callAmount: z.number().positive("Call amount must be greater than 0"),
  paidAmount: z.number().optional().default(0),
  allocationId: z.number().positive("Allocation ID is required"),
});

// Capital Call Payments - Track individual payments against capital calls
export const capitalCallPayments = pgTable("capital_call_payments", {
  id: serial("id").primaryKey(),
  capitalCallId: integer("capital_call_id").notNull().references(() => capitalCalls.id, { onDelete: "cascade" }),
  paymentAmount: real("payment_amount").notNull(), // Amount of this payment
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  paymentType: text("payment_type", { enum: ["wire", "check", "ach", "other"] }).default("wire"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCapitalCallPaymentSchema = createInsertSchema(capitalCallPayments).omit({
  id: true,
  createdAt: true,
});

// Closing Schedule Events for deals
export const closingScheduleEvents = pgTable("closing_schedule_events", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["first_close", "second_close", "final_close", "extension", "custom"] }).notNull(),
  eventName: text("event_name").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  actualDate: timestamp("actual_date"),
  targetAmount: real("target_amount"),
  amountType: text("amount_type", { enum: ["percentage", "dollar"] }).default("percentage"),
  actualAmount: real("actual_amount"),
  status: text("status", { enum: ["scheduled", "completed", "delayed", "cancelled"] }).notNull().default("scheduled"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClosingScheduleEventSchema = createInsertSchema(closingScheduleEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;

export type DealStar = typeof dealStars.$inferSelect;
export type InsertDealStar = z.infer<typeof insertDealStarSchema>;

export type MiniMemo = typeof miniMemos.$inferSelect;
export type InsertMiniMemo = z.infer<typeof insertMiniMemoSchema>;

// Base type from the table
export type FundBase = typeof funds.$inferSelect;

// Extended type with additional properties for API responses
export type Fund = FundBase & {
  committedCapital?: number;
  totalFundSize?: number;
  allocationCount?: number;
  calledCapital?: number;
  uncalledCapital?: number;
};
export type InsertFund = z.infer<typeof insertFundSchema>;

// Distribution type will be defined after the table declaration

// Base type from the table
export type FundAllocationBase = typeof fundAllocations.$inferSelect;

// Extended type with additional properties for API responses
export type FundAllocation = FundAllocationBase & {
  fundName?: string;
  dealName?: string;
  dealSector?: string;
  weight?: number;
  distributions?: typeof distributions.$inferSelect[];
};
export type InsertFundAllocation = z.infer<typeof insertFundAllocationSchema>;

// Alias for components that expect 'Allocation' type
export type Allocation = FundAllocation & {
  calledAmount?: number;
  paidAmount?: number;
};

// Base type from the table
export type CapitalCallBase = typeof capitalCalls.$inferSelect;

// Extended type with additional properties for the API response
export type CapitalCall = CapitalCallBase & {
  dealName?: string;
  fundName?: string;
  payments?: CapitalCallPayment[];
};
export type InsertCapitalCall = z.infer<typeof insertCapitalCallSchema>;

export type CapitalCallPayment = typeof capitalCallPayments.$inferSelect;
export type InsertCapitalCallPayment = z.infer<typeof insertCapitalCallPaymentSchema>;

export type ClosingScheduleEvent = typeof closingScheduleEvents.$inferSelect;
export type InsertClosingScheduleEvent = z.infer<typeof insertClosingScheduleEventSchema>;

export type DealAssignment = typeof dealAssignments.$inferSelect;
export type InsertDealAssignment = z.infer<typeof insertDealAssignmentSchema>;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type MemoComment = typeof memoComments.$inferSelect;
export type InsertMemoComment = z.infer<typeof insertMemoCommentSchema>;

// Payments table for tracking actual cash flow from capital calls
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  capitalCallId: integer("capital_call_id").notNull().references(() => capitalCalls.id, { onDelete: "cascade" }),
  paidDate: date("paid_date").notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Helper enum for stages display
export const DealStageLabels: Record<Deal['stage'], string> = {
  initial_review: "Initial Review",
  screening: "Screening",
  diligence: "Diligence",
  ic_review: "IC Review",
  closing: "Closing",
  closed: "Closed",
  invested: "Invested",
  rejected: "Rejected"
};

// Helper for stage colors
export const DealStageColors: Record<Deal['stage'], string> = {
  initial_review: "neutral",
  screening: "neutral",
  diligence: "primary",
  ic_review: "info",
  closing: "success",
  closed: "success",
  invested: "success",
  rejected: "danger"
};

// Audit logs table for tracking all data changes
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'fund_allocation', 'capital_call', etc.
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  userId: integer("user_id").notNull(),
  oldValues: text("old_values"), // JSON string of previous values
  newValues: text("new_values"), // JSON string of new values
  metadata: text("metadata"), // Additional context as JSON
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Distributions table for tracking multiple distributions from investments
export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id").notNull().references(() => fundAllocations.id, { onDelete: "cascade" }),
  distributionDate: date("distribution_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  distributionType: text("distribution_type", { 
    enum: ["dividend", "capital_gain", "return_of_capital", "liquidation", "other"] 
  }).notNull().default("dividend"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDistributionSchema = createInsertSchema(distributions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Distribution = typeof distributions.$inferSelect;
export type InsertDistribution = z.infer<typeof insertDistributionSchema>;
