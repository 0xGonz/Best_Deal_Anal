#!/usr/bin/env tsx
/**
 * Dedicated Worker Process
 * 
 * Runs queue processors in a separate Node.js process to prevent
 * heavy tasks (PDF rendering, CSV processing, AI analysis) from
 * blocking the main web server event loop.
 */

import 'dotenv/config';
import { JobQueueService } from './server/services/queue-processor.service';
import fs from 'fs/promises';
import path from 'path';

console.log('🚀 Starting dedicated worker process...');

// Initialize the job queue service for the worker process
const jobQueueService = new JobQueueService();

async function startWorker() {
  try {
    // Initialize the job queue database
    await jobQueueService.initialize();
    
    // Start processing jobs
    await jobQueueService.start();
    
    console.log('✅ Worker process started successfully');
    console.log('📄 Ready for PDF generation jobs');
    console.log('📊 Ready for CSV processing jobs');
    console.log('🤖 Ready for AI analysis jobs');
    console.log('📧 Ready for notification jobs');
    console.log('📋 Ready for report generation jobs');
    
    // Setup health monitoring
    setupHealthMonitoring();
    
  } catch (error) {
    console.error('❌ Failed to start worker process:', error);
    process.exit(1);
  }
}

// Worker Process Health Monitoring
function setupHealthMonitoring() {
  // Health check data
  setInterval(async () => {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        status: 'running',
        processingCounts: jobQueueService.getProcessingCounts(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };
      
      // Ensure storage directory exists
      await fs.mkdir('./storage', { recursive: true });
      
      // Store worker health in a file that the main process can read
      await fs.writeFile('./storage/worker-health.json', JSON.stringify(stats, null, 2));
    } catch (err) {
      console.error('Failed to write health stats:', err);
    }
  }, 30000); // Update every 30 seconds
  
  // Log processing statistics every 5 minutes
  setInterval(() => {
    const counts = jobQueueService.getProcessingCounts();
    console.log('📊 Worker stats:', counts);
  }, 5 * 60 * 1000);
}

// Graceful Shutdown
async function gracefulShutdown() {
  console.log('🛑 Shutting down worker gracefully...');
  
  try {
    await jobQueueService.stop();
    console.log('✅ Worker shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during worker shutdown:', error);
    process.exit(1);
  }
}

// Process Signal Handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception in worker:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection in worker:', reason);
  gracefulShutdown();
});

// Start the worker
startWorker();