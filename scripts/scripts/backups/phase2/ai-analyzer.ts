import OpenAI from 'openai';
import { StorageFactory } from '../storage-factory';
import { DataExtractor } from './data-extractor';
import * as fs from 'fs';
import * as path from 'path';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DealContext {
  deal: any;
  memos: any[];
  documents: any[];
  extractedData: any[];
  allocations: any[];
  activities: any[];
  calendar: {
    meetings: {
      total: number;
      past: number;
      upcoming: number;
      nextMeeting: any;
      allMeetings: any[];
    };
    capitalCalls: {
      total: number;
      completed: number;
      pending: number;
      nextCall: any;
      allCalls: any[];
    };
    closings: {
      total: number;
      nextClosing: any;
      allClosings: any[];
    };
    timeline: {
      recentActivity: any[];
    };
  };
}

export interface AnalysisResponse {
  response: string;
  context: {
    dealId: number;
    dealName: string;
    dataSourcesUsed: string[];
    timestamp: Date;
  };
}

export class AIAnalyzer {
  
  /**
   * Extract all contextual data for a specific deal
   */
  static async extractDealContext(dealId: number): Promise<DealContext> {
    const storage = StorageFactory.getStorage();
    
    console.log(`🔍 Extracting full context for deal ${dealId}`);
    
    // Get the main deal information
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }
    
    // Get all related data
    const [memos, documents, allocations] = await Promise.all([
      storage.getMiniMemosByDeal(dealId),
      storage.getDocumentsByDeal(dealId),
      storage.getAllocationsByDeal(dealId)
    ]);
    
    // Get activities manually for now (will add proper method later)
    const dealActivities: any[] = [];
    
    // Get comprehensive calendar context for this deal
    const calendar = await AIAnalyzer.extractCalendarContext(dealId, storage);
    
    // Extract data from ALL document types (Excel/CSV/PDF)
    const extractedData: any[] = [];
    for (const doc of documents) {
      const extension = path.extname(doc.fileName).toLowerCase();
      try {
        // Find the actual file path
        const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
        const possiblePaths = [
          path.resolve(UPLOAD_PATH, 'deals', dealId.toString(), doc.fileName),
          path.resolve(UPLOAD_PATH, dealId.toString(), doc.fileName),
          path.resolve(UPLOAD_PATH, doc.fileName),
          path.resolve(doc.filePath)
        ];
        
        let actualFilePath = null;
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            actualFilePath = testPath;
            break;
          }
        }
        
