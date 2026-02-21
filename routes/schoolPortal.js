const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const TrainingSchedule = require('../models/TrainingSchedule');
const Student = require('../models/Student');
const Certificate = require('../models/Certificate');
const Invoice = require('../models/Invoice');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const School = require('../models/School');
const { getDashboardData } = require('../lib/dashboard');
const { auth, schoolAuth } = require('../middleware/auth');

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

// Get server.js io instance
let io;
const setIO = (ioInstance) => {
  io = ioInstance;
};

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

// Get single invoice details
router.get('/invoices/:id', auth, schoolAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, school: req.user._id });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
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

// Initialize payment with gateway
router.post('/payments/init-gateway', auth, schoolAuth, async (req, res) => {
  const { invoiceId, amount, gateway, isPrepay } = req.body;
  const schoolId = req.user._id;

  // Validation
  if (!invoiceId || !amount || !gateway) {
    return res.status(400).json({ error: 'invoiceId, amount, and gateway are required' });
  }

  if (!['paystack', 'flutterwave'].includes(gateway)) {
    return res.status(400).json({ error: 'Invalid gateway. Must be paystack or flutterwave' });
  }

  try {
    // Validate invoice exists and belongs to school
    const invoice = await Invoice.findOne({ _id: invoiceId, school: schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Create payment record (pending)
    const payment = await Payment.create({
      invoiceId,
      schoolId,
      amount,
      gateway,
      isPrepay: isPrepay || false,
      status: 'pending',
      metadata: { initiatedAt: new Date() },
    });

    if (gateway === 'paystack') {
      const school = await School.findById(schoolId);
      const paystackRes = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: school.contact.email,
          amount: amount * 100, // Paystack expects amount in kobo
          metadata: {
            paymentId: payment._id.toString(),
            invoiceId: invoiceId,
            isPrepay: isPrepay || false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return res.json({ authorizationUrl: paystackRes.data.data.authorization_url });
    }

    if (gateway === 'flutterwave') {
      const school = await School.findById(schoolId);
      const flutterwaveRes = await axios.post(
        'https://api.flutterwave.com/v3/payments',
        {
          tx_ref: `payment-${payment._id}`,
          amount: amount,
          currency: 'NGN',
          customer: {
            email: school.contact.email,
            name: school.name,
          },
          customizations: {
            title: 'School Invoice Payment',
            description: `Payment for invoice ${invoiceId}`,
          },
          redirect_url: `${process.env.APP_URL}/school-portal/payments/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return res.json({ checkout_url: flutterwaveRes.data.data.link });
    }
  } catch (err) {
    console.error('Gateway init failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Record direct payment
router.post('/payments', auth, schoolAuth, async (req, res) => {
  const { invoiceId, amount, gateway, isPrepay } = req.body;
  const schoolId = req.user._id;

  // Validation
  if (!invoiceId || !amount) {
    return res.status(400).json({ error: 'invoiceId and amount are required' });
  }

  if (amount < 100) {
    return res.status(400).json({ error: 'Minimum payment amount is ₦100' });
  }

  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, school: schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Create payment record
    const payment = await Payment.create({
      invoiceId,
      schoolId,
      amount,
      gateway: gateway || 'direct',
      isPrepay: isPrepay || false,
      status: 'completed',
      date: new Date(),
    });

    // Update invoice balance/status
    if (isPrepay) {
      // Store as credit for future invoices
      const school = await School.findById(schoolId);
      school.creditBalance = (school.creditBalance || 0) + amount;
      await school.save();
    } else {
      // Apply to invoice only
      invoice.paidAmount = (invoice.paidAmount || 0) + amount;
      invoice.balance = invoice.total - invoice.paidAmount;
      invoice.status = invoice.balance === 0 ? 'Paid' : 'Partially Paid';
      await invoice.save();
    }

    // Broadcast to admin via WebSocket
    if (io) {
      io.to('admins').emit('payment_made', {
        type: 'payment_completed',
        data: {
          paymentId: payment._id,
          invoiceId,
          amount: payment.amount,
          isPrepay: payment.isPrepay,
          schoolId,
          timestamp: new Date(),
        },
      });
    }

    res.json({
      paymentId: payment._id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      status: 'completed',
      isPrepay: payment.isPrepay,
      date: payment.date,
    });
  } catch (err) {
    console.error('Direct payment failed:', err.message);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// Get all dashboard data
router.get('/dashboard', auth, schoolAuth, async (req, res) => {
  try {
    const schoolId = req.user._id;
    const dashboardData = await getDashboardData(schoolId);
    res.send(dashboardData);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
module.exports.setIO = setIO;