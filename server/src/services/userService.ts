import { AppError } from '../middleware/errorHandler';
import { User, IUser } from '../models/User';
import { hash, compare } from 'bcryptjs';

export class UserService {
  async createUser(email: string, password: string, name: string): Promise<IUser> {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError(400, 'Email already registered');
    }

    const user = new User({
      email,
      password,
      name,
      status: 'offline'
    });

    await user.save();
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<IUser> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials');
    }

    return user;
  }

  async updateUserStatus(userId: string, status: 'online' | 'offline'): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    user.status = status;
    user.lastSeen = new Date();
    await user.save();
  }

  async getUserProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }

  async searchUsers(query: string): Promise<IUser[]> {
    console.log('Searching users with query:', query);
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('_id name email status lastSeen');
    
    console.log('Found users:', users);
    return users;
  }
} 