
import path from 'path';

export class SecureFileHandler {
  private static readonly ALLOWED_DIRECTORIES = [
    'uploads',
    'public/uploads',
    'data/uploads'
  ];

  static sanitizePath(filePath: string): string {
    // Remove directory traversal attempts
    const normalized = path.normalize(filePath).replace(/^(..[/\])+/, '');
    
    // Ensure path is within allowed directories
    const resolvedPath = path.resolve(process.cwd(), normalized);
    const projectRoot = path.resolve(process.cwd());
    
    if (!resolvedPath.startsWith(projectRoot)) {
      throw new Error('Path traversal attempt detected');
    }
    
    return normalized;
  }

  static validateFileAccess(requestedPath: string): boolean {
    try {
      const sanitized = this.sanitizePath(requestedPath);
      return this.ALLOWED_DIRECTORIES.some(dir => 
        sanitized.startsWith(dir)
      );
    } catch {
      return false;
    }
  }
}