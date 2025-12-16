const express = require('express');
const Nylas = require('nylas');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure Nylas
const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY,
});

// Send booking confirmation email
router.post('/booking-confirmation', auth, async (req, res) => {
  try {
    const { email, bookingDetails } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Booking Confirmation - NOAP',
      html: `
        <h1>Booking Confirmed</h1>
        <p>Thank you for your booking. Here are the details:</p>
        <ul>
          <li>Event: ${bookingDetails.eventName}</li>
          <li>Date: ${bookingDetails.date}</li>
          <li>Deposit: ${bookingDetails.deposit}</li>
        </ul>
        <p>We look forward to seeing you!</p>
      `,
    };

    await nylas.messages.send({
      to: [{ email }],
      from: [{ email: process.env.EMAIL_USER }],
      subject: mailOptions.subject,
      body: mailOptions.html,
    });
    res.send({ message: 'Booking confirmation email sent' });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Send certificate delivery email
router.post('/certificate-delivery', auth, async (req, res) => {
  try {
    const { email, certificateUrl } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Certificate Delivered - NOAP',
      html: `
        <h1>Certificate Delivered</h1>
        <p>Your certificate has been issued and is now available for download.</p>
        <p><a href="${certificateUrl}">Download Certificate</a></p>
        <p>Congratulations on your achievement!</p>
      `,
    };

    await nylas.messages.send({
      to: [{ email }],
      from: [{ email: process.env.EMAIL_USER }],
      subject: mailOptions.subject,
      body: mailOptions.html,
    });
    res.send({ message: 'Certificate delivery email sent' });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
