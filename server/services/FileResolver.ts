import fs from 'fs';
import path from 'path';

// Scalable File Resolution Architecture
interface FileResolverStrategy {
  name: string;
  priority: number;
  resolve(document: any, baseFilename: string): string[];
}

class CurrentStructureStrategy implements FileResolverStrategy {
  name = 'current-structure';
  priority = 1;
  
  resolve(document: any, baseFilename: string): string[] {
    const UPLOAD_PATH = path.resolve(process.cwd(), 'public/uploads');
    return [
      path.join(UPLOAD_PATH, `deal-${document.dealId}`, baseFilename),
      path.join(UPLOAD_PATH, baseFilename)
    ];
  }
}

class LegacyPathStrategy implements FileResolverStrategy {
  name = 'legacy-paths';
  priority = 2;
  
  resolve(document: any, baseFilename: string): string[] {
    const normalizedPath = document.filePath.startsWith('/') 
      ? document.filePath.substring(1) 
      : document.filePath;
      
    return [
      path.resolve(process.cwd(), 'public', normalizedPath),
      path.resolve(process.cwd(), 'public', document.filePath),
      path.resolve(process.cwd(), normalizedPath)
    ];
  }
}

class FlexibleSearchStrategy implements FileResolverStrategy {
  name = 'flexible-search';
  priority = 3;
  
  resolve(document: any, baseFilename: string): string[] {
    return [
      path.resolve(process.cwd(), 'public/uploads', path.basename(document.filePath)),
      path.resolve(process.cwd(), 'public/uploads', baseFilename),
      path.resolve(process.cwd(), 'uploads', baseFilename),
      path.resolve(process.cwd(), 'uploads', path.basename(document.filePath))
    ];
  }
}

export class ModularFileResolver {
  private strategies: Map<string, FileResolverStrategy> = new Map();
  
  constructor() {
    this.registerStrategy(new CurrentStructureStrategy());
    this.registerStrategy(new LegacyPathStrategy());
    this.registerStrategy(new FlexibleSearchStrategy());
  }
  
  registerStrategy(strategy: FileResolverStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`📁 Registered file resolution strategy: ${strategy.name}`);
  }
  
  async resolveFile(document: any): Promise<{ 
    path: string | null, 
    strategy: string | null,
    allAttempts: string[]
  }> {
    const baseFilename = path.basename(document.filePath);
    const allAttempts: string[] = [];
    
    // Sort strategies by priority
    const sortedStrategies = Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority);
    
    for (const strategy of sortedStrategies) {
      const candidates = strategy.resolve(document, baseFilename);
      allAttempts.push(...candidates);
      
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          console.log(`✅ File resolved using ${strategy.name}: ${candidate}`);
          return { 
            path: candidate, 
            strategy: strategy.name,
            allAttempts 
          };
        }
      }
    }
    
    console.log(`❌ File resolution failed for: ${document.fileName}`);
    console.log(`📂 Attempted paths: ${allAttempts.length} locations`);
    
    return { 
      path: null, 
      strategy: null,
      allAttempts 
    };
  }
  
  // Method for future extensibility
  addCustomStrategy(strategy: FileResolverStrategy): void {
    this.registerStrategy(strategy);
  }
  
  // Health check method
  async validateStorageHealth(): Promise<{
    availableStrategies: string[],
    storageStatus: Record<string, boolean>
  }> {
    const storageStatus: Record<string, boolean> = {};
    const testPaths = [
      path.resolve(process.cwd(), 'public/uploads'),
      path.resolve(process.cwd(), 'uploads'),
      path.resolve(process.cwd(), 'public')
    ];
    
    testPaths.forEach(testPath => {
      storageStatus[testPath] = fs.existsSync(testPath);
    });
    
    return {
      availableStrategies: Array.from(this.strategies.keys()),
      storageStatus
    };
  }
}

// Singleton instance for the application
export const fileResolver = new ModularFileResolver();