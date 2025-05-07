import { AppError } from '../middleware/errorHandler';
import { Message, IMessage } from '../models/Message';
import { Room, IRoom } from '../models/Room';
import { User, IUser } from '../models/User';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';

export class ChatService {
  async createPrivateMessage(senderId: string, recipientId: string, content: string): Promise<IMessage> {
    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId)
    ]);

    if (!sender || !recipient) {
      throw new AppError(404, 'User not found');
    }

    const message = new Message({
      content,
      sender: new Types.ObjectId(senderId),
      recipient: new Types.ObjectId(recipientId),
      type: 'private',
      readBy: [new Types.ObjectId(senderId)]
    });

    await message.save();
    return message;
  }

  async createGroupMessage(senderId: string, roomId: string, content: string): Promise<IMessage> {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(senderId) || !Types.ObjectId.isValid(roomId)) {
        throw new Error('Invalid senderId or roomId');
      }
  
      // Validate room exists
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
      // Create and save the message
      const message = new Message({
        content,
        type: 'group',
        sender: senderId, // Pass as string, Mongoose will cast
        room: roomId,     // Pass as string, Mongoose will cast
        readBy: [senderId],
        status: 'sent'
      });
  
      const savedMessage = await message.save();
      console.log('Message saved to database:', savedMessage);
  
      // Update room's lastMessage
      await Room.findByIdAndUpdate(roomId, {
        lastMessage: savedMessage._id,
        updatedAt: new Date()
      });
  
      return savedMessage;
    } catch (error) {
      console.error('Error creating group message:', error);
      throw error;
    }
  }

  async getRoomMessages(roomId: string): Promise<IMessage[]> {
    try {
      console.log('Fetching messages for room:', roomId);
      
      const messages = await Message.find({ room: new Types.ObjectId(roomId) })
        .populate('sender', 'name email')
        .sort({ createdAt: 1 })
        .lean();

      console.log(`Found ${messages.length} messages for room ${roomId}`);
      return messages;
    } catch (error) {
      console.error('Error getting room messages:', error);
      throw error;
    }
  }

  async getUserRooms(userId: string): Promise<IRoom[]> {
    console.log('Fetching rooms for user:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    try {
      const rooms = await Room.find({ members: new Types.ObjectId(userId) })
        .populate('creator', 'name email status')
        .populate('members', 'name email status')
        .lean();

      console.log(`Found ${rooms.length} rooms for user ${userId}`);
      return rooms;
    } catch (error) {
      console.error('Error fetching user rooms:', error);
      throw new AppError(500, 'Failed to fetch user rooms');
    }
  }

  async createRoom(name: string, creatorId: string, memberIds: string[]): Promise<IRoom> {
    console.log('Creating room:', { name, creatorId, memberIds });
    
    const creator = await User.findById(creatorId);
    if (!creator) {
      throw new AppError(404, 'Creator not found');
    }

    const members = await User.find({ _id: { $in: memberIds } });
    if (members.length !== memberIds.length) {
      throw new AppError(404, 'Some members not found');
    }

    try {
      // Generate a unique invite code for the group
      let inviteCode;
      let codeExists = true;
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (codeExists) {
        inviteCode = Array.from({ length: 6 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
        codeExists = !!(await Room.exists({ inviteCode }));
      }
      const room = new Room({
        name,
        creator: new Types.ObjectId(creatorId),
        members: [...memberIds, creatorId].map(id => new Types.ObjectId(id)),
        inviteCode
      });

      await room.save();
      console.log('Room created successfully:', room.id);
      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      throw new AppError(500, 'Failed to create room');
    }
  }

  async addReaction(messageId: string, userId: string, reaction: string): Promise<IMessage> {
    console.log('Adding reaction:', { messageId, userId, reaction });
    
    const [message, user] = await Promise.all([
      Message.findById(messageId),
      User.findById(userId)
    ]);

    if (!message || !user) {
      throw new AppError(404, 'Message or user not found');
    }
    try {
      if (!message.reactions) {
        message.reactions = {};
      }
      message.reactions[userId] = reaction;
      await message.save();
      console.log('Reaction added successfully');
      return message;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw new AppError(500, 'Failed to add reaction');
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<IMessage> {
    console.log('Marking message as read:', { messageId, userId });
    
    const [message, user] = await Promise.all([
      Message.findById(messageId),
      User.findById(userId)
    ]);

    if (!message || !user) {
      throw new AppError(404, 'Message or user not found');
    }

    try {
      const userIdObj = new Types.ObjectId(userId);
      const readByArray = message.readBy as unknown as Types.ObjectId[];
      const hasRead = readByArray.some(id => id.equals(userIdObj));
      
      if (!hasRead) {
        message.readBy.push(userIdObj);
        await message.save();
        console.log('Message marked as read successfully');
      }
      
      return message;
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw new AppError(500, 'Failed to mark message as read');
    }
  }

  async getMessageWithSender(messageId: Types.ObjectId) {
    return Message.findById(messageId)
      .populate('sender', 'name email')
      .lean();
  }

  async markMessagesAsRead(roomId: string, userId: string) {
    try {
      console.log('Marking messages as read:', { roomId, userId });

      const result = await Message.updateMany(
        {
          room: new Types.ObjectId(roomId),
          readBy: { $ne: new Types.ObjectId(userId) }
        },
        {
          $addToSet: { readBy: new Types.ObjectId(userId) },
          $set: { status: 'read' }
        }
      );

      console.log('Update result:', result);

      if (result.modifiedCount > 0) {
        const updatedMessages = await Message.find({ room: new Types.ObjectId(roomId) })
          .populate('sender', 'name email')
          .sort({ createdAt: 1 })
          .lean();
        
        console.log(`Updated ${updatedMessages.length} messages`);
        return updatedMessages;
      }
      return null;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  async addReactionToMessage(messageId: string, userId: string, reaction: string) {
    const message = await Message.findById(messageId);
    if (!message) return null;

    message.reactions = {
      ...message.reactions,
      [userId]: reaction
    };

    return message.save();
  }

  async saveMessage(message: any) {
    try {
      const { id, content, sender, room, createdAt, reactions, readBy, status } = message;
      
      // If message already exists, update it
      if (id) {
        return await Message.findByIdAndUpdate(
          id,
          {
            content,
            sender: sender.id,
            room,
            createdAt,
            reactions,
            readBy,
            status
          },
          { new: true }
        ).populate('sender', 'name email');
      }

      // Otherwise create new message
      return await Message.create({
        content,
        sender: sender.id,
        room,
        createdAt,
        reactions,
        readBy,
        status
      });
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async createDirectMessageRoom(creatorId: string, recipientId: string): Promise<IRoom> {
    console.log('Creating direct message room:', { creatorId, recipientId });
    
    const [creator, recipient] = await Promise.all([
      User.findById(creatorId),
      User.findById(recipientId)
    ]);

    if (!creator || !recipient) {
      throw new AppError(404, 'User not found');
    }

    // Check if a direct message room already exists between these users
    const existingRoom = await Room.findOne({
      isDirect: true,
      members: {
        $all: [
          new Types.ObjectId(creatorId),
          new Types.ObjectId(recipientId)
        ],
        $size: 2
      }
    }).populate('members', 'name email status');

    if (existingRoom) {
      console.log('Found existing direct message room:', existingRoom.id);
      return existingRoom;
    }

    try {
      const room = new Room({
        name: `${creator.name}, ${recipient.name}`,
        creator: new Types.ObjectId(creatorId),
        members: [creatorId, recipientId].map(id => new Types.ObjectId(id)),
        isDirect: true
      });

      await room.save();
      console.log('Direct message room created successfully:', room.id);
      
      // Populate the room with member details before returning
      const populatedRoom = await Room.findById(room._id)
        .populate('members', 'name email status')
        .populate('creator', 'name email status')
        .lean();
      
      if (!populatedRoom) {
        throw new AppError(500, 'Failed to populate room after creation');
      }
      
      return populatedRoom;
    } catch (error) {
      console.error('Error creating direct message room:', error);
      throw new AppError(500, 'Failed to create direct message room');
    }
  }
}

export const chatService = new ChatService(); 