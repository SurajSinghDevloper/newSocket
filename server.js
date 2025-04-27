const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const authRoutes = require('./routes/auth');
const socketHandler = require('./socket');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

// CORS Configuration for Socket.IO
const io = socketIO(server, {
    cors: {
        origin: 'https://www.ssbtechnology.co.in',  // Replace with your client-side URL
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true  // Allow cookies if needed
    }
});

app.use(cors({
    origin: 'https://www.ssbtechnology.co.in',  // Replace with your client-side URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true  // Allow cookies if needed
}));

app.use(express.json());

connectDB(); // MongoDB Connection

// Routes
app.use('/api/auth', authRoutes);

// WebSocket Handler
socketHandler(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

