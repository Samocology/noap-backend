const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Member = require('../models/Member');
const School = require('../models/School');
const UserRole = require('../models/UserRole');

const router = express.Router();

// Configure nodemailer with Brevo
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_LOGIN, // Your Brevo login
    pass: process.env.BREVO_SMTP_KEY, // Your Brevo SMTP key
  },
});

// School Signup
router.post('/school/signup', async (req, res) => {
  try {
    // Check for email configuration
    if (!process.env.BREVO_LOGIN || !process.env.BREVO_SMTP_KEY || !process.env.EMAIL_USER) {
      console.error('Email service is not configured. Cannot send OTP. Please check environment variables (BREVO_LOGIN, BREVO_SMTP_KEY, EMAIL_USER).');
      return res.status(500).send({ error: 'Email service is not configured on the server.' });
    }

    // Validate required fields from a flat request body
    const { name, password, email, phone, tier, status, street, city, state, country, zipCode } = req.body;
    let { address } = req.body;

    if (!name) {
      return res.status(400).send({ error: 'School name is required' });
    }
    if (!password) {
      return res.status(400).send({ error: 'Password is required' });
    }
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }
    if (!phone) {
      return res.status(400).send({ error: 'Phone number is required' });
    }

    // Check if school with this email already exists
    const existingSchool = await School.findOne({ 'contact.email': email });
    if (existingSchool) {
      return res.status(400).send({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Construct address object from various possible request formats
    let addressObject;
    if (req.body.contact && typeof req.body.contact.address === 'object') {
        addressObject = req.body.contact.address;
    } else if (typeof address === 'string') {
        addressObject = { street: address, city, state, country, zipCode };
    } else if (street || city || state || country) {
        addressObject = { street, city, state, country, zipCode };
    }

    // Construct the School object with a nested contact field
    const school = new School({
      name,
      password: hashedPassword,
      contact: {
        email,
        phone,
        address: addressObject,
      },
      tier,
      status,
      otp,
      otpExpires,
    });

    await school.save();

    // Send OTP email synchronously
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP for School Registration',
        html: `<p>Your OTP for school registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      });
      res.status(201).send({ message: 'OTP sent to your email. Please verify to complete registration.' });
    } catch (err) {
      console.error('Error sending OTP email:', err);
      return res.status(500).send({ error: 'Failed to send OTP email' });
    }
  } catch (e) {
    console.error('Error in school signup:', e);
    res.status(400).send({ error: e.message });
  }
});

// Send/Resend School OTP
router.post('/school/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }

    const school = await School.findOne({ 'contact.email': email });
    if (!school) {
      return res.status(404).send({ error: 'School not found' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    school.otp = otp;
    school.otpExpires = otpExpires;
    await school.save();

    // Send OTP email synchronously
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP for School Registration',
        html: `<p>Your OTP for school registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      });
      res.send({ message: 'OTP sent to your email.' });
    } catch (err) {
      console.error('Error sending OTP email:', err);
      return res.status(500).send({ error: 'Failed to send OTP email' });
    }
  } catch (e) {
    console.error('Error in send OTP:', e);
    res.status(400).send({ error: e.message });
  }
});

