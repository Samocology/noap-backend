const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|avi|mov/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, folder, public_id) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        public_id,
        resource_type: 'auto',
        transformation: folder === 'noap-uploads/images' ? [{ width: 1000, height: 1000, crop: 'limit' }] : [],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

// Upload product images
router.post('/products', auth, upload.array('images', 5), async (req, res) => {
  try {
    const uploadPromises = req.files.map((file, index) =>
      uploadToCloudinary(file.buffer, 'noap-uploads/images', `product_${Date.now()}_${index}`)
    );
    const results = await Promise.all(uploadPromises);
    const fileUrls = results.map(result => result.secure_url);
    res.send({ message: 'Product images uploaded successfully', urls: fileUrls });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Upload certificates
router.post('/certificates', auth, upload.single('certificate'), async (req, res) => {
  try {
    const result = await uploadToCloudinary(req.file.buffer, 'noap-uploads/certificates', `certificate_${Date.now()}`);
    res.send({ message: 'Certificate uploaded successfully', url: result.secure_url });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Upload profile photos
router.post('/profiles', auth, upload.single('profilePhoto'), async (req, res) => {
  try {
    const result = await uploadToCloudinary(req.file.buffer, 'noap-uploads/profiles', `profile_${Date.now()}`);
    res.send({ message: 'Profile photo uploaded successfully', url: result.secure_url });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
