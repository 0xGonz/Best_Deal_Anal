/**
 * Queue Processing Service
 * 
 * Implements background job processing to move heavy tasks off the main thread.
 * Addresses Issue #1 from performance audit - Single-process bottlenecks.
 */

import { EventEmitter } from 'events';
import { pool } from '../db';

interface QueueJob {
  id?: number;
  type: string;
  payload: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt?: Date;
  scheduledFor?: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  result?: any;
}

interface QueueProcessor {
  type: string;
  handler: (payload: any) => Promise<any>;
  concurrency: number;
  timeout: number;
}

export class JobQueueService extends EventEmitter {
  private processors = new Map<string, QueueProcessor>();
  private processing = new Map<string, number>(); // Track active jobs per type
  private pollInterval: NodeJS.Timeout | null = null;
  private isStarted = false;

  constructor() {
    super();
    this.setupProcessors();
  }

  // Initialize the job queue table
  async initialize() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_queue (
          id SERIAL PRIMARY KEY,
          type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          priority INTEGER DEFAULT 0,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processing_started_at TIMESTAMP,
          completed_at TIMESTAMP,
          error_message TEXT,
          result JSONB
        );
        
        -- Indexes for efficient job processing
        CREATE INDEX IF NOT EXISTS idx_job_queue_status_priority 
        ON job_queue(status, priority DESC, scheduled_for);
        
        CREATE INDEX IF NOT EXISTS idx_job_queue_type_status 
        ON job_queue(type, status);
        
