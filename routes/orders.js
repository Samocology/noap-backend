const express = require('express');
const Order = require('../models/Order');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all orders (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const orders = await Order.find({}).populate('buyer', 'name').populate('items.product', 'name');
    res.send(orders);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('buyer', 'name').populate('items.product', 'name');
    if (!order) {
      return res.status(404).send();
    }
    res.send(order);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).send(order);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Update order
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['items', 'totalAmount', 'status', 'paymentStatus', 'shippingAddress'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).send();
    }

    updates.forEach((update) => order[update] = req.body[update]);
    await order.save();
    res.send(order);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete order (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).send();
    }
    res.send(order);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
