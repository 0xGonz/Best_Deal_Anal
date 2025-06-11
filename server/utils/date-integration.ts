/**
 * Date Integration Utilities
 * 
 * Provides centralized utilities for handling date integration and synchronization 
 * between allocations, capital calls, closing schedules, and other time-sensitive components.
 * 
 * These utilities ensure consistent date handling across the application, allowing
 * for proper integration of dates between related entities without hardcoding.
 */

import { StorageFactory } from '../storage-factory';
import { TIME_MS, DEFAULT_DURATIONS } from '../constants/time-constants';
import { SCHEDULE_TYPES } from '../constants/status-constants';

/**
 * Get the appropriate reference date for a capital call based on allocation
 * 
 * This function ensures that capital calls properly use allocation dates for consistency
 * and prevents date mismatches between allocations and their capital calls.
 * 
 * @param allocationId - The ID of the fund allocation to get the reference date from
 * @param fallbackDate - Optional fallback date if allocation isn't found or has no date
 * @returns A Date object representing the reference date for the capital call
 */
export async function getAllocationReferenceDate(
  allocationId: number, 
  fallbackDate: Date = new Date()
): Promise<Date> {
  try {
    const allocation = await StorageFactory.storage.getFundAllocation(allocationId);
    
    if (allocation && allocation.allocationDate) {
      return new Date(allocation.allocationDate);
    }
    
    return fallbackDate;
  } catch (error) {
    console.error(`Error getting allocation reference date for allocation ${allocationId}:`, error);
    return fallbackDate;
  }
}

/**
 * Calculate a due date based on a reference date
 * 
 * @param referenceDate - The base date to calculate from
 * @param daysUntilDue - Number of days until due (defaults to system constant)
 * @returns A Date object representing the due date
 */
export function calculateDueDate(
  referenceDate: Date, 
  daysUntilDue: number = DEFAULT_DURATIONS.CAPITAL_CALL_DUE_DAYS
): Date {
  const dueDate = new Date(referenceDate);
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  return dueDate;
}

/**
 * Generate a sequence of dates based on a schedule type
 * 
 * @param baseDate - The starting date for the sequence
 * @param scheduleType - The type of schedule (monthly, quarterly, etc.)
 * @param count - The number of dates to generate
 * @returns An array of Date objects following the schedule
 */
export function generateScheduleDates(
  baseDate: Date,
  scheduleType: string,
  count: number
): Date[] {
  const dates: Date[] = [];
  const startDate = new Date(baseDate);
  
  // Determine the month interval based on schedule type
  let monthInterval = 1; // default to monthly
  
  if (scheduleType === 'quarterly') monthInterval = 3;
  if (scheduleType === 'biannual') monthInterval = 6;
  if (scheduleType === 'annual') monthInterval = 12;
  
  // Generate the dates
  for (let i = 0; i < count; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + (i * monthInterval));
    dates.push(currentDate);
  }
  
  return dates;
}

/**
 * Synchronize dates between an allocation, its capital calls, and closing schedules
 * 
 * This function ensures that when allocation dates change, all related entities
 * are updated accordingly to maintain consistent dates throughout the system.
 * 
 * @param allocationId - The ID of the fund allocation to synchronize dates for
 * @param newAllocationDate - The new allocation date to synchronize with
 * @returns A boolean indicating success or failure
 */
export async function synchronizeAllocationDates(
  allocationId: number,
  newAllocationDate: Date
): Promise<boolean> {
  try {
    const storage = StorageFactory.storage;
    
    // 1. First get the allocation to ensure it exists
    const allocation = await storage.getFundAllocation(allocationId);
    if (!allocation) {
      console.error(`Cannot synchronize dates: Allocation ${allocationId} not found`);
      return false;
    }
    
    // Store the original date for potential rollback
    const originalDate = allocation.allocationDate;
    
    // 2. Update the allocation date
    await storage.updateFundAllocation(allocationId, { allocationDate: newAllocationDate });
    
    // 3. Get all capital calls for this allocation
    const capitalCalls = await storage.getCapitalCallsByAllocation(allocationId);
    
    // 4. Get any closing schedules related to this allocation's deal
    const closingSchedules = await storage.getClosingScheduleEventsByDeal(allocation.dealId);
    
    // 5. Calculate date differences for proper adjustment
    const dateDiff = newAllocationDate.getTime() - new Date(originalDate).getTime();
    
    // 6. Update capital call dates - maintain same relative timing
    for (const call of capitalCalls) {
      try {
        // Only adjust dates for 'scheduled' capital calls, not those already paid
        if (call.status === 'scheduled') {
          const newCallDate = new Date(new Date(call.callDate).getTime() + dateDiff);
          const newDueDate = new Date(new Date(call.dueDate).getTime() + dateDiff);
          
          await storage.updateCapitalCallDates(call.id, newCallDate, newDueDate);
        }
      } catch (error) {
        console.error(`Error updating capital call ${call.id} dates:`, error);
      }
    }
    
    // 7. Update any future closing schedule dates that might be related
    const today = new Date();
    for (const event of closingSchedules) {
      try {
        // Only adjust future events that haven't happened yet
        if (event.status === 'scheduled' && new Date(event.scheduledDate) > today) {
          const newScheduledDate = new Date(new Date(event.scheduledDate).getTime() + dateDiff);
          
          await storage.updateClosingScheduleEventDate(event.id, newScheduledDate);
        }
      } catch (error) {
        console.error(`Error updating closing schedule event ${event.id} date:`, error);
      }
    }
    
    console.log(`Successfully synchronized dates for allocation ${allocationId}`);
    return true;
  } catch (error) {
    console.error(`Error synchronizing dates for allocation ${allocationId}:`, error);
    return false;
  }
}

