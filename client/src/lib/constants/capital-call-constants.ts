/**
 * Constants related to capital calls for the client side
 */

// Capital call status values
export const CAPITAL_CALL_STATUS = {
  SCHEDULED: 'scheduled' as const,
  CALLED: 'called' as const,
  PARTIALLY_PAID: 'partially_paid' as const,
  PAID: 'paid' as const,
  DEFAULTED: 'defaulted' as const
};

export type CapitalCallStatus = typeof CAPITAL_CALL_STATUS[keyof typeof CAPITAL_CALL_STATUS];

// Payment schedule types
export const SCHEDULE_TYPES = {
  SINGLE: 'single' as const,
  MONTHLY: 'monthly' as const,
  QUARTERLY: 'quarterly' as const,
  BIANNUAL: 'biannual' as const,
  ANNUAL: 'annual' as const,
  CUSTOM: 'custom' as const
};

export type ScheduleType = typeof SCHEDULE_TYPES[keyof typeof SCHEDULE_TYPES];

// Capital call status colors for display
export const CAPITAL_CALL_STATUS_COLORS = {
  [CAPITAL_CALL_STATUS.SCHEDULED]: 'bg-blue-100 text-blue-800',
  [CAPITAL_CALL_STATUS.CALLED]: 'bg-amber-100 text-amber-800',
  [CAPITAL_CALL_STATUS.PARTIALLY_PAID]: 'bg-purple-100 text-purple-800',
  [CAPITAL_CALL_STATUS.PAID]: 'bg-green-100 text-green-800',
  [CAPITAL_CALL_STATUS.DEFAULTED]: 'bg-red-100 text-red-800',
};

// Capital call display labels
export const CAPITAL_CALL_STATUS_LABELS = {
  [CAPITAL_CALL_STATUS.SCHEDULED]: 'Scheduled',
  [CAPITAL_CALL_STATUS.CALLED]: 'Called',
  [CAPITAL_CALL_STATUS.PARTIALLY_PAID]: 'Partially Paid',
  [CAPITAL_CALL_STATUS.PAID]: 'Paid',
  [CAPITAL_CALL_STATUS.DEFAULTED]: 'Defaulted',
};

// Schedule type display labels
export const SCHEDULE_TYPE_LABELS = {
  [SCHEDULE_TYPES.SINGLE]: 'Single Payment',
  [SCHEDULE_TYPES.MONTHLY]: 'Monthly',
  [SCHEDULE_TYPES.QUARTERLY]: 'Quarterly',
  [SCHEDULE_TYPES.BIANNUAL]: 'Biannual',
  [SCHEDULE_TYPES.ANNUAL]: 'Annual',
  [SCHEDULE_TYPES.CUSTOM]: 'Custom Schedule',
};