        if (actualFilePath) {
          if (['.xlsx', '.xls', '.xlsm', '.csv'].includes(extension)) {
            // Extract structured data from Excel/CSV
            const data = await DataExtractor.extractData(actualFilePath, doc.fileName);
            extractedData.push({
              documentId: doc.id,
              fileName: doc.fileName,
              documentType: doc.documentType,
              extractedData: data
            });
            console.log(`📊 Extracted data from ${doc.fileName}: ${data.metadata.totalRows} rows`);
          } else if (extension === '.pdf') {
            // Extract text content from PDF documents
            const pdfParse = await import('pdf-parse');
            const pdfBuffer = fs.readFileSync(actualFilePath);
            const pdfData = await pdfParse.default(pdfBuffer);
            
            extractedData.push({
              documentId: doc.id,
              fileName: doc.fileName,
              documentType: doc.documentType,
              textContent: pdfData.text,
              pages: pdfData.numpages
            });
            console.log(`📄 Extracted text from PDF ${doc.fileName}: ${pdfData.numpages} pages`);
          }
        }
      } catch (error) {
        console.error(`Failed to extract data from ${doc.fileName}:`, error);
      }
    }
    
    console.log(`✅ Extracted context for ${deal.name}: ${memos.length} memos, ${documents.length} documents, ${extractedData.length} data files`);
    
    return {
      deal,
      memos,
      documents,
      extractedData,
      allocations,
      activities: dealActivities,
      calendar
    };
  }

  /**
   * Extract comprehensive calendar and timeline context for a specific deal
   */
  static async extractCalendarContext(dealId: number, storage: any) {
    try {
      console.log(`📅 Extracting calendar context for deal ${dealId}`);
      
      // Get calendar-related data for this specific deal
      const [meetings, capitalCalls, closingSchedules] = await Promise.all([
        storage.getMeetingsByDeal?.(dealId).catch(() => []) || [],
        storage.getCapitalCallsByDeal?.(dealId).catch(() => []) || [],
        storage.getClosingSchedulesByDeal?.(dealId).catch(() => []) || []
      ]);

      const now = new Date();
      
      // Analyze meetings
      const pastMeetings = meetings.filter((m: any) => new Date(m.date || m.scheduledDate) <= now);
      const upcomingMeetings = meetings
        .filter((m: any) => new Date(m.date || m.scheduledDate) > now)
        .sort((a: any, b: any) => 
          new Date(a.date || a.scheduledDate).getTime() - new Date(b.date || b.scheduledDate).getTime()
        );
      
      // Analyze capital calls
      const completedCapitalCalls = capitalCalls.filter((cc: any) => cc.status === 'completed' || cc.status === 'paid');
      const pendingCapitalCalls = capitalCalls.filter((cc: any) => cc.status === 'pending' || cc.status === 'issued');
      const upcomingCapitalCalls = capitalCalls
        .filter((cc: any) => new Date(cc.dueDate || cc.callDate) > now)
        .sort((a: any, b: any) => 
          new Date(a.dueDate || a.callDate).getTime() - new Date(b.dueDate || b.callDate).getTime()
        );
      
      // Analyze closings
      const upcomingClosings = closingSchedules
        .filter((cs: any) => new Date(cs.scheduledDate) > now)
        .sort((a: any, b: any) => 
          new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
        );

      // Create comprehensive timeline of recent activity (last 90 days)
      const recentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentActivity = [
        ...meetings.map((m: any) => ({
          ...m,
          type: 'meeting',
          date: m.date || m.scheduledDate,
          title: m.title || m.subject || 'Meeting'
        })),
        ...capitalCalls.map((cc: any) => ({
          ...cc,
          type: 'capital_call',
          date: cc.dueDate || cc.callDate,
          title: `Capital Call - $${cc.amount?.toLocaleString()}`
        })),
        ...closingSchedules.map((cs: any) => ({
          ...cs,
          type: 'closing',
          date: cs.scheduledDate,
          title: cs.eventName || 'Closing Event'
        }))
      ]
      .filter((item: any) => item.date && new Date(item.date) >= recentCutoff)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const calendarContext = {
        meetings: {
          total: meetings.length,
          past: pastMeetings.length,
          upcoming: upcomingMeetings.length,
          nextMeeting: upcomingMeetings[0] || null,
          allMeetings: meetings
        },
        capitalCalls: {
          total: capitalCalls.length,
          completed: completedCapitalCalls.length,
          pending: pendingCapitalCalls.length,
          nextCall: upcomingCapitalCalls[0] || null,
          allCalls: capitalCalls
        },
        closings: {
          total: closingSchedules.length,
          nextClosing: upcomingClosings[0] || null,
          allClosings: closingSchedules
        },
        timeline: {
          recentActivity: recentActivity.slice(0, 20) // Limit to 20 most recent
        }
      };

      console.log(`📅 Calendar context extracted: ${meetings.length} meetings, ${capitalCalls.length} capital calls, ${closingSchedules.length} closings`);
      return calendarContext;

    } catch (error) {
      console.warn('Error extracting calendar context:', error);
      // Return empty context if calendar data unavailable
      return {
        meetings: { total: 0, past: 0, upcoming: 0, nextMeeting: null, allMeetings: [] },
        capitalCalls: { total: 0, completed: 0, pending: 0, nextCall: null, allCalls: [] },
        closings: { total: 0, nextClosing: null, allClosings: [] },
        timeline: { recentActivity: [] }
      };
    }
  }

  /**
   * Get deal context for API endpoints
   */
  async getDealContext(dealId: number): Promise<DealContext> {
    return await AIAnalyzer.extractDealContext(dealId);
  }

  /**
   * Format deal context into a comprehensive prompt for AI analysis
   */
  static formatDealContextForAI(context: DealContext): string {
    const { deal, memos, documents, extractedData, allocations, activities, calendar } = context;
    
    let prompt = `# DEAL ANALYSIS CONTEXT\n\n`;
    
    // Deal Overview
    prompt += `## DEAL OVERVIEW\n`;
    prompt += `**Name:** ${deal.name}\n`;
    prompt += `**Sector:** ${deal.sector || 'Not specified'}\n`;
    prompt += `**Stage:** ${deal.stage} (${deal.stageLabel})\n`;
    prompt += `**Description:** ${deal.description || 'No description provided'}\n`;
    prompt += `**Target Return:** ${deal.targetReturn || 'Not specified'}\n`;
    prompt += `**Score:** ${deal.score || 0}\n`;
    prompt += `**Contact:** ${deal.contactEmail || 'Not specified'}\n`;
    prompt += `**Created:** ${new Date(deal.createdAt).toLocaleDateString()}\n`;
    if (deal.targetRaise) prompt += `**Target Raise:** ${deal.targetRaise}\n`;
    if (deal.valuation) prompt += `**Valuation:** ${deal.valuation}\n`;
    if (deal.leadInvestor) prompt += `**Lead Investor:** ${deal.leadInvestor}\n`;
    if (deal.projectedIrr) prompt += `**Projected IRR:** ${deal.projectedIrr}\n`;
    if (deal.projectedMultiple) prompt += `**Projected Multiple:** ${deal.projectedMultiple}\n`;
    if (deal.notes) prompt += `**Notes:** ${deal.notes}\n`;
    prompt += `\n`;

    // Investment Memos
    if (memos.length > 0) {
      prompt += `## INVESTMENT MEMOS (${memos.length})\n`;
      memos.forEach((memo, index) => {
        prompt += `### Memo ${index + 1} (Score: ${memo.score})\n`;
        prompt += `**Thesis:** ${memo.thesis}\n`;
        if (memo.risksAndMitigations) prompt += `**Risks & Mitigations:** ${memo.risksAndMitigations}\n`;
        if (memo.pricingConsideration) prompt += `**Pricing:** ${memo.pricingConsideration}\n`;
        if (memo.marketRiskScore) prompt += `**Market Risk Score:** ${memo.marketRiskScore}\n`;
        if (memo.executionRiskScore) prompt += `**Execution Risk Score:** ${memo.executionRiskScore}\n`;
        if (memo.teamStrengthScore) prompt += `**Team Strength Score:** ${memo.teamStrengthScore}\n`;
        if (memo.competitiveAdvantageScore) prompt += `**Competitive Advantage Score:** ${memo.competitiveAdvantageScore}\n`;
        prompt += `**Created:** ${new Date(memo.createdAt).toLocaleDateString()}\n\n`;
      });
    }

    // Documents
    if (documents.length > 0) {
      prompt += `## DOCUMENTS (${documents.length})\n`;
      documents.forEach((doc, index) => {
        prompt += `### Document ${index + 1}: ${doc.fileName}\n`;
        prompt += `**Type:** ${doc.documentType}\n`;
        prompt += `**Size:** ${Math.round(doc.fileSize / 1024)} KB\n`;
        if (doc.description) prompt += `**Description:** ${doc.description}\n`;
        prompt += `**Uploaded:** ${new Date(doc.uploadedAt).toLocaleDateString()}\n\n`;
      });
    }

    // Extracted Document Content and Financial Data
    if (extractedData.length > 0) {
      prompt += `## DOCUMENT CONTENT AND DATA\n`;
      extractedData.forEach((data, index) => {
        if (data.textContent) {
          // PDF document content
          prompt += `### ${data.fileName} (PDF Document)\n`;
          prompt += `**Type:** ${data.documentType}\n`;
          prompt += `**Pages:** ${data.pages}\n`;
          prompt += `**Content:**\n${data.textContent}\n\n`;
        } else if (data.extractedData) {
          // Excel/CSV financial data
          prompt += `### Data from ${data.fileName} (${data.documentType})\n`;
          prompt += DataExtractor.formatForAI(data.extractedData);
          prompt += `\n`;
        }
      });
    }

    // Allocations
    if (allocations.length > 0) {
      prompt += `## FUND ALLOCATIONS (${allocations.length})\n`;
      allocations.forEach((allocation, index) => {
        prompt += `### Allocation ${index + 1}\n`;
        prompt += `**Amount:** $${allocation.amount?.toLocaleString() || 'Not specified'}\n`;
        prompt += `**Security Type:** ${allocation.securityType}\n`;
        prompt += `**Status:** ${allocation.status}\n`;
        prompt += `**Date:** ${new Date(allocation.allocationDate).toLocaleDateString()}\n`;
        if (allocation.notes) prompt += `**Notes:** ${allocation.notes}\n`;
        prompt += `\n`;
      });
    }

    // Calendar & Timeline Intelligence
    if (calendar) {
      prompt += `## CALENDAR & TIMELINE INTELLIGENCE\n`;
      
      // Meeting Analysis
      prompt += `### MEETINGS\n`;
      prompt += `**Total Meetings:** ${calendar.meetings.total}\n`;
      prompt += `**Past Meetings:** ${calendar.meetings.past}\n`;
      prompt += `**Upcoming Meetings:** ${calendar.meetings.upcoming}\n`;
      if (calendar.meetings.nextMeeting) {
        const nextMeeting = calendar.meetings.nextMeeting;
        prompt += `**Next Meeting:** ${nextMeeting.title || nextMeeting.subject || 'Meeting'} on ${new Date(nextMeeting.date || nextMeeting.scheduledDate).toLocaleDateString()}\n`;
        if (nextMeeting.description) prompt += `**Meeting Details:** ${nextMeeting.description}\n`;
      }
      prompt += `\n`;

      // Capital Calls Analysis
      prompt += `### CAPITAL CALLS\n`;
      prompt += `**Total Capital Calls:** ${calendar.capitalCalls.total}\n`;
      prompt += `**Completed Calls:** ${calendar.capitalCalls.completed}\n`;
      prompt += `**Pending Calls:** ${calendar.capitalCalls.pending}\n`;
      if (calendar.capitalCalls.nextCall) {
        const nextCall = calendar.capitalCalls.nextCall;
        prompt += `**Next Capital Call:** $${nextCall.amount?.toLocaleString()} due ${new Date(nextCall.dueDate || nextCall.callDate).toLocaleDateString()}\n`;
        if (nextCall.purpose) prompt += `**Call Purpose:** ${nextCall.purpose}\n`;
      }
      if (calendar.capitalCalls.allCalls.length > 0) {
        const totalCalled = calendar.capitalCalls.allCalls
          .filter((cc: any) => cc.status === 'completed' || cc.status === 'paid')
          .reduce((sum: number, cc: any) => sum + (cc.amount || 0), 0);
        if (totalCalled > 0) prompt += `**Total Capital Called:** $${totalCalled.toLocaleString()}\n`;
      }
      prompt += `\n`;

      // Closing Schedule Analysis
      prompt += `### CLOSING SCHEDULE\n`;
      prompt += `**Total Closing Events:** ${calendar.closings.total}\n`;
      if (calendar.closings.nextClosing) {
        const nextClosing = calendar.closings.nextClosing;
        prompt += `**Next Closing:** ${nextClosing.milestone || 'Closing Event'} on ${new Date(nextClosing.expectedDate || nextClosing.targetDate).toLocaleDateString()}\n`;
        if (nextClosing.description) prompt += `**Closing Details:** ${nextClosing.description}\n`;
      }
      prompt += `\n`;

      // Recent Timeline Activity
      if (calendar.timeline.recentActivity.length > 0) {
        prompt += `### RECENT TIMELINE ACTIVITY (Last 90 Days)\n`;
        calendar.timeline.recentActivity.slice(0, 10).forEach((activity: any, index: number) => {
          const activityDate = new Date(activity.date).toLocaleDateString();
          const activityType = activity.type.replace('_', ' ').toUpperCase();
          prompt += `**${activityDate}** - ${activityType}: ${activity.title}\n`;
          if (activity.description || activity.notes) {
            prompt += `  Details: ${activity.description || activity.notes}\n`;
          }
        });
        prompt += `\n`;
      }
    }

    // Recent Activities
    if (activities.length > 0) {
      prompt += `## RECENT ACTIVITIES (${Math.min(activities.length, 10)})\n`;
      activities.slice(0, 10).forEach((activity, index) => {
        prompt += `### ${new Date(activity.createdAt).toLocaleDateString()}: ${activity.content}\n`;
        if (activity.metadata) {
          prompt += `**Details:** ${JSON.stringify(activity.metadata)}\n`;
        }
        prompt += `\n`;
      });
    }

    prompt += `\n---\n\n`;
    prompt += `This is all the available data for the deal "${deal.name}". `;
    prompt += `Please provide analysis and insights based ONLY on this specific deal data. `;
    prompt += `Do not make assumptions about data not provided above.\n\n`;

    return prompt;
  }

  /**
   * Analyze a specific deal using AI
   */
  static async analyzeDeal(dealId: number, userQuery?: string): Promise<AnalysisResponse> {
    try {
      console.log(`🤖 Starting AI analysis for deal ${dealId}`);
      
      // Extract all deal context
      const context = await this.extractDealContext(dealId);
      const dealPrompt = this.formatDealContextForAI(context);
      
      // Prepare the system message for investment analysis
      const systemMessage = `You are an expert investment analyst with deep knowledge of private equity, venture capital, and institutional investing. You analyze deals comprehensively based on provided data and have full calendar intelligence.

Key responsibilities:
- Provide detailed investment analysis based ONLY on the provided deal data
- Answer calendar-related questions about meetings, closings, and capital calls for this specific deal
- Identify strengths, weaknesses, opportunities, and risks
- Analyze financial metrics and projections when available
- Evaluate team, market, and competitive positioning
- Assess valuation and return potential
- Highlight key concerns or red flags
- Suggest areas for further due diligence
- Provide timeline insights including next meetings, capital calls, and closing events

Calendar Intelligence Capabilities:
- Answer questions like "How many meetings have we had?" or "When is the next closing?"
- Provide insights on capital call timing and amounts
- Analyze meeting frequency and engagement patterns
- Identify upcoming critical dates and milestones
- Track deal progression through calendar events

Always base your analysis on the actual data provided. If information is missing, clearly state what additional data would be helpful for a complete analysis.`;

      const userMessage = userQuery 
        ? `Based on the deal data below, please answer this specific question: "${userQuery}"\n\n${dealPrompt}`
        : `Please provide a comprehensive investment analysis of this deal based on the data below:\n\n${dealPrompt}`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const response = completion.choices[0]?.message?.content || 'No analysis generated';
      
      // Determine data sources used
      const dataSourcesUsed = [];
      if (context.memos.length > 0) dataSourcesUsed.push(`${context.memos.length} investment memos`);
      if (context.documents.length > 0) dataSourcesUsed.push(`${context.documents.length} documents`);
      if (context.extractedData.length > 0) dataSourcesUsed.push(`${context.extractedData.length} financial data files`);
      if (context.allocations.length > 0) dataSourcesUsed.push(`${context.allocations.length} allocations`);
      if (context.activities.length > 0) dataSourcesUsed.push(`${context.activities.length} activities`);

      console.log(`✅ AI analysis complete for ${context.deal.name}`);

      return {
        response,
        context: {
          dealId,
          dealName: context.deal.name,
          dataSourcesUsed,
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('AI analysis failed:', error);
      throw new Error(`Failed to analyze deal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}