const express = require('express');
const Student = require('../models/Student');
const { auth, schoolAuth } = require('../middleware/auth');
const { triggerDashboardUpdate } = require('../lib/dashboard');

const router = express.Router();

// Get all students (school only)
router.get('/', auth, schoolAuth, async (req, res) => {
  try {
    const students = await Student.find({ school: req.user._id });
    res.send(students);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch students' });
  }
});

// Get student by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.send(student);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch student' });
  }
});

// Create student (school only)
router.post('/', auth, schoolAuth, async (req, res) => {
  try {
    const student = new Student({ ...req.body, school: req.user._id });
    await student.save();
    triggerDashboardUpdate(req.user._id.toString()); // Trigger update
    res.status(201).send(student);
  } catch (e) {
    // Handle duplicate email error
    if (e.code === 11000 && e.keyPattern?.email) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    // Handle validation errors
    if (e.errors) {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    // Generic error
    res.status(400).json({ error: e.message || 'Failed to create student' });
  }
});

// Update student
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'email', 'progress', 'contact', 'class'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ error: 'Invalid updates!' });
  }

  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    updates.forEach((update) => student[update] = req.body[update]);
    await student.save();
    triggerDashboardUpdate(student.school.toString()); // Trigger update
    res.send(student);
  } catch (e) {
    // Handle duplicate email error
    if (e.code === 11000 && e.keyPattern?.email) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    // Handle validation errors
    if (e.errors) {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(400).json({ error: e.message || 'Failed to update student' });
  }
});

// Delete student (school only)
router.delete('/:id', auth, schoolAuth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    triggerDashboardUpdate(student.school.toString()); // Trigger update
    res.send(student);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to delete student' });
  }
});

module.exports = router;