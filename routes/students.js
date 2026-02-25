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

// PUT /api/students/:id - Update a student's progress and/or class information
router.put('/:id', auth, async (req, res) => {
  try {
    const { progress, class: studentClass } = req.body;

    // Validate progress value (must be 0-100 if provided)
    if (progress !== undefined) {
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        return res.status(400).json({ error: 'Invalid progress value. Must be a number between 0 and 100' });
      }
    }

    // Validate class format (must be a string if provided)
    if (studentClass !== undefined) {
      if (typeof studentClass !== 'string' || studentClass.trim() === '') {
        return res.status(400).json({ error: 'Invalid class format. Must be a non-empty string' });
      }
    }

    // Find the student
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Authorization: Check if user has permission to update this student
    // School can update their own students, Member can update their own record
    if (req.user.role === 'school') {
      // Check if the student belongs to this school
      if (student.school.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "You don't have permission to update this student" });
      }
    } else if (req.user.role === 'member') {
      // Member can only update their own student record
      if (student._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "You don't have permission to update this student" });
      }
    } else {
      return res.status(403).json({ error: "You don't have permission to update this student" });
    }

    // Update the student with the provided fields
    if (progress !== undefined) {
      student.progress = progress;
    }
    if (studentClass !== undefined) {
      student.class = studentClass;
    }

    await student.save();
    
    // Trigger dashboard update
    triggerDashboardUpdate(student.school.toString());

    // Return the updated student
    res.send(student);
  } catch (e) {
    // Handle validation errors
    if (e.errors) {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    // Handle invalid ObjectId
    if (e.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.status(500).json({ error: e.message || 'Failed to update student' });
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