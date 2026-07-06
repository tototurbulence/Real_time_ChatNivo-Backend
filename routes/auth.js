const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ message: 'Username or email already in use' });

    const user = new User({ username, email, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    user.isOnline = true;
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
