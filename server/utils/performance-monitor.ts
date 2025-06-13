
export class PerformanceMonitor {
  static measureApiCall<T>(fn: () => Promise<T>, endpoint: string): Promise<T> {
    const start = performance.now();
    return fn().finally(() => {
      const duration = performance.now() - start;
      console.log(`API ${endpoint} took ${duration.toFixed(2)}ms`);
    });
  }

  static measureDatabaseQuery<T>(fn: () => Promise<T>, queryName: string): Promise<T> {
    const start = performance.now();
    return fn().finally(() => {
      const duration = performance.now() - start;
      console.log(`Query ${queryName} took ${duration.toFixed(2)}ms`);
    });
  }
}