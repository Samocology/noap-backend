const express = require('express');
const nodemailer = require('nodemailer');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure nodemailer with Brevo
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_LOGIN, // Your Brevo login
    pass: process.env.BREVO_API_KEY, // Your Brevo API key
  },
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

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: mailOptions.subject,
      html: mailOptions.html,
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

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: mailOptions.subject,
      html: mailOptions.html,
    });
    res.send({ message: 'Certificate delivery email sent' });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
