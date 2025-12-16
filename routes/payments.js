const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Paystack payment initialization
router.post('/paystack/initiate', auth, async (req, res) => {
  try {
    const { amount, email, reference } = req.body;
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      amount: amount * 100, // Paystack expects amount in kobo
      email,
      reference,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Paystack payment verification
router.get('/paystack/verify/:reference', auth, async (req, res) => {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${req.params.reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Flutterwave payment initialization
router.post('/flutterwave/initiate', auth, async (req, res) => {
  try {
    const { amount, email, tx_ref } = req.body;
    const response = await axios.post('https://api.flutterwave.com/v3/payments', {
      tx_ref,
      amount,
      currency: 'NGN',
      redirect_url: 'http://localhost:3000/payment/callback',
      customer: {
        email,
      },
      customizations: {
        title: 'NOAP Payment',
      },
    }, {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Flutterwave payment verification
router.get('/flutterwave/verify/:tx_ref', auth, async (req, res) => {
  try {
    const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${req.params.tx_ref}/verify`, {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      },
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
