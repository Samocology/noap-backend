const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Member = require('../models/Member');
const School = require('../models/School');
const UserRole = require('../models/UserRole');

const router = express.Router();

// School Signup
router.post('/school/signup', async (req, res) => {
  try {
    // Check if school with this email already exists
    const existingSchool = await School.findOne({ 'contact.email': req.body.contact?.email });
    if (existingSchool) {
      return res.status(400).send({ error: 'Email already in use' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const school = new School({
      ...req.body,
      otp,
      otpExpires,
    });
    await school.save();

    // Send OTP email
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: req.body.contact.email,
      from: process.env.EMAIL_USER,
      subject: 'OTP for School Registration',
      text: `Your OTP for school registration is: ${otp}. It expires in 10 minutes.`,
    });

    res.status(201).send({ message: 'OTP sent to your email. Please verify to complete registration.' });
  } catch (e) {
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
    res.send({ school, token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// School Login
router.post('/school/login', async (req, res) => {
  try {
    const school = await School.findOne({ 'contact.email': req.body.email });
    if (!school) {
      return res.status(400).send({ error: 'Invalid login credentials' });
    }
    const token = jwt.sign({ _id: school._id, role: 'school' }, process.env.JWT_SECRET);
    res.send({ school, token });
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

    const transporter = nodemailer.createTransporter({
      service: 'gmail', // or your email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: req.body.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset',
      text: `Click the link to reset your password: http://localhost:3000/reset-password/${resetToken}`,
    });
    res.send({ message: 'Password reset email sent' });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
