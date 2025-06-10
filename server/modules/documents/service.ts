import { db } from '../../db';
import { documents } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Unified Document Service
 * Single source of truth for all document operations
 * Uses Drizzle ORM with fallback to raw SQL for compatibility
 */
export class DocumentService {
  
  /**
   * Get all documents for a specific deal
   */
  static async getDocumentsByDeal(dealId: number) {
    try {
      
      const result = await db
        .select()
        .from(documents)
        .where(eq(documents.dealId, dealId))
        .orderBy(documents.uploadedAt);
      
      return result;
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to fetch documents: ${err.message}`);
    }
  }

  /**
   * Get a single document by ID
   */
  static async getDocumentById(documentId: number) {
    try {
      
      const result = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }
      
      const document = result[0];
      
      return {
        ...document,
        downloadUrl: `/api/documents/${document.id}/download`
      };
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to fetch document: ${err.message}`);
    }
  }

  /**
   * Create a new document
   */
  static async createDocument(documentData: any) {
    try {
      
      // Use Drizzle ORM for creation (handles schema compatibility automatically)
      const [newDocument] = await db
        .insert(documents)
        .values({
          dealId: documentData.dealId,
          fileName: documentData.fileName,
          fileType: documentData.fileType,
          fileSize: documentData.fileSize,
          filePath: documentData.filePath,
          uploadedBy: documentData.uploadedBy,
          description: documentData.description || null,
          documentType: documentData.documentType || 'general'
        })
        .returning();
      
      return newDocument;
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to create document: ${err.message}`);
    }
  }

  /**
   * Extract PDF content for AI analysis
   */
  static async extractPdfContent(documentId: number): Promise<string> {
    try {
      
      // Get document metadata
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Build file path - try multiple possible locations
      const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
      const fs = require('fs');
      const path = require('path');
      
      // Try multiple path combinations to find the file
      const possiblePaths = [
        document.filePath, // Exact path from database
        path.resolve(document.filePath), // Relative to current directory
        path.join(process.cwd(), document.filePath), // From project root
        path.join(UPLOAD_PATH, path.basename(document.filePath)), // Filename in uploads
        path.join(UPLOAD_PATH, document.fileName), // Original filename in uploads
      ];
      
      
      let filePath = '';
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      
      // Check if file was found
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Document file not found on disk: ${document.fileName}`);
      }
      
      


      // Extract content ONLY from the actual uploaded document - no fallbacks or test content
      
      if (document.fileType === 'application/pdf' || document.fileName.endsWith('.pdf')) {
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          
          if (pdfData.text && pdfData.text.trim().length > 0) {
            return pdfData.text;
          } else {
            throw new Error(`PDF document "${document.fileName}" contains no extractable text content. Please ensure the document contains text that can be analyzed.`);
          }
        } catch (pdfError) {
          throw new Error(`Cannot extract content from PDF document "${document.fileName}": ${(pdfError as Error).message}`);
        }
      } else {
        // Handle other file types as text
        try {
          const textContent = fs.readFileSync(filePath, 'utf8');
          if (textContent && textContent.trim().length > 0) {
            return textContent;
          } else {
            throw new Error(`Document "${document.fileName}" is empty or contains no readable content.`);
          }
        } catch (textError) {
          throw new Error(`Cannot read content from document "${document.fileName}": ${(textError as Error).message}`);
        }
      }
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to extract PDF content: ${err.message}`);
    }
  }

  /**
   * Update document metadata
   */
  static async updateDocument(documentId: number, updates: { description?: string; documentType?: string }) {
    try {
      
      const updateData: any = {};
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      if (updates.documentType !== undefined) {
        updateData.documentType = updates.documentType;
      }
      
      if (Object.keys(updateData).length === 0) {
        throw new Error('No updates provided');
      }
      
      const result = await db
        .update(documents)
        .set(updateData)
        .where(eq(documents.id, documentId))
        .returning({
          id: documents.id,
          fileName: documents.fileName,
          documentType: documents.documentType,
          description: documents.description
        });
      
      if (result.length === 0) {
        throw new Error('Document not found');
      }
      
      return result[0];
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to update document: ${err.message}`);
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: number) {
    try {
      
      const result = await db
        .delete(documents)
        .where(eq(documents.id, documentId));
      
      return true;
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to delete document: ${err.message}`);
    }
  }

  /**
   * Get documents by type for a deal
   */
  static async getDocumentsByType(dealId: number, documentType: string) {
    try {
      
      const result = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.dealId, dealId),
          eq(documents.documentType, documentType)
        ))
        .orderBy(documents.uploadedAt);
      
      return result;
      
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to fetch ${documentType} documents: ${err.message}`);
    }
  }
}