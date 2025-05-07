import { Router, Request } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { authenticate } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const router = Router();
const userService = new UserService();

// Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user!.id);
    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
          lastSeen: user.lastSeen
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search users
router.get('/search', authenticate, async (req: AuthRequest, res, next) => {
  try {
    console.log('User search query:', req.query); // Debug log
    const { query } = z.object({ query: z.string() }).parse(req.query);
    const users = await userService.searchUsers(query);
    res.json({
      status: 'success',
      data: {
        users: users.map(user => ({
          _id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          lastSeen: user.lastSeen
        }))
      }
    });
  } catch (error) {
    console.error('User search error:', error); // Debug log
    next(error);
  }
});

export const userRouter = router; 