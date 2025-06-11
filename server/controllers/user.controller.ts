import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { insertUserSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { formatZodError } from '../utils/errorHandlers';

/**
 * Controller for user related endpoints
 */
export class UserController {
  /**
   * Get all users
   */
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Failed to get all users', error);
      res.status(500).json({ error: 'An error occurred while retrieving users' });
    }
  }

  /**
   * Get a user by ID
   */
  async getUserById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const user = await userService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Failed to get user', error);
      res.status(500).json({ error: 'An error occurred while retrieving the user' });
    }
  }

  /**
   * Create a new user
   */
  async createUser(req: Request, res: Response) {
    try {
      // Validate request body
      const validatedUser = insertUserSchema.parse(req.body);
      
      // Create user
      const result = await userService.createUser(validatedUser);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      
      if (error instanceof Error && error.message === 'Username already exists') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      
      console.error('Failed to create user', error);
      res.status(500).json({ error: 'An error occurred while creating the user' });
    }
  }

  /**
   * Update a user
   */
  async updateUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      // We're not validating the full schema here since it's a partial update
      const userData = req.body;
      
      // Update user
      const result = await userService.updateUser(id, userData);
      
      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Failed to update user', error);
      res.status(500).json({ error: 'An error occurred while updating the user' });
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const result = await userService.deleteUser(id);
      
      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete user', error);
      res.status(500).json({ error: 'An error occurred while deleting the user' });
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      res.json(req.user);
    } catch (error) {
      console.error('Failed to get current user', error);
      res.status(500).json({ error: 'An error occurred while retrieving the current user' });
    }
  }
}

export const userController = new UserController();