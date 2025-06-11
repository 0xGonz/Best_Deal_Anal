import { Router, Request, Response, NextFunction } from 'express';
import { StorageFactory } from '../storage-factory';
import { insertClosingScheduleEventSchema, type Deal } from '@shared/schema';
import { CLOSING_EVENT_STATUS } from '../constants/status-constants';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import { AppError } from '../utils/errorHandlers';

const router = Router();
const storage = StorageFactory.getStorage();

// Custom type for the request with user property
interface AuthRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

// Get all closing schedule events
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Debug session data
    console.log(`Closing schedules GET request with session userId: ${req.session?.userId}`);
    
    // Get raw closing schedule events
    const closingEvents = await storage.getAllClosingScheduleEvents();
    
    // Get all deals to validate which deals exist
    const deals = await storage.getDeals();
    const dealMap = new Map<number, Deal>();
    deals.forEach(deal => dealMap.set(deal.id, deal));
    
    // Filter and enhance closing events - ensure all fields have default values to prevent null errors
    const enhancedEvents = closingEvents
      .filter(event => dealMap.has(event.dealId))
      .map(event => {
        const deal = dealMap.get(event.dealId);
        return {
          ...event,
          dealName: deal?.name || 'Unknown Deal',
          scheduledDate: event.scheduledDate ?? null,
          targetAmount: event.targetAmount ?? 0,
          actualAmount: event.actualAmount ?? null,
          actualDate: event.actualDate ?? null
        };
      });
    
    res.json(enhancedEvents);
  } catch (error) {
    console.error('Error fetching closing schedule events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch closing schedule events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get closing schedule events for a specific deal
router.get('/deal/:dealId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    // First verify the deal exists
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const closingEvents = await storage.getClosingScheduleEventsByDeal(dealId);
    res.json(closingEvents);
  } catch (error) {
    console.error(`Error fetching closing schedule events for deal ${req.params.dealId}:`, error);
    res.status(500).json({ error: 'Failed to fetch closing schedule events' });
  }
});

