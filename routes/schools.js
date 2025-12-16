const express = require('express');
const School = require('../models/School');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all schools (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const schools = await School.find({});
    res.send(schools);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get school by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).send();
    }
    res.send(school);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create school (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const school = new School(req.body);
    await school.save();
    res.status(201).send(school);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update school
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'tier', 'status', 'contact'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).send();
    }

    updates.forEach((update) => school[update] = req.body[update]);
    await school.save();
    res.send(school);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete school (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) {
      return res.status(404).send();
    }
    res.send(school);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
