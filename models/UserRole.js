const mongoose = require('mongoose');

const userRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['admin', 'member', 'school'],
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'admin'],
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userRoleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('UserRole', userRoleSchema);
