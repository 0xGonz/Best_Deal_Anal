export const REJECTION_CATEGORIES = {
  MARKET: {
    label: "Market Issues",
    reasons: [
      "Market too small",
      "Market declining",
      "Too competitive",
      "Market timing poor",
      "Regulatory concerns"
    ]
  },
  BUSINESS_MODEL: {
    label: "Business Model",
    reasons: [
      "Weak business model",
      "Poor unit economics",
      "Revenue model unclear",
      "Scalability concerns",
      "Customer acquisition too expensive"
    ]
  },
  TEAM: {
    label: "Management Team",
    reasons: [
      "Inexperienced management",
      "Team execution concerns",
      "Key person risk",
      "Cultural misfit",
      "Leadership gaps"
    ]
  },
  FINANCIAL: {
    label: "Financial",
    reasons: [
      "Valuation too high",
      "Poor financial performance",
      "Insufficient traction",
      "Burn rate too high",
      "Financial projections unrealistic"
    ]
  },
  STRATEGIC: {
    label: "Strategic Fit",
    reasons: [
      "Doesn't fit thesis",
      "Portfolio conflict",
      "Geography mismatch",
      "Stage mismatch",
      "Sector expertise lacking"
    ]
  },
  DUE_DILIGENCE: {
    label: "Due Diligence",
    reasons: [
      "Legal issues discovered",
      "Technology concerns",
      "Reference checks failed",
      "IP issues",
      "Compliance problems"
    ]
  },
  TERMS: {
    label: "Deal Terms",
    reasons: [
      "Deal terms unfavorable",
      "Liquidation preferences",
      "Board control issues",
      "Anti-dilution terms",
      "Exit restrictions"
    ]
  },
  OTHER: {
    label: "Other",
    reasons: [
      "Other (specify below)"
    ]
  }
} as const;

export type RejectionCategory = keyof typeof REJECTION_CATEGORIES;
export type RejectionReason = string;

export interface RejectionData {
  category: RejectionCategory;
  reason: RejectionReason;
  additionalNotes?: string;
  rejectedBy: number;
  rejectedAt: Date;
}