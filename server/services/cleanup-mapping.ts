/**
 * Service Cleanup Mapping
 * 
 * Maps old service imports to canonical services after cleanup.
 * This file ensures backward compatibility during transition.
 * 
 * Generated: 2025-06-29T18:17:33.024Z
 */

// CANONICAL SERVICES (use these in new code)
export { AllocationService } from './allocation.service';
export { AllocationDomainService } from './allocation-domain.service';
export { CapitalCallService } from './capital-call.service';

// BACKWARD COMPATIBILITY ALIASES (deprecated - will be removed)
export { AllocationDomainService as ProductionAllocationService } from './allocation-domain.service';
export { AllocationDomainService as OptimizedAllocationService } from './allocation-domain.service';
export { AllocationDomainService as AllocationCreationService } from './allocation-domain.service';
export { AllocationDomainService as AllocationStatusService } from './allocation-domain.service';
export { AllocationDomainService as AllocationIntegrityService } from './allocation-domain.service';
export { AllocationDomainService as TransactionSafeAllocationService } from './allocation-domain.service';

export { CapitalCallService as EnterpriseCapitalCallService } from './capital-call.service';
export { CapitalCallService as ProductionCapitalCallService } from './capital-call.service';

// TODO: Remove these aliases in the next cleanup phase
console.warn('Using deprecated service aliases. Please update imports to use canonical services.');
