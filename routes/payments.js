const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const School = require('../models/School');
const { auth } = require('../middleware/auth');

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

// Get server.js io instance
let io;
const setIO = (ioInstance) => {
  io = ioInstance;
};

// Initialize payment with gateway
router.post('/init-gateway', auth, async (req, res) => {
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
router.post('/pay', auth, async (req, res) => {
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
      invoice.status =
        invoice.balance === 0 ? 'Paid' : 'Partially Paid';
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

// Paystack webhook
router.post('/webhook/paystack', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { paymentId, invoiceId, isPrepay } = event.data.metadata;

    try {
      // Update payment status
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      payment.status = 'completed';
      payment.reference = event.data.reference;
      await payment.save();

      // Update invoice or credit
      if (isPrepay) {
        const school = await School.findById(payment.schoolId);
        school.creditBalance = (school.creditBalance || 0) + payment.amount;
        await school.save();
      } else {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) {
          invoice.paidAmount = (invoice.paidAmount || 0) + payment.amount;
          invoice.balance = invoice.total - invoice.paidAmount;
          invoice.status = invoice.balance === 0 ? 'Paid' : 'Partially Paid';
          await invoice.save();
        }
      }

      // Broadcast to admin via WS
      if (io) {
        io.to('admins').emit('payment_made', {
          type: 'payment_completed',
          data: {
            paymentId: payment._id,
            invoiceId,
            amount: payment.amount,
            isPrepay,
            schoolId: payment.schoolId,
            timestamp: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('Webhook processing error:', err.message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  res.sendStatus(200);
});

// Flutterwave webhook
router.post('/webhook/flutterwave', async (req, res) => {
  const signature = req.headers['verif-hash'];
  const hash = crypto
    .createHmac('sha256', FLUTTERWAVE_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (req.body.status === 'successful') {
    const txRef = req.body.txRef || req.body.tx_ref;
    const paymentIdMatch = txRef?.match(/payment-([a-f0-9]+)/);

    if (!paymentIdMatch) {
      return res.status(400).json({ error: 'Invalid transaction reference' });
    }

    const paymentId = paymentIdMatch[1];

    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      payment.status = 'completed';
      payment.reference = req.body.id || req.body.transaction_id;
      await payment.save();

      // Update invoice/credit
      if (payment.isPrepay) {
        const school = await School.findById(payment.schoolId);
        school.creditBalance = (school.creditBalance || 0) + payment.amount;
        await school.save();
      } else {
        const invoice = await Invoice.findById(payment.invoiceId);
        if (invoice) {
          invoice.paidAmount = (invoice.paidAmount || 0) + payment.amount;
          invoice.balance = invoice.total - invoice.paidAmount;
          invoice.status = invoice.balance === 0 ? 'Paid' : 'Partially Paid';
          await invoice.save();
        }
      }

      // Broadcast to admin via WS
      if (io) {
        io.to('admins').emit('payment_made', {
          type: 'payment_completed',
          data: {
            paymentId: payment._id,
            invoiceId: payment.invoiceId,
            amount: payment.amount,
            isPrepay: payment.isPrepay,
            schoolId: payment.schoolId,
            timestamp: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('Flutterwave webhook error:', err.message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  res.sendStatus(200);
});

module.exports = router;
module.exports.setIO = setIO;