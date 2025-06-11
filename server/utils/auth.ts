import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandlers';
import { StorageFactory } from '../storage-factory';
import * as bcrypt from 'bcrypt';
import { SALT_ROUNDS, AUTH_ERRORS } from '../constants/auth-constants';

// Types for session data
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
  }
}

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return next(new AppError(AUTH_ERRORS.AUTH_REQUIRED, 401));
  }
  next();
}

// Role-based authorization middleware
export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return next(new AppError(AUTH_ERRORS.AUTH_REQUIRED, 401));
    }
    
    if (!req.session.role || !allowedRoles.includes(req.session.role)) {
      return next(new AppError(AUTH_ERRORS.PERMISSION_DENIED, 403));
    }
    
    next();
  };
}

// Helper to get the current user from the session
export async function getCurrentUser(req: Request) {
  if (!req.session || !req.session.userId) {
    console.log('No userId in session, user is not authenticated');
    return null;
  }
  
  console.log(`Getting current user from session with userId: ${req.session.userId}`);
  
  try {
    const storage = StorageFactory.getStorage();
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      console.error(`User with ID ${req.session.userId} not found in database but was in session`);
      // Session refers to a user that doesn't exist in the database
      // This is an inconsistent state - we should destroy the session
      await new Promise<void>((resolve) => {
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying invalid session:', err);
          }
          resolve();
        });
      });
      return null;
    }
    
    console.log(`Found current user: ${user.username} (ID: ${user.id}, Role: ${user.role})`);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Function to hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Function to verify a password against a hash
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Login helper - simplified to reduce race conditions
export async function login(req: Request, username: string, password: string) {
  try {
    console.log(`Auth login helper called for username: ${username}`);

    // First, get the user from the database
    const storage = StorageFactory.getStorage();
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      console.error(`User ${username} not found in database`);
      throw new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, 401);
    }
    
    console.log(`User ${username} found, checking password`);
    
    // Check if the password is hashed by seeing if it starts with $2b$ (bcrypt identifier)
    let passwordValid = false;
    if (user.password.startsWith('$2b$')) {
      // If the password is hashed, use bcrypt to verify
      passwordValid = await verifyPassword(password, user.password);
      console.log(`Password verified with bcrypt for ${username}: ${passwordValid}`);
    } else {
      // Fallback for plain text passwords during transition
      // This allows old accounts to still log in
      passwordValid = user.password === password;
      console.log(`Password verified with plain text for ${username}: ${passwordValid}`);
      
      // Optionally hash the password for next time if it matches
      if (passwordValid) {
        // Update the user's password hash in the database
        const hashedPassword = await hashPassword(password);
        await storage.updateUser(user.id, { password: hashedPassword });
        console.log(`Upgraded password hash for user ${username}`);
      }
    }
    
    if (!passwordValid) {
      console.error(`Invalid password for user ${username}`);
      throw new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, 401);
    }
    
    // Regenerate session for better security
    try {
      // Regenerate the session to avoid session fixation attacks
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('Error regenerating session during login:', err);
            return reject(new AppError('Session error during login', 500));
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('Failed to regenerate session:', error);
      // Continue anyway, don't fail the login process for this
    }
    
    // Directly set session data
    console.log(`Setting session data for user ${username}:`, { id: user.id, role: user.role });
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    // Save the session synchronously to avoid race conditions
    console.log(`Saving session for ${username}`);
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          return reject(new AppError('Failed to save session', 500));
        }
        console.log(`Session saved successfully for ${username} with ID ${req.sessionID}`);
        
        // Double check the session was properly saved
        if (!req.session.userId) {
          console.error('Session userId not set after save!');
          return reject(new AppError('Session data not properly saved', 500));
        }
        resolve();
      });
    });
    
    // Verify the session was properly saved
    console.log('Session verification - userId in session:', req.session.userId);
    if (!req.session.userId) {
      throw new Error('Session data not properly saved');
    }
    
    return user;
  } catch (error) {
    console.error('Login helper error:', error);
    throw error;
  }
}

// Logout helper with enhanced error handling
export function logout(req: Request) {
  console.log('Logout helper called');
  
  if (!req.session || !req.session.userId) {
    console.log('No active session to logout from');
    return Promise.resolve();
  }
  
  const username = req.session.username;
  const userId = req.session.userId;
  console.log(`Destroying session for user: ${username}, ID: ${userId}`);
  
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return reject(new AppError('Failed to destroy session', 500));
      }
      
      // Clear the cookie as well
      if (req.res) {
        req.res.clearCookie('investment_tracker.sid');
        console.log('Session cookie cleared');
      }
      
      console.log(`Session successfully destroyed for user: ${username}, ID: ${userId}`);
      resolve();
    });
  });
}

// Register user helper - simplified to match login approach
export async function registerUser(req: Request, userData: any) {
  try {
    console.log(`Register user helper called for username: ${userData.username}`);
    
    const storage = StorageFactory.getStorage();
    
    // Check if the username already exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      console.error(`Username already exists: ${userData.username}`);
      throw new AppError(AUTH_ERRORS.USERNAME_EXISTS, 400);
    }
    
    // Check if the email already exists
    const users = await storage.getUsers();
    const existingEmail = users.find(u => u.email === userData.email);
    if (existingEmail) {
      console.error(`Email already exists: ${userData.email}`);
      throw new AppError(AUTH_ERRORS.EMAIL_EXISTS, 400);
    }
    
    // Hash the password
    console.log('Hashing password for new user');
    const hashedPassword = await hashPassword(userData.password);
    
    // Create the user with hashed password
    console.log('Creating new user with hashed password');
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword,
    });
    
    // Use a more reliable approach for handling sessions
    try {
      // Clean out any existing session data
      for (const key in req.session) {
        if (key !== 'cookie' && key !== 'id') {
          delete (req.session as any)[key];
        }
      }
      
      // Regenerate the session to avoid session fixation attacks
      // This creates a new session ID and maintains the data
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('Error regenerating session during registration:', err);
            return reject(err);
          }
          resolve();
        });
      });
      
      // Set session data after regeneration
      console.log(`Setting session data for new user ${userData.username}:`, { id: newUser.id, role: newUser.role });
      req.session.userId = newUser.id;
      req.session.username = newUser.username;
      req.session.role = newUser.role;
      
      // Save the session synchronously to avoid race conditions
      console.log(`Saving session for new user ${userData.username}`);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session during registration:', err);
            return reject(err);
          }
          console.log(`Session saved successfully for new user ${userData.username} with ID ${req.sessionID}`);
          resolve();
        });
      });
      
      // Verify the session was properly saved
      console.log('Session verification - userId in session:', req.session.userId);
      console.log('Session ID:', req.sessionID);
      
      if (!req.session.userId) {
        throw new Error('Session data not properly saved during registration');
      }
    } catch (error) {
      console.error('Session handling error during registration:', error);
      throw new AppError('Failed to establish user session', 500);
    }
    
    return newUser;
  } catch (error) {
    console.error('Register user helper error:', error);
    throw error;
  }
}
