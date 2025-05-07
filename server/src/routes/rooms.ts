import express, { Request, Response, NextFunction } from 'express';
import { Room } from '../models/Room';
import { User } from '../models/User';
import { authenticate } from '../middleware/auth';
import { ChatService } from '../services/chatService';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = express.Router();
const chatService = new ChatService();

// Create a new room
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, members } = req.body;
    const userId = (req.user as any).id || (req.user as any)._id;
    const room = await chatService.createRoom(name, userId, members);
    const populatedRoom = await Room.findById(room._id)
      .populate('members', 'name email status')
      .lean();
    res.status(201).json({ ...populatedRoom, inviteCode: room.inviteCode });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all rooms for a user
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = (req.user as any)._id;
    const rooms = await Room.find({ members: userId })
      .populate('members', 'name email status')
      .sort({ updatedAt: -1 });
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add members to a group
router.post('/add-members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, memberIds } = req.body;
    const userId = (req.user as any).id || (req.user as any)._id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    console.log('Attempting to add members:', { roomId, memberIds, userId });
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is a member of the room
    const isMember = room.members.some((memberId: any) => 
      memberId && memberId.toString() === userId.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to add members to this room' });
    }

    // Filter out any invalid member IDs and existing members
    const validMemberIds = memberIds.filter((id: string) => {
      return id && !room.members.some((memberId: any) => 
        memberId && memberId.toString() === id.toString()
      );
    });

    if (validMemberIds.length === 0) {
      return res.status(400).json({ message: 'No valid new members to add' });
    }

    // Add new members
    room.members.push(...validMemberIds);
    await room.save();

    // Return updated room with populated members
    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'name email status');
      
    res.json({
      status: 'success',
      data: { room: populatedRoom }
    });
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove members from a group
router.post('/remove-members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, memberIds } = req.body;
    const room = await Room.findById(roomId);
    if (!room || !room.members.includes((req.user as any)._id)) {
      return res.status(404).json({ message: 'Room not found or not authorized' });
    }
    room.members = room.members.filter((id: any) => !memberIds.includes(id.toString()));
    if (room.members.length === 0) {
      await Room.findByIdAndDelete(roomId);
      return res.json({ message: 'Room deleted as it became empty' });
    }
    await room.save();
    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'name email status');
    res.json(populatedRoom);
  } catch (error) {
    console.error('Error removing members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave a group
router.post('/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.body;
    const userId = (req.user as any).id || (req.user as any)._id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    console.log('Attempting to leave room:', { roomId, userId });
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Convert both IDs to strings for comparison
    const userIdStr = userId.toString();
    room.members = room.members.filter((memberId: any) => {
      return memberId && memberId.toString() !== userIdStr;
    });

    if (room.members.length === 0) {
      await Room.findByIdAndDelete(roomId);
      return res.json({ message: 'Room deleted as it became empty' });
    }

    await room.save();
    res.json({ message: 'Successfully left the room' });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a group by invite code
router.post('/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const userId = (req.user as any).id || (req.user as any)._id;
    // Make invite code lookup case-insensitive
    const room = await Room.findOne({ inviteCode: new RegExp(`^${inviteCode}$`, 'i') });
    if (!room) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }
    if (!room.members.map((id: any) => id.toString()).includes(userId.toString())) {
      room.members.push(userId);
      await room.save();
    }
    const populatedRoom = await Room.findById(room._id)
      .populate('members', 'name email status')
      .lean();
    res.json({ ...populatedRoom, inviteCode: room.inviteCode });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search groups by name
router.get('/search', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json({ groups: [] });
    }

    const groups = await Room.find({
      type: 'group',
      name: { $regex: query, $options: 'i' },
      members: { $ne: (req.user as any)._id } // Exclude groups user is already a member of
    })
    .populate('members', 'name email')
    .select('name members')
    .limit(10);

    res.json({ groups });
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 