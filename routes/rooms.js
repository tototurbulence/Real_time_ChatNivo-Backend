const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all rooms
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('creator', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ createdAt: -1 });
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create room
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Room name is required' });

    const existing = await Room.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Room name already taken' });

    const room = new Room({ name, description, creator: req.user._id, members: [req.user._id] });
    await room.save();
    await room.populate('creator', 'username avatar');
    await room.populate('members', 'username avatar isOnline');

    res.status(201).json({ room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single room
router.get('/:id', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'username avatar')
      .populate('members', 'username avatar isOnline');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join room
router.post('/:id/join', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (!room.members.includes(req.user._id)) {
      room.members.push(req.user._id);
      await room.save();
    }
    await room.populate('creator', 'username avatar');
    await room.populate('members', 'username avatar isOnline');
    res.json({ room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Leave room
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    room.members = room.members.filter((m) => m.toString() !== req.user._id.toString());
    await room.save();
    res.json({ message: 'Left room successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get room messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find({ room: req.params.id })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
