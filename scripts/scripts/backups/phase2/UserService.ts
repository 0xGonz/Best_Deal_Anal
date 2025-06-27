import { BaseService } from './BaseService';
import { User, InsertUser } from '@shared/schema';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// Convert scrypt to Promise-based
const scryptAsync = promisify(scrypt);

/**
 * Service for handling user-related business logic
 */
export class UserService extends BaseService {
  /**
   * Create a new user with password hashing
   */
  async createUser(userData: InsertUser): Promise<User> {
    // Hash the password before storing
    const hashedPassword = await this.hashPassword(userData.password);
    
    // Create user with hashed password
    return this.storage.createUser({
      ...userData,
      password: hashedPassword
    });
  }
  
  /**
   * Get a user by ID
   */
  async getUserById(id: number): Promise<User | undefined> {
    return this.storage.getUser(id);
  }
  
  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.storage.getUserByUsername(username);
  }
  
  /**
   * Authenticate a user
   */
  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.storage.getUserByUsername(username);
    
    if (!user) return undefined;
    
    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);
    
    return isPasswordValid ? user : undefined;
  }
  
  /**
   * Update a user
   */
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    // If updating password, hash it first
    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }
    
    return this.storage.updateUser(id, userData);
  }
  
  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return this.storage.getUsers();
  }
  
  /**
   * Delete a user
   */
  async deleteUser(id: number): Promise<boolean> {
    return this.storage.deleteUser(id);
  }
  
  /**
   * Hash a password using scrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buffer.toString('hex')}.${salt}`;
  }
  
  /**
   * Verify a password against a stored hash
   */
  private async verifyPassword(supplied: string, stored: string): Promise<boolean> {
    const [hashed, salt] = stored.split('.');
    const hashedBuffer = Buffer.from(hashed, 'hex');
    const suppliedBuffer = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuffer, suppliedBuffer);
  }
}