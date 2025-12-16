const express = require('express');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all events
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find({});
    res.send(events);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get event by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).send();
    }
    res.send(event);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create event (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).send(event);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update event
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'description', 'date', 'location', 'capacity', 'price', 'status'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).send();
    }

    updates.forEach((update) => event[update] = req.body[update]);
    await event.save();
    res.send(event);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete event (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).send();
    }
    res.send(event);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
