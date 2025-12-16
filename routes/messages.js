const express = require('express');
const Message = require('../models/Message');
const { auth, adminAuth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

// Get all messages (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const messages = await Message.find({}).populate('sender', 'name').populate('receiver', 'name');
    res.send(messages);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get messages for a school
router.get('/school/:schoolId', auth, schoolAuth, async (req, res) => {
  try {
    const messages = await Message.find({ receiver: req.params.schoolId }).populate('sender', 'name');
    res.send(messages);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get message by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id).populate('sender', 'name').populate('receiver', 'name');
    if (!message) {
      return res.status(404).send();
    }
    res.send(message);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create message
router.post('/', auth, async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();
    res.status(201).send(message);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update message
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['subject', 'content', 'isRead'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).send();
    }

    updates.forEach((update) => message[update] = req.body[update]);
    await message.save();
    res.send(message);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete message (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).send();
    }
    res.send(message);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
