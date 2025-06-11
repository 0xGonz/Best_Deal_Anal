/**
 * LoggingService provides centralized logging functionality
 * with different log levels and formatting options
 */

// Log levels for different types of messages
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export class LoggingService {
  private static instance: LoggingService;
  private logLevel: LogLevel;
  
  constructor() {
    // Set log level based on environment or default to INFO
    this.logLevel = this.getLogLevelFromEnv();
    console.log(`Logging service initialized at level: ${LogLevel[this.logLevel]}`);
  }
  
  /**
   * Get the singleton instance of the logging service
   */
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }
  
  /**
   * Determine log level from environment variables
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      return LogLevel[envLevel as keyof typeof LogLevel];
    }
    
    // Default to INFO in production, DEBUG in development
    return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }
  
  /**
   * Format a log message with timestamp and level
   */
  private formatLog(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (meta) {
      if (meta instanceof Error) {
        formattedMessage += `\n${meta.stack || meta.message}`;
      } else if (typeof meta === 'object') {
        try {
          formattedMessage += `\n${JSON.stringify(meta, null, 2)}`;
        } catch (err) {
          formattedMessage += `\n[Object cannot be stringified]`;
        }
      } else {
        formattedMessage += `\n${meta}`;
      }
    }
    
    return formattedMessage;
  }
  
  /**
   * Log an error message
   */
  public error(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatLog('ERROR', message, meta));
    }
  }
  
  /**
   * Log a warning message
   */
  public warn(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatLog('WARN', message, meta));
    }
  }
  
  /**
   * Log an info message
   */
  public info(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(this.formatLog('INFO', message, meta));
    }
  }
  
  /**
   * Log a debug message
   */
  public debug(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.debug(this.formatLog('DEBUG', message, meta));
    }
  }
  
  /**
   * Log a trace message (most verbose)
   */
  public trace(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.TRACE) {
      console.debug(this.formatLog('TRACE', message, meta));
    }
  }
  
  /**
   * Temporarily increase log level for debugging
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level changed to: ${LogLevel[level]}`);
  }
}