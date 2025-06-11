import { Request, Response } from 'express';
import { calendarService } from '../services/calendar.service';
import { asyncHandler } from '../utils/errorHandlers';

/**
 * Calendar controller for unified calendar event handling
 */
export class CalendarController {
  /**
   * Get all calendar events aggregated from multiple sources
   * Supports optional date range filtering
   */
  getAllEvents = asyncHandler(async (req: Request, res: Response) => {
    // Extract date range from query parameters if provided
    const { startDate, endDate } = req.query;
    
    // Get events from service with optional date filtering
    const dateRange = startDate || endDate 
      ? { 
          startDate: startDate as string | undefined, 
          endDate: endDate as string | undefined 
        } 
      : undefined;
    
    const events = await calendarService.getAllEvents(dateRange);
    
    res.status(200).json(events);
  });

  /**
   * Get event counts by type for summary/dashboard
   */
  getEventCounts = asyncHandler(async (req: Request, res: Response) => {
    const counts = await calendarService.getEventCounts();
    res.status(200).json(counts);
  });
}

export const calendarController = new CalendarController();