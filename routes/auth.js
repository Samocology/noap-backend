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
    console.log('Request body:', req.body); // Debug log

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
    console.log('Initial validation passed.');

    // Check if school with this email already exists
    console.log('Checking for existing school...');
    const existingSchool = await School.findOne({ 'contact.email': email });
    if (existingSchool) {
      console.log('School with this email already exists.');
      return res.status(400).send({ error: 'Email already in use' });
    }
    console.log('No existing school found.');

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('Password hashed.');

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    console.log('OTP generated.');

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
    console.log('School object created:', school);

    console.log('Saving school to database...');
    await school.save();
    console.log('School saved successfully.');

    // Send OTP email
    console.log('Sending OTP email...');
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'OTP for School Registration',
      html: `<p>Your OTP for school registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    });
    console.log('OTP email sent successfully.');

    res.status(201).send({ message: 'OTP sent to your email. Please verify to complete registration.' });
  } catch (e) {
    console.error('Error in school signup:', e);
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
    // Find or create the 'member' role
    let memberRole = await UserRole.findOne({ name: 'member' });
    if (!memberRole) {
      memberRole = new UserRole({ name: 'member', permissions: ['read', 'write'] });
      await memberRole.save();
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 8);
    const memberData = { ...req.body, password: hashedPassword, role: memberRole._id };
    const member = new Member(memberData);
    await member.save();
    const token = jwt.sign({ _id: member._id, role: 'member' }, process.env.JWT_SECRET);
    res.status(201).send({ member, token });
  } catch (e) {
    res.status(400).send(e);
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
