import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Centralized File Management Service
 * Provides consistent file storage, retrieval, and path resolution
 */
export class FileManagerService {
  private static readonly BASE_UPLOAD_DIR = 'data/uploads';
  private static readonly SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx'];
  
  /**
   * Get the absolute base upload directory with production persistence
   */
  static getBaseUploadDir(): string {
    // Always use data/uploads for persistent storage
    const persistentPath = path.join(process.cwd(), this.BASE_UPLOAD_DIR);
    console.log(`📁 Using persistent upload path: ${persistentPath}`);
    return persistentPath;
  }

  /**
   * Ensure upload directory exists
   */
  static ensureUploadDir(): void {
    const uploadDir = this.getBaseUploadDir();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  /**
   * Generate a unique filename with proper sanitization
   */
  static generateUniqueFilename(originalName: string): string {
    const uniqueId = crypto.randomUUID();
    const sanitizedName = originalName.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
    return `${uniqueId}-${sanitizedName}`;
  }

  /**
   * Get the standard file path format for database storage
   */
  static getStoragePath(filename: string): string {
    return `${this.BASE_UPLOAD_DIR}/${filename}`;
  }

  /**
   * Validate file extension
   */
  static isValidFileType(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  /**
   * Get MIME type for a file extension
   */
  static getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Resolve file path with fallback locations
   * Returns the actual file system path or null if not found
   */
  static resolveFilePath(storedPath: string, fileName?: string): string | null {
    console.log(`🔍 Resolving file path for: ${storedPath}, fileName: ${fileName}`);
    
    const possiblePaths: string[] = [];
    
    // Primary: Use stored path as-is
    if (storedPath) {
      const normalizedPath = storedPath.startsWith('/') ? storedPath.substring(1) : storedPath;
      possiblePaths.push(path.join(process.cwd(), normalizedPath));
    }
    
    // Fallback: Look in standard upload directory using filename
    if (fileName) {
      possiblePaths.push(path.join(this.getBaseUploadDir(), fileName));
    }
    
    // Fallback: Extract filename from stored path
    if (storedPath) {
      const extractedFilename = path.basename(storedPath);
      possiblePaths.push(path.join(this.getBaseUploadDir(), extractedFilename));
    }

    // Check each possible path
    for (const testPath of possiblePaths) {
      try {
        if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
          return testPath;
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }
    
    return null;
  }

  /**
   * Check if a file exists at the given path
   */
  static fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get file stats (size, creation date, etc.)
   */
  static getFileStats(filePath: string): fs.Stats | null {
    try {
      return fs.statSync(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Delete a file safely
   */
  static deleteFile(filePath: string): boolean {
    try {
      if (this.fileExists(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Create a read stream for a file
   */
  static createReadStream(filePath: string): fs.ReadStream | null {
    try {
      if (this.fileExists(filePath)) {
        return fs.createReadStream(filePath);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate and prepare file upload data
   */
  static validateUpload(file: Express.Multer.File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!this.isValidFileType(file.originalname)) {
      return { 
        isValid: false, 
        error: `File type not supported. Allowed types: ${this.SUPPORTED_EXTENSIONS.join(', ')}` 
      };
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return { 
        isValid: false, 
        error: 'File size exceeds 50MB limit' 
      };
    }

    return { isValid: true };
  }

  /**
   * Get diagnostic information for troubleshooting
   */
  static getDiagnosticInfo(storedPath: string, fileName?: string): {
    baseDir: string;
    searchPaths: string[];
    foundPath: string | null;
    exists: boolean;
  } {
    const searchPaths: string[] = [];
    
    if (storedPath) {
      const normalizedPath = storedPath.startsWith('/') ? storedPath.substring(1) : storedPath;
      searchPaths.push(path.join(process.cwd(), normalizedPath));
    }
    
    if (fileName) {
      searchPaths.push(path.join(this.getBaseUploadDir(), fileName));
    }
    
    if (storedPath) {
      const extractedFilename = path.basename(storedPath);
      searchPaths.push(path.join(this.getBaseUploadDir(), extractedFilename));
    }

    const foundPath = this.resolveFilePath(storedPath, fileName);
    
    return {
      baseDir: this.getBaseUploadDir(),
      searchPaths,
      foundPath,
      exists: foundPath !== null
    };
  }
}