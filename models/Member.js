const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserRole',
    required: true,
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
  },
  earnings: {
    type: Number,
    default: 0,
  },
  ratings: [{
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: String,
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
    },
    givenAt: {
      type: Date,
      default: Date.now,
    },
  }],
  profilePhoto: {
    type: String, // URL to photo
  },
  contact: {
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

memberSchema.pre('save', async function(next) {
  // Only hash password if it's not already hashed (check if it starts with $2)
  if (this.isModified('password') && !this.password.startsWith('$2')) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Member', memberSchema);
