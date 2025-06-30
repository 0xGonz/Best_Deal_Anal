/**
 * Modular and scalable table configuration service
 * Centralizes all table formatting, styling, and display logic
 */

import { formatCurrency } from "@/lib/utils/format";

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  responsive?: 'always' | 'sm' | 'md' | 'lg';
  formatter?: (value: any, row: any) => string;
  sortable?: boolean;
}

export interface TableConfig {
  columns: TableColumn[];
  rowClickAction?: (row: any) => void;
  responsive: boolean;
  pagination?: {
    enabled: boolean;
    pageSize: number;
  };
  sorting?: {
    enabled: boolean;
    defaultSort?: { column: string; direction: 'asc' | 'desc' };
  };
}

// Modular column definitions for reuse across tables
export const COLUMN_DEFINITIONS = {
  // Deal-related columns
  dealName: {
    key: 'name',
    label: 'Deal Name',
    width: 'w-[35%] xs:w-[25%] sm:w-[20%] md:w-[18%]',
    align: 'left' as const,
    responsive: 'always' as const,
    sortable: true
  },
  dealSector: {
    key: 'sector',
    label: 'Type',
    width: 'w-[12%] sm:w-[10%]',
    align: 'left' as const,
    responsive: 'xs' as const,
    sortable: true
  },
  dealDescription: {
    key: 'description',
    label: 'Description',
    width: 'w-auto',
    align: 'left' as const,
    responsive: 'sm' as const,
    sortable: false
  },
  targetReturn: {
    key: 'targetReturn',
    label: 'Return',
    width: 'w-[10%]',
    align: 'right' as const,
    responsive: 'md' as const,
    formatter: (value: string) => value ? `${value}${!value.includes('%') ? '%' : ''}` : 'N/A',
    sortable: true
  },
  
  // Allocation-related columns
  investment: {
    key: 'dealName',
    label: 'Investment',
    align: 'left' as const,
    responsive: 'always' as const,
    sortable: true
  },
  allocationSector: {
    key: 'dealSector',
    label: 'Sector',
    align: 'left' as const,
    responsive: 'always' as const,
    sortable: true
  },
  allocationDate: {
    key: 'allocationDate',
    label: 'Date',
    align: 'left' as const,
    responsive: 'always' as const,
    formatter: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A',
    sortable: true
  },
  allocationStatus: {
    key: 'status',
    label: 'Status',
    align: 'left' as const,
    responsive: 'always' as const,
    sortable: true
  },
  portfolioWeight: {
    key: 'portfolioWeight',
    label: 'Weight',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => {
      // Safe handling of NaN and invalid values
      if (isNaN(value) || value === null || value === undefined) {
        return '0.00%';
      }
      return `${Number(value).toFixed(2)}%`;
    },
    sortable: true,
    dynamic: true // Indicates this column changes with capital view
  },
  capitalAmount: {
    key: 'amount',
    label: 'Amount',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => formatCurrency(value),
    sortable: true,
    dynamic: true // Indicates this column changes with capital view
  },
  distributions: {
    key: 'distributionPaid',
    label: 'Distributions',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => formatCurrency(value || 0),
    sortable: true
  },
  marketValue: {
    key: 'marketValue',
    label: 'Value',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => formatCurrency(value || 0),
    sortable: true
  },
  moic: {
    key: 'moic',
    label: 'MOIC',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => `${(value || 1).toFixed(2)}x`,
    sortable: true
  },
  irr: {
    key: 'irr',
    label: 'IRR',
    align: 'right' as const,
    responsive: 'always' as const,
    formatter: (value: number) => `${(value || 0).toFixed(2)}%`,
    sortable: true
  },
  
  // Fund-related columns
  fundName: {
    key: 'name',
    label: 'Fund Name',
    align: 'left' as const,
    responsive: 'always' as const,
    sortable: true
  },
  aum: {
    key: 'aum',
    label: 'AUM',
    align: 'right' as const,
    responsive: 'sm' as const,
    formatter: (value: number) => formatCurrency(value || 0),
    sortable: true
  },
  vintage: {
    key: 'vintage',
    label: 'Vintage',
    align: 'center' as const,
    responsive: 'sm' as const,
    sortable: true
  },
  
  // Actions column
  actions: {
    key: 'actions',
    label: 'Actions',
    align: 'center' as const,
    responsive: 'always' as const,
    sortable: false
  }
};

