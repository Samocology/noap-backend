const express = require('express');
const Certificate = require('../models/Certificate');
const { auth, adminAuth, memberAuth } = require('../middleware/auth');

const router = express.Router();

// Get all certificates (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const certificates = await Certificate.find({}).populate('recipient', 'name').populate('issuedBy', 'name');
    res.send(certificates);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get certificate by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id).populate('recipient', 'name').populate('issuedBy', 'name');
    if (!certificate) {
      return res.status(404).send();
    }
    res.send(certificate);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create certificate (member only)
router.post('/', auth, memberAuth, async (req, res) => {
  try {
    const certificate = new Certificate(req.body);
    await certificate.save();
    res.status(201).send(certificate);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update certificate
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['program', 'certificateUrl', 'isDelivered'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).send();
    }

    updates.forEach((update) => certificate[update] = req.body[update]);
    await certificate.save();
    res.send(certificate);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete certificate (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const certificate = await Certificate.findByIdAndDelete(req.params.id);
    if (!certificate) {
      return res.status(404).send();
    }
    res.send(certificate);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
