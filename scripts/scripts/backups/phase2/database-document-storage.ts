import { db } from '../db-read-replica.js';
import { documents } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

export class DatabaseDocumentStorage {
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/jpeg',
    'image/png'
  ];
  private readonly ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png'];

  async validateFile(fileName: string, mimeType: string, fileSize: number): Promise<{ valid: boolean; reason?: string }> {
    // Check file size
    if (fileSize > this.MAX_FILE_SIZE) {
      return { valid: false, reason: `File size exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
    }

    // Check MIME type
    if (!this.ALLOWED_TYPES.includes(mimeType)) {
      return { valid: false, reason: `File type ${mimeType} not allowed` };
    }

    // Check file extension
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!this.ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return { valid: false, reason: `File extension ${fileExtension} not allowed` };
    }

    // Check for valid filename (no path traversal)
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return { valid: false, reason: 'Invalid filename' };
    }

    return { valid: true };
  }

  async createDocument(documentData: {
    dealId: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileBuffer: Buffer;
    uploadedBy: number;
    description?: string;
    documentType?: string;
  }) {
    try {
      console.log(`📄 Creating document: ${documentData.fileName} for deal ${documentData.dealId}`);
      console.log(`📊 Original buffer size: ${documentData.fileBuffer.length} bytes`);
      
      // Convert buffer to base64 for storage
      const fileDataBase64 = documentData.fileBuffer.toString('base64');
      console.log(`📝 Base64 string length: ${fileDataBase64.length} characters`);
      console.log(`🔍 First 50 chars of base64: ${fileDataBase64.substring(0, 50)}...`);
      
      const [newDocument] = await db
        .insert(documents)
        .values({
          dealId: documentData.dealId,
          fileName: documentData.fileName,
          fileType: documentData.fileType,
          fileSize: documentData.fileSize,
          filePath: `database://${documentData.dealId}/${documentData.fileName}`, // Virtual path for backward compatibility
          fileData: fileDataBase64, // Store as base64 text
          uploadedBy: documentData.uploadedBy,
          description: documentData.description || null,
          documentType: (documentData.documentType as any) || 'other'
        })
        .returning();
      
      console.log(`✅ Document created with ID: ${newDocument.id}`);
      return newDocument;
    } catch (error) {
      console.error(`❌ Error creating document ${documentData.fileName}:`, error);
      throw error;
    }
  }

  async getDocument(documentId: number) {
    try {
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId));
      
      return document;
    } catch (error) {
      console.error('Error fetching document:', error);
      return null;
    }
  }

  async getDocumentsByDeal(dealId: number) {
    try {
      const result = await db
        .select()
        .from(documents)
        .where(eq(documents.dealId, dealId))
        .orderBy(desc(documents.uploadedAt));
      
      return result;
    } catch (error) {
      console.error(`Error fetching documents for deal ${dealId}:`, error);
      return [];
    }
  }

  async downloadDocument(documentId: number) {
    try {
      const document = await this.getDocument(documentId);
      if (!document || !document.fileData) {
        console.error(`Document ${documentId} not found or has no file data`);
        return null;
      }

      console.log(`📥 Downloading document ${documentId}: ${document.fileName} (${document.fileSize} bytes)`);
      
      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(document.fileData, 'base64');
      
      console.log(`✅ Document ${documentId} converted to buffer: ${fileBuffer.length} bytes`);
      
      return {
        buffer: fileBuffer,
        fileName: document.fileName,
        mimeType: document.fileType
      };
    } catch (error) {
      console.error('Error downloading document:', error);
      return null;
    }
  }

  async updateDocument(documentId: number, updateData: Partial<{
    fileName: string;
    description: string;
    documentType: string;
  }>) {
    try {
      console.log(`📝 Updating document ${documentId}`);
      
      const [updatedDocument] = await db
        .update(documents)
        .set({
          fileName: updateData.fileName,
          description: updateData.description,
          documentType: (updateData.documentType as any),
          uploadedAt: new Date() // Update timestamp
        })
        .where(eq(documents.id, documentId))
        .returning();

      console.log(`✅ Document ${documentId} updated successfully`);
      return updatedDocument;
    } catch (error) {
      console.error(`❌ Error updating document ${documentId}:`, error);
      throw error;
    }
  }

  async deleteDocument(documentId: number) {
    try {
      console.log(`🗑️ Deleting document ${documentId}`);
      
      // First get the document for response
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete database record (file data is stored in the database, so no separate cleanup needed)
      await db
        .delete(documents)
        .where(eq(documents.id, documentId));

      console.log(`✅ Document ${documentId} deleted successfully`);
      return { success: true, deletedDocument: document };
    } catch (error) {
      console.error(`❌ Error deleting document ${documentId}:`, error);
      throw error;
    }
  }
}

export const databaseDocumentStorage = new DatabaseDocumentStorage();