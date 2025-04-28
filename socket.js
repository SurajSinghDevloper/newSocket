const http = require("http")
const { Server } = require("socket.io")
const { createAdapter } = require("@socket.io/redis-adapter")
const { createClient } = require("redis")

/**
 * Enhanced Socket Server with dual channel architecture
 * - Control channel: Low-latency, high-priority for mouse/keyboard events
 * - Screen channel: Optimized for screen sharing with adaptive quality
 */
class SocketServer {
    constructor(options = {}) {
        this.options = {
            port: options.port || 5001,
            redisUrl: options.redisUrl || null,
            maxBufferSize: options.maxBufferSize || 10e6, // 10MB
            pingInterval: options.pingInterval || 10000,
            pingTimeout: options.pingTimeout || 5000,
        }

        this.rooms = {}
        this.server = null
        this.io = null
        this.controlChannel = null
        this.screenChannel = null
    }

    async initialize() {
        // Create HTTP server
        this.server = http.createServer()

        // Configure Socket.IO with optimized settings
        this.io = new Server(this.server, {
            path: "/socket.io/",
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true,
            },
            maxHttpBufferSize: this.options.maxBufferSize,
            pingInterval: this.options.pingInterval,
            pingTimeout: this.options.pingTimeout,
            transports: ["websocket", "polling"],
        })

        // Set up Redis adapter if Redis URL is provided
        if (this.options.redisUrl) {
            try {
                const pubClient = createClient({ url: this.options.redisUrl })
                const subClient = pubClient.duplicate()

                await Promise.all([pubClient.connect(), subClient.connect()])

                this.io.adapter(createAdapter(pubClient, subClient))
                console.log("Redis adapter configured successfully")
            } catch (error) {
                console.error("Failed to configure Redis adapter:", error)
            }
        }

        // Create namespaces for control and screen channels
        this.controlChannel = this.io.of("/control")
        this.screenChannel = this.io.of("/screen")

        // Initialize event handlers
        this._setupControlChannel()
        this._setupScreenChannel()

