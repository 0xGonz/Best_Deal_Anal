/**
 * Security Audit Logger
 */

export class SecurityAuditLogger {
  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: this.maskSensitiveData(data)
    };
    console.log(JSON.stringify(logEntry));
  }

  private maskSensitiveData(data: any): any {
    if (typeof data === 'string' && data.length > 20) {
      return data.substring(0, 6) + '***' + data.substring(data.length - 4);
    }

    if (data && typeof data === 'object') {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (['password', 'token', 'secret', 'key', 'hash'].some(field => 
          key.toLowerCase().includes(field))) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = this.maskSensitiveData(value);
        }
      }
      return masked;
    }

    return data;
  }

  logAuthEvent(type: string, userId?: number, ip?: string) {
    this.log('info', 'Authentication event: ' + type, { type, userId, ip });
  }

  logSecurityViolation(type: string, details: any, ip?: string) {
    this.log('error', 'Security violation: ' + type, { type, details, ip });
  }

  logDataAccess(userId: number, resource: string, action: string) {
    this.log('info', 'Data access', { userId, resource, action });
  }
}

export default SecurityAuditLogger;