/**
 * Generate capital call schedule from an allocation with date integration
 * 
 * @param allocation - The fund allocation to generate capital calls for
 * @param scheduleType - The type of schedule (single, monthly, quarterly, etc.)
 * @param options - Additional options for schedule generation
 * @returns An array of dates for the capital calls
 */
export function generateIntegratedCapitalCallSchedule(
  allocationDate: Date,
  scheduleType: string,
  count: number = 1
): Date[] {
  // Base date is always the allocation date for consistency
  const baseDate = new Date(allocationDate);
  
  // For single payment, just return the allocation date
  if (scheduleType === SCHEDULE_TYPES.SINGLE) {
    return [baseDate];
  }
  
  // For other schedule types, use the standard date generation logic
  return generateScheduleDates(baseDate, scheduleType.toLowerCase(), count);
}

/**
 * Get the next date in an integration calendar
 * 
 * This utility helps when scheduling future events based on existing schedules.
 * It finds the next appropriate date based on existing allocations and capital calls.
 * 
 * @param dealId - The deal ID to calculate the next date for
 * @param eventType - The type of event (allocation, capital-call, closing)
 * @returns The next appropriate date for the specified event type
 */
export async function getNextIntegrationDate(
  dealId: number,
  eventType: 'allocation' | 'capital-call' | 'closing'
): Promise<Date> {
  try {
    const storage = StorageFactory.storage;
    
    // Default to today if no better date is found
    const today = new Date();
    
    // Get allocations for this deal
    const allocations = await storage.getAllocationsByDeal(dealId);
    if (!allocations || allocations.length === 0) {
      return today; // No allocations yet, use today
    }
    
    // Get all capital calls for this deal
    const allCapitalCalls = await storage.getCapitalCallsByDeal(dealId);
    
    // Get all closing schedules for this deal
    const closingEvents = await storage.getClosingScheduleEventsByDeal(dealId);
    
    // Find the latest date among all related events
    let latestDate = today;
    
    // Check allocation dates
    for (const allocation of allocations) {
      const allocDate = new Date(allocation.allocationDate);
      if (allocDate > latestDate) {
        latestDate = allocDate;
      }
    }
    
    // Check capital call dates
    for (const call of allCapitalCalls) {
      const callDate = new Date(call.callDate);
      const dueDate = new Date(call.dueDate);
      if (callDate > latestDate) latestDate = callDate;
      if (dueDate > latestDate) latestDate = dueDate;
    }
    
    // Check closing event dates
    for (const event of closingEvents) {
      const eventDate = new Date(event.scheduledDate);
      if (eventDate > latestDate) {
        latestDate = eventDate;
      }
    }
    
    // Add a buffer based on event type
    const nextDate = new Date(latestDate);
    
    // Different buffers for different event types
    switch(eventType) {
      case 'allocation':
        nextDate.setDate(nextDate.getDate() + DEFAULT_DURATIONS.ALLOCATION_BUFFER_DAYS);
        break;
      case 'capital-call':
        nextDate.setDate(nextDate.getDate() + DEFAULT_DURATIONS.CAPITAL_CALL_BUFFER_DAYS);
        break;
      case 'closing':
        nextDate.setDate(nextDate.getDate() + DEFAULT_DURATIONS.CLOSING_BUFFER_DAYS);
        break;
    }
    
    return nextDate;
  } catch (error) {
    console.error(`Error calculating next integration date for deal ${dealId}:`, error);
    return new Date(); // Return today as fallback
  }
}
