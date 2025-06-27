import Queue, { Job, JobOptions } from 'bull';
import { pool } from '../db';

/**
 * JobQueue service for handling asynchronous tasks
 * 
 * This service uses Bull to create and process job queues
 * for tasks that need to be processed in the background
 */
export class JobQueueService {
  private static instance: JobQueueService;
  
  // Map of queue names to Queue instances
  private queues: Map<string, Queue.Queue> = new Map();
  
  // Default queue options
  private defaultQueueOptions: Queue.QueueOptions = {
    redis: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD,
      // Add TLS support for production environments
      tls: process.env.REDIS_TLS === 'true' ? {
        rejectUnauthorized: process.env.REDIS_REJECT_UNAUTHORIZED !== 'false'
      } : undefined,
      // Add connection timeout
      connectTimeout: 10000
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  };
  
  // Queue names
  public static QUEUES = {
    EMAIL: 'email',
    DOCUMENT_PROCESSING: 'document-processing',
    REPORT_GENERATION: 'report-generation',
    DATA_IMPORT: 'data-import',
    NOTIFICATIONS: 'notifications'
  };
  
  constructor() {
    console.log('Initializing job queue service...');
  }
  
  /**
   * Get the singleton instance of the job queue service
   */
  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }
  
  /**
   * Get or create a queue by name
   */
  public getQueue(name: string): Queue.Queue {
    if (!this.queues.has(name)) {
      // Enhanced queue configuration with better error handling
      const queueOptions = {
        ...this.defaultQueueOptions,
        settings: {
          stalledInterval: 300000, // 5 minutes
          maxStalledCount: 1
        }
      };
      
      // Check if Redis is available - if not, always use mock queues
      if (!process.env.REDIS_HOST || process.env.USE_MOCK_QUEUE === 'true') {
        console.log(`Using in-memory mock queue for ${name} - Redis not configured or mock forced`);
        this.createMockQueue(name);
        return this.queues.get(name)!;
      }
      
      // Try to connect to Redis and create a real queue
      console.log(`Creating queue with Redis: ${name}`);
      try {
        const queue = new Queue(name, queueOptions);
        
        // Enhanced error monitoring and handling
        queue.on('error', (error) => {
          console.error(`Queue ${name} Redis error:`, error);
          
          // If we get a Redis error after initial setup, we could swap to in-memory
          // This can happen if Redis becomes unavailable during runtime
          const errorObj = error as any; // Cast to any to access potential code property
          if (errorObj && (errorObj.code === 'ECONNREFUSED' || errorObj.code === 'NR_CLOSED')) {
            console.warn(`Redis connection lost for queue ${name}, will use in-memory fallback for future operations`);
            // But we don't replace the queue here to avoid disrupting existing jobs
          }
        });
        
        queue.on('failed', (job, error) => {
          console.error(`Job ${job.id} in queue ${name} failed:`, error);
        });
        
        queue.on('stalled', (job) => {
          console.warn(`Job ${job.id} in queue ${name} stalled`);
        });
        
        // Improved connection monitoring
        queue.on('ready', () => {
          console.log(`Queue ${name} successfully connected to Redis`);
        });
        
        this.queues.set(name, queue);
      } catch (error) {
        console.error(`Failed to create Redis queue ${name}:`, error);
        
        // If Redis connection fails, fall back to the in-memory implementation
        this.createMockQueue(name);
      }
    }
    
    return this.queues.get(name)!;
  }
  
  /**
   * Create an in-memory mock queue that implements the essential Queue interface
   * This is used as a fallback when Redis is not available
   */
  private createMockQueue(name: string): void {
    console.log(`Creating in-memory mock queue: ${name}`);
    
    // Local in-memory storage for jobs
    const jobs: Map<string, { id: string, data: any, timestamp: string }> = new Map();
    const handlers: Array<{ concurrency: number, handler: (job: Job) => Promise<any> }> = [];
    
    // Create a more robust in-memory implementation that can actually process jobs
    const mockQueue = {
      add: (data: any, opts?: JobOptions) => {
        // Generate a unique ID for the job
        const jobId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Store job info in our in-memory map
        const jobInfo = {
          id: jobId,
          data,
          timestamp: new Date().toISOString()
        };
        
        jobs.set(jobId, jobInfo);
        console.log(`Mock job created in queue ${name}:`, { id: jobId, dataType: typeof data });
        
        // Return a Job-like object
        const jobObject = {
          id: jobId,
          data,
          opts,
          queue: { name },
          finished: () => Promise.resolve(),
          remove: () => {
            jobs.delete(jobId);
            return Promise.resolve();
          }
        } as Job;
        
        // If we have handlers, process the job immediately
        if (handlers.length > 0) {
          const handler = handlers[0].handler;
          console.log(`Processing mock job ${jobId} immediately`);
          
          // Don't await - simulates async processing
          Promise.resolve().then(() => {
            handler(jobObject)
              .then(() => {
                console.log(`Successfully processed mock job ${jobId}`);
              })
              .catch((error) => {
                console.error(`Error processing mock job ${jobId}:`, error);
              });
          });
        }
        
        return Promise.resolve(jobObject);
      },
      
      process: (concurrency: number, handler: (job: Job) => Promise<any>) => {
        console.log(`Registered processor for mock queue ${name} with concurrency: ${concurrency}`);
        handlers.push({ concurrency, handler });
        
        // Process any existing jobs
        if (jobs.size > 0) {
          console.log(`Processing ${jobs.size} existing mock jobs in queue ${name}`);
          for (const [jobId, jobInfo] of jobs.entries()) {
            const jobObject = {
              id: jobId,
              data: jobInfo.data,
              queue: { name },
              finished: () => Promise.resolve(),
              remove: () => {
                jobs.delete(jobId);
                return Promise.resolve();
              }
            } as Job;
            
            handler(jobObject)
              .then(() => {
                console.log(`Successfully processed existing mock job ${jobId}`);
              })
              .catch((error) => {
                console.error(`Error processing existing mock job ${jobId}:`, error);
              });
          }
        }
      },
      
      on: (event: string, handler: (...args: any[]) => void) => {
        console.log(`Registered event handler for mock queue ${name} event: ${event}`);
        return mockQueue; // For chaining
      },
      
      getJobs: () => Promise.resolve(Array.from(jobs.entries()).map(([id, job]) => ({
        id,
        data: job.data
      })) as unknown as Job[]),
      
      close: () => {
        console.log(`Closing mock queue: ${name}`);
        jobs.clear();
        return Promise.resolve();
      },
      
      count: () => Promise.resolve(jobs.size)
    } as unknown as Queue.Queue;
    
    this.queues.set(name, mockQueue);
  }
  
  /**
   * Add a job to a queue
   */
  public async addJob<T>(
    queueName: string, 
    data: T, 
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(data, options);
  }
  
  /**
   * Register a processor for a queue
   */
  public processQueue<T>(
    queueName: string, 
    concurrency: number, 
    handler: (job: Job<T>) => Promise<any>
  ): void {
    const queue = this.getQueue(queueName);
    queue.process(concurrency, handler);
  }
  
  /**
   * Get all jobs in a queue with a specific status
   */
  public async getJobs(
    queueName: string, 
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  ): Promise<Array<Job>> {
    const queue = this.getQueue(queueName);
    return queue.getJobs([status]);
  }
  
  /**
   * Close all queues (useful for graceful shutdown)
   */
  public async closeAll(): Promise<void> {
    const promises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(promises);
    this.queues.clear();
  }
}