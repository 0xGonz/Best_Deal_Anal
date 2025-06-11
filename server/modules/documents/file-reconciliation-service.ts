import { promises as fs } from 'fs';
import path from 'path';

export interface FileReconciliationResult {
  documentId: number;
  originalPath: string;
  actualPath: string | null;
  status: 'found' | 'missing' | 'multiple_matches';
}

export class FileReconciliationService {
  private readonly searchDirectories = [
    './uploads',
    './public/uploads', 
    './data/uploads'
  ];

  /**
   * Find the actual location of a file based on its filename
   */
  async findFileByName(fileName: string): Promise<string | null> {
    const normalizedName = this.normalizeFileName(fileName);
    
    for (const dir of this.searchDirectories) {
      try {
        const files = await fs.readdir(dir);
        
        // Look for exact filename match
        if (files.includes(fileName)) {
          return path.join(dir, fileName);
        }
        
        // Look for normalized filename match
        const matchingFile = files.find(file => 
          this.normalizeFileName(file) === normalizedName
        );
        
        if (matchingFile) {
          return path.join(dir, matchingFile);
        }
        
        // Look for partial matches (UUID prefix matching)
        const uuidMatch = this.extractUUID(fileName);
        if (uuidMatch) {
          const partialMatch = files.find(file => file.includes(uuidMatch));
          if (partialMatch) {
            return path.join(dir, partialMatch);
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read, skip
        continue;
      }
    }
    
    return null;
  }

  /**
   * Reconcile all documents in the database with actual files
   */
  async reconcileAllDocuments(documents: Array<{
    id: number;
    fileName: string;
    filePath: string;
  }>): Promise<FileReconciliationResult[]> {
    const results: FileReconciliationResult[] = [];
    
    for (const doc of documents) {
      const actualPath = await this.findFileByName(
        path.basename(doc.filePath)
      );
      
      results.push({
        documentId: doc.id,
        originalPath: doc.filePath,
        actualPath,
        status: actualPath ? 'found' : 'missing'
      });
    }
    
    return results;
  }

  /**
   * Generate standardized file paths for new uploads
   */
  generateStandardPath(originalName: string, uuid: string): string {
    const sanitized = this.sanitizeFileName(originalName);
    return `uploads/${uuid}-${sanitized}`;
  }

  private normalizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .replace(/_+/g, '_');
  }

  private extractUUID(fileName: string): string | null {
    const uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const match = fileName.match(uuidRegex);
    return match ? match[1] : null;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  /**
   * Ensure upload directory exists and is properly configured
   */
  async ensureUploadDirectories(): Promise<void> {
    const primaryDir = './uploads';
    const backupDir = './public/uploads';
    
    try {
      await fs.mkdir(primaryDir, { recursive: true });
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directories:', error);
    }
  }
}

export const fileReconciliationService = new FileReconciliationService();