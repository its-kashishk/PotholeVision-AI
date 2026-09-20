const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, city, state } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({
      name, email, password,
      role: role || 'citizen',
      location: { city: city || '', state: state || '' }
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please provide email and password' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    const userObj = user.toJSON();
    res.json({ success: true, token, user: userObj });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// Update profile
router.patch('/me', protect, async (req, res) => {
  try {
    const { name, city, state } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, 'location.city': city, 'location.state': state },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
