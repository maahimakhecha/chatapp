const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create a new room
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, members } = req.body;

    // Create the room
    const room = new Room({
      name,
      type,
      members: [...new Set(members)], // Remove duplicates
      createdBy: req.user._id
    });

    await room.save();

    // Populate member details
    const populatedRoom = await Room.findById(room._id)
      .populate('members', 'name email status')
      .populate('messages.sender', 'name email');

    res.status(201).json(populatedRoom);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all rooms for a user
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate('members', 'name email status')
      .populate('messages.sender', 'name email')
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add members to a group
router.post('/add-members', auth, async (req, res) => {
  try {
    const { roomId, memberIds } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is a member of the room
    if (!room.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to modify this room' });
    }

    // Add new members if they don't exist
    const newMembers = memberIds.filter(id => !room.members.includes(id));
    room.members.push(...newMembers);

    await room.save();

    // Populate member details
    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'name email status')
      .populate('messages.sender', 'name email');

    res.json(populatedRoom);
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove members from a group
router.post('/remove-members', auth, async (req, res) => {
  try {
    const { roomId, memberIds } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is a member of the room
    if (!room.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to modify this room' });
    }

    // Remove members
    room.members = room.members.filter(id => !memberIds.includes(id.toString()));

    // If room becomes empty, delete it
    if (room.members.length === 0) {
      await Room.findByIdAndDelete(roomId);
      return res.json({ message: 'Room deleted as it became empty' });
    }

    await room.save();

    // Populate member details
    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'name email status')
      .populate('messages.sender', 'name email');

    res.json(populatedRoom);
  } catch (error) {
    console.error('Error removing members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave a group
router.post('/leave', auth, async (req, res) => {
  try {
    const { roomId } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove user from members
    room.members = room.members.filter(id => id.toString() !== req.user._id.toString());

    // If room becomes empty, delete it
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

module.exports = router; 