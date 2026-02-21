const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const { auth } = require('../middleware/auth');
const { io } = require('../server'); // Import io for WebSocket events

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_URL = 'https://api.paystack.co';

// Initialize a payment from an invoice
router.post('/', auth, async (req, res) => {
  const { invoiceId } = req.body;

  if (!invoiceId) {
    return res.status(400).send({ error: 'Invoice ID is required.' });
  }

  try {
    const invoice = await Invoice.findById(invoiceId).populate('school', 'email');
    if (!invoice) {
      return res.status(404).send({ error: 'Invoice not found.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).send({ error: 'Invoice has already been paid.' });
    }

    const paystackData = {
      email: invoice.school.email,
      amount: invoice.amount * 100, // Paystack expects amount in kobo
      reference: invoice._id.toString(), // Use invoice ID as the unique reference
      metadata: {
        invoice_id: invoice._id.toString(),
        school_id: invoice.school._id.toString(),
      },
    };

    const paystackResponse = await axios.post(`${PAYSTACK_API_URL}/transaction/initialize`, paystackData, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    res.send({ authorization_url: paystackResponse.data.data.authorization_url });

  } catch (error) {
    console.error('Paystack initialization error:', error.response ? error.response.data : error.message);
    res.status(500).send({ error: 'Failed to initialize payment.' });
  }
});

// Paystack Webhook Handler
router.post('/webhook', (req, res) => {
  // Validate event is from Paystack
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return res.sendStatus(401); // Unauthorized
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const reference = event.data.reference;

    // Use a timeout to handle potential race conditions with the database
    setTimeout(async () => {
      try {
        const invoice = await Invoice.findById(reference);
        if (invoice && invoice.status !== 'paid') {
          invoice.status = 'paid';
          invoice.paidDate = new Date();
          await invoice.save();

          console.log(`Invoice ${invoice._id} marked as paid.`);

          // Notify admins via WebSocket
          io.to('admins').emit('payment_made', {
            message: `Payment received for invoice ${invoice._id}`,
            invoice,
          });
        }
      } catch (error) {
        console.error('Webhook processing error:', error);
      }
    }, 5000); // 5-second delay
  }

  res.sendStatus(200); // Acknowledge receipt of the event
});

module.exports = router;