import { IStorage, MemStorage } from './storage';
import { DatabaseStorage } from './database-storage';
import { db, pool } from './db';

/**
 * StorageFactory provides a way to easily switch between different storage implementations
 * This makes the application more modular and easier to test
 */
export class StorageFactory {
  private static instance: IStorage;
  static storage: IStorage;

  /**
   * Get the appropriate storage implementation based on environment
   */
  public static getStorage(): IStorage {
    if (!this.instance) {
      try {
        // Choose storage based on environment variables
        // Default to database unless explicitly told to use memory
        const useMemory = process.env.USE_MEMORY_SESSIONS === "true";
        
        if (useMemory) {
          console.log('Using MemStorage for data persistence');
          this.instance = new MemStorage();
        } else {
          console.log('Using DatabaseStorage for data persistence');
          this.instance = new DatabaseStorage();
        }
      } catch (error) {
        console.error('Error initializing storage:', error);
        console.log('Falling back to MemStorage as last resort');
        this.instance = new MemStorage();
      }
    }
    
    // Set the static storage property to the instance for easier access
    this.storage = this.instance;
    return this.instance;
  }

  /**
   * Set a specific storage implementation (useful for testing)
   */
  public static setStorage(storage: IStorage): void {
    this.instance = storage;
    this.storage = storage;
  }

  /**
   * Reset the storage instance (useful for testing)
   */
  public static resetStorage(): void {
    this.instance = undefined as unknown as IStorage;
    this.storage = undefined as unknown as IStorage;
  }
}
