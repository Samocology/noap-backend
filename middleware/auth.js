const jwt = require('jsonwebtoken');
const Member = require('../models/Member');
const School = require('../models/School');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;

    if (decoded.role === 'member') {
      user = await Member.findById(decoded._id);
    } else if (decoded.role === 'school') {
      user = await School.findById(decoded._id);
    }

    if (!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send({ error: 'Access denied. Admin role required.' });
  }
  next();
};

const memberAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'member') {
    return res.status(403).send({ error: 'Access denied. Member role required.' });
  }
  next();
};

const schoolAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'school') {
    return res.status(403).send({ error: 'Access denied. School role required.' });
  }
  next();
};

module.exports = { auth, adminAuth, memberAuth, schoolAuth };
