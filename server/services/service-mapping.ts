/**
 * Service Consolidation Mapping
 * 
 * Maps old service imports to new consolidated services
 * Use this during the transition period
 */

// OLD: Multiple allocation services
// import { AllocationCreationService } from './allocation-creation.service';
// import { AllocationStatusService } from './allocation-status.service';
// import { AllocationIntegrityService } from './allocation-integrity.service';
// ... 14 more allocation services

// NEW: Single allocation domain service
export { AllocationDomainService } from './allocation-domain.service';

// Backward compatibility aliases (temporary)
export const AllocationCreationService = AllocationDomainService;
export const AllocationStatusService = AllocationDomainService;
export const AllocationIntegrityService = AllocationDomainService;
