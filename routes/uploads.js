const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for Cloudinary uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'noap-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'mp4', 'avi', 'mov'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload product images
router.post('/products', auth, upload.array('images', 5), (req, res) => {
  try {
    const fileUrls = req.files.map(file => file.path);
    res.send({ message: 'Product images uploaded successfully', urls: fileUrls });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Upload certificates
router.post('/certificates', auth, upload.single('certificate'), (req, res) => {
  try {
    const fileUrl = req.file.path;
    res.send({ message: 'Certificate uploaded successfully', url: fileUrl });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Upload profile photos
router.post('/profiles', auth, upload.single('profilePhoto'), (req, res) => {
  try {
    const fileUrl = req.file.path;
    res.send({ message: 'Profile photo uploaded successfully', url: fileUrl });
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
