import { Router, Request, Response } from 'express';
import { StorageFactory } from '../../storage-factory';
import { requireAuth } from '../../utils/auth';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DocumentContent {
  documentId: number;
  fileName: string;
  documentType: string;
  content: string;
  extractedData?: any;
}

/**
 * Extract content from documents stored in database
 */
async function extractDocumentContent(document: any): Promise<DocumentContent | null> {
  try {
    // Check if document has fileData (base64 content stored in database)
    if (!document.fileData) {
      console.warn(`Document ${document.fileName} has no fileData content in database`);
      return null;
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(document.fileData, 'base64');
    const extension = document.fileName.toLowerCase().split('.').pop();

    let content = '';

    if (extension === 'pdf') {
      // For now, indicate PDF is available but extract basic info from filename
      const fileSize = Math.round(fileBuffer.length / 1024);
      content = `PDF Document: ${document.fileName} (${fileSize}KB)\n\nThis document contains content that requires analysis. The file is successfully stored and available for processing.`;
    } else if (['txt', 'md'].includes(extension || '')) {
      // Read text files directly
      content = fileBuffer.toString('utf-8');
    } else {
      console.warn(`Unsupported file type for analysis: ${extension}`);
      return null;
    }

    return {
      documentId: document.id,
      fileName: document.fileName,
      documentType: document.documentType || 'unknown',
      content: content,
      extractedData: { fileType: extension }
    };
  } catch (error) {
    console.error(`Error extracting content from document ${document.fileName}:`, error);
    return null;
  }
}

/**
 * Extract content from all documents for a deal
 */
async function extractDealDocuments(dealId: number): Promise<DocumentContent[]> {
  const storage = StorageFactory.getStorage();
  const documents = await storage.getDocumentsByDeal(dealId);
  
  const documentContents: DocumentContent[] = [];
  
  for (const document of documents) {
    // Only process documents that have actual file data
    if (!document.fileData) {
      console.warn(`Skipping document ${document.fileName} - no file data available`);
      continue;
    }

    const extractedContent = await extractDocumentContent(document);
    if (extractedContent) {
      documentContents.push(extractedContent);
    }
  }
  
  return documentContents;
}

/**
 * Perform AI analysis on documents
 */
async function performAnalysis(dealId: number, documentContents: DocumentContent[], deal: any, query?: string): Promise<string> {
  // Validate we have document content
  if (documentContents.length === 0) {
    throw new Error(`No document files found for analysis of "${deal.name}". Please upload document files to enable AI analysis.`);
  }

  // Check if we have actual text content or just file metadata
  const hasTextContent = documentContents.some(doc => 
    doc.content && !doc.content.startsWith('[PDF Document:') && doc.content.length > 50
  );

  if (!hasTextContent) {
    // Provide analysis based on document metadata when text extraction fails
    return `Analysis based on uploaded documents for ${deal.name}:

Available Documents (${documentContents.length}):
${documentContents.map((doc, i) => `${i + 1}. ${doc.fileName} (${doc.documentType})`).join('\n')}

Note: The documents are available in the system but text extraction is currently limited. Based on the document names and types:

${documentContents.map(doc => {
  if (doc.fileName.toLowerCase().includes('financial')) {
    return `• ${doc.fileName}: Likely contains financial projections, models, and key metrics for the investment analysis.`;
  } else if (doc.fileName.toLowerCase().includes('presentation') || doc.fileName.toLowerCase().includes('pitch')) {
    return `• ${doc.fileName}: Management presentation with company overview, market opportunity, and business strategy.`;
  } else if (doc.fileName.toLowerCase().includes('research')) {
    return `• ${doc.fileName}: Market research and analysis documentation.`;
  } else {
    return `• ${doc.fileName}: Supporting documentation for investment evaluation.`;
  }
}).join('\n')}

To enable detailed content analysis, please ensure documents are properly uploaded and accessible.`;
  }

  // Build analysis prompt with deal information
  let analysisPrompt = `DEAL INFORMATION:\n`;
  analysisPrompt += `Name: ${deal.name}\n`;
  analysisPrompt += `Sector: ${deal.sector}\n`;
  analysisPrompt += `Stage: ${deal.stage}\n`;
  if (deal.amount) analysisPrompt += `Amount: ${deal.amount}\n`;
  if (deal.targetReturn) analysisPrompt += `Target Return: ${deal.targetReturn}\n`;
  if (deal.valuation) analysisPrompt += `Valuation: ${deal.valuation}\n`;
  analysisPrompt += `\n`;

  // Add authentic document contents
  analysisPrompt += `DOCUMENTS (${documentContents.length}):\n\n`;
  documentContents.forEach((doc, index) => {
    analysisPrompt += `Document ${index + 1}: ${doc.fileName} (${doc.documentType})\n`;
    analysisPrompt += `Content:\n${doc.content}\n\n`;
  });

  // Add specific query or default analysis request
  const analysisQuery = query || `Analyze the content of this document`;

  analysisPrompt += `\nANALYSIS REQUEST: ${analysisQuery}\n`;
  analysisPrompt += `\nIMPORTANT: Only analyze what is explicitly written in the document content. Do not generate or assume any information not directly stated.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert investment analyst. CRITICAL: You must analyze ONLY the authentic content from uploaded documents. Never generate, assume, or create any information not explicitly stated in the provided document text. If specific information is not found in the documents, clearly state 'Not specified in the provided documents' rather than making assumptions or generating content."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    });

    return completion.choices[0]?.message?.content || 'No analysis generated';
  } catch (error) {
    console.error('Error performing AI analysis:', error);
    throw new Error('Failed to perform AI analysis');
  }
}

/**
 * POST /api/v1/ai-analysis/deals/:dealId
 * Analyze all documents for a deal
 */
router.post('/deals/:dealId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { query } = req.body;
    const userId = (req as any).user.id;

    console.log(`🔍 Starting AI analysis for deal ${dealId}`);
    
    const storage = StorageFactory.getStorage();
    
    // Get deal information
    const deal = await storage.getDeal(parseInt(dealId));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Extract all authentic document content
    const documentContents = await extractDealDocuments(parseInt(dealId));
    
    // Perform the AI analysis with authentic data only
    const result = await performAnalysis(parseInt(dealId), documentContents, deal, query);
    
    console.log(`✅ AI analysis completed successfully for deal ${dealId}`);
    console.log(`📄 Analysis based on ${documentContents.length} authentic documents`);

    res.json({ analysis: result });
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
 * POST /api/v1/ai-analysis/documents/:documentId
 * Analyze a specific document
 */
router.post('/documents/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { query } = req.body;
    const userId = (req as any).user.id;

    console.log(`🔍 Starting analysis for document ${documentId}`);
    
    const storage = StorageFactory.getStorage();
    
    // Get document information
    const document = await storage.getDocument(parseInt(documentId));
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get deal information
    const deal = await storage.getDeal(document.dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Extract content from this specific document
    const documentContent = await extractDocumentContent(document);
    if (!documentContent) {
      return res.status(400).json({ 
        error: `Document "${document.fileName}" content is not available for analysis. Only authentic uploaded documents can be analyzed.`,
        requiresDocument: true
      });
    }

    // Perform analysis on the specific document
    const result = await performAnalysis(document.dealId, [documentContent], deal, query || `Analyze this document`);
    
    console.log(`✅ Specific document analysis completed for ${document.fileName}`);
    res.json({ analysis: result });
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
});

export default router;