import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './utils/jwt';
import { UserService } from './services/userService';
import { ChatService } from './services/chatService';
import { Message, IMessage } from './models/Message';
import { User } from './models/User';
import { Types } from 'mongoose';
import { Room } from './models/Room';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface PopulatedMessage extends Omit<IMessage, 'sender'> {
  sender: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
  room: Types.ObjectId;
}

export const initializeWebSocket = (httpServer: HttpServer, chatService: ChatService) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  const userService = new UserService();

  // Middleware for authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = await verifyToken(token);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Track online users
  const onlineUsers = new Map<string, Set<string>>(); // Map of userId to Set of socketIds

  // Update user status
  const updateUserStatus = async (userId: string, status: 'online' | 'offline') => {
    try {
      console.log(`Updating user ${userId} status to ${status}`);
      
      // Force update the user's status in the database
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            status: status,
            lastSeen: status === 'offline' ? new Date() : undefined
          }
        },
        { new: true }
      );

      if (!user) {
        console.error(`User ${userId} not found`);
        return;
      }

      console.log(`Updated user ${userId} status to ${status}`, user);
      
      // Immediately broadcast to all clients
      io.emit('user:status', {
        userId,
        status,
        lastSeen: user.lastSeen
      });

      // Force broadcast all users' status
      const allUsers = await User.find().select('_id status lastSeen');
      const statuses = allUsers.map(user => ({
        userId: user._id.toString(),
        status: onlineUsers.has(user._id.toString()) ? 'online' : 'offline',
        lastSeen: user.lastSeen
      }));
      io.emit('users:status', statuses);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('User connected:', socket.userId);
    
    if (socket.userId) {
      // Add user to online users
      if (!onlineUsers.has(socket.userId)) {
        onlineUsers.set(socket.userId, new Set());
      }
      onlineUsers.get(socket.userId)?.add(socket.id);
      
      // Force update status to online immediately
      updateUserStatus(socket.userId, 'online');
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
      if (socket.userId) {
        const userSockets = onlineUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          
          // Only mark as offline if no more sockets exist
          if (userSockets.size === 0) {
            onlineUsers.delete(socket.userId);
            updateUserStatus(socket.userId, 'offline');
          }
        }
      }
    });

    // Handle explicit online status
    socket.on('user:online', () => {
      if (socket.userId) {
        console.log('User explicitly went online:', socket.userId);
        updateUserStatus(socket.userId, 'online');
      }
    });

    // Handle explicit offline status
    socket.on('user:offline', () => {
      if (socket.userId) {
        console.log('User explicitly went offline:', socket.userId);
        const userSockets = onlineUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(socket.userId);
            updateUserStatus(socket.userId, 'offline');
          }
        }
      }
    });

    // Handle user status requests
    socket.on('user:status', async (userId: string) => {
      try {
        const user = await User.findById(userId).select('status lastSeen');
        if (user) {
          // If user has any active sockets, they are online
          const isOnline = onlineUsers.has(userId);
          socket.emit('user:status', {
            userId,
            status: isOnline ? 'online' : 'offline',
            lastSeen: user.lastSeen
          });
        }
      } catch (error) {
        console.error('Error fetching user status:', error);
      }
    });

    // Handle all users status request
    socket.on('users:status', async () => {
      try {
        const users = await User.find().select('_id status lastSeen');
        const statuses = users.map(user => ({
          userId: user._id.toString(),
          status: onlineUsers.has(user._id.toString()) ? 'online' : 'offline',
          lastSeen: user.lastSeen
        }));
        socket.emit('users:status', statuses);
      } catch (error) {
        console.error('Error fetching users status:', error);
      }
    });

    socket.on('room:join', async (roomId: string) => {
      console.log('Joining room:', roomId);
      if (!roomId) {
        console.error('No roomId provided');
        return;
      }

      try {
        // Leave previous room if any
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room !== socket.id) {
            socket.leave(room);
          }
        });

        // Join new room
        await socket.join(roomId);
        console.log(`User ${socket.userId} joined room ${roomId}`);

        // Fetch and send room messages
        const messages = await chatService.getRoomMessages(roomId);
        console.log('Fetched messages from database:', messages);

        if (messages) {
          const formattedMessages = messages.map(message => ({
            id: message._id.toString(),
            content: message.content,
            type: message.type,
            sender: {
              id: message.sender._id.toString(),
              name: message.sender.name
            },
            createdAt: message.createdAt.toISOString(),
            reactions: message.reactions || {},
            readBy: message.readBy.map(id => id.toString()),
            status: message.status || 'sent'
          }));
          console.log('Sending message history:', formattedMessages);
          socket.emit('messages:history', formattedMessages);
        }

        // Mark messages as read
        if (socket.userId) {
          const updatedMessages = await chatService.markMessagesAsRead(roomId, socket.userId);
          if (updatedMessages) {
            // Emit read status for each message
            updatedMessages.forEach(message => {
              io.to(roomId).emit('message:status', {
                messageId: message._id.toString(),
                status: 'read'
              });
            });
          }
        }
      } catch (error) {
        console.error('Error joining room:', error);
      }
    });

    socket.on('message:send', async (data: { roomId: string; content: string }) => {
      console.log('message:send event received', data, 'userId:', socket.userId);
      if (!socket.userId) {
        console.error('No userId in socket');
        return;
      }

      try {
        // Create the message
        const message = await chatService.createGroupMessage(
          socket.userId,
          data.roomId,
          data.content
        );

        if (!message) {
          throw new Error('Failed to create message');
        }

        // Populate the sender information
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email')
          .lean();

        if (!populatedMessage) {
          throw new Error('Failed to populate message');
        }

        // Convert to plain object and stringify ObjectIds
        const messageToSend = {
          id: populatedMessage._id.toString(),
          content: populatedMessage.content,
          type: populatedMessage.type,
          sender: {
            id: populatedMessage.sender._id.toString(),
            name: populatedMessage.sender.name
          },
          roomId: data.roomId,
          createdAt: populatedMessage.createdAt.toISOString(),
          reactions: populatedMessage.reactions || {},
          readBy: populatedMessage.readBy.map(id => id.toString()),
          status: 'sent'
        };

        // Get room members to check who's online
        const room = await Room.findById(data.roomId).populate('members', '_id');
        if (!room) {
          throw new Error('Room not found');
        }

        // Check if any recipients are online
        const onlineRecipients = room.members.filter(member => 
          member._id.toString() !== socket.userId && 
          onlineUsers.has(member._id.toString())
        );

        // Broadcast message to room
        io.to(data.roomId).emit('message:new', messageToSend);

        // If there are online recipients, mark as delivered immediately
        if (onlineRecipients.length > 0) {
          await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
          io.to(data.roomId).emit('message:status', {
            messageId: messageToSend.id,
            status: 'delivered',
            readBy: messageToSend.readBy
          });
        } else {
          // If no online recipients, mark as delivered after a delay
          setTimeout(async () => {
            try {
              await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
              io.to(data.roomId).emit('message:status', {
                messageId: messageToSend.id,
                status: 'delivered',
                readBy: messageToSend.readBy
              });
            } catch (error) {
              console.error('Error updating message status:', error);
            }
          }, 1000);
        }

      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (data: { roomId: string; messageId: string }) => {
      if (!socket.userId) return;

      try {
        const { roomId, messageId } = data;
        
        if (messageId === 'all') {
          // Mark all messages in the room as read
          const updatedMessages = await chatService.markMessagesAsRead(roomId, socket.userId);
          if (updatedMessages) {
            // Get the latest readBy arrays for all messages
            const messagesWithReadBy = await Message.find({ room: roomId })
              .select('_id readBy')
              .lean();

            // Create a map of message IDs to their readBy arrays
            const readByMap = new Map(
              messagesWithReadBy.map(msg => [
                msg._id.toString(),
                msg.readBy.map(id => id.toString())
              ])
            );

            // Emit status updates for each message
            updatedMessages.forEach(message => {
              const messageId = message._id.toString();
              io.to(roomId).emit('message:status', {
                messageId,
                status: 'read',
                readBy: readByMap.get(messageId) || []
              });
            });
          }
        } else {
          // Mark single message as read
          const message = await chatService.markMessageAsRead(messageId, socket.userId);
          if (message) {
            // Get the latest readBy array
            const updatedMessage = await Message.findById(messageId)
              .select('readBy')
              .lean();

            if (updatedMessage) {
              io.to(roomId).emit('message:status', {
                messageId: message._id.toString(),
                status: 'read',
                readBy: updatedMessage.readBy.map(id => id.toString())
              });
            }
          }
        }
      } catch (error) {
        console.error('Error handling message read:', error);
      }
    });

    socket.on('message:react', async (data: { messageId: string; reaction: string }) => {
      if (!socket.userId) return;

      try {
        const updatedMessage = await chatService.addReactionToMessage(
          data.messageId,
          socket.userId,
          data.reaction
        );

        if (updatedMessage) {
          const populatedMessage = await Message.findById(updatedMessage._id)
            .populate('sender', 'name email')
            .lean() as PopulatedMessage;

          if (populatedMessage) {
            const messageToSend = {
              ...populatedMessage,
              _id: populatedMessage._id.toString(),
              sender: {
                id: populatedMessage.sender._id.toString(),
                name: populatedMessage.sender.name
              },
              room: populatedMessage.room.toString(),
              readBy: populatedMessage.readBy.map(id => id.toString())
            };
            io.to(messageToSend.room).emit('message:update', messageToSend);
          }
        }
      } catch (error) {
        console.error('Error handling message reaction:', error);
      }
    });

    socket.on('typing:start', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('typing:start', { userId: socket.userId });
    });

    socket.on('typing:stop', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('typing:stop', { userId: socket.userId });
    });
  });

  return io;
}; 