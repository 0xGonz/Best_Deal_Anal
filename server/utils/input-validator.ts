
import { z } from 'zod';

export class InputValidator {
  static sanitizeString(input: string): string {
    return input.replace(/<script[^<]*(?:(?!</script>)<[^<]*)*</script>/gi, '')
                .replace(/[<>'"&]/g, '');
  }

  static validateFileUpload(file: any): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    return allowedTypes.includes(file.mimetype) && file.size <= maxSize;
  }

  static validateEmail(email: string): boolean {
    const emailSchema = z.string().email();
    try {
      emailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  }
}