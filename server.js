const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const authRoutes = require("./routes/auth")
const connectDB = require("./config/db")
const socketHandler = require("./socket")

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
mainServer.listen(API_PORT, () => {
    console.log(`Main API server running on port ${API_PORT}`)

    // Start Socket.IO server
    const socketServer = http.createServer()
    const io = new Server(socketServer, {
        path: "/socket.io/",
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
        maxHttpBufferSize: 10e6, // 10MB buffer size for larger payloads
        pingTimeout: 60000, // Increased timeout for better connection stability
        transports: ["websocket", "polling"], // Prefer websocket for lower latency
        pingInterval: 10000, // More frequent pings to detect connection issues
    })

    // Initialize socket handler
    socketHandler(io)

    // Start Socket.IO server
    const SOCKET_PORT = process.env.SOCKET_PORT || 5001
    socketServer.listen(SOCKET_PORT, () => {
        console.log(`Socket server running on port ${SOCKET_PORT}`)
    })
})
