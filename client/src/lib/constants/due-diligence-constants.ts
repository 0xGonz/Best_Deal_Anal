/**
 * Due Diligence Checklist Constants
 * 
 * Centralized constants for due diligence checklist items used across memo components.
 * This eliminates duplication and ensures consistency.
 */

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

export type DueDiligenceItem = keyof typeof DUE_DILIGENCE_CHECKLIST;

/**
 * Get all due diligence checklist items as an array
 */
export const getDueDiligenceItems = () => {
  return Object.entries(DUE_DILIGENCE_CHECKLIST).map(([key, label]) => ({
    key: key as DueDiligenceItem,
    label
  }));
};

/**
 * Default due diligence checklist state (all items unchecked)
 */
export const getDefaultDueDiligenceState = (): Record<DueDiligenceItem, boolean> => {
  return Object.keys(DUE_DILIGENCE_CHECKLIST).reduce((acc, key) => {
    acc[key as DueDiligenceItem] = false;
    return acc;
  }, {} as Record<DueDiligenceItem, boolean>);
}; 