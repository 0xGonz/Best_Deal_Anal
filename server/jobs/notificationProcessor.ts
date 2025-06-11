import { Job } from 'bull';
import { JobQueueService } from '../services/JobQueue';
import { StorageFactory } from '../storage-factory';
import { InsertNotification } from '@shared/schema';

/**
 * Interface for notification job data
 */
interface NotificationJob {
  // Notification data
  notification: InsertNotification;
  // Optional delivery channels
  channels?: {
    email?: boolean;
    push?: boolean;
    inApp?: boolean;
  };
}

/**
 * Process a notification asynchronously
 */
async function processNotification(job: Job<NotificationJob>) {
  const { notification, channels = { inApp: true } } = job.data;
  
  console.log(`Processing notification for user ${notification.userId}`);
  job.progress(10);
  
  try {
    // Get storage
    const storage = StorageFactory.getStorage();
    
    // Create the in-app notification
    if (channels.inApp) {
      const createdNotification = await storage.createNotification(notification);
      console.log(`In-app notification created: ${createdNotification.id}`);
    }
    
    job.progress(50);
    
    // Send email notification if requested
    if (channels.email) {
      // Simulate sending an email
      console.log(`Sending email notification to user ${notification.userId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Email notification sent to user ${notification.userId}`);
    }
    
    // Send push notification if requested
    if (channels.push) {
      // Simulate sending a push notification
      console.log(`Sending push notification to user ${notification.userId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Push notification sent to user ${notification.userId}`);
    }
    
    job.progress(100);
    console.log(`Notification processing completed for user ${notification.userId}`);
    
    return { success: true };
  } catch (error) {
    console.error(`Notification processing failed for user ${notification.userId}`, error);
    throw error;
  }
}

/**
 * Initialize the notification processing queue
 */
export function initNotificationQueue() {
  const jobQueueService = JobQueueService.getInstance();
  
  // Register notification processing handler
  jobQueueService.processQueue(
    JobQueueService.QUEUES.NOTIFICATIONS,
    5, // Process 5 notifications concurrently
    processNotification
  );
  
  console.log('Notification queue initialized');
}

/**
 * Queue a notification for processing
 */
export async function queueNotification(
  notification: InsertNotification,
  channels?: NotificationJob['channels']
) {
  const jobQueueService = JobQueueService.getInstance();
  
  const job = await jobQueueService.addJob(
    JobQueueService.QUEUES.NOTIFICATIONS,
    {
      notification,
      channels
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
  
  console.log(`Notification queued for user ${notification.userId}, job ID: ${job.id}`);
  return job;
}