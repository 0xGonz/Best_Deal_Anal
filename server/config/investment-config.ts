/**
 * Investment Configuration Management
 * 
 * Centralized configuration for investment workflows, validation rules,
 * and business logic parameters. Supports environment-specific overrides
 * and runtime configuration updates.
 */

export interface InvestmentLimits {
  minAllocationAmount: number;
  maxAllocationAmount: number;
  maxAllocationsPerDeal: number;
  maxCapitalCallPercentage: number;
  capitalCallGracePeriodDays: number;
}

export interface StatusTransitions {
  [currentStatus: string]: string[];
}

export interface WorkflowSettings {
  autoUpdateDealStage: boolean;
  autoRecalculateMetrics: boolean;
  requireApprovalThreshold: number;
  enableAuditLogging: boolean;
  enableNotifications: boolean;
}

export interface ValidationRules {
  strictAmountValidation: boolean;
  allowPartialPayments: boolean;
  enforceSequentialCapitalCalls: boolean;
  validateFundCapacity: boolean;
}

class InvestmentConfigManager {
  private static instance: InvestmentConfigManager;
  private config: InvestmentConfiguration;

  private constructor() {
    this.config = this.loadDefaultConfiguration();
    this.loadEnvironmentOverrides();
  }

  static getInstance(): InvestmentConfigManager {
    if (!InvestmentConfigManager.instance) {
      InvestmentConfigManager.instance = new InvestmentConfigManager();
    }
    return InvestmentConfigManager.instance;
  }

  private loadDefaultConfiguration(): InvestmentConfiguration {
    return {
      limits: {
        minAllocationAmount: 1000,
        maxAllocationAmount: 100_000_000,
        maxAllocationsPerDeal: 10,
        maxCapitalCallPercentage: 100,
        capitalCallGracePeriodDays: 30
      },
      
      allocationStatusTransitions: {
        'committed': ['funded', 'partially_paid', 'unfunded', 'written_off'],
        'funded': ['written_off'],
        'partially_paid': ['funded', 'unfunded', 'written_off'],
        'unfunded': ['committed', 'partially_paid', 'funded', 'written_off'],
        'written_off': []
      },

      capitalCallStatusTransitions: {
        'scheduled': ['called', 'cancelled'],
        'called': ['paid', 'overdue', 'partial', 'defaulted'],
        'paid': [],
        'overdue': ['paid', 'partial', 'defaulted'],
        'partial': ['paid', 'overdue', 'defaulted'],
        'defaulted': ['paid', 'partial'],
        'cancelled': []
      },

      workflow: {
        autoUpdateDealStage: true,
        autoRecalculateMetrics: true,
        requireApprovalThreshold: 1_000_000,
        enableAuditLogging: true,
        enableNotifications: true
      },

      validation: {
        strictAmountValidation: true,
        allowPartialPayments: true,
        enforceSequentialCapitalCalls: false,
        validateFundCapacity: true
      },

      businessRules: {
        allowDuplicateAllocations: false,
        requireDealInvestmentStage: false,
        autoCreateTimelineEvents: true,
        enforceCapitalCallSequence: false,
        enableOverpayments: false
      },

      dateFormats: {
        capitalCallDueDate: 'YYYY-MM-DD',
        auditTimestamp: 'YYYY-MM-DD HH:mm:ss',
        reportingPeriod: 'YYYY-MM'
      },

      notifications: {
        sendCapitalCallReminders: true,
        reminderDaysBefore: [7, 3, 1],
        sendOverdueNotifications: true,
        escalationDays: 5
      }
    };
  }

  private loadEnvironmentOverrides(): void {
    // Load environment-specific configurations
    const env = process.env.NODE_ENV || 'development';
    
    if (env === 'production') {
      this.config.limits.minAllocationAmount = 10000;
      this.config.workflow.requireApprovalThreshold = 500_000;
      this.config.validation.strictAmountValidation = true;
    } else if (env === 'staging') {
      this.config.limits.minAllocationAmount = 1000;
      this.config.workflow.requireApprovalThreshold = 100_000;
    }

    // Override with environment variables if present
    if (process.env.MIN_ALLOCATION_AMOUNT) {
      this.config.limits.minAllocationAmount = parseInt(process.env.MIN_ALLOCATION_AMOUNT);
    }
    
    if (process.env.MAX_ALLOCATION_AMOUNT) {
      this.config.limits.maxAllocationAmount = parseInt(process.env.MAX_ALLOCATION_AMOUNT);
    }

    if (process.env.ENABLE_AUDIT_LOGGING) {
      this.config.workflow.enableAuditLogging = process.env.ENABLE_AUDIT_LOGGING === 'true';
    }
  }