// Create a new closing schedule event
router.post('/', requireAuth, requirePermission('create', 'closingEvent'), async (req: AuthRequest, res: Response) => {
  try {
    // Process input data
    let modifiedBody = { ...req.body };
    
    // Handle amountType field
    if (modifiedBody.amountType !== undefined) {
      // Make sure it's a valid value
      if (!['percentage', 'dollar'].includes(modifiedBody.amountType)) {
        modifiedBody.amountType = 'percentage'; // Default to percentage if invalid
      }
    } else {
      modifiedBody.amountType = 'percentage'; // Default value if not provided
    }
    
    // Convert date strings to Date objects
    const data = {
      ...modifiedBody,
      scheduledDate: modifiedBody.scheduledDate ? new Date(modifiedBody.scheduledDate) : new Date(),
      actualDate: modifiedBody.actualDate ? new Date(modifiedBody.actualDate) : undefined
    };
    
    const validatedData = insertClosingScheduleEventSchema.parse(data);
    const closingEvent = await storage.createClosingScheduleEvent(validatedData);
    
    // Create a timeline event for this closing schedule
    await storage.createTimelineEvent({
      dealId: closingEvent.dealId,
      eventType: 'closing_scheduled',
      content: `${closingEvent.eventName} scheduled for ${new Date(closingEvent.scheduledDate).toLocaleDateString()}${closingEvent.targetAmount ? ` with ${closingEvent.amountType === 'dollar' ? '$' + closingEvent.targetAmount.toLocaleString() : closingEvent.targetAmount + '%'}` : ''}`,
      createdBy: closingEvent.createdBy,
      metadata: {
        closingEventId: [closingEvent.id],
        closingEventType: [closingEvent.eventType]
      }
    });
    
    res.status(201).json(closingEvent);
  } catch (error) {
    console.error('Error creating closing schedule event:', error);
    res.status(400).json({ 
      error: 'Failed to create closing schedule event', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Update a closing schedule event status
router.patch('/:id/status', requireAuth, requirePermission('edit', 'closingEvent'), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, actualDate, actualAmount } = req.body;
    
    if (!Object.values(CLOSING_EVENT_STATUS).includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const updatedEvent = await storage.updateClosingScheduleEventStatus(id, status, actualDate, actualAmount);
    
    if (!updatedEvent) {
      return res.status(404).json({ error: 'Closing schedule event not found' });
    }
    
    // Create a timeline event for this status update
    if (status === CLOSING_EVENT_STATUS.COMPLETED) {
      const deal = await storage.getDeal(updatedEvent.dealId);
      
      // Get the user ID safely
      const userId = req.session?.userId || updatedEvent.createdBy;
      
      await storage.createTimelineEvent({
        dealId: updatedEvent.dealId,
        eventType: 'note',
        content: `${updatedEvent.eventName} completed with ${actualAmount ? (updatedEvent.amountType === 'dollar' ? `$${actualAmount.toLocaleString()}` : `${actualAmount}%`) : 'an undisclosed amount'}`,
        createdBy: userId,
        metadata: {
          closingEventId: [updatedEvent.id],
          closingEventType: [updatedEvent.eventType],
          closingEventStatus: [status]
        }
      });
    }
    
    res.json(updatedEvent);
  } catch (error) {
    console.error(`Error updating closing schedule event ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update closing schedule event' });
  }
});

// Update a closing schedule event date
router.patch('/:id/date', requireAuth, requirePermission('edit', 'closingEvent'), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledDate } = req.body;
    
    // Validate the date
    if (!scheduledDate) {
      return res.status(400).json({ error: 'scheduledDate is required' });
    }
    
    // Parse date - accept both ISO strings and date objects
    const parsedDate = new Date(scheduledDate);
    
    // Validate that the date is valid
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    // Get the event to confirm it exists
    const event = await storage.getClosingScheduleEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Closing schedule event not found' });
    }
    
    // Check if the event is already completed - if so, don't allow date changes
    if (event.status === CLOSING_EVENT_STATUS.COMPLETED) {
      return res.status(400).json({ 
        error: 'Cannot change date for a closing schedule event that has already been completed' 
      });
    }
    
    // Update the event date
    const updatedEvent = await storage.updateClosingScheduleEventDate(id, parsedDate);
    
    if (!updatedEvent) {
      return res.status(404).json({ error: 'Closing schedule event not found or could not be updated' });
    }
    
    // Get the user ID safely
    const userId = req.session?.userId || updatedEvent.createdBy;
    
    // Create a timeline event for this date update
    await storage.createTimelineEvent({
      dealId: updatedEvent.dealId,
      eventType: 'note',
      content: `${updatedEvent.eventName} rescheduled to ${parsedDate.toLocaleDateString()}`,
      createdBy: userId,
      metadata: {
        closingEventId: [updatedEvent.id],
        closingEventType: [updatedEvent.eventType]
      }
    });
    
    res.json(updatedEvent);
  } catch (error) {
    console.error(`Error updating closing schedule event date for event ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update closing schedule event date' });
  }
});

// Delete a closing schedule event - rewritten to use async/await
router.delete('/:id', requireAuth, requirePermission('delete', 'closingEvent'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('DELETE request to /api/closing-schedules/', req.params.id);
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const userId = req.user?.id || 0; // Default to 0 if user ID is undefined
    console.log(`User ID ${userId} attempting to delete closing schedule event ${id}`);
    
    // First get the event to ensure it exists
    const event = await storage.getClosingScheduleEvent(id);
    
    if (!event) {
      return res.status(404).json({ message: 'Closing schedule event not found' });
    }
    
    // Delete the event
    const deleteSuccess = await storage.deleteClosingScheduleEvent(id);
    
    if (!deleteSuccess) {
      return res.status(500).json({ message: 'Failed to delete closing schedule event' });
    }
    
    // Create a timeline event for this deletion
    await storage.createTimelineEvent({
      dealId: event.dealId,
      eventType: 'note',
      content: `Closing event "${event.eventName}" has been deleted`,
      createdBy: userId || 0, // Default to 0 if userId is undefined
      metadata: {
        closingEventId: [event.id],
        closingEventType: [event.eventType],
        action: ['deleted']
      }
    });
    
    console.log(`Successfully deleted closing schedule event with ID ${id}`);
    return res.json({ success: true, id });
  } catch (error) {
    console.error(`Error deleting closing schedule event ${req.params.id}:`, error);
    return res.status(500).json({ 
      message: 'Failed to delete closing schedule event',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;