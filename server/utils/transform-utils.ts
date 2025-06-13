
export class DataTransformUtils {
  static standardizeNullToUndefined<T>(obj: T): T {
    if (obj === null) return undefined as unknown as T;
    if (typeof obj !== 'object') return obj;
    
    const result = {} as T;
    for (const [key, value] of Object.entries(obj as any)) {
      (result as any)[key] = value === null ? undefined : value;
    }
    return result;
  }

  static formatAllocationData(allocation: any) {
    return this.standardizeNullToUndefined({
      ...allocation,
      dealName: allocation.dealName || undefined,
      dealSector: allocation.dealSector || undefined
    });
  }
}