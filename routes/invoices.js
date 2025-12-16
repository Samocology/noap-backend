const express = require('express');
const Invoice = require('../models/Invoice');
const { auth, adminAuth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

// Get all invoices (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find({}).populate('school', 'name').populate('relatedOrder', 'totalAmount');
    res.send(invoices);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get invoices for a school
router.get('/school/:schoolId', auth, schoolAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ school: req.params.schoolId }).populate('relatedOrder', 'totalAmount');
    res.send(invoices);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get invoice by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('school', 'name').populate('relatedOrder', 'totalAmount');
    if (!invoice) {
      return res.status(404).send();
    }
    res.send(invoice);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create invoice (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const invoice = new Invoice(req.body);
    await invoice.save();
    res.status(201).send(invoice);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update invoice
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['amount', 'status', 'dueDate', 'paidDate'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).send();
    }

    updates.forEach((update) => invoice[update] = req.body[update]);
    await invoice.save();
    res.send(invoice);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete invoice (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).send();
    }
    res.send(invoice);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
