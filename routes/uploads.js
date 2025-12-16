const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Upload product images
router.post('/products', auth, upload.array('images', 5), (req, res) => {
  try {
    const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
    res.send({ message: 'Product images uploaded successfully', urls: fileUrls });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Upload certificates
router.post('/certificates', auth, upload.single('certificate'), (req, res) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ message: 'Certificate uploaded successfully', url: fileUrl });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Upload profile photos
router.post('/profiles', auth, upload.single('profilePhoto'), (req, res) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ message: 'Profile photo uploaded successfully', url: fileUrl });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
