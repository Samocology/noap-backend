const express = require('express');
const TrainingSchedule = require('../models/TrainingSchedule');
const Student = require('../models/Student');
const Certificate = require('../models/Certificate');
const Invoice = require('../models/Invoice');
const Message = require('../models/Message');
const { auth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

// Get training schedules for school
router.get('/training-schedules', auth, schoolAuth, async (req, res) => {
  try {
    const schedules = await TrainingSchedule.find({ school: req.user._id }).populate('instructor', 'name');
    res.send(schedules);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get student progress for school
router.get('/student-progress', auth, schoolAuth, async (req, res) => {
  try {
    const students = await Student.find({ school: req.user._id }).populate('enrolledPrograms.program', 'program');
    res.send(students);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get certificates for school
router.get('/certificates', auth, schoolAuth, async (req, res) => {
  try {
    const students = await Student.find({ school: req.user._id }).select('_id');
    const studentIds = students.map(student => student._id);
    const certificates = await Certificate.find({ recipient: { $in: studentIds } }).populate('recipient', 'name').populate('issuedBy', 'name');
    res.send(certificates);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get invoices for school
router.get('/invoices', auth, schoolAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ school: req.user._id }).populate('relatedOrder', 'totalAmount');
    res.send(invoices);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get messages for school
router.get('/messages', auth, schoolAuth, async (req, res) => {
  try {
    const messages = await Message.find({ receiver: req.user._id }).populate('sender', 'name');
    res.send(messages);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
