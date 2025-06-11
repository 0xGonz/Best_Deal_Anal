/**
 * Centralized type definitions for improved type safety and modularity
 * This ensures consistent types across the entire application
 */

// Core domain types
export interface AllocationMetrics {
  totalInvested: number;
  currentValue: number;
  distributions: number;
  totalCalled: number;
  totalPaid: number;
  moic: number;
  irr?: number;
  unrealized?: number;
}

export interface CapitalCallSummary {
  totalCalls: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

export interface FundPerformanceMetrics {
  totalCommitments: number;
  totalCalled: number;
  totalPaid: number;
  totalDistributions: number;
  netCashFlow: number;
  moic: number;
  irr?: number;
  dpi?: number; // Distributions to Paid-In
  tvpi?: number; // Total Value to Paid-In
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
}

// Audit trail types
export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId: number;
  username: string;
  changes: Record<string, { old?: any; new?: any }>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Service layer interfaces
export interface MetricsCalculator {
  calculateAllocationMetrics(allocationId: number): Promise<AllocationMetrics>;
  calculateFundMetrics(fundId: number): Promise<FundPerformanceMetrics>;
  calculateCapitalCallSummary(allocationId: number): Promise<CapitalCallSummary>;
}

export interface AuditService {
  logChange(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
  getAuditTrail(entityType: string, entityId: number): Promise<AuditLogEntry[]>;
}

export interface ValidationService {
  validateAllocation(data: any): ValidationResult;
  validateCapitalCall(data: any): ValidationResult;
  validateFund(data: any): ValidationResult;
}

// Error handling types
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, public field: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends ApplicationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', 500, context);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string | number) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolMin?: number;
  poolMax?: number;
  connectionTimeout?: number;
}

export interface ApplicationConfig {
  database: DatabaseConfig;
  session: {
    secret: string;
    maxAge: number;
    secure: boolean;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    uploadPath: string;
  };
  ai: {
    apiKey?: string;
    model: string;
    maxTokens: number;
  };
}