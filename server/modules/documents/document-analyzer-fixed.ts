import OpenAI from 'openai';
import { StorageFactory } from '../../storage-factory';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AnalysisRequest {
  dealId: number;
  query?: string;
  userId: number;
}

export interface DocumentContent {
  documentId: number;
  fileName: string;
  documentType: string;
  content: string;
  extractedData?: any;
}

export class DocumentAnalyzer {
  /**
   * Extract content from all documents for a deal
   */
  async extractDealDocuments(dealId: number): Promise<DocumentContent[]> {
    const storage = StorageFactory.getStorage();
    const documents = await storage.getDocumentsByDeal(dealId);
    
    const documentContents: DocumentContent[] = [];
    
    for (const document of documents) {
      // Only process documents that have actual file data
      if (!document.fileData) {
        console.warn(`Skipping document ${document.fileName} - no file data available`);
        continue;
      }

      const extractedContent = await this.extractDocumentContent(document);
      if (extractedContent) {
        documentContents.push({
          documentId: document.id,
          fileName: document.fileName,
          documentType: document.documentType || 'unknown',
          content: extractedContent.content,
          extractedData: extractedContent.extractedData
        });
      }
    }
    
    return documentContents;
  }

  /**
   * Extract content from a single document stored in database
   */
  private async extractDocumentContent(document: any): Promise<{ content: string; extractedData?: any } | null> {
    try {
      // Check if document has fileData (base64 content stored in database)
      if (!document.fileData) {
        console.warn(`Document ${document.fileName} has no fileData content in database`);
        return null;
      }

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(document.fileData, 'base64');
      const extension = document.fileName.toLowerCase().split('.').pop();

      if (extension === 'pdf') {
        // Extract text content from PDF
        const pdfParse = await import('pdf-parse');
        const pdfData = await pdfParse.default(fileBuffer);
        
        return {
          content: pdfData.text,
          extractedData: {
            pages: pdfData.numpages,
            info: pdfData.info
          }
        };
      } else if (['txt', 'md'].includes(extension || '')) {
        // Read text files directly
        const content = fileBuffer.toString('utf-8');
        return { content };
      } else {
        console.warn(`Unsupported file type for analysis: ${extension}`);
        return null;
      }
    } catch (error) {
      console.error(`Error extracting content from document ${document.fileName}:`, error);
      return null;
    }
  }

  /**
   * Validate that we have sufficient data for analysis
   */
  validateAnalysisData(documentContents: DocumentContent[], deal: any): void {
    if (documentContents.length === 0) {
      throw new Error(`No authentic document content available for analysis of "${deal.name}". Please upload the actual document files to enable AI analysis. Only authentic uploaded documents can be analyzed.`);
    }
  }

  /**
   * Perform AI analysis on the provided documents
   */
  async performAnalysis(
    request: AnalysisRequest, 
    documentContents: DocumentContent[], 
    deal: any
  ): Promise<string> {
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
    const analysisQuery = request.query || 
      `Extract and analyze only the information explicitly stated in the uploaded documents:
      1. Financial data, metrics, and projections as presented
      2. Risk factors specifically mentioned in the documents
      3. Market information and competitive data included
      4. Management team details provided
      5. Investment terms and conditions specified
      6. Key facts and figures directly stated`;

    analysisPrompt += `\nANALYSIS REQUEST: ${analysisQuery}\n`;
    analysisPrompt += `\nCRITICAL REQUIREMENT: Base your analysis EXCLUSIVELY on content explicitly written in the uploaded documents. Never generate, assume, or infer information not directly stated. If information is missing from the documents, state "Not provided in the documents" rather than making assumptions.`;

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
}