  // Configuration getters
  getLimits(): InvestmentLimits {
    return { ...this.config.limits };
  }

  getAllocationStatusTransitions(): StatusTransitions {
    return { ...this.config.allocationStatusTransitions };
  }

  getCapitalCallStatusTransitions(): StatusTransitions {
    return { ...this.config.capitalCallStatusTransitions };
  }

  getWorkflowSettings(): WorkflowSettings {
    return { ...this.config.workflow };
  }

  getValidationRules(): ValidationRules {
    return { ...this.config.validation };
  }

  // Business rule checks
  isAmountValid(amount: number): boolean {
    return amount >= this.config.limits.minAllocationAmount && 
           amount <= this.config.limits.maxAllocationAmount;
  }

  requiresApproval(amount: number): boolean {
    return amount >= this.config.workflow.requireApprovalThreshold;
  }

  isStatusTransitionValid(currentStatus: string, newStatus: string, type: 'allocation' | 'capitalCall'): boolean {
    const transitions = type === 'allocation' 
      ? this.config.allocationStatusTransitions 
      : this.config.capitalCallStatusTransitions;
    
    const allowedTransitions = transitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  shouldAutoUpdateDealStage(): boolean {
    return this.config.workflow.autoUpdateDealStage;
  }

  shouldAutoRecalculateMetrics(): boolean {
    return this.config.workflow.autoRecalculateMetrics;
  }

  isAuditLoggingEnabled(): boolean {
    return this.config.workflow.enableAuditLogging;
  }

  allowsPartialPayments(): boolean {
    return this.config.validation.allowPartialPayments;
  }

  getCapitalCallGracePeriod(): number {
    return this.config.limits.capitalCallGracePeriodDays;
  }

  // Dynamic configuration updates
  updateLimits(limits: Partial<InvestmentLimits>): void {
    this.config.limits = { ...this.config.limits, ...limits };
  }

  updateWorkflowSettings(settings: Partial<WorkflowSettings>): void {
    this.config.workflow = { ...this.config.workflow, ...settings };
  }

  updateValidationRules(rules: Partial<ValidationRules>): void {
    this.config.validation = { ...this.config.validation, ...rules };
  }

  // Configuration export for monitoring/debugging
  exportConfiguration(): InvestmentConfiguration {
    return JSON.parse(JSON.stringify(this.config));
  }

  // Validation helpers
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.limits.minAllocationAmount >= this.config.limits.maxAllocationAmount) {
      errors.push('Minimum allocation amount must be less than maximum');
    }

    if (this.config.limits.maxCapitalCallPercentage > 100) {
      errors.push('Maximum capital call percentage cannot exceed 100%');
    }

    if (this.config.limits.capitalCallGracePeriodDays < 0) {
      errors.push('Capital call grace period cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

interface InvestmentConfiguration {
  limits: InvestmentLimits;
  allocationStatusTransitions: StatusTransitions;
  capitalCallStatusTransitions: StatusTransitions;
  workflow: WorkflowSettings;
  validation: ValidationRules;
  businessRules: {
    allowDuplicateAllocations: boolean;
    requireDealInvestmentStage: boolean;
    autoCreateTimelineEvents: boolean;
    enforceCapitalCallSequence: boolean;
    enableOverpayments: boolean;
  };
  dateFormats: {
    capitalCallDueDate: string;
    auditTimestamp: string;
    reportingPeriod: string;
  };
  notifications: {
    sendCapitalCallReminders: boolean;
    reminderDaysBefore: number[];
    sendOverdueNotifications: boolean;
    escalationDays: number;
  };
}

// Export singleton instance
export const investmentConfig = InvestmentConfigManager.getInstance();

// Export configuration validation utility
export function validateInvestmentConfig(): { valid: boolean; errors: string[] } {
  return investmentConfig.validateConfiguration();
}

// Export configuration reset utility (for testing)
export function resetConfigurationToDefaults(): void {
  const newInstance = new (InvestmentConfigManager as any)();
  (InvestmentConfigManager as any).instance = newInstance;
}