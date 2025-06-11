import OpenAI from 'openai';
import { StorageFactory } from '../../storage-factory';
import * as path from 'path';
import * as fs from 'fs';
import { Document } from '@shared/schema';
import { DataExtractor } from '../../services/data-extractor';

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

    console.log(`📄 Extracting content from ${documents.length} documents for deal ${dealId}`);

    for (const doc of documents) {
      try {
        const content = await this.extractDocumentContent(doc);
        if (content) {
          documentContents.push({
            documentId: doc.id,
            fileName: doc.fileName,
            documentType: doc.documentType,
            content: content.content,
            extractedData: content.extractedData
          });
        }
      } catch (error) {
        console.error(`Failed to extract content from ${doc.fileName}:`, error);
      }
    }

    console.log(`✅ Successfully extracted content from ${documentContents.length} documents`);
    return documentContents;
  }

  /**
   * Extract content from a single document
   */
  private async extractDocumentContent(document: any): Promise<{ content: string; extractedData?: any } | null> {
    const extension = path.extname(document.fileName).toLowerCase();
    
    // Find the actual file path
    const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
    const possiblePaths = [
      path.resolve(UPLOAD_PATH, 'deals', document.dealId?.toString() || '', document.fileName),
      path.resolve(UPLOAD_PATH, document.dealId?.toString() || '', document.fileName),
      path.resolve(UPLOAD_PATH, document.fileName),
      path.resolve(document.filePath || '')
    ];
    
    let actualFilePath = null;
    for (const testPath of possiblePaths) {
      try {
        if (fs.existsSync(testPath)) {
          actualFilePath = testPath;
          break;
        }
      } catch (error) {
        console.error('Error checking file path:', error);
      }
    }

    if (!actualFilePath) {
      console.warn(`File not found for document: ${document.fileName}`);
      return null;
    }

    if (extension === '.pdf') {
      // Extract text content from PDF
      const pdfParse = await import('pdf-parse');
      const pdfBuffer = fs.readFileSync(actualFilePath);
      const pdfData = await pdfParse.default(pdfBuffer);
      
      return {
        content: pdfData.text,
        extractedData: {
          pages: pdfData.numpages,
          info: pdfData.info
        }
      };
    } else if (['.xlsx', '.xls', '.xlsm', '.csv'].includes(extension)) {
      // Extract structured data from Excel/CSV
      const data = await DataExtractor.extractData(actualFilePath, document.fileName);
      const summary = DataExtractor.formatForAI(data);
      
      return {
        content: summary,
        extractedData: data
      };
    } else if (['.txt', '.md'].includes(extension)) {
      // Read text files directly
      const content = fs.readFileSync(actualFilePath, 'utf-8');
      return { content };
    }

    return null;
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
    deal: any, 
    documentContents: DocumentContent[]
  ): Promise<any> {
    const { query, dealId } = request;

    // Build the context for AI analysis
    let analysisPrompt = `You are an expert investment analyst. Analyze the following deal and documents:\n\n`;
    
    // Add deal information
    analysisPrompt += `DEAL: ${deal.name}\n`;
    analysisPrompt += `Sector: ${deal.sector}\n`;
    analysisPrompt += `Stage: ${deal.stage}\n`;
    analysisPrompt += `Description: ${deal.description || 'No description'}\n`;
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
    const analysisQuery = query || 
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
        temperature: 0.3
      });

      const analysis = completion.choices[0]?.message?.content || 'No analysis generated';
      
      return {
        analysis,
        response: analysis,
        context: {
          dealId,
          dealName: deal.name,
          documentsAnalyzed: documentContents.length,
          dataSourcesUsed: documentContents.map(doc => doc.fileName),
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}