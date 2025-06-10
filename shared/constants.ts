/**
 * Shared constants across the application
 */

// Due diligence checklist items - single source of truth
export const DUE_DILIGENCE_CHECKLIST = {
  financialReview: 'Financial Review',
  legalReview: 'Legal Review',
  marketAnalysis: 'Market Analysis',
  teamAssessment: 'Team Assessment', 
  customerInterviews: 'Customer Interviews',
  competitorAnalysis: 'Competitor Analysis',
  technologyReview: 'Technology Review',
  businessModelValidation: 'Business Model Validation',
  regulatoryCompliance: 'Regulatory Compliance',
  esgAssessment: 'ESG Assessment'
} as const;

// Allocation status values - standardized enum
export const ALLOCATION_STATUS = {
  COMMITTED: 'committed',
  FUNDED: 'funded',
  UNFUNDED: 'unfunded',
  PARTIALLY_PAID: 'partially_paid',
  WRITTEN_OFF: 'written_off'
} as const;

// Capital call status values
export const CAPITAL_CALL_STATUS = {
  SCHEDULED: 'scheduled',
  CALLED: 'called',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  DEFAULTED: 'defaulted',
  OVERDUE: 'overdue'
} as const;

// Deal stages
export const DEAL_STAGES = {
  INITIAL_REVIEW: 'initial_review',
  SCREENING: 'screening',
  DILIGENCE: 'diligence',
  IC_REVIEW: 'ic_review',
  CLOSING: 'closing',
  CLOSED: 'closed',
  INVESTED: 'invested',
  REJECTED: 'rejected'
} as const;

// Capital call timing constants
export const CAPITAL_CALL_TIMING = {
  STANDARD_NOTICE_DAYS: 14,
  URGENT_NOTICE_DAYS: 7,
  MINIMUM_NOTICE_DAYS: 3,
  DEFAULT_DUE_DAYS: 30,
  GRACE_PERIOD_DAYS: 15
} as const;

// Financial calculation constants - consolidated from client/server
export const FINANCIAL_CALCULATION = {
  MILLION: 1000000,
  BILLION: 1000000000,
  THOUSAND: 1000,
  PRECISION: {
    CURRENCY: 2,
    PERCENTAGE: 2,
    IRR: 1,
    MULTIPLE: 2,
  },
  DEFAULT_IRR: 0,
  DEFAULT_MOIC: 1,
  MIN_DAYS_FOR_IRR: 30,
  DECIMAL_TO_PERCENTAGE: 100,
  BASE_VALUE: 100,
} as const;

// Time constants in milliseconds
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// Date formats
export const DATE_FORMATS = {
  DEFAULT: 'MMM d, yyyy',
  SHORT: 'MM/dd/yyyy',
  ISO: 'yyyy-MM-dd',
  MONTH_YEAR: 'MMM yyyy',
  YEAR: 'yyyy',
  MONTH_DAY: 'MMM d',
  FULL: 'MMMM d, yyyy',
  DATE_TIME: 'MMM d, yyyy h:mm a',
  TIME: 'h:mm a',
} as const;

// Payment defaults for allocation calculations
export const PAYMENT_DEFAULTS = {
  MIN_PAYMENT_AMOUNT: 1000,
  DEFAULT_CALL_PERCENTAGE: 25,
  MAX_CALL_PERCENTAGE: 100,
  PAYMENT_GRACE_PERIOD_DAYS: 30
} as const;

export type AllocationStatus = typeof ALLOCATION_STATUS[keyof typeof ALLOCATION_STATUS];
export type CapitalCallStatus = typeof CAPITAL_CALL_STATUS[keyof typeof CAPITAL_CALL_STATUS];
export type DealStage = typeof DEAL_STAGES[keyof typeof DEAL_STAGES];