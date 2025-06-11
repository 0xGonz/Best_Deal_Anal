import path from 'path';
import fs from 'fs';

/**
 * Unified File Path Resolution Service
 * Single source of truth for all document file path operations
 * Eliminates the multiple competing path resolution strategies
 */
export class DocumentPathResolver {
  
  // Standardized upload directory - persistent across server restarts
  private static readonly UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
  
  /**
   * Initialize upload directories
   */
  static ensureUploadDirectories() {
    try {
      if (!fs.existsSync(this.UPLOAD_DIR)) {
        fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
        console.log(`✅ Created persistent uploads directory: ${this.UPLOAD_DIR}`);
      }
    } catch (error) {
      console.error('❌ Error creating upload directories:', error);
      throw error;
    }
  }
  
  /**
   * Get the standardized file path for storage in database
   * Always returns path relative to public directory (no leading slash)
   */
  static getStoragePath(dealId: number, filename: string): string {
    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(filename);
    
    // Return path relative to public directory
    return path.join('uploads', `deal-${dealId}`, sanitizedFilename);
  }
  
  /**
   * Get the absolute file system path for reading/writing files
   */
  static getAbsolutePath(storagePath: string): string {
    // Handle both old and new path formats
    const normalizedPath = storagePath.startsWith('/') 
      ? storagePath.substring(1) 
      : storagePath;
      
    return path.join(process.cwd(), 'public', normalizedPath);
  }
  
  /**
   * Resolve file path with fallback strategies for existing files
   */
  static resolveExistingFile(document: any): string | null {
    const baseFilename = path.basename(document.filePath);
    
    // Priority order for file resolution
    const possiblePaths = [
      // Current standardized structure
      this.getAbsolutePath(document.filePath),
      
      // Deal-specific directory
      path.join(this.UPLOAD_DIR, `deal-${document.dealId}`, baseFilename),
      
      // Root uploads directory
      path.join(this.UPLOAD_DIR, baseFilename),
      
      // Legacy paths (for backward compatibility)
      path.join(process.cwd(), document.filePath),
      path.join(process.cwd(), 'uploads', baseFilename)
    ];
    
    // Return first existing file
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log(`✅ Found document at: ${filePath}`);
        return filePath;
      }
    }
    
    console.error(`❌ Document not found. Searched paths:`, possiblePaths);
    return null;
  }
  
  /**
   * Ensure deal-specific directory exists
   */
  static ensureDealDirectory(dealId: number): string {
    const dealDir = path.join(this.UPLOAD_DIR, `deal-${dealId}`);
    
    if (!fs.existsSync(dealDir)) {
      fs.mkdirSync(dealDir, { recursive: true });
      console.log(`✅ Created deal directory: ${dealDir}`);
    }
    
    return dealDir;
  }
  
  /**
   * Sanitize filename for safe storage
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\/\\?%*:|"<>]/g, '_') // Replace unsafe chars
      .replace(/\s+/g, '_')           // Replace spaces with underscores
      .toLowerCase();                  // Convert to lowercase
  }
  
  /**
   * Get public URL for document access
   */
  static getPublicUrl(storagePath: string): string {
    const normalizedPath = storagePath.startsWith('/') 
      ? storagePath 
      : `/${storagePath}`;
      
    return normalizedPath;
  }
  
  /**
   * Migration helper - move file to standardized location
   */
  static async migrateToStandardPath(document: any): Promise<string | null> {
    try {
      const currentPath = this.resolveExistingFile(document);
      if (!currentPath) {
        return null;
      }
      
      const standardPath = this.getStoragePath(document.dealId, document.fileName);
      const absoluteStandardPath = this.getAbsolutePath(standardPath);
      
      // If already in standard location, return path
      if (currentPath === absoluteStandardPath) {
        return standardPath;
      }
      
      // Ensure target directory exists
      this.ensureDealDirectory(document.dealId);
      
      // Copy file to standard location
      fs.copyFileSync(currentPath, absoluteStandardPath);
      console.log(`✅ Migrated document to standard path: ${absoluteStandardPath}`);
      
      return standardPath;
      
    } catch (error) {
      console.error(`❌ Error migrating document ${document.id}:`, error);
      return null;
    }
  }
}