import { StorageFactory } from '../storage-factory';
import { User, InsertUser } from '@shared/schema';
import bcrypt from 'bcrypt';

/**
 * Service for user related operations
 */
export class UserService {
  /**
   * Get a user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    const storage = StorageFactory.getStorage();
    const user = await storage.getUser(id);
    
    if (!user) {
      return null;
    }
    
    // Don't return password in the result
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const storage = StorageFactory.getStorage();
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return null;
    }
    
    // Don't return password in the result
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    const storage = StorageFactory.getStorage();
    const users = await storage.getUsers();
    
    // Remove passwords from all users
    return users.map((user: User) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  /**
   * Create a new user
   */
  async createUser(userData: InsertUser): Promise<User | null> {
    const storage = StorageFactory.getStorage();
    
    // Check if user with this username already exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Create the user with hashed password
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword
    });
    
    // Don't return password in the result
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword as User;
  }

  /**
   * Update a user
   */
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | null> {
    const storage = StorageFactory.getStorage();
    
    // Check if user exists
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      return null;
    }
    
    let updateData = { ...userData };
    
    // If password is being updated, hash it
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    // Update the user
    const updatedUser = await storage.updateUser(id, updateData);
    
    if (!updatedUser) {
      return null;
    }
    
    // Don't return password in the result
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  /**
   * Delete a user
   */
  async deleteUser(id: number): Promise<boolean> {
    const storage = StorageFactory.getStorage();
    
    // Check if user exists
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      return false;
    }
    
    // Delete the user
    return await storage.deleteUser(id);
  }
  
  /**
   * Authenticate user
   */
  async authenticateUser(username: string, password: string): Promise<User | null> {
    const storage = StorageFactory.getStorage();
    
    // Get user with password
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return null;
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return null;
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}

export const userService = new UserService();