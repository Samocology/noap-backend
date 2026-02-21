const express = require('express');
const Invoice = require('../models/Invoice');
const PDFDocument = require('pdfkit');
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

// Download invoice as PDF
router.get('/:id/download', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('school', 'name');
    if (!invoice) {
      return res.status(404).send({ error: 'Invoice not found.' });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice._id}.pdf`);

    doc.pipe(res);

    // Add content to the PDF
    doc.fontSize(25).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Invoice ID: ${invoice._id}`);
    doc.text(`School: ${invoice.school.name}`);
    doc.text(`Amount: ${invoice.amount}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
    if (invoice.paidDate) {
      doc.text(`Paid on: ${new Date(invoice.paidDate).toLocaleDateString()}`);
    }

    doc.end();

  } catch (e) {
    console.error(e);
    res.status(500).send({ error: 'Failed to generate PDF.' });
  }
});

module.exports = router;