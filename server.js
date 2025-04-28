const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const authRoutes = require("./routes/auth")
const connectDB = require("./config/db")
const socketHandler = require("./socket")

// Initialize Express app
const app = express()
const server = http.createServer(app)

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

// Initialize Socket.IO with the server
const io = new Server(server, {
    path: "/socket.io/",
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
    maxHttpBufferSize: 10e6, // 10MB buffer size for larger payloads
    pingTimeout: 60000, // Increase timeout for better connection stability
})

// Initialize socket handler
socketHandler(io)

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
