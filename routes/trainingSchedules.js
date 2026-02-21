const express = require('express');
const router = express.Router();
const TrainingSchedule = require('../models/TrainingSchedule');
const { auth, adminAuth } = require('../middleware/auth');
const { triggerDashboardUpdate } = require('../lib/dashboard');

// Get all training schedules
router.get('/', auth, async (req, res) => {
  try {
    const schedules = await TrainingSchedule.find().populate('instructor');
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get training schedule by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const schedule = await TrainingSchedule.findById(req.params.id).populate('instructor');
    if (!schedule) return res.status(404).json({ message: 'Training schedule not found' });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new training schedule (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const schedule = new TrainingSchedule(req.body);
    await schedule.save();
    triggerDashboardUpdate(schedule.school.toString()); // Trigger update
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update training schedule (admin only)
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const schedule = await TrainingSchedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) return res.status(404).json({ message: 'Training schedule not found' });
    triggerDashboardUpdate(schedule.school.toString()); // Trigger update
    res.json(schedule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete training schedule (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const schedule = await TrainingSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Training schedule not found' });
    triggerDashboardUpdate(schedule.school.toString()); // Trigger update
    res.json({ message: 'Training schedule deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;