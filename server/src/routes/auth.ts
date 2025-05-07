import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticate } from '../middleware/auth';

const router = Router();
const userService = new UserService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/register', async (req, res) => {
  try {
    let { email, password, name } = registerSchema.parse(req.body);
    email = email.toLowerCase();
    console.log('Registration attempt:', { email, name });
    const user = await userService.createUser(email, password, name);
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
    console.log('Registration successful:', { email });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message: errorMessage });
  }
});

// Development route to create a test user
router.post('/create-test-user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (testUser) {
      return res.json({
        success: true,
        message: 'Test user already exists',
        data: {
          email: testUser.email,
          password: 'password123'
        }
      });
    }

    const newUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Test user created',
      data: {
        email: newUser.email,
        password: 'password123'
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase();
    console.log('Login attempt:', { email });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', email);
    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login' });
  }
});

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new AppError(401, 'User not authenticated');
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router; 