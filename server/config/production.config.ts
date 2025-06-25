/**
 * Production Configuration
 * Centralized configuration for production-ready deployment
 */

export interface DatabaseConfig {
  connectionPoolSize: number;
  idleTimeoutMs: number;
  maxRetries: number;
  queryTimeoutMs: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupIntervalMs: number;
}

export interface AuditConfig {
  retentionDays: number;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableFinancialAudit: boolean;
  enableSecurityAudit: boolean;
}

export interface BusinessRulesConfig {
  maxAllocationPerFund: number;
  maxAllocationPerDeal: number;
  minAllocationAmount: number;
  maxFundUtilization: number;
  allowedSecurityTypes: string[];
  allowedStatuses: string[];
  requireApprovalThreshold: number;
}

export interface PerformanceConfig {
  batchSize: number;
  queryTimeoutMs: number;
  maxConcurrentOperations: number;
  enableQueryOptimization: boolean;
}

export interface SecurityConfig {
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  enableInputSanitization: boolean;
  requireSSL: boolean;
  sessionTimeoutMs: number;
}

export class ProductionConfig {
  private static instance: ProductionConfig;
  
  readonly database: DatabaseConfig = {
    connectionPoolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
    queryTimeoutMs: parseInt(process.env.DB_QUERY_TIMEOUT || '10000')
  };

  readonly cache: CacheConfig = {
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000'),
    cleanupIntervalMs: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000')
  };

  readonly audit: AuditConfig = {
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
    logLevel: (process.env.AUDIT_LOG_LEVEL as any) || 'INFO',
    enableFinancialAudit: process.env.ENABLE_FINANCIAL_AUDIT !== 'false',
    enableSecurityAudit: process.env.ENABLE_SECURITY_AUDIT !== 'false'
  };

  readonly businessRules: BusinessRulesConfig = {
    maxAllocationPerFund: parseInt(process.env.MAX_ALLOCATION_PER_FUND || String(Number.MAX_SAFE_INTEGER)),
    maxAllocationPerDeal: parseInt(process.env.MAX_ALLOCATION_PER_DEAL || String(Number.MAX_SAFE_INTEGER)),
    minAllocationAmount: parseInt(process.env.MIN_ALLOCATION_AMOUNT || '1'),
    maxFundUtilization: parseFloat(process.env.MAX_FUND_UTILIZATION || String(Number.MAX_SAFE_INTEGER)),
    allowedSecurityTypes: (process.env.ALLOWED_SECURITY_TYPES || 'equity,debt,convertible,warrant,option,preferred,common,note').split(','),
    allowedStatuses: (process.env.ALLOWED_STATUSES || 'committed,funded,unfunded,partially_paid,written_off').split(','),
    requireApprovalThreshold: parseInt(process.env.APPROVAL_THRESHOLD || String(Number.MAX_SAFE_INTEGER))
  };

  readonly performance: PerformanceConfig = {
    batchSize: parseInt(process.env.BATCH_SIZE || '500'), // Scale up for large operations
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT || '30000'), // 30s for complex queries
    maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPS || '50'), // Scale up
    enableQueryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION !== 'false'
  };

  readonly security: SecurityConfig = {
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100'),
    enableInputSanitization: process.env.ENABLE_INPUT_SANITIZATION !== 'false',
    requireSSL: process.env.NODE_ENV === 'production',
    sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT || '1800000')
  };

  static getInstance(): ProductionConfig {
    if (!ProductionConfig.instance) {
      ProductionConfig.instance = new ProductionConfig();
    }
    return ProductionConfig.instance;
  }

  /**
   * Validate configuration on startup
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Database validation
    if (this.database.connectionPoolSize < 1 || this.database.connectionPoolSize > 100) {
      errors.push('Database connection pool size must be between 1 and 100');
    }

    // Business rules validation
    if (this.businessRules.minAllocationAmount > this.businessRules.maxAllocationPerDeal) {
      errors.push('Minimum allocation amount cannot exceed maximum per deal');
    }

    if (this.businessRules.maxFundUtilization < 0 || this.businessRules.maxFundUtilization > 100) {
      errors.push('Fund utilization must be between 0 and 100');
    }

    // Performance validation
    if (this.performance.batchSize < 1 || this.performance.batchSize > 1000) {
      errors.push('Batch size must be between 1 and 1000');
    }

    // Security validation
    if (this.security.maxRequestsPerMinute < 1) {
      errors.push('Rate limit must be at least 1 request per minute');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment-specific settings
   */
  getEnvironmentConfig(): {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    logLevel: string;
  } {
    const env = process.env.NODE_ENV || 'development';
    
    return {
      isDevelopment: env === 'development',
      isProduction: env === 'production',
      isTest: env === 'test',
      logLevel: process.env.LOG_LEVEL || (env === 'production' ? 'INFO' : 'DEBUG')
    };
  }

  /**
   * Get database connection string with optimizations
   */
  getDatabaseUrl(): string {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Add connection pool parameters for production
    const url = new URL(baseUrl);
    url.searchParams.set('pool_size', this.database.connectionPoolSize.toString());
    url.searchParams.set('idle_timeout', (this.database.idleTimeoutMs / 1000).toString());
    
    return url.toString();
  }

  /**
   * Export configuration for external use
   */
  exportConfig(): Record<string, any> {
    return {
      database: this.database,
      cache: this.cache,
      audit: this.audit,
      businessRules: this.businessRules,
      performance: this.performance,
      security: this.security,
      environment: this.getEnvironmentConfig()
    };
  }
}

// Singleton instance
export const productionConfig = ProductionConfig.getInstance();

// Validate configuration on module load
const validation = productionConfig.validateConfig();
if (!validation.isValid) {
  console.error('Invalid production configuration:', validation.errors);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid production configuration');
  }
}