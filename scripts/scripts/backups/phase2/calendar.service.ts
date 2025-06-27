import { db } from '../db';
import { closingScheduleEvents, capitalCalls, meetings, funds, fundAllocations, deals } from '@shared/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { addHours } from 'date-fns';

/**
 * Unified calendar service providing aggregated event data
 * from multiple sources: meetings, capital calls, and closing schedules
 */
export class CalendarService {
  /**
   * Get all calendar events across different sources
   * within a date range (if specified)
   */
  async getAllEvents(dateRange?: { startDate?: string; endDate?: string }) {
    try {
      // Prepare date filters based on provided range or default to all events
      const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : undefined;
      const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : undefined;

      // 1. Fetch meetings
      const meetingsQuery = startDate && endDate 
        ? db.select({
            id: meetings.id,
            title: meetings.title,
            description: meetings.notes,
            startDate: meetings.date,
            endDate: meetings.date,
            dealId: meetings.dealId,
            eventType: sql`'meeting'`.as('eventType'),
            status: sql`'scheduled'`.as('status'),
            metadata: sql`json_build_object(
              'attendees', ${meetings.attendees},
              'notes', ${meetings.notes},
              'createdBy', ${meetings.createdBy}
            )`.as('metadata'),
          })
          .from(meetings)
          .leftJoin(deals, eq(meetings.dealId, deals.id))
          .where(
            and(
              gte(meetings.date, startDate),
              lte(meetings.date, endDate)
            )
          )
        : db.select({
            id: meetings.id,
            title: meetings.title,
            description: meetings.notes,
            startDate: meetings.date,
            endDate: meetings.date,
            dealId: meetings.dealId,
            eventType: sql`'meeting'`.as('eventType'),
            status: sql`'scheduled'`.as('status'),
            metadata: sql`json_build_object(
              'attendees', ${meetings.attendees},
              'notes', ${meetings.notes},
              'createdBy', ${meetings.createdBy}
            )`.as('metadata'),
          })
          .from(meetings)
          .leftJoin(deals, eq(meetings.dealId, deals.id));

      const meetingEvents = await meetingsQuery;

      // 2. Fetch capital calls
      const capitalCallsQuery = startDate && endDate 
        ? db.select({
            id: capitalCalls.id,
            title: sql`CONCAT('Capital Call: ', ${deals.name})`.as('title'),
            description: capitalCalls.notes,
            startDate: capitalCalls.dueDate,
            endDate: capitalCalls.dueDate, 
            dealId: fundAllocations.dealId,
            eventType: sql`'capital_call'`.as('eventType'),
            status: capitalCalls.status,
            metadata: sql`json_build_object(
              'callAmount', ${capitalCalls.callAmount},
              'amountType', ${capitalCalls.amountType},
              'paidAmount', ${capitalCalls.paidAmount},
              'fundName', ${funds.name},
              'fundId', ${funds.id},
              'outstanding_amount', ${capitalCalls.outstanding_amount},
              'allocationId', ${capitalCalls.allocationId}
            )`.as('metadata'),
          })
          .from(capitalCalls)
          .leftJoin(fundAllocations, eq(capitalCalls.allocationId, fundAllocations.id))
          .leftJoin(deals, eq(fundAllocations.dealId, deals.id))
          .leftJoin(funds, eq(fundAllocations.fundId, funds.id))
          .where(
            and(
              gte(capitalCalls.dueDate, startDate),
              lte(capitalCalls.dueDate, endDate)
            )
          )
        : db.select({
            id: capitalCalls.id,
            title: sql`CONCAT('Capital Call: ', ${deals.name})`.as('title'),
            description: capitalCalls.notes,
            startDate: capitalCalls.dueDate,
            endDate: capitalCalls.dueDate,
            dealId: fundAllocations.dealId,
            eventType: sql`'capital_call'`.as('eventType'),
            status: capitalCalls.status,
            metadata: sql`json_build_object(
              'callAmount', ${capitalCalls.callAmount},
              'amountType', ${capitalCalls.amountType},
              'paidAmount', ${capitalCalls.paidAmount},
              'fundName', ${funds.name},
              'fundId', ${funds.id},
              'outstanding_amount', ${capitalCalls.outstanding_amount},
              'allocationId', ${capitalCalls.allocationId}
            )`.as('metadata'),
          })
          .from(capitalCalls)
          .leftJoin(fundAllocations, eq(capitalCalls.allocationId, fundAllocations.id))
          .leftJoin(deals, eq(fundAllocations.dealId, deals.id))
          .leftJoin(funds, eq(fundAllocations.fundId, funds.id));

      const capitalCallEvents = await capitalCallsQuery;

      // 3. Fetch closing schedules
      const closingSchedulesQuery = startDate && endDate 
        ? db.select({
            id: closingScheduleEvents.id,
            title: sql`CONCAT(${closingScheduleEvents.eventName}, ': ', ${deals.name})`.as('title'),
            description: closingScheduleEvents.notes,
            startDate: closingScheduleEvents.scheduledDate,
            endDate: closingScheduleEvents.scheduledDate,
            dealId: closingScheduleEvents.dealId,
            eventType: sql`CONCAT('closing_', ${closingScheduleEvents.eventType})`.as('eventType'),
            status: closingScheduleEvents.status,
            metadata: sql`json_build_object(
              'targetAmount', ${closingScheduleEvents.targetAmount},
              'amountType', ${closingScheduleEvents.amountType},
              'actualAmount', ${closingScheduleEvents.actualAmount},
              'actualDate', ${closingScheduleEvents.actualDate},
              'eventName', ${closingScheduleEvents.eventName},
              'dealName', ${deals.name}
            )`.as('metadata'),
          })
          .from(closingScheduleEvents)
          .leftJoin(deals, eq(closingScheduleEvents.dealId, deals.id))
          .where(
            and(
              gte(closingScheduleEvents.scheduledDate, startDate),
              lte(closingScheduleEvents.scheduledDate, endDate)
            )
          )
        : db.select({
            id: closingScheduleEvents.id,
            title: sql`CONCAT(${closingScheduleEvents.eventName}, ': ', ${deals.name})`.as('title'),
            description: closingScheduleEvents.notes,
            startDate: closingScheduleEvents.scheduledDate,
            endDate: closingScheduleEvents.scheduledDate,
            dealId: closingScheduleEvents.dealId, 
            eventType: sql`CONCAT('closing_', ${closingScheduleEvents.eventType})`.as('eventType'),
            status: closingScheduleEvents.status,
            metadata: sql`json_build_object(
              'targetAmount', ${closingScheduleEvents.targetAmount},
              'amountType', ${closingScheduleEvents.amountType},
              'actualAmount', ${closingScheduleEvents.actualAmount},
              'actualDate', ${closingScheduleEvents.actualDate},
              'eventName', ${closingScheduleEvents.eventName},
              'dealName', ${deals.name}
            )`.as('metadata'),
          })
          .from(closingScheduleEvents)
          .leftJoin(deals, eq(closingScheduleEvents.dealId, deals.id));

      const closingScheduleEventData = await closingSchedulesQuery;

      // 4. Combine all events and sort by date
      const allEvents = [
        ...meetingEvents,
        ...capitalCallEvents,
        ...closingScheduleEventData
      ].sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA.getTime() - dateB.getTime();
      });

