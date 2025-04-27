const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandler = require('./socket');
const authRoutes = require('./routes/auth');
const connectDB = require('./config/db');

// Initialize main Express app
const app = express();
const mainServer = http.createServer(app);

// Configure Express middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));
app.use(express.json());

// Database connection
connectDB();

// API Routes
app.use('/remote-support/api/auth', authRoutes);

// Start main API server
const API_PORT = process.env.PORT || 5002;
mainServer.listen(API_PORT, () => {
    console.log(`Main API server running on port ${API_PORT}`);

    // Start Socket.IO server after main server starts
    const socketServer = http.createServer();
    const io = new Server(socketServer, {
        path: '/socket.io/',
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Initialize socket handler
    socketHandler(io);

    // Start Socket.IO server
    const SOCKET_PORT = process.env.SOCKET_PORT || 5001;
    socketServer.listen(SOCKET_PORT, () => {
        console.log(`Socket server running on port ${SOCKET_PORT}`);
    });
});