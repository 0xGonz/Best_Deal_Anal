/**
 * Job initialization module
 * This file initializes all job queues and exports queue functions
 */

import { initNotificationQueue, queueNotification } from './notificationProcessor';
import { initReportGenerationQueue, queueReportGeneration } from './reportGenerator';
import { JobQueueService } from '../services/JobQueue';

/**
 * Initialize all job queues
 */
export function initJobQueues() {
  // Initialize the job service
  JobQueueService.getInstance();
  
  console.log('Initializing job queues...');
  
  try {
    // Initialize each queue
    initNotificationQueue();
    initReportGenerationQueue();
    
    console.log('All job queues initialized successfully');
  } catch (error) {
    console.error('Error initializing job queues:', error);
  }
}

// Export queue functions for use in routes and services
export {
  queueNotification,
  queueReportGeneration
};