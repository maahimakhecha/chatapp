import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/chatService';
import { authenticate } from '../middleware/auth';
import { Message } from '../models/Message';
import { AppError } from '../middleware/errorHandler';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

const router = Router();
const chatService = new ChatService();

const messageSchema = z.object({
  content: z.string().min(1),
  recipientId: z.string().optional(),
  roomId: z.string().optional()
});

const roomSchema = z.object({
  name: z.string().min(2),
  memberIds: z.array(z.string()).default([])
});

// Get user's rooms
router.get('/rooms', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rooms = await chatService.getUserRooms(req.user!.id);
    res.json({
      status: 'success',
      data: { rooms }
    });
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(400, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
});

// Get room messages
router.get('/rooms/:roomId/messages', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await chatService.getRoomMessages(req.params.roomId);
    res.json({
      status: 'success',
      data: { messages }
    });
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(400, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
});

// Create a new room
router.post('/rooms', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, memberIds, isDirect } = req.body;
    
    if (isDirect) {
      if (!memberIds || memberIds.length !== 1) {
        throw new AppError(400, 'Direct message requires exactly one recipient');
      }
      const room = await chatService.createDirectMessageRoom(req.user!.id, memberIds[0]);
      res.status(201).json({
        status: 'success',
        data: { room }
      });
    } else {
      if (!name) {
        throw new AppError(400, 'Room name is required for group chats');
      }
      const room = await chatService.createRoom(name, req.user!.id, memberIds || []);
      res.status(201).json({
        status: 'success',
        data: { room }
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(400, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
});

// Send a message
router.post('/messages', authenticate, async (req, res, next) => {
  try {
    const { content, recipientId, roomId } = messageSchema.parse(req.body);
    let message;

    if (recipientId) {
      message = await chatService.createPrivateMessage(req.user!.id, recipientId, content);
    } else if (roomId) {
      message = await chatService.createGroupMessage(req.user!.id, roomId, content);
    } else {
      throw new Error('Either recipientId or roomId must be provided');
    }

    res.status(201).json({
      status: 'success',
      data: { message }
    });
  } catch (error) {
    next(error);
  }
});

// Add reaction to message
router.post('/messages/:messageId/reactions', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { reaction } = req.body;
    const message = await chatService.addReaction(req.params.messageId, req.user!.id, reaction);
    res.json({
      status: 'success',
      data: { message }
    });
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(400, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
});

// Mark message as read
router.post('/messages/:messageId/read', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await chatService.markMessageAsRead(messageId, req.user!.id);
    res.json({
      status: 'success',
      data: { message }
    });
  } catch (error) {
    next(error);
  }
});

// Test route to create a message
router.post('/test-create-message', async (req, res) => {
  try {
    const { content, roomId, senderId } = req.body;
    const message = new Message({
      content,
      type: 'group',
      sender: senderId,
      room: roomId,
      readBy: [senderId],
      status: 'sent'
    });
    await message.save();
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test route to fetch messages
router.get('/test-get-messages/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 