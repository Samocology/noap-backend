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


// Get all dashboard data
router.get('/dashboard', auth, schoolAuth, async (req, res) => {
  try {
    const schoolId = req.user._id;

    // Fetch students and schedules in parallel
    const [students, schedules] = await Promise.all([
      Student.find({ school: schoolId }),
      TrainingSchedule.find({ school: schoolId }),
    ]);

    // 1. Active Students (students with progress > 0)
    const activeStudents = students.filter(student => student.progress > 0).length;

    // 2. Sessions this month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const sessionsThisMonth = schedules.reduce((count, schedule) => {
      return count + schedule.sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= startOfMonth && sessionDate <= endOfMonth;
      }).length;
    }, 0);

    // 3. Certificates Earned
    const studentIds = students.map(student => student._id);
    const certificatesEarned = await Certificate.countDocuments({ recipient: { $in: studentIds } });

    // 4. Average Progress
    const totalProgress = students.reduce((sum, student) => sum + student.progress, 0);
    const averageProgress = students.length > 0 ? totalProgress / students.length : 0;

    // 5. Upcoming Sessions
    const upcomingSessions = schedules.reduce((count, schedule) => {
      return count + schedule.sessions.filter(session => new Date(session.date) > today).length;
    }, 0);

    // 6. Top Performers (top 5 students with highest progress)
    const topPerformers = students
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5)
      .map(student => ({ name: student.name, progress: student.progress }));

    res.send({
      activeStudents,
      sessionsThisMonth,
      certificatesEarned,
      averageProgress: parseFloat(averageProgress.toFixed(2)),
      upcomingSessions,
      topPerformers,
    });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;