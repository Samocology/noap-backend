const express = require('express');
const Booking = require('../models/Booking');
const { auth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

// Get all bookings (admin only)
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({}).populate('school', 'name').populate('event', 'name');
    res.send(bookings);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get bookings for a school
router.get('/school/:schoolId', auth, schoolAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ school: req.params.schoolId }).populate('event', 'name');
    res.send(bookings);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('school', 'name').populate('event', 'name');
    if (!booking) {
      return res.status(404).send();
    }
    res.send(booking);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    res.status(201).send(booking);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update booking
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['status', 'depositAmount', 'depositPaid', 'paymentMethod'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).send();
    }

    updates.forEach((update) => booking[update] = req.body[update]);
    await booking.save();
    res.send(booking);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).send();
    }
    res.send(booking);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