// Pre-configured table setups for common use cases
export const TABLE_CONFIGS = {
  deals: {
    columns: [
      COLUMN_DEFINITIONS.dealName,
      COLUMN_DEFINITIONS.dealSector,
      COLUMN_DEFINITIONS.dealDescription,
      COLUMN_DEFINITIONS.targetReturn,
      { ...COLUMN_DEFINITIONS.allocationStatus, key: 'stage', label: 'Status' },
      COLUMN_DEFINITIONS.actions
    ],
    responsive: true,
    pagination: { enabled: true, pageSize: 10 },
    sorting: { enabled: true, defaultSort: { column: 'name', direction: 'asc' as const } }
  },
  
  allocations: {
    columns: [
      COLUMN_DEFINITIONS.investment,
      COLUMN_DEFINITIONS.allocationSector,
      COLUMN_DEFINITIONS.allocationDate,
      COLUMN_DEFINITIONS.allocationStatus,
      COLUMN_DEFINITIONS.portfolioWeight,
      COLUMN_DEFINITIONS.capitalAmount,
      COLUMN_DEFINITIONS.distributions,
      COLUMN_DEFINITIONS.marketValue,
      COLUMN_DEFINITIONS.moic,
      COLUMN_DEFINITIONS.irr,
      COLUMN_DEFINITIONS.actions
    ],
    responsive: true,
    pagination: { enabled: false, pageSize: 50 },
    sorting: { enabled: true, defaultSort: { column: 'allocationDate', direction: 'desc' as const } }
  },
  
  funds: {
    columns: [
      COLUMN_DEFINITIONS.fundName,
      { ...COLUMN_DEFINITIONS.dealDescription, key: 'description', label: 'Description' },
      COLUMN_DEFINITIONS.aum,
      COLUMN_DEFINITIONS.vintage,
      { ...COLUMN_DEFINITIONS.capitalAmount, key: 'committedCapital', label: 'Committed' },
      COLUMN_DEFINITIONS.actions
    ],
    responsive: true,
    pagination: { enabled: true, pageSize: 10 },
    sorting: { enabled: true, defaultSort: { column: 'name', direction: 'asc' as const } }
  }
};

// Responsive class utilities
export const RESPONSIVE_CLASSES = {
  show: {
    always: '',
    xs: 'hidden xs:table-cell',
    sm: 'hidden sm:table-cell',
    md: 'hidden md:table-cell',
    lg: 'hidden lg:table-cell'
  },
  text: {
    responsive: 'text-[10px] xs:text-xs sm:text-sm'
  }
};

// Status badge styling
export const STATUS_STYLES = {
  allocation: {
    funded: 'bg-emerald-100 text-emerald-800',
    committed: 'bg-blue-100 text-blue-800',
    unfunded: 'bg-amber-100 text-amber-800',
    partially_paid: 'bg-purple-100 text-purple-800',
    written_off: 'bg-red-100 text-red-800'
  },
  deal: {
    initial_review: 'bg-gray-100 text-gray-800',
    screening: 'bg-blue-100 text-blue-800',
    diligence: 'bg-indigo-100 text-indigo-800',
    ic_review: 'bg-purple-100 text-purple-800',
    closing: 'bg-amber-100 text-amber-800',
    closed: 'bg-emerald-100 text-emerald-800',
    invested: 'bg-teal-100 text-teal-800',
    rejected: 'bg-red-100 text-red-800',
    passed: 'bg-yellow-100 text-yellow-800'
  }
};

export function getStatusStyle(type: 'allocation' | 'deal', status: string): string {
  return STATUS_STYLES[type][status as keyof typeof STATUS_STYLES[typeof type]] || 'bg-gray-100 text-gray-800';
}