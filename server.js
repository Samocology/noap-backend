const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for now, adjust as needed
    methods: ["GET", "POST"]
  }
});

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/events', require('./routes/events'));
app.use('/api/members', require('./routes/members'));
app.use('/api/products', require('./routes/products'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/user-roles', require('./routes/userRoles'));
app.use('/api/training-schedules', require('./routes/trainingSchedules'));
app.use('/api/students', require('./routes/students'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/school-portal', require('./routes/schoolPortal'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Route not found');
});

const PORT = process.env.PORT || 5000;

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) {
    return next(new Error('Authentication error: Token not provided.'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token.'));
    }

    // Attach user info to the socket
    socket.user = decoded;

    // Allow connection for 'school' or 'admin' roles
    if (socket.user.role === 'school' || socket.user.role === 'admin') {
      next();
    } else {
      return next(new Error('Authorization error: Access denied.'));
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`A user connected with role: ${socket.user.role}`);

  // Join room based on role
  if (socket.user.role === 'school') {
    const schoolId = socket.user._id;
    socket.join(schoolId);
    console.log(`Socket for school ${schoolId} joined its room.`);

    // Handler for when a school requests its initial dashboard data
    socket.on('requestInitialData', async () => {
      try {
        const { getDashboardData } = require('./lib/dashboard');
        const dashboardData = await getDashboardData(schoolId);
        socket.emit('dashboardUpdate', dashboardData);
      } catch (error) {
        console.error(`Failed to send initial data to school ${schoolId}:`, error);
      }
    });

  } else if (socket.user.role === 'admin') {
    socket.join('admins');
    console.log('Admin socket joined the admins room.');
  }

  socket.on('disconnect', () => {
    console.log(`User with role ${socket.user.role} disconnected.`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };