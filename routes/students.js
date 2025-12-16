const express = require('express');
const Student = require('../models/Student');
const { auth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

// Get all students (school only)
router.get('/', auth, schoolAuth, async (req, res) => {
  try {
    const students = await Student.find({ school: req.user._id });
    res.send(students);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get student by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).send();
    }
    res.send(student);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create student (school only)
router.post('/', auth, schoolAuth, async (req, res) => {
  try {
    const student = new Student({ ...req.body, school: req.user._id });
    await student.save();
    res.status(201).send(student);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update student
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'email', 'progress', 'contact'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).send();
    }

    updates.forEach((update) => student[update] = req.body[update]);
    await student.save();
    res.send(student);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete student (school only)
router.delete('/:id', auth, schoolAuth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).send();
    }
    res.send(student);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
