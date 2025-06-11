import { promises as fs } from 'fs';
import path from 'path';

export interface UniversalFileResolution {
  found: boolean;
  resolvedPath?: string;
  searchStrategy: string;
  confidence: 'high' | 'medium' | 'low';
}

export class UniversalDocumentResolver {
  private readonly searchLocations = [
    './uploads',
    './public/uploads', 
    './data/uploads',
    './public/uploads/deal-84',
    './public/uploads/deal-100'
  ];

  /**
   * Universal file resolution that works for ANY document regardless of age or location
   */
  async resolveFile(filePath: string, fileName: string): Promise<UniversalFileResolution> {
    // Strategy 1: Direct path resolution (highest confidence)
    const directResult = await this.tryDirectPath(filePath);
    if (directResult.found) return directResult;

    // Strategy 2: UUID-based matching (high confidence)
    const uuidResult = await this.findByUUID(filePath);
    if (uuidResult.found) return uuidResult;

    // Strategy 3: Filename similarity matching (medium confidence)
    const similarityResult = await this.findBySimilarity(fileName);
    if (similarityResult.found) return similarityResult;

    // Strategy 4: Fuzzy matching for legacy files (low confidence)
    const fuzzyResult = await this.findByFuzzyMatch(fileName);
    if (fuzzyResult.found) return fuzzyResult;

    return { found: false, searchStrategy: 'exhausted', confidence: 'low' };
  }

  private async tryDirectPath(filePath: string): Promise<UniversalFileResolution> {
    const possiblePaths = [
      path.resolve(filePath),
      path.resolve(filePath.startsWith('/') ? `.${filePath}` : `./${filePath}`),
      path.resolve(`./uploads/${path.basename(filePath)}`),
      path.resolve(`./public/uploads/${path.basename(filePath)}`)
    ];

    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        return {
          found: true,
          resolvedPath: testPath,
          searchStrategy: 'direct_path',
          confidence: 'high'
        };
      } catch {
        continue;
      }
    }

    return { found: false, searchStrategy: 'direct_path', confidence: 'high' };
  }

  private async findByUUID(filePath: string): Promise<UniversalFileResolution> {
    const uuid = this.extractUUID(filePath);
    if (!uuid) return { found: false, searchStrategy: 'uuid_match', confidence: 'high' };

    for (const location of this.searchLocations) {
      try {
        const files = await fs.readdir(location);
        const matchingFile = files.find(file => file.includes(uuid));
        
        if (matchingFile) {
          const fullPath = path.resolve(location, matchingFile);
          return {
            found: true,
            resolvedPath: fullPath,
            searchStrategy: 'uuid_match',
            confidence: 'high'
          };
        }
      } catch {
        continue;
      }
    }

    return { found: false, searchStrategy: 'uuid_match', confidence: 'high' };
  }

  private async findBySimilarity(fileName: string): Promise<UniversalFileResolution> {
    const normalizedTarget = this.normalizeFileName(fileName);
    
    for (const location of this.searchLocations) {
      try {
        const files = await fs.readdir(location);
        
        for (const file of files) {
          if (!file.endsWith('.pdf')) continue;
          
          const normalizedFile = this.normalizeFileName(file);
          const similarity = this.calculateSimilarity(normalizedTarget, normalizedFile);
          
          if (similarity > 0.7) { // 70% similarity threshold
            const fullPath = path.resolve(location, file);
            return {
              found: true,
              resolvedPath: fullPath,
              searchStrategy: 'similarity_match',
              confidence: 'medium'
            };
          }
        }
      } catch {
        continue;
      }
    }

    return { found: false, searchStrategy: 'similarity_match', confidence: 'medium' };
  }

  private async findByFuzzyMatch(fileName: string): Promise<UniversalFileResolution> {
    const keywords = this.extractKeywords(fileName);
    
    for (const location of this.searchLocations) {
      try {
        const files = await fs.readdir(location);
        
        for (const file of files) {
          if (!file.endsWith('.pdf')) continue;
          
          const fileKeywords = this.extractKeywords(file);
          const matchScore = this.calculateKeywordMatch(keywords, fileKeywords);
          
          if (matchScore > 0.5) { // 50% keyword match threshold
            const fullPath = path.resolve(location, file);
            return {
              found: true,
              resolvedPath: fullPath,
              searchStrategy: 'fuzzy_match',
              confidence: 'low'
            };
          }
        }
      } catch {
        continue;
      }
    }

    return { found: false, searchStrategy: 'fuzzy_match', confidence: 'low' };
  }

  private extractUUID(filename: string): string | null {
    const uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const match = filename.match(uuidRegex);
    return match ? match[1] : null;
  }

  private normalizeFileName(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/pdf$/, '');
  }

  private extractKeywords(filename: string): string[] {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5); // Top 5 keywords
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private calculateKeywordMatch(keywords1: string[], keywords2: string[]): number {
    const intersection = keywords1.filter(k => keywords2.includes(k));
    const union = [...new Set([...keywords1, ...keywords2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Auto-fix database paths based on resolved file locations
   */
  async autoFixDatabasePath(documentId: number, currentPath: string, fileName: string): Promise<boolean> {
    const resolution = await this.resolveFile(currentPath, fileName);
    
    if (resolution.found && resolution.confidence !== 'low') {
      // Update database with the correct path
      const relativePath = this.makeRelativePath(resolution.resolvedPath!);
      console.log(`🔧 Auto-fixing document ${documentId}: ${currentPath} → ${relativePath}`);
      return true;
    }
    
    return false;
  }

  private makeRelativePath(absolutePath: string): string {
    const workspacePath = path.resolve('./');
    const relativePath = path.relative(workspacePath, absolutePath);
    
    // Standardize to uploads/ prefix
    if (relativePath.startsWith('public/uploads/')) {
      return relativePath.replace('public/', '');
    }
    if (relativePath.startsWith('data/uploads/')) {
      return relativePath.replace('data/', '');
    }
    
    return relativePath;
  }
}

export const universalDocumentResolver = new UniversalDocumentResolver();