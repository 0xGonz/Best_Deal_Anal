import express, { Request, Response, NextFunction } from 'express';
import { asyncHandler, AppError } from '../utils/errorHandlers';
import { login, logout, getCurrentUser, hashPassword, registerUser } from '../utils/auth';
import { z, ZodError } from 'zod';
import { StorageFactory } from '../storage-factory';
import { insertUserSchema } from '@shared/schema';
import { AUTH_ERRORS } from '../constants/auth-constants';

// Helper to format Zod error messages
function formatErrors(error: ZodError): string {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}

const router = express.Router();

// Login validation schema
const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

// Login route with rate limiting protection
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = loginSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ 
        message: 'Invalid credentials', 
        code: 'VALIDATION_ERROR' 
      });
    }
    
    const { username, password } = validatedData.data;
    
    // Attempt login
    const user = await login(req, username, password);
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    // Return user directly, not wrapped in an object
    return res.json(userWithoutPassword);
  } catch (err) {
    // Use type assertion for better error handling
    const error = err as Error;
    
    if (error.message === AUTH_ERRORS.INVALID_CREDENTIALS) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    } else if (error instanceof ZodError) {
      return res.status(400).json({ 
        message: 'Invalid credentials',
        code: 'VALIDATION_ERROR'
      });
    } else if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({ 
        message: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    } else {
      // For unknown errors, provide a generic message
      return res.status(500).json({ 
        message: 'Authentication failed',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}));

// Logout route
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  await logout(req);
  return res.json({ success: true, message: 'Logged out successfully' });
}));

// Get current user route
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  console.log(`Session debug [GET /api/auth/me]: sessionID=${req.sessionID?.slice(0, 8)}..., hasSession=${!!req.session}, userId=${req.session?.userId || 'none'}, headers="${req.headers.cookie?.slice(0, 20)}"`);
  
  // Add extended logging to help debug session issues
  console.log('Session cookies:', req.headers.cookie);
  console.log('Session object:', {
    id: req.sessionID,
    cookie: req.session?.cookie,
    userId: req.session?.userId,
    username: req.session?.username,
    role: req.session?.role,
  });
  
  const user = await getCurrentUser(req);
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  // Update last active timestamp for the user
  try {
    const storage = StorageFactory.getStorage();
    await storage.updateUser(user.id, { lastActive: new Date() });
  } catch (error) {
    // Log error but don't fail the request
    console.warn('Failed to update last active timestamp:', error);
  }
  
  // Return user info (without password)
  const { password: _, ...userWithoutPassword } = user;
  // Return user directly, not wrapped in an object
  return res.json(userWithoutPassword);
}));

// Registration validation schema
const registrationSchema = insertUserSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  initials: z.string().max(3, 'Initials must be at most 3 characters').optional(),
  passwordConfirm: z.string().min(6, 'Password confirmation must be at least 6 characters')
})
.refine(data => data.password === data.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm'],
});

// Register route - public registration always creates analyst users
router.post('/register', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Handling public registration request', {
      body: {
        ...req.body,
        password: req.body?.password ? '******' : undefined,
        passwordConfirm: req.body?.passwordConfirm ? '******' : undefined
      }
    });
    
    // Check if passwords match before validation schema
    if (req.body.password !== req.body.passwordConfirm) {
      console.error('Password mismatch in request');
      return res.status(400).json({ 
        message: 'Passwords do not match',
        path: ['passwordConfirm']
      });
    }
    
    // Validate request body against schema
    let validatedData;
    try {
      validatedData = registrationSchema.parse(req.body);
      console.log('Registration data passed schema validation');
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        console.error('Zod validation error:', validationError.errors);
        return res.status(400).json({ 
          message: formatErrors(validationError),
          errors: validationError.errors 
        });
      }
      throw validationError; // Re-throw unexpected errors
    }
    
    // Remove passwordConfirm (it's just for validation)
    const { passwordConfirm, ...userData } = validatedData;
    
    // Self registration allows analyst, observer, intern, and partner roles
    // Only admin role is restricted and requires admin creation
    if (!userData.role || userData.role === 'admin') {
      console.log(`Overriding requested role ${userData.role} to 'analyst' for public registration`);
      userData.role = 'analyst';
    }
    
    // Log the role assignment for security audit
    console.log(`Public registration creating user with role: ${userData.role}`);
    
    // If initials are not provided, generate them from full name
    if (!userData.initials) {
      userData.initials = userData.fullName
        .split(' ')
        .map(name => name[0])
        .join('')
        .slice(0, 3)
        .toUpperCase();
      console.log(`Generated initials ${userData.initials} from fullName ${userData.fullName}`);
    }
    
    // Generate a random avatar color if not provided
    if (!userData.avatarColor) {
      const colors = ['#4f46e5', '#0891b2', '#ea580c', '#be123c', '#7c3aed', '#059669', '#dc2626'];
      userData.avatarColor = colors[Math.floor(Math.random() * colors.length)];
    }
    
    console.log(`Creating new user via public registration (role: ${userData.role})`);
    
    // Register the new user
    const user = await registerUser(req, userData);
    console.log(`User registered successfully: ${user.username}, ID: ${user.id}`);
    
    // Check if session was properly established
    if (!req.session.userId) {
      console.error('Session not established after registration');
      return res.status(500).json({ 
        message: 'Registration successful but session not established. Please try logging in.' 
      });
    }
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    return res.status(201).json(userWithoutPassword);
  } catch (err) {
    // Use type assertion for better error handling
    const error = err as Error;
    console.error('Registration route error:', error);
    
    // Handle specific error types
    if (error instanceof AppError) {
      if (error.message === AUTH_ERRORS.USERNAME_EXISTS) {
        return res.status(400).json({ message: 'Username already exists' });
      } else if (error.message === AUTH_ERRORS.EMAIL_EXISTS) {
        return res.status(400).json({ message: 'Email already exists' });
      } else {
        return res.status(error.statusCode || 500).json({ message: error.message });
      }
    } else if (error instanceof ZodError) {
      return res.status(400).json({ message: formatErrors(error) });
    } else {
      // For unknown errors, provide a generic message but log the details
      console.error('Unknown error during registration:', error);
      return res.status(500).json({ message: 'Registration failed due to an internal error' });
    }
  }
}));

export default router;
