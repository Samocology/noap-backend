const express = require('express');
const Member = require('../models/Member');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all members (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const members = await Member.find({}).populate('role', 'name').populate('school', 'name');
    res.send(members);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get member by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).populate('role', 'name').populate('school', 'name');
    if (!member) {
      return res.status(404).send();
    }
    res.send(member);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create member (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const member = new Member(req.body);
    await member.save();
    res.status(201).send(member);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update member
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'email', 'role', 'school', 'earnings', 'profilePhoto', 'contact', 'isActive'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).send();
    }

    updates.forEach((update) => member[update] = req.body[update]);
    await member.save();
    res.send(member);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete member (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) {
      return res.status(404).send();
    }
    res.send(member);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
