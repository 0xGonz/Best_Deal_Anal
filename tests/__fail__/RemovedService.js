/**
 * Jest Test Failure Module
 * 
 * This module causes Jest to fail when importing removed services,
 * forcing developers to use canonical services.
 */

throw new Error('❌ Import Error: This service has been removed during cleanup. Please use canonical services from cleanup-mapping.ts');
