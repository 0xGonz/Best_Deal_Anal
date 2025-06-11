import fs from 'fs';
import path from 'path';

/**
 * Universal Document Path Resolver
 * Single source of truth for all file path resolution across the application
 */
export class UniversalPathResolver {
  private static instance: UniversalPathResolver;
  
  // Environment-aware base directories
  private readonly STORAGE_BASES = this.getStorageBases();
  
  public static getInstance(): UniversalPathResolver {
    if (!UniversalPathResolver.instance) {
      UniversalPathResolver.instance = new UniversalPathResolver();
    }
    return UniversalPathResolver.instance;
  }

  /**
   * Get environment-appropriate storage base directories
   */
  private getStorageBases(): string[] {
    const isProd = process.env.NODE_ENV === 'production';
    const isReplit = process.env.REPLIT_CLUSTER !== undefined;
    const baseDir = process.cwd();
    
    const bases: string[] = [];
    
    // Primary persistent storage
    bases.push(path.join(baseDir, 'data/uploads'));
    
    // Legacy and fallback paths
    if (isProd || isReplit) {
      // Production/Replit paths
      bases.push('/tmp/uploads');
      bases.push('/app/uploads');
      bases.push('/app/data/uploads');
      bases.push(path.join(baseDir, 'uploads'));
    } else {
      // Development paths
      bases.push(path.join(baseDir, 'uploads'));
      bases.push(path.join(baseDir, 'public/uploads'));
    }
    
    console.log(`📁 Universal resolver initialized with bases:`, bases);
    return bases;
  }

  /**
   * Get the primary upload directory for new files
   */
  public getPrimaryUploadDir(dealId?: number): string {
    const baseDir = this.STORAGE_BASES[0]; // Always use data/uploads as primary
    
    if (dealId) {
      const dealDir = path.join(baseDir, `deal-${dealId}`);
      this.ensureDirectoryExists(dealDir);
      return dealDir;
    }
    
    this.ensureDirectoryExists(baseDir);
    return baseDir;
  }

  /**
   * Resolve file path with comprehensive search
   */
  public resolveFilePath(dbPath: string, fileName?: string): { 
    found: boolean; 
    path: string | null; 
    searchedPaths: string[];
    error?: string;
  } {
    const searchedPaths: string[] = [];
    
    if (!dbPath && !fileName) {
      return {
        found: false,
        path: null,
        searchedPaths,
        error: 'No file path or name provided'
      };
    }

    // Generate all possible file paths
    const candidatePaths = this.generateCandidatePaths(dbPath, fileName);
    
    // Search each candidate path
    for (const candidatePath of candidatePaths) {
      searchedPaths.push(candidatePath);
      
      try {
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          console.log(`✅ File found at: ${candidatePath}`);
          return {
            found: true,
            path: candidatePath,
            searchedPaths
          };
        }
      } catch (error) {
        // Continue searching
        continue;
      }
    }

    console.log(`❌ File not found. Searched ${searchedPaths.length} locations`);
    return {
      found: false,
      path: null,
      searchedPaths,
      error: `File not found in any of ${searchedPaths.length} locations`
    };
  }

  /**
   * Generate all possible candidate paths for a file
   */
  private generateCandidatePaths(dbPath: string, fileName?: string): string[] {
    const candidates: string[] = [];
    
    // Extract filename from various sources
    const extractedFileName = fileName || path.basename(dbPath);
    const normalizedDbPath = dbPath?.startsWith('/') ? dbPath.substring(1) : dbPath;
    
    // For each storage base, try multiple patterns
    for (const base of this.STORAGE_BASES) {
      // Direct database path
      if (dbPath) {
        candidates.push(path.join(base, path.basename(dbPath)));
        candidates.push(path.join(process.cwd(), normalizedDbPath));
      }
      
      // Filename variations
      if (extractedFileName) {
        candidates.push(path.join(base, extractedFileName));
        
        // Deal-specific subdirectories (extract deal ID from filename if present)
        const dealMatch = extractedFileName.match(/deal-(\d+)/);
        if (dealMatch) {
          const dealId = dealMatch[1];
          candidates.push(path.join(base, `deal-${dealId}`, extractedFileName));
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(candidates)];
  }

  /**
   * Get standardized relative path for database storage
   */
  public getStandardizedPath(fileName: string, dealId?: number): string {
    if (dealId) {
      return `data/uploads/deal-${dealId}/${fileName}`;
    }
    return `data/uploads/${fileName}`;
  }

  /**
   * Validate file exists and get metadata
   */
  public validateFile(filePath: string): {
    exists: boolean;
    isFile: boolean;
    size?: number;
    error?: string;
  } {
    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        isFile: stats.isFile(),
        size: stats.size
      };
    } catch (error) {
      return {
        exists: false,
        isFile: false,
        error: String(error)
      };
    }
  }

  /**
   * Move file to standardized location
   */
  public moveToStandardLocation(currentPath: string, fileName: string, dealId?: number): {
    success: boolean;
    newPath?: string;
    error?: string;
  } {
    try {
      const targetDir = this.getPrimaryUploadDir(dealId);
      const targetPath = path.join(targetDir, fileName);
      
      if (currentPath === targetPath) {
        return { success: true, newPath: targetPath };
      }
      
      // Copy file to new location
      fs.copyFileSync(currentPath, targetPath);
      
      // Verify copy succeeded
      if (fs.existsSync(targetPath)) {
        // Remove original if it's in a different location
        if (currentPath !== targetPath) {
          fs.unlinkSync(currentPath);
        }
        return { success: true, newPath: targetPath };
      } else {
        return { success: false, error: 'Copy failed - target file not created' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get comprehensive diagnostic information
   */
  public getDiagnostics(dbPath: string, fileName?: string): {
    environment: string;
    storageBases: string[];
    resolution: ReturnType<typeof this.resolveFilePath>;
    validation?: ReturnType<typeof this.validateFile>;
  } {
    const resolution = this.resolveFilePath(dbPath, fileName);
    
    return {
      environment: process.env.NODE_ENV || 'development',
      storageBases: this.STORAGE_BASES,
      resolution,
      validation: resolution.path ? this.validateFile(resolution.path) : undefined
    };
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create directory ${dirPath}:`, error);
    }
  }
}

// Export singleton instance
export const universalPathResolver = UniversalPathResolver.getInstance();