import { Router, Request, Response } from "express";
import { StorageFactory } from "../storage-factory";
import { hashPassword, requireAuth } from "../utils/auth";
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import * as schema from '@shared/schema';

const router = Router();

// Create user validation schema - custom schema to avoid database field requirements
const userInsertSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'partner', 'analyst', 'observer', 'intern']),
  // Optional fields that we generate if not provided
  initials: z.string().optional(),
  avatarColor: z.string().optional(),
});

// Create a new user with password hashing - ADMIN ONLY
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the current user is an admin
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!req.session.role || req.session.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can create new users' });
    }
    
    console.log(`Admin user (ID: ${req.session.userId}) attempting to create a new user`);
    
    // Validate request body
    const userData = userInsertSchema.parse(req.body);
    
    // Check if username already exists
    const storage = StorageFactory.getStorage();
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    
    // Generate initials from full name
    const nameParts = userData.fullName.split(' ');
    let initials = '';
    if (nameParts.length >= 2) {
      initials = `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
    } else if (nameParts.length === 1) {
      initials = nameParts[0].substring(0, 2);
    }
    
    // Generate a random avatar color
    const colors = ['#4f46e5', '#0891b2', '#ea580c', '#be123c', '#7c3aed', '#059669', '#dc2626'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Hash the password
    const hashedPassword = await hashPassword(userData.password);
    
    // Create user with hashed password
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword,
      initials,
      avatarColor
    });
    
    // Don't return the password
    const { password, ...userWithoutPassword } = newUser;
    
    console.log(`New user created by admin: ${userData.username}, role: ${userData.role}`);
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// Get all users
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const storage = StorageFactory.getStorage();
    const users = await storage.getUsers();
    res.json(users.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      initials: user.initials,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      lastActive: user.lastActive
    })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get a specific user by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const storage = StorageFactory.getStorage();
    const user = await storage.getUser(Number(req.params.id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Don't send password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Update a user's profile
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the current user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const targetUserId = Number(req.params.id);
    const currentUserId = req.session.userId;
    const isAdmin = req.session.role === 'admin';
    const isOwnProfile = currentUserId === targetUserId;
    
    // Users can only update their own profile unless they're an admin
    if (!isAdmin && !isOwnProfile) {
      return res.status(403).json({ 
        message: 'You can only update your own profile' 
      });
    }
    
    const storage = StorageFactory.getStorage();
    
    // Make sure target user exists
    const existingUser = await storage.getUser(targetUserId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Allow updating more fields for admins
    const { fullName, role, avatarColor, email, username, password } = req.body;
    const updateData: any = {};
    
    console.log(`Update request for user ${targetUserId} by user ${currentUserId} (admin: ${isAdmin})`);
    console.log('Update data received:', { fullName, role, avatarColor, email, username });
    
    if (fullName) {
      updateData.fullName = fullName;
      
      // Update initials based on the new name
      const nameParts = fullName.split(' ');
      if (nameParts.length >= 2) {
        updateData.initials = `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
      } else if (nameParts.length === 1) {
        updateData.initials = nameParts[0].substring(0, 2);
      }
    }
    
    // Admins can update email and username
    if (email && isAdmin) {
      updateData.email = email;
      console.log(`Admin updating email for user ${targetUserId} to: ${email}`);
    }
    
    if (username && isAdmin) {
      // Check if username is already taken by another user
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername && existingUserByUsername.id !== targetUserId) {
        return res.status(409).json({ 
          message: 'Username already exists' 
        });
      }
      updateData.username = username;
      console.log(`Admin updating username for user ${targetUserId} to: ${username}`);
    }
    
    // Only admins can update roles
    if (role && isAdmin) {
      updateData.role = role;
      console.log(`Admin updating role for user ${targetUserId} to: ${role}`);
    } else if (role && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only administrators can update user roles' 
      });
    }
    
    // Allow users to update their avatar color
    if (avatarColor) {
      updateData.avatarColor = avatarColor;
      console.log(`Updating avatar color for user ${targetUserId} to: ${avatarColor}`);
    }
    
    // Handle password updates (admins can update any password, users can update their own)
    if (password && (isAdmin || isOwnProfile)) {
      // Hash the password before storing
      updateData.password = await hashPassword(password);
      console.log(`Updating password for user ${targetUserId}`);
    } else if (password && !isAdmin && !isOwnProfile) {
      return res.status(403).json({ 
        message: 'You can only update your own password' 
      });
    }
    
    // Check if there's actually something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    console.log('Final update data being sent to storage:', updateData);
    
    // Update the user
    const updatedUser = await storage.updateUser(targetUserId, updateData);
    if (!updatedUser) {
      console.error(`Failed to update user ${targetUserId} in storage`);
      return res.status(500).json({ message: 'Failed to update user' });
    }
    
    console.log(`Successfully updated user ${targetUserId}:`, updatedUser.fullName);
    
    // Return the updated user without password
    const { password: userPassword, ...userWithoutPassword } = updatedUser;
    
    // Add cache headers to prevent stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      ...userWithoutPassword,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Change password endpoint
router.post('/:id/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the current user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const targetUserId = Number(req.params.id);
    const currentUserId = req.session.userId;
    const isAdmin = req.session.role === 'admin';
    const isOwnPassword = currentUserId === targetUserId;
    
    // Users can only change their own password unless they're an admin
    if (!isAdmin && !isOwnPassword) {
      return res.status(403).json({ 
        message: 'You can only change your own password' 
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }
    
    // Get user to verify current password
    const storage = StorageFactory.getStorage();
    const user = await storage.getUser(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify the current password (only if it's not an admin or if it's the own user)
    let passwordValid = true;
    if (!isAdmin || isOwnPassword) {
      if (user.password.startsWith('$2b$')) {
        // If the password is hashed, use bcrypt to verify
        const { verifyPassword } = await import('../utils/auth');
        passwordValid = await verifyPassword(currentPassword, user.password);
      } else {
        // Fallback for plain text passwords
        passwordValid = user.password === currentPassword;
      }
      
      if (!passwordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }
    
    // Hash the new password
    const { hashPassword } = await import('../utils/auth');
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user with the new password
    const updatedUser = await storage.updateUser(targetUserId, { password: hashedPassword });
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update password' });
    }
    
    console.log(`Password changed for user ID ${targetUserId}${isAdmin && !isOwnPassword ? ' by admin' : ''}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Delete user endpoint - ADMIN ONLY
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if the current user is authenticated and an admin
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!req.session.role || req.session.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can delete users' });
    }
    
    const targetUserId = Number(req.params.id);
    const currentUserId = req.session.userId;
    
    // Prevent admins from deleting themselves
    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    console.log(`Admin user (ID: ${currentUserId}) attempting to delete user ID: ${targetUserId}`);
    
    const storage = StorageFactory.getStorage();
    
    // Make sure target user exists
    const userToDelete = await storage.getUser(targetUserId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete the user
    const success = await storage.deleteUser(targetUserId);
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete user' });
    }
    
    console.log(`User ID ${targetUserId} (${userToDelete.username}) deleted by admin (ID: ${currentUserId})`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;