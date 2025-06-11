import { Router, Request, Response } from 'express';
import { requireAuth } from '../utils/auth';
import { AIAnalyzer } from '../services/ai-analyzer';
import { z } from 'zod';

const router = Router();

// Schema for analysis request
const analysisRequestSchema = z.object({
  query: z.string().optional()
});

// Get all deals for AI analysis
router.get('/deals', requireAuth, async (req: Request, res: Response) => {
  try {
    const { StorageFactory } = await import('../storage-factory');
    const storage = StorageFactory.getStorage();
    const deals = await storage.getDeals();
    
    res.json(deals);
  } catch (error) {
    console.error('Error getting deals for AI analysis:', error);
    res.status(500).json({ message: 'Failed to get deals' });
  }
});

// Analyze a specific deal
router.post('/deals/:dealId/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    const { query } = analysisRequestSchema.parse(req.body);
    
    const analysis = await AIAnalyzer.analyzeDeal(dealId, query);
    
    res.json({
      success: true,
      dealId,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error analyzing deal:', error);
    res.status(500).json({ message: 'Failed to analyze deal' });
  }
});

// Get deal context for AI analysis
router.get('/deals/:dealId/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    const context = await AIAnalyzer.extractDealContext(dealId);
    
    res.json({
      success: true,
      dealId,
      context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting deal context:', error);
    res.status(500).json({ 
      message: 'Failed to get deal context',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get comprehensive AI analysis for a specific deal
router.post('/deals/:dealId/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    console.log(`🤖 AI Analysis request for deal ${dealId} by user ${req.user?.username}`);

    // Validate request body
    const validation = analysisRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: 'Invalid request format',
        errors: validation.error.errors 
      });
    }

    const { query } = validation.data;

    // Generate AI analysis
    const analysis = await AIAnalyzer.analyzeDeal(dealId, query);

    console.log(`✅ AI Analysis completed for deal ${dealId}: ${analysis.context.dealName}`);

    return res.json({
      success: true,
      response: analysis.response,
      analysis: analysis.response, // Keep both for compatibility
      context: analysis.context,
      query: query || null
    });

  } catch (error) {
    console.error('AI Analysis error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ 
        message: 'Deal not found',
        error: error.message 
      });
    }

    return res.status(500).json({ 
      message: 'Failed to generate AI analysis',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get deal context data (for debugging or preview)
router.get('/deals/:dealId/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    console.log(`📋 Context extraction request for deal ${dealId}`);

    // Extract deal context
    const context = await AIAnalyzer.extractDealContext(dealId);

    // Return summary of available data
    const summary = {
      deal: {
        id: context.deal.id,
        name: context.deal.name,
        sector: context.deal.sector,
        stage: context.deal.stage,
        description: context.deal.description
      },
      dataAvailable: {
        memos: context.memos.length,
        documents: context.documents.length,
        extractedDataFiles: context.extractedData.length,
        allocations: context.allocations.length,
        activities: context.activities.length
      },
      extractedDataSummary: context.extractedData.map(data => ({
        fileName: data.fileName,
        documentType: data.documentType,
        rows: data.extractedData.metadata.totalRows,
        columns: data.extractedData.metadata.totalColumns
      }))
    };

    console.log(`✅ Context extracted for deal ${dealId}: ${context.deal.name}`);

    return res.json({
      success: true,
      summary,
      // Include full context if requested (for debugging)
      fullContext: req.query.full === 'true' ? context : undefined
    });

  } catch (error) {
    console.error('Context extraction error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ 
        message: 'Deal not found',
        error: error.message 
      });
    }

    return res.status(500).json({ 
      message: 'Failed to extract deal context',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;