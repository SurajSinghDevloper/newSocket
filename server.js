const express = require("express")
const http = require("http")
const cors = require("cors")
const SocketServer = require("./socket")
const authRoutes = require("./routes/auth")
const connectDB = require("./config/db")

// Initialize Express app
const app = express()
const mainServer = http.createServer(app)

// Configure Express middleware
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    }),
)
app.use(express.json())

// Database connection
connectDB()

// API Routes
app.use("/ssb-remote-support/api/auth", authRoutes)

// Start main API server
const API_PORT = process.env.PORT || 5002
mainServer.listen(API_PORT, async () => {
    console.log(`Main API server running on port ${API_PORT}`)

    // Initialize and start Socket.IO server with dual channels
    const socketServer = new SocketServer({
        port: process.env.SOCKET_PORT || 5001,
        redisUrl: process.env.REDIS_URL || null,
        maxBufferSize: 10e6, // 10MB
        pingInterval: 10000,
        pingTimeout: 5000,
    })

    await socketServer.initialize()

    // Start cleanup interval for inactive rooms (30 minutes)
    socketServer.startCleanupInterval(30 * 60 * 1000)
})