        CREATE INDEX IF NOT EXISTS idx_job_queue_created_at 
        ON job_queue(created_at);
      `);
      
      console.log('✅ Job queue table initialized');
    } catch (error) {
      console.error('Failed to initialize job queue:', error);
    }
  }

  // Setup built-in processors for common heavy tasks
  private setupProcessors() {
    // PDF processing processor
    this.registerProcessor({
      type: 'pdf-processing',
      handler: this.processPdfJob.bind(this),
      concurrency: 2,
      timeout: 60000 // 1 minute
    });

    // CSV import processor
    this.registerProcessor({
      type: 'csv-import',
      handler: this.processCsvImport.bind(this),
      concurrency: 1,
      timeout: 300000 // 5 minutes
    });

    // AI analysis processor
    this.registerProcessor({
      type: 'ai-analysis',
      handler: this.processAiAnalysis.bind(this),
      concurrency: 1,
      timeout: 120000 // 2 minutes
    });

    // Email notifications processor
    this.registerProcessor({
      type: 'email-notification',
      handler: this.processEmailNotification.bind(this),
      concurrency: 5,
      timeout: 30000 // 30 seconds
    });

    // Report generation processor
    this.registerProcessor({
      type: 'report-generation',
      handler: this.processReportGeneration.bind(this),
      concurrency: 1,
      timeout: 180000 // 3 minutes
    });
  }

  // Register a new job processor
  registerProcessor(processor: QueueProcessor) {
    this.processors.set(processor.type, processor);
    this.processing.set(processor.type, 0);
  }

  // Add job to queue
  async addJob(
    type: string,
    payload: any,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<number> {
    const {
      priority = 0,
      delay = 0,
      maxAttempts = 3
    } = options;

    const scheduledFor = new Date(Date.now() + delay);

    try {
      const result = await pool.query(`
        INSERT INTO job_queue (type, payload, priority, max_attempts, scheduled_for)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [type, JSON.stringify(payload), priority, maxAttempts, scheduledFor]);

      const jobId = result.rows[0].id;
      console.log(`📋 Job queued: ${type} (ID: ${jobId}, Priority: ${priority})`);
      
      this.emit('jobQueued', { id: jobId, type, payload, priority });
      return jobId;
    } catch (error) {
      console.error('Failed to add job to queue:', error);
      throw error;
    }
  }

  // Start the queue processor
  start() {
    if (this.isStarted) return;
    
    this.isStarted = true;
    this.pollInterval = setInterval(() => {
      this.processJobs();
    }, 1000); // Check for jobs every second

    console.log('🚀 Job queue processor started');
  }

  // Stop the queue processor
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isStarted = false;
    console.log('⏹️ Job queue processor stopped');
  }

  // Process available jobs
  private async processJobs() {
    for (const [type, processor] of this.processors) {
      const currentProcessing = this.processing.get(type) || 0;
      
      if (currentProcessing < processor.concurrency) {
        await this.processJobsOfType(type, processor);
      }
    }
  }

  // Process jobs of a specific type
  private async processJobsOfType(type: string, processor: QueueProcessor) {
    try {
      // Get next available job
      const result = await pool.query(`
        UPDATE job_queue 
        SET status = 'processing', processing_started_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id FROM job_queue 
          WHERE type = $1 AND status = 'pending' 
            AND scheduled_for <= CURRENT_TIMESTAMP
            AND attempts < max_attempts
          ORDER BY priority DESC, created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `, [type]);

      if (result.rows.length === 0) return;

      const job = result.rows[0];
      const currentProcessing = this.processing.get(type) || 0;
      this.processing.set(type, currentProcessing + 1);

      // Process the job
      setImmediate(() => this.executeJob(job, processor));
      
    } catch (error) {
      console.error(`Failed to get job of type ${type}:`, error);
    }
  }

  // Execute a single job
  private async executeJob(job: any, processor: QueueProcessor) {
    const startTime = Date.now();
    
    try {
      console.log(`⚡ Processing job: ${job.type} (ID: ${job.id})`);
      
      // Set timeout for job execution
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), processor.timeout);
      });

      // Parse payload
      const payload = typeof job.payload === 'string' 
        ? JSON.parse(job.payload) 
        : job.payload;

      // Execute the job handler with timeout
      const result = await Promise.race([
        processor.handler(payload),
        timeoutPromise
      ]);

      // Mark job as completed
      await pool.query(`
        UPDATE job_queue 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, result = $2
        WHERE id = $1
      `, [job.id, JSON.stringify(result)]);

      const duration = Date.now() - startTime;
      console.log(`✅ Job completed: ${job.type} (ID: ${job.id}) in ${duration}ms`);
      
      this.emit('jobCompleted', { id: job.id, type: job.type, duration, result });

    } catch (error) {
      console.error(`❌ Job failed: ${job.type} (ID: ${job.id}):`, error.message);
      
      const attempts = job.attempts + 1;
      const isMaxAttempts = attempts >= job.max_attempts;
      
      await pool.query(`
        UPDATE job_queue 
        SET status = $1, attempts = $2, error_message = $3
        WHERE id = $4
      `, [
        isMaxAttempts ? 'failed' : 'pending',
        attempts,
        error.message,
        job.id
      ]);

      this.emit('jobFailed', { 
        id: job.id, 
        type: job.type, 
        error: error.message, 
        attempts,
        willRetry: !isMaxAttempts 
      });
    } finally {
      // Decrement processing counter
      const currentProcessing = this.processing.get(job.type) || 0;
      this.processing.set(job.type, Math.max(0, currentProcessing - 1));
    }
  }

  // Built-in job processors

  private async processPdfJob(payload: { filePath: string; action: string; options?: any }) {
    // Move PDF processing off main thread
    const { filePath, action, options } = payload;
    
    switch (action) {
      case 'extract-text':
        // Simulate PDF text extraction
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { text: `Extracted text from ${filePath}`, pages: 10 };
        
      case 'generate-thumbnail':
        // Simulate thumbnail generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { thumbnailPath: `/thumbnails/${filePath.split('/').pop()}.jpg` };
        
      default:
        throw new Error(`Unknown PDF action: ${action}`);
    }
  }

  private async processCsvImport(payload: { filePath: string; dealId?: number; userId: number }) {
    // Move CSV processing off main thread
    const { filePath, dealId, userId } = payload;
    
    // Simulate CSV processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      rowsProcessed: 150,
      recordsCreated: 140,
      errors: 10,
      filePath
    };
  }

  private async processAiAnalysis(payload: { documentId: number; analysisType: string }) {
    // Move AI analysis off main thread
    const { documentId, analysisType } = payload;
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      documentId,
      analysisType,
      insights: ['Key insight 1', 'Key insight 2'],
      confidence: 0.85
    };
  }

  private async processEmailNotification(payload: { to: string; subject: string; body: string }) {
    // Move email sending off main thread
    const { to, subject } = payload;
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { sent: true, to, subject, sentAt: new Date() };
  }

  private async processReportGeneration(payload: { type: string; parameters: any; userId: number }) {
    // Move report generation off main thread
    const { type, parameters, userId } = payload;
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    return {
      reportType: type,
      filePath: `/reports/${type}-${Date.now()}.pdf`,
      generatedAt: new Date(),
      userId
    };
  }

  // Get queue statistics
  async getQueueStats(): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT 
          status,
          type,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, CURRENT_TIMESTAMP) - created_at))) as avg_duration
        FROM job_queue
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY status, type
        ORDER BY type, status
      `);

      const processingStats = Array.from(this.processing.entries()).map(([type, count]) => ({
        type,
        currentlyProcessing: count
      }));

      return {
        queueStats: result.rows,
        processingStats,
        totalProcessors: this.processors.size
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return null;
    }
  }

  // Clean up old completed jobs
  async cleanupOldJobs(daysToKeep: number = 7) {
    try {
      const result = await pool.query(`
        DELETE FROM job_queue 
        WHERE status IN ('completed', 'failed') 
          AND completed_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
      `);
      
      console.log(`🧹 Cleaned up ${result.rowCount} old jobs`);
    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
    }
  }
}

// Export singleton instance
export const jobQueue = new JobQueueService();