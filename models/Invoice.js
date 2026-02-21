const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Unpaid', 'Partially Paid', 'Paid', 'Overdue'],
    default: 'Unpaid',
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paidDate: {
    type: Date,
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
  },
  items: [
    {
      description: String,
      qty: Number,
      unitPrice: Number,
      total: Number,
    },
  ],
  subtotal: {
    type: Number,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
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

invoiceSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
