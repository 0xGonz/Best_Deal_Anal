import { Router, Request, Response } from "express";
import { StorageFactory } from "../storage-factory";
import { requireAuth } from "../utils/auth";

const router = Router();

// Get activity feed with improved error handling and performance
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('Activity feed request received');
    const storage = StorageFactory.getStorage();
    
    // Use a timeout to prevent long-running queries
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Activity feed query timed out')), 8000)
    );
    
    // First check if we can get deals to avoid long processing if database is unavailable
    const deals = await Promise.race([
      storage.getDeals(),
      timeoutPromise
    ]) as any[];
    
    if (!deals || !Array.isArray(deals)) {
      console.error('Failed to retrieve deals for activity feed');
      return res.status(404).json({ message: 'No deals available' });
    }
    
    console.log(`Retrieved ${deals.length} deals for activity feed`);
    
    // Get only the most recent events for better performance
    // Limit to 100 deals or less to avoid excessive queries
    const dealsToProcess = deals.slice(0, 100);
    const allEvents: Array<any> = [];
    
    // Process deals in batches to avoid memory issues
    const BATCH_SIZE = 10;
    for (let i = 0; i < dealsToProcess.length; i += BATCH_SIZE) {
      const batch = dealsToProcess.slice(i, i + BATCH_SIZE);
      const batchEvents = await Promise.all(
        batch.map(async (deal) => {
          try {
            // Only get the 5 most recent events per deal for better performance
            const events = await storage.getTimelineEventsByDeal(deal.id);
            const recentEvents = events.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ).slice(0, 5);
            
            // Add deal info to each event
            return recentEvents.map(event => ({
              ...event,
              deal: {
                id: deal.id,
                name: deal.name,
                stageLabel: deal.stageLabel || deal.stage
              }
            }));
          } catch (err) {
            console.error(`Error fetching events for deal ${deal.id}:`, err);
            return []; // Return empty array for this deal instead of failing
          }
        })
      );
      
      // Flatten the batch events and add to all events
      for (const events of batchEvents) {
        allEvents.push(...events);
      }
    }
    
    console.log(`Retrieved ${allEvents.length} events for activity feed`);
    
    // Sort by date (descending) and limit to latest 20
    const sortedEvents = allEvents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 20);
    
    // Get user info for each event
    const userIds = Array.from(new Set(sortedEvents.map(e => e.createdBy)));
    console.log(`Fetching information for ${userIds.length} users`);
    
    // Use Promise.allSettled to handle potential failures in user fetching
    const userPromises = userIds.map(id => storage.getUser(id));
    const userResults = await Promise.allSettled(userPromises);
    
    // Filter out the failed promises and extract values from fulfilled ones
    const users = userResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(Boolean); // Remove any null values
    
    const eventsWithUserInfo = sortedEvents.map(event => {
      const user = users.find(u => u?.id === event.createdBy);
      return {
        ...event,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          initials: user.initials,
          avatarColor: user.avatarColor,
          role: user.role
        } : null
      };
    });
    
    console.log('Activity feed successfully generated');
    res.json(eventsWithUserInfo);
  } catch (error) {
    console.error('Error generating activity feed:', error);
    // Return a more specific error message with a 500 status
    res.status(500).json({ 
      message: 'Failed to fetch activity feed',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;