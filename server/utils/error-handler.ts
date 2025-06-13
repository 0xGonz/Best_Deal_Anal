
export class GlobalErrorHandler {
  static setup() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Log to external service in production
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  static wrapAsync<T>(fn: (...args: any[]) => Promise<T>) {
    return (...args: any[]) => {
      const result = fn(...args);
      if (result && typeof result.catch === 'function') {
        result.catch((error: Error) => {
          console.error('Async error caught:', error);
        });
      }
      return result;
    };
  }
}