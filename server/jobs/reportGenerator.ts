import { Job } from 'bull';
import { JobQueueService } from '../services/JobQueue';
import { StorageFactory } from '../storage-factory';

/**
 * Interface for report generation job data
 */
interface ReportGenerationJob {
  reportType: 'deal_summary' | 'portfolio_performance' | 'fund_overview' | 'investment_metrics';
  parameters: {
    dealId?: number;
    fundId?: number;
    dateRange?: {
      start: string;
      end: string;
    };
    format?: 'pdf' | 'excel' | 'csv';
    userId: number; // User who requested the report
  };
}

/**
 * Process a report generation job asynchronously
 */
async function processReportGeneration(job: Job<ReportGenerationJob>) {
  const { reportType, parameters } = job.data;
  
  console.log(`Starting report generation: ${reportType}`);
  job.progress(10);
  
  try {
    // Get storage
    const storage = StorageFactory.getStorage();
    
    // Generate the report based on type
    let reportData: any;
    let reportFileName: string;
    
    // Simulate different report generation times based on complexity
    switch (reportType) {
      case 'deal_summary':
        if (!parameters.dealId) {
          throw new Error('Deal ID is required for deal summary report');
        }
        
        // Simulate deal data collection
        const deal = await storage.getDeal(parameters.dealId);
        if (!deal) {
          throw new Error(`Deal not found: ${parameters.dealId}`);
        }
        
        job.progress(30);
        
        // Simulate time to generate deal summary
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        reportData = {
          dealName: deal.name,
          stage: deal.stage,
          metrics: {
            score: deal.score || 0,
            projectedReturn: deal.projectedIrr || 'N/A',
            targetRaise: deal.targetRaise || 'N/A'
          },
          generatedAt: new Date().toISOString()
        };
        
        reportFileName = `deal_summary_${deal.id}_${Date.now()}.${parameters.format || 'pdf'}`;
        break;
        
      case 'portfolio_performance':
        // Simulate portfolio data collection
        job.progress(20);
        
        // Fetch all invested deals
        const investedDeals = await storage.getDealsByStage('invested');
        
        job.progress(40);
        
        // Simulate more complex calculations for portfolio performance
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        reportData = {
          portfolioSize: investedDeals.length,
          metrics: {
            totalInvested: Math.floor(Math.random() * 10000000) / 100,
            averageIRR: Math.floor(Math.random() * 3000) / 100,
            topPerformer: investedDeals.length > 0 ? investedDeals[0].name : 'N/A'
          },
          generatedAt: new Date().toISOString()
        };
        
        reportFileName = `portfolio_performance_${Date.now()}.${parameters.format || 'pdf'}`;
        break;
        
      case 'fund_overview':
        if (!parameters.fundId) {
          throw new Error('Fund ID is required for fund overview report');
        }
        
        // Simulate fund data collection
        const fund = await storage.getFund(parameters.fundId);
        if (!fund) {
          throw new Error(`Fund not found: ${parameters.fundId}`);
        }
        
        job.progress(30);
        
        // Get allocations for this fund
        const allocations = await storage.getAllocationsByFund(parameters.fundId);
        
        job.progress(50);
        
        // Simulate time to generate fund report
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        reportData = {
          fundName: fund.name,
          totalCapital: fund.totalCapital,
          allocations: allocations.length,
          metrics: {
            committed: allocations.reduce((sum, a) => sum + (a.amount || 0), 0),
            available: fund.totalCapital - allocations.reduce((sum, a) => sum + (a.amount || 0), 0),
            projectedReturns: Math.floor(Math.random() * 2500) / 100 + '%'
          },
          generatedAt: new Date().toISOString()
        };
        
        reportFileName = `fund_overview_${fund.id}_${Date.now()}.${parameters.format || 'pdf'}`;
        break;
        
      case 'investment_metrics':
        // This is the most complex report, simulate long processing time
        job.progress(20);
        
        // Fetch all deals
        const allDeals = await storage.getDeals();
        
        job.progress(30);
        
        // Fetch all funds
        const allFunds = await storage.getFunds();
        
        job.progress(40);
        
        // Simulate complex metric calculations
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        reportData = {
          dealCount: allDeals.length,
          fundCount: allFunds.length,
          metrics: {
            dealToInvestmentRatio: allDeals.filter(d => d.stage === 'invested').length / allDeals.length,
            averageDealScore: allDeals.reduce((sum, d) => sum + (d.score || 0), 0) / allDeals.length || 0,
            topFund: allFunds.length > 0 ? allFunds[0].name : 'N/A'
          },
          generatedAt: new Date().toISOString()
        };
        
        reportFileName = `investment_metrics_${Date.now()}.${parameters.format || 'pdf'}`;
        break;
        
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
    
    job.progress(80);
    
    // Simulate saving the report file
    console.log(`Report generated: ${reportFileName}`);
    
    // Create a notification for the user
    await storage.createNotification({
      userId: parameters.userId,
      title: `Report Generated: ${reportType}`,
      content: `Your ${reportType.replace('_', ' ')} report is ready.`,
      category: 'report',
      read: false,
      metadata: {
        reportType,
        reportFileName,
        generateTime: new Date().toISOString()
      }
    });
    
    job.progress(100);
    console.log(`Report generation completed: ${reportType}`);
    
    return {
      success: true,
      reportFileName,
      reportData
    };
  } catch (error) {
    console.error(`Report generation failed: ${reportType}`, error);
    throw error;
  }
}

/**
 * Initialize the report generation queue
 */
export function initReportGenerationQueue() {
  const jobQueueService = JobQueueService.getInstance();
  
  // Register report generation handler
  jobQueueService.processQueue(
    JobQueueService.QUEUES.REPORT_GENERATION,
    1, // Process 1 report at a time as they can be resource-intensive
    processReportGeneration
  );
  
  console.log('Report generation queue initialized');
}

/**
 * Queue a report for generation
 */
export async function queueReportGeneration(
  reportType: ReportGenerationJob['reportType'],
  parameters: ReportGenerationJob['parameters']
) {
  const jobQueueService = JobQueueService.getInstance();
  
  const job = await jobQueueService.addJob(
    JobQueueService.QUEUES.REPORT_GENERATION,
    {
      reportType,
      parameters
    },
    {
      // Report generation can be resource-intensive, so give it more time
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 10000
      },
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 300000 // 5 minutes for complex reports
    }
  );
  
  console.log(`Report queued for generation: ${reportType}, job ID: ${job.id}`);
  return job;
}