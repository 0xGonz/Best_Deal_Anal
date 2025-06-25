/**
 * Allocation Auto-Sync Middleware
 * 
 * Automatically triggers sync operations for allocation-related endpoints
 * Ensures data consistency without manual intervention
 */

import { Request, Response, NextFunction } from 'express';
import { allocationEventSystem } from '../services/allocation-event-system.service';

export interface AllocationRequest extends Request {
  allocationData?: {
    allocationId: number;
    fundId: number;
    dealId: number;
    amount: number;
    paidAmount?: number;
    operation: 'create' | 'update' | 'delete' | 'payment';
  };
}

/**
 * Middleware to auto-trigger allocation sync after successful operations
 */
export function autoSyncAllocationMiddleware() {
  return async (req: AllocationRequest, res: Response, next: NextFunction) => {
    // Store original send method
    const originalSend = res.send;
    
    // Override send to trigger auto-sync on successful responses
    res.send = function(body: any) {
      // Only trigger auto-sync for successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.allocationData) {
        // Don't await - let sync happen in background
        triggerAutoSync(req.allocationData, req.user?.id || 0).catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
      
      // Call original send
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Helper to trigger auto-sync based on operation type
 */
async function triggerAutoSync(data: AllocationRequest['allocationData'], userId: number): Promise<void> {
  if (!data) return;
  
  const eventType = getEventType(data.operation);
  if (!eventType) return;
  
  await allocationEventSystem.emitAllocationEvent({
    type: eventType,
    allocationId: data.allocationId,
    fundId: data.fundId,
    dealId: data.dealId,
    amount: data.amount,
    paidAmount: data.paidAmount,
    timestamp: new Date(),
    userId
  });
}

/**
 * Map operation to event type
 */
function getEventType(operation: string): 'allocation_created' | 'allocation_updated' | 'allocation_deleted' | 'payment_made' | null {
  switch (operation) {
    case 'create': return 'allocation_created';
    case 'update': return 'allocation_updated';
    case 'delete': return 'allocation_deleted';
    case 'payment': return 'payment_made';
    default: return null;
  }
}

/**
 * Helper to set allocation data for auto-sync
 */
export function setAllocationData(
  req: AllocationRequest, 
  allocationId: number, 
  fundId: number, 
  dealId: number, 
  amount: number, 
  operation: 'create' | 'update' | 'delete' | 'payment',
  paidAmount?: number
): void {
  req.allocationData = {
    allocationId,
    fundId,
    dealId,
    amount,
    paidAmount,
    operation
  };
}