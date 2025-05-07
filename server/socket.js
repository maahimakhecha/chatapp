// Handle room updates
socket.on('room:update', async (data) => {
  try {
    const { roomId, type, memberIds } = data;
    const room = await Room.findById(roomId)
      .populate('members', 'name email status')
      .populate('messages.sender', 'name email');

    if (!room) {
      return;
    }

    // Broadcast room update to all members
    room.members.forEach(member => {
      const memberSocket = userSockets.get(member._id.toString());
      if (memberSocket) {
        memberSocket.emit('room:updated', room);
      }
    });

    // If members were added, notify them
    if (type === 'add_members' && memberIds) {
      memberIds.forEach(memberId => {
        const memberSocket = userSockets.get(memberId);
        if (memberSocket) {
          memberSocket.emit('room:invited', room);
        }
      });
    }

    // If members were removed, notify them
    if (type === 'remove_members' && memberIds) {
      memberIds.forEach(memberId => {
        const memberSocket = userSockets.get(memberId);
        if (memberSocket) {
          memberSocket.emit('room:removed', { roomId });
        }
      });
    }
  } catch (error) {
    console.error('Error handling room update:', error);
  }
});

// Handle typing events
socket.on('typing:start', async (data) => {
  try {
    const { roomId } = data;
    const room = await Room.findById(roomId).populate('members', 'name');

    if (!room) return;

    // Broadcast typing event to all members except sender
    room.members.forEach(member => {
      if (member._id.toString() !== socket.user._id.toString()) {
        const memberSocket = userSockets.get(member._id.toString());
        if (memberSocket) {
          memberSocket.emit('typing:start', {
            userId: socket.user._id,
            userName: socket.user.name
          });
        }
      }
    });
  } catch (error) {
    console.error('Error handling typing start:', error);
  }
});

socket.on('typing:stop', async (data) => {
  try {
    const { roomId } = data;
    const room = await Room.findById(roomId).populate('members', 'name');

    if (!room) return;

    // Broadcast typing stop event to all members except sender
    room.members.forEach(member => {
      if (member._id.toString() !== socket.user._id.toString()) {
        const memberSocket = userSockets.get(member._id.toString());
        if (memberSocket) {
          memberSocket.emit('typing:stop', {
            userId: socket.user._id
          });
        }
      }
    });
  } catch (error) {
    console.error('Error handling typing stop:', error);
  }
});

// Handle new messages
socket.on('message:new', async (message) => {
  try {
    const room = await Room.findById(message.roomId).populate('members', 'name');
    if (!room) return;

    // Broadcast message to all members
    room.members.forEach(member => {
      const memberSocket = userSockets.get(member._id.toString());
      if (memberSocket) {
        memberSocket.emit('message:new', message);
      }
    });
  } catch (error) {
    console.error('Error handling new message:', error);
  }
});

// Handle message sent event
socket.on('message:sent', async (data) => {
  try {
    const { roomId, messageId } = data;
    const room = await Room.findById(roomId).populate('members', 'name');

    if (!room) return;

    // Broadcast message delivered event to all members except sender
    room.members.forEach(member => {
      if (member._id.toString() !== socket.user._id.toString()) {
        const memberSocket = userSockets.get(member._id.toString());
        if (memberSocket) {
          memberSocket.emit('message:delivered', { messageId });
        }
      }
    });
  } catch (error) {
    console.error('Error handling message sent:', error);
  }
});

// Handle message delivered event
socket.on('message:delivered', async (data) => {
  try {
    const { roomId, messageId } = data;
    const room = await Room.findById(roomId).populate('members', 'name');

    if (!room) return;

    // Find the message sender
    const message = await Message.findById(messageId);
    if (!message) return;

    // Notify the sender that their message was delivered
    const senderSocket = userSockets.get(message.sender.toString());
    if (senderSocket) {
      senderSocket.emit('message:delivered', { messageId });
    }
  } catch (error) {
    console.error('Error handling message delivered:', error);
  }
});

// Handle message read event
socket.on('message:read', async (data) => {
  try {
    const { roomId, messageId } = data;
    const room = await Room.findById(roomId).populate('members', 'name');

    if (!room) return;

    // Find the message sender
    const message = await Message.findById(messageId);
    if (!message) return;

    // Notify the sender that their message was read
    const senderSocket = userSockets.get(message.sender.toString());
    if (senderSocket) {
      senderSocket.emit('message:read', { messageId });
    }
  } catch (error) {
    console.error('Error handling message read:', error);
  }
}); 