const express = require('express');
const UserRole = require('../models/UserRole');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all user roles (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const userRoles = await UserRole.find({});
    res.send(userRoles);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get user role by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).send();
    }
    res.send(userRole);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create user role (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const userRole = new UserRole(req.body);
    await userRole.save();
    res.status(201).send(userRole);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update user role
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'permissions'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const userRole = await UserRole.findById(req.params.id);
    if (!userRole) {
      return res.status(404).send();
    }

    updates.forEach((update) => userRole[update] = req.body[update]);
    await userRole.save();
    res.send(userRole);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete user role (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const userRole = await UserRole.findByIdAndDelete(req.params.id);
    if (!userRole) {
      return res.status(404).send();
    }
    res.send(userRole);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