// Resend School OTP
router.post('/school/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }

    const school = await School.findOne({ 'contact.email': email });
    if (!school) {
      return res.status(404).send({ error: 'School not found' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    school.otp = otp;
    school.otpExpires = otpExpires;
    await school.save();

    // Send OTP email synchronously
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP for School Registration (Resent)',
        html: `<p>Your OTP for school registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      });
      res.send({ message: 'OTP resent to your email.' });
    } catch (err) {
      console.error('Error resending OTP email:', err);
      return res.status(500).send({ error: 'Failed to resend OTP email' });
    }
  } catch (e) {
    console.error('Error in resend OTP:', e);
    res.status(400).send({ error: e.message });
  }
});

// Verify School OTP
router.post('/school/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const school = await School.findOne({ 'contact.email': email, otp, otpExpires: { $gt: Date.now() } });
    if (!school) {
      return res.status(400).send({ error: 'Invalid or expired OTP' });
    }

    school.isVerified = true;
    school.otp = undefined;
    school.otpExpires = undefined;
    await school.save();

    const token = jwt.sign({ _id: school._id, role: 'school' }, process.env.JWT_SECRET);
    const { password: _, ...schoolResponse } = school.toObject();
    res.send({ school: schoolResponse, token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// School Login
router.post('/school/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const school = await School.findOne({ 'contact.email': email });
    if (!school) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, school.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ _id: school._id, role: 'school' }, process.env.JWT_SECRET);
    const { password: _, ...schoolResponse } = school.toObject();
    res.send({ school: schoolResponse, token });
  } catch (e) {
    res.status(400).send(e);
  }
});

// Member Signup
router.post('/member/signup', async (req, res) => {
  try {
    // Check for email configuration
    if (!process.env.BREVO_LOGIN || !process.env.BREVO_SMTP_KEY || !process.env.EMAIL_USER) {
      console.error('Email service is not configured. Cannot send OTP. Please check environment variables (BREVO_LOGIN, BREVO_SMTP_KEY, EMAIL_USER).');
      return res.status(500).send({ error: 'Email service is not configured on the server.' });
    }

    // Validate required fields
    const { name, password, email } = req.body;
    if (!name) {
      return res.status(400).send({ error: 'Name is required' });
    }
    if (!password) {
      return res.status(400).send({ error: 'Password is required' });
    }
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }

    // Check if member with this email already exists
    const existingMember = await Member.findOne({ email });
    if (existingMember) {
      return res.status(400).send({ error: 'Email already in use' });
    }

    // Find or create the 'member' role
    let memberRole = await UserRole.findOne({ name: 'member' });
    if (!memberRole) {
      memberRole = new UserRole({ name: 'member', permissions: ['read', 'write'] });
      await memberRole.save();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const memberData = { ...req.body, password: hashedPassword, role: memberRole._id, otp, otpExpires };
    const member = new Member(memberData);
    await member.save();

    // Send OTP email synchronously
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP for Member Registration',
        html: `<p>Your OTP for member registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      });
      res.status(201).send({ message: 'OTP sent to your email. Please verify to complete registration.' });
    } catch (err) {
      console.error('Error sending OTP email:', err);
      return res.status(500).send({ error: 'Failed to send OTP email' });
    }
  } catch (e) {
    console.error('Error in member signup:', e);
    res.status(400).send({ error: e.message });
  }
});

// Member Login
router.post('/member/login', async (req, res) => {
  try {
    const member = await Member.findOne({ email: req.body.email });
    if (!member || !(await bcrypt.compare(req.body.password, member.password))) {
      return res.status(400).send({ error: 'Invalid login credentials' });
    }
    const token = jwt.sign({ _id: member._id, role: 'member' }, process.env.JWT_SECRET);
    res.send({ member, token });
  } catch (e) {
    res.status(400).send(e);
  }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    // Assuming admin is a special member with admin role
    const admin = await Member.findOne({ email: req.body.email });
    if (!admin || !(await bcrypt.compare(req.body.password, admin.password)) || admin.role !== 'admin') {
      return res.status(400).send({ error: 'Invalid login credentials' });
    }
    const token = jwt.sign({ _id: admin._id, role: 'admin' }, process.env.JWT_SECRET);
    res.send({ admin, token });
  } catch (e) {
    res.status(400).send(e);
  }
});

// Password Reset
router.post('/password-reset', async (req, res) => {
  try {
    const user = await Member.findOne({ email: req.body.email }) || await School.findOne({ 'contact.email': req.body.email });
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    const resetToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: req.body.email,
      subject: 'Password Reset',
      html: `<p>Click the link to reset your password: <a href="http://localhost:3000/reset-password/${resetToken}">Reset Password</a></p>`,
    });
    res.send({ message: 'Password reset email sent' });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
