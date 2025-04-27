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
const io = socketIO(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

connectDB(); // MongoDB Connection

// Routes
app.use('/api/auth', authRoutes);

// WebSocket Handler
socketHandler(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
