import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class DocumentBlobStorage {
  /**
   * Store a document file in the database as binary data
   */
  static async storeDocument(
    dealId: number,
    fileName: string,
    fileType: string,
    filePath: string,
    uploadedBy: number,
    documentType: string = 'other',
    description?: string
  ): Promise<{ id: number; success: boolean; error?: string }> {
    try {
      // Read the file from disk
      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fileBuffer.length;

      // Insert document record with file data as binary blob
      const result = await pool.query(
        `INSERT INTO documents 
         (deal_id, file_name, file_type, file_size, file_path, file_data, uploaded_by, document_type, description) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [dealId, fileName, fileType, fileSize, filePath, fileBuffer, uploadedBy, documentType, description]
      );

      const documentId = result.rows[0].id;

      // Clean up the temporary file from disk
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temporary file ${filePath}:`, cleanupError);
      }

      console.log(`✓ Document ${documentId} stored in database: ${fileName} (${fileSize} bytes)`);
      return { id: documentId, success: true };
    } catch (error) {
      console.error('Error storing document in database:', error);
      return { id: 0, success: false, error: error.message };
    }
  }

  /**
   * Retrieve a document from the database
   */
  static async retrieveDocument(documentId: number): Promise<{
    success: boolean;
    data?: Buffer;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    error?: string;
  }> {
    try {
      const result = await pool.query(
        'SELECT file_name, file_type, file_size, file_data FROM documents WHERE id = $1',
        [documentId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Document not found' };
      }

      const { file_name, file_type, file_size, file_data } = result.rows[0];

      return {
        success: true,
        data: file_data,
        fileName: file_name,
        fileType: file_type,
        fileSize: file_size,
      };
    } catch (error) {
      console.error('Error retrieving document from database:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all documents for a deal
   */
  static async getDocumentsForDeal(dealId: number): Promise<{
    success: boolean;
    documents?: Array<{
      id: number;
      fileName: string;
      fileType: string;
      fileSize: number;
      uploadedAt: string;
      uploadedBy: number;
      documentType: string;
      description?: string;
      hasFileData: boolean;
    }>;
    error?: string;
  }> {
    try {
      const result = await pool.query(
        `SELECT id, file_name, file_type, file_size, uploaded_at, uploaded_by, document_type, description,
                (file_data IS NOT NULL) as has_file_data
         FROM documents 
         WHERE deal_id = $1 
         ORDER BY uploaded_at DESC`,
        [dealId]
      );

      const documents = result.rows.map(row => ({
        id: row.id,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        uploadedAt: row.uploaded_at,
        uploadedBy: row.uploaded_by,
        documentType: row.document_type,
        description: row.description,
        hasFileData: row.has_file_data,
      }));

      return { success: true, documents };
    } catch (error) {
      console.error('Error getting documents for deal:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update document metadata
   */
  static async updateDocument(documentId: number, updates: {
    fileName?: string;
    description?: string;
    documentType?: string;
  }): Promise<{
    success: boolean;
    document?: any;
    error?: string;
  }> {
    try {
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (updates.fileName !== undefined) {
        updateFields.push(`file_name = $${paramCount++}`);
        updateValues.push(updates.fileName);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(updates.description);
      }
      if (updates.documentType !== undefined) {
        updateFields.push(`document_type = $${paramCount++}`);
        updateValues.push(updates.documentType);
      }

      if (updateFields.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      updateValues.push(documentId);

      const result = await pool.query(
        `UPDATE documents 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramCount}
         RETURNING id, file_name, file_type, document_type, description`,
        updateValues
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Document not found' };
      }

      const document = {
        id: result.rows[0].id,
        fileName: result.rows[0].file_name,
        fileType: result.rows[0].file_type,
        documentType: result.rows[0].document_type,
        description: result.rows[0].description,
      };

      console.log(`✓ Document ${documentId} updated in database`);
      return { success: true, document };
    } catch (error) {
      console.error('Error updating document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete document from database
   */
  static async deleteDocument(documentId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await pool.query(
        'DELETE FROM documents WHERE id = $1',
        [documentId]
      );

      if (result.rowCount === 0) {
        return { success: false, error: 'Document not found' };
      }

      console.log(`✓ Document ${documentId} deleted from database`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Migrate existing filesystem documents to database storage
   */
  static async migrateFilesystemDocuments(): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      // Get all documents that don't have file_data populated
      const result = await pool.query(
        'SELECT id, file_name, file_path FROM documents WHERE file_data IS NULL'
      );

      console.log(`Found ${result.rows.length} documents to migrate`);

      for (const doc of result.rows) {
        console.log(`Processing document ${doc.id}: ${doc.file_name}`);

        // Try different possible file paths
        const possiblePaths = [
          doc.file_path,
          path.join('uploads', doc.file_name),
          path.join('uploads', path.basename(doc.file_name)),
          path.join('storage', 'documents', doc.file_name),
        ];

        let fileBuffer: Buffer | null = null;
        let actualPath: string | null = null;

        // Find the actual file
        for (const filePath of possiblePaths) {
          if (filePath && fs.existsSync(filePath)) {
            try {
              fileBuffer = fs.readFileSync(filePath);
              actualPath = filePath;
              break;
            } catch (error) {
              console.log(`Could not read file at ${filePath}: ${error}`);
            }
          }
        }

        if (fileBuffer) {
          console.log(`Found file for document ${doc.id} at ${actualPath}, size: ${fileBuffer.length} bytes`);

          // Update the database with the file data
          await pool.query(
            'UPDATE documents SET file_data = $1 WHERE id = $2',
            [fileBuffer, doc.id]
          );

          migratedCount++;
          console.log(`✓ Successfully migrated document ${doc.id}: ${doc.file_name}`);
        } else {
          const error = `Could not find file for document ${doc.id}: ${doc.file_name}`;
          console.log(`✗ ${error}`);
          errors.push(error);
        }
      }

      console.log(`Migration completed! Migrated ${migratedCount} documents, ${errors.length} errors`);
      return { success: true, migratedCount, errors };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, migratedCount, errors: [error.message] };
    }
  }

  /**
   * Delete a document from the database
   */
  static async deleteDocument(documentId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [documentId]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Document not found' };
      }

      console.log(`✓ Document ${documentId} deleted from database`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }
  }
}