      // Group events by month for easier calendar display
      const groupedByMonth: Record<string, any[]> = {};
      
      allEvents.forEach(event => {
        const date = new Date(event.startDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!groupedByMonth[monthKey]) {
          groupedByMonth[monthKey] = [];
        }
        
        groupedByMonth[monthKey].push(event);
      });

      return {
        events: allEvents,
        eventsByMonth: groupedByMonth
      };
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  /**
   * Count events by type for dashboard/calendar summary
   */
  async getEventCounts() {
    try {
      // Only count upcoming events (today and future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count upcoming meetings
      const [meetingsCount] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(meetings)
        .where(gte(meetings.date, today));

      // Count upcoming capital calls
      const [capitalCallsCount] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(capitalCalls)
        .where(gte(capitalCalls.dueDate, today));

      // Count upcoming closing events
      const [closingsCount] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(closingScheduleEvents)
        .where(gte(closingScheduleEvents.scheduledDate, today));

      return {
        meetings: Number(meetingsCount.count),
        capitalCalls: Number(capitalCallsCount.count),
        closings: Number(closingsCount.count),
        total: Number(meetingsCount.count) + Number(capitalCallsCount.count) + Number(closingsCount.count)
      };
    } catch (error) {
      console.error('Error fetching event counts:', error);
      throw error;
    }
  }
}

export const calendarService = new CalendarService();