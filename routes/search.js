const express = require('express');
const School = require('../models/School');
const Member = require('../models/Member');
const Product = require('../models/Product');
const Certificate = require('../models/Certificate');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Global search across all entities
router.get('/', auth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).send({ error: 'Query parameter "q" is required' });
    }

    const regex = new RegExp(query, 'i'); // Case-insensitive regex

    const [schools, members, products, certificates, orders, events] = await Promise.all([
      School.find({ name: regex }),
      Member.find({ name: regex }),
      Product.find({ name: regex }),
      Certificate.find({ program: regex }),
      Order.find({}).populate('buyer', 'name').then(orders => orders.filter(order => regex.test(order.buyer.name))),
      Event.find({ name: regex }),
    ]);

    const results = {
      schools,
      members,
      products,
      certificates,
      orders,
      events,
    };

    res.send(results);
  } catch (e) {
    res.status(500).send(e);
  }
});

module.exports = router;