        // Start the server
        return new Promise((resolve) => {
            this.server.listen(this.options.port, () => {
                console.log(`Socket server running on port ${this.options.port}`)
                resolve(true)
            })
        })
    }

    _setupControlChannel() {
        this.controlChannel.on("connection", (socket) => {
            console.log(`Control channel: New connection (${socket.id})`)

            // Join room
            socket.on("join-room", (data) => {
                const { code, role } = data

                if (!code) {
                    socket.emit("error", { message: "Room code is required" })
                    return
                }

                // Leave previous rooms
                if (socket.currentRoom) {
                    this._leaveRoom(socket, socket.currentRoom, "control")
                }

                // Join new room
                socket.join(code)
                socket.currentRoom = code
                socket.role = role

                // Initialize room if it doesn't exist
                if (!this.rooms[code]) {
                    this.rooms[code] = {
                        host: null,
                        clients: [],
                        lastActivity: Date.now(),
                        screenSize: { width: 1280, height: 720 },
                        quality: { level: 0.5, frameRate: 3 },
                    }
                }

                // Set host or client
                if (role === "host") {
                    this.rooms[code].host = socket.id
                    socket.emit("room-joined", { room: code, role: "host" })
                    console.log(`Host ${socket.id} joined control room ${code}`)
                } else {
                    this.rooms[code].clients.push(socket.id)
                    socket.emit("room-joined", { room: code, role: "client" })

                    // Notify host
                    if (this.rooms[code].host) {
                        this.controlChannel.to(this.rooms[code].host).emit("client-connected", {
                            room: code,
                            clientId: socket.id,
                        })
                    }

                    console.log(`Client ${socket.id} joined control room ${code}`)
                }
            })

            // Mouse move event - high priority
            socket.on("mouse-move", (data) => {
                if (!data || !data.code) return

                // Update room activity
                if (this.rooms[data.code]) {
                    this.rooms[data.code].lastActivity = Date.now()

                    // Forward to host with minimal processing
                    if (this.rooms[data.code].host) {
                        this.controlChannel.to(this.rooms[data.code].host).volatile.emit("mouse-move", data)
                    }
                }
            })

            // Mouse click event
            socket.on("mouse-click", (data) => {
                if (!data || !data.code) return

                if (this.rooms[data.code]) {
                    this.rooms[data.code].lastActivity = Date.now()

                    if (this.rooms[data.code].host) {
                        this.controlChannel.to(this.rooms[data.code].host).emit("mouse-click", data)
                    }
                }
            })

            // Key press event
            socket.on("key-press", (data) => {
                if (!data || !data.code) return

                if (this.rooms[data.code]) {
                    this.rooms[data.code].lastActivity = Date.now()

                    if (this.rooms[data.code].host) {
                        this.controlChannel.to(this.rooms[data.code].host).emit("key-press", data)
                    }
                }
            })

            // Screen size update
            socket.on("screen-size", (data) => {
                if (!data || !data.code) return

                if (this.rooms[data.code] && socket.role === "host") {
                    this.rooms[data.code].screenSize = {
                        width: data.width || 1280,
                        height: data.height || 720,
                    }

                    // Notify all clients about screen size
                    this.controlChannel.to(data.code).emit("screen-size", {
                        width: this.rooms[data.code].screenSize.width,
                        height: this.rooms[data.code].screenSize.height,
                    })
                }
            })

            // Quality settings update
            socket.on("quality-settings", (data) => {
                if (!data || !data.code) return

                if (this.rooms[data.code]) {
                    this.rooms[data.code].quality = {
                        level: data.quality || 0.5,
                        frameRate: data.frameRate || 3,
                    }

                    // Notify screen channel about quality changes
                    this.screenChannel.to(data.code).emit("quality-settings", {
                        quality: this.rooms[data.code].quality.level,
                        frameRate: this.rooms[data.code].quality.frameRate,
                    })
                }
            })

            // Cursor position updates
            socket.on("cursor-position", (data) => {
                if (!data || !data.code) return

                // Use volatile for cursor updates (can be dropped if needed)
                socket.to(data.code).volatile.emit("cursor-position", {
                    x: data.x,
                    y: data.y,
                })
            })

            // Disconnect event
            socket.on("disconnect", () => {
                console.log(`Control channel: Disconnected (${socket.id})`)

                if (socket.currentRoom) {
                    this._leaveRoom(socket, socket.currentRoom, "control")
                }
            })
        })
    }

    _setupScreenChannel() {
        this.screenChannel.on("connection", (socket) => {
            console.log(`Screen channel: New connection (${socket.id})`)

            // Join room
            socket.on("join-room", (data) => {
                const { code, role } = data

                if (!code) {
                    socket.emit("error", { message: "Room code is required" })
                    return
                }

                // Leave previous rooms
                if (socket.currentRoom) {
                    this._leaveRoom(socket, socket.currentRoom, "screen")
                }

                // Join new room
                socket.join(code)
                socket.currentRoom = code
                socket.role = role

                console.log(`${role === "host" ? "Host" : "Client"} ${socket.id} joined screen room ${code}`)
                socket.emit("room-joined", { room: code, role })
            })

            // Screen data event
            socket.on("screen-data", (data) => {
                if (!data || !data.code || !data.image) return

                // Update room activity
                if (this.rooms[data.code]) {
                    this.rooms[data.code].lastActivity = Date.now()

                    // Forward screen data to clients in the room
                    // Use volatile to allow dropping frames if needed
                    socket.to(data.code).volatile.emit("screen-data", data)
                }
            })

            // Screen data received acknowledgment
            socket.on("screen-data-received", (data) => {
                if (!data || !data.code || !data.frameId) return

                // Forward acknowledgment to the host
                if (this.rooms[data.code] && this.rooms[data.code].host) {
                    this.screenChannel.to(this.rooms[data.code].host).emit("screen-data-received", data)
                }
            })

            // Disconnect event
            socket.on("disconnect", () => {
                console.log(`Screen channel: Disconnected (${socket.id})`)

                if (socket.currentRoom) {
                    this._leaveRoom(socket, socket.currentRoom, "screen")
                }
            })
        })
    }

    _leaveRoom(socket, roomCode, channelType) {
        const room = this.rooms[roomCode]
        if (!room) return

        if (socket.role === "host" && room.host === socket.id) {
            // Host is leaving
            room.host = null

            // Notify all clients
            room.clients.forEach((clientId) => {
                this.controlChannel.to(clientId).emit("host-disconnected", { room: roomCode })
                this.screenChannel.to(clientId).emit("host-disconnected", { room: roomCode })
            })

            console.log(`Host ${socket.id} left room ${roomCode} (${channelType})`)
        } else {
            // Client is leaving
            const clientIndex = room.clients.indexOf(socket.id)
            if (clientIndex !== -1) {
                room.clients.splice(clientIndex, 1)

                // Notify the host
                if (room.host) {
                    this.controlChannel.to(room.host).emit("client-disconnected", {
                        room: roomCode,
                        clientId: socket.id,
                    })
                }

                console.log(`Client ${socket.id} left room ${roomCode} (${channelType})`)
            }
        }

        // Clean up empty rooms
        if (room.host === null && room.clients.length === 0) {
            delete this.rooms[roomCode]
            console.log(`Room ${roomCode} deleted (empty)`)
        }

        // Remove current room reference
        socket.currentRoom = null
        socket.role = null
    }

    // Clean up inactive rooms
    startCleanupInterval(interval = 30 * 60 * 1000) {
        setInterval(() => {
            const now = Date.now()
            const inactiveThreshold = interval

            Object.keys(this.rooms).forEach((roomCode) => {
                const room = this.rooms[roomCode]
                if (now - room.lastActivity > inactiveThreshold) {
                    // Room is inactive, clean it up
                    if (room.host) {
                        this.controlChannel.to(room.host).emit("room-expired", { room: roomCode })
                        this.screenChannel.to(room.host).emit("room-expired", { room: roomCode })
                    }

                    room.clients.forEach((clientId) => {
                        this.controlChannel.to(clientId).emit("room-expired", { room: roomCode })
                        this.screenChannel.to(clientId).emit("room-expired", { room: roomCode })
                    })

                    delete this.rooms[roomCode]
                    console.log(`Room ${roomCode} deleted (inactive)`)
                }
            })
        }, interval)
    }
}

module.exports = SocketServer
