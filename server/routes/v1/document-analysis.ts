import { Router, Request, Response } from 'express';
import { StorageFactory } from '../../storage-factory';
import { requireAuth } from '../../utils/auth';
import { DocumentAnalyzer, type AnalysisRequest } from '../../modules/documents/document-analyzer-fixed';

const router = Router();

/**
 * Test route to verify the document analysis router is working
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Document analysis router is working!' });
});

/**
 * General deal analysis - for comprehensive AI analysis of entire deals
 */
router.post('/deals/:dealId/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { query } = req.body;
    
    const userId = (req.session as any)?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }
    
    console.log(`🔍 AI ANALYSIS REQUEST - Deal ${dealId}, User ${userId}, Query: ${query || 'comprehensive analysis'}`);
    
    const storage = StorageFactory.getStorage();
    
    // Get the deal with validation
    const deal = await storage.getDeal(parseInt(dealId));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    console.log(`📈 Analyzing deal: ${deal.name} (${deal.sector})`);

    // Initialize the document analyzer
    const analyzer = new DocumentAnalyzer();
    
    // Extract all authentic document content
    const documentContents = await analyzer.extractDealDocuments(parseInt(dealId));
    
    // Validate we have sufficient authentic data
    analyzer.validateAnalysisData(documentContents, deal);
    
    // Perform the AI analysis with authentic data only
    const analysisRequest: AnalysisRequest = {
      dealId: parseInt(dealId),
      query,
      userId
    };
    
    const result = await analyzer.performAnalysis(analysisRequest, documentContents, deal);
    
    console.log(`✅ AI analysis completed successfully for deal ${dealId}`);
    console.log(`📄 Analysis based on ${documentContents.length} authentic documents`);

    res.json(result);
  } catch (error) {
    console.error('Error in document analysis:', error);
    
    if (error instanceof Error && error.message.includes('No authentic document content')) {
      return res.status(400).json({ 
        error: error.message,
        requiresDocuments: true
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze documents', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze a specific document by ID
 */
router.post('/deals/:dealId/documents/:documentId/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, documentId } = req.params;
    const { query } = req.body;
    const userId = (req.session as any)?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }
    
    console.log(`🔍 Analyzing specific document ${documentId} for deal ${dealId}`);
    
    const storage = StorageFactory.getStorage();
    
    // Get the specific document
    const documents = await storage.getDocumentsByDeal(parseInt(dealId));
    const document = documents.find((doc: any) => doc.id === parseInt(documentId));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Use the modular DocumentAnalyzer for authentic content extraction
    const analyzer = new DocumentAnalyzer();
    
    try {
      // Extract content using the modular service
      const content = await analyzer.extractDealDocuments(parseInt(dealId));
      const specificDoc = content.find(doc => doc.documentId === parseInt(documentId));
      
      if (!specificDoc) {
        return res.status(400).json({ 
          error: `Document "${document.fileName}" content is not available for analysis. Only authentic uploaded documents can be analyzed.`,
          requiresDocument: true
        });
      }

      // Create analysis request for the specific document
      const deal = await storage.getDeal(parseInt(dealId));
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const analysisRequest: AnalysisRequest = {
        dealId: parseInt(dealId),
        query: query || `Analyze the document "${document.fileName}" in detail`,
        userId
      };

      const result = await analyzer.performAnalysis(analysisRequest, [specificDoc], deal);
      
      console.log(`✅ Specific document analysis completed for ${document.fileName}`);
      res.json(result);
    } catch (error) {
      console.error('Error in specific document analysis:', error);
      
      if (error instanceof Error && error.message.includes('No authentic document content')) {
        return res.status(400).json({ 
          error: error.message,
          requiresDocument: true
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to analyze document', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in document analysis endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;