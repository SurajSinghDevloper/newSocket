/**
 * Enhanced Socket Server for Remote Support Application
 * Handles all socket.io events for remote control functionality
 */

// Track rooms and connections
const rooms = {}

const socketHandler = (io) => {
    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id)

        // Join Room by Code
        socket.on("join-room", (data) => {
            const { code, role } = data

            if (!code) {
                console.log("Error: Missing room code for join")
                socket.emit("error", { message: "Room code is required" })
                return
            }

            // Leave previous rooms if any
            if (socket.currentRoom) {
                leaveRoom(socket, socket.currentRoom)
            }

            // Join the new room
            socket.join(code)
            socket.currentRoom = code
            socket.role = role

            // Initialize room if it doesn't exist
            if (!rooms[code]) {
                rooms[code] = {
                    host: null,
                    clients: [],
                    lastActivity: Date.now(),
                    screenSize: { width: 1280, height: 720 },
                }
            }

            // Determine if this is host or client
            if (role === "host") {
                // Register as host
                rooms[code].host = socket.id
                socket.isHost = true
                console.log(`${socket.id} joined room ${code} as host`)
                socket.emit("room-joined", { room: code, role: "host" })
            } else {
                // Register as client
                rooms[code].clients.push(socket.id)
                socket.isHost = false
                console.log(`${socket.id} joined room ${code} as client`)
                socket.emit("room-joined", { room: code, role: "client" })

                // Notify host that a client has connected
                if (rooms[code].host) {
                    io.to(rooms[code].host).emit("client-connected", {
                        room: code,
                        clientId: socket.id,
                    })
                }

                // Notify client that a host is available
                if (rooms[code].host) {
                    socket.emit("host-connected", {
                        room: code,
                        hostId: rooms[code].host,
                    })
                }
            }

            console.log(`Room ${code} status:`, rooms[code])
        })

        // Screen Size Update
        socket.on("screen-size", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid screen size data")
                return
            }

            // Store screen size in room
            if (rooms[data.code]) {
                rooms[data.code].screenSize = {
                    width: data.width,
                    height: data.height,
                }

                // Update room activity timestamp
                rooms[data.code].lastActivity = Date.now()

                // Broadcast to clients
                socket.to(data.code).emit("screen-size", {
                    width: data.width,
                    height: data.height,
                })
            }
        })

        // Quality Settings
        socket.on("quality-settings", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid quality settings data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()

                // Broadcast to clients
                socket.to(data.code).emit("quality-settings", {
                    quality: data.quality,
                    frameRate: data.frameRate,
                })
            }
        })

        // Screen Share Stream - optimized for reducing latency
        socket.on("screen-data", (data) => {
            if (!data || !data.code || !data.image) {
                console.log("Error: Invalid screen data received")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward screen data to clients in the room
            // Use volatile for potential frame dropping if needed
            socket.to(data.code).volatile.emit("screen-data", data)
        })

        // Screen data received acknowledgment
        socket.on("screen-data-received", (data) => {
            if (!data || !data.code || !data.frameId) {
                console.log("Error: Invalid screen data acknowledgment")
                return
            }

            // Forward acknowledgment to the host
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).emit("screen-data-received", data)
            }
        })

        // Mouse move event - highest priority
        socket.on("mouse-move", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid mouse move data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host - use volatile to allow dropping packets if needed
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).volatile.emit("mouse-move", data)
            }
        })

        // Mouse click event
        socket.on("mouse-click", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid mouse click data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host - important, so not volatile
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).emit("mouse-click", data)
            }
        })

        // Mouse double click event
        socket.on("mouse-double-click", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid mouse double click data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).emit("mouse-double-click", data)
            }
        })

        // Mouse scroll event
        socket.on("mouse-scroll", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid mouse scroll data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host - can be volatile for smoother experience
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).volatile.emit("mouse-scroll", data)
            }
        })

        // Key press event - important for accurate typing
        socket.on("key-press", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid key press data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host - important to not miss keystrokes
            if (rooms[data.code] && rooms[data.code].host) {
                io.to(rooms[data.code].host).emit("key-press", data)
            }
        })

        // Cursor position updates from host to client
        socket.on("cursor-position", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid cursor position data")
                return
            }

            // Forward to all clients in the room - can be volatile
            socket.to(data.code).volatile.emit("cursor-position", {
                x: data.x,
                y: data.y,
            })
        })

        // Clipboard sharing
        socket.on("clipboard-data", (data) => {
            if (!data || !data.code || !data.text) {
                console.log("Error: Invalid clipboard data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to everyone else in the room
            socket.to(data.code).emit("clipboard-data", {
                text: data.text,
                sender: socket.id,
            })
        })

        // Disconnect Event
        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id)

            // Handle room cleanup if the socket was in a room
            if (socket.currentRoom) {
                leaveRoom(socket, socket.currentRoom)
            }
        })
    })

    // Helper function to handle room leaving logic
    function leaveRoom(socket, roomCode) {
        const room = rooms[roomCode]
        if (!room) return

        if (socket.isHost && room.host === socket.id) {
            // If host is leaving
            room.host = null

            // Notify all clients in the room
            room.clients.forEach((clientId) => {
                io.to(clientId).emit("host-disconnected", { room: roomCode })
            })

            console.log(`Host ${socket.id} left room ${roomCode}`)
        } else {
            // If client is leaving
            const clientIndex = room.clients.indexOf(socket.id)
            if (clientIndex !== -1) {
                room.clients.splice(clientIndex, 1)

                // Notify the host
                if (room.host) {
                    io.to(room.host).emit("client-disconnected", {
                        room: roomCode,
                        clientId: socket.id,
                    })
                }

                console.log(`Client ${socket.id} left room ${roomCode}`)
            }
        }

        // Clean up empty rooms
        if (room.host === null && room.clients.length === 0) {
            delete rooms[roomCode]
            console.log(`Room ${roomCode} deleted (empty)`)
        }

        // Remove current room reference
        socket.currentRoom = null
        socket.isHost = false
    }

    // Set up room cleanup interval (every 30 minutes)
    setInterval(
        () => {
            const now = Date.now()
            const inactiveThreshold = 30 * 60 * 1000 // 30 minutes

            Object.keys(rooms).forEach((roomCode) => {
                const room = rooms[roomCode]
                if (now - room.lastActivity > inactiveThreshold) {
                    // Room is inactive, clean it up
                    if (room.host) {
                        io.to(room.host).emit("room-expired", { room: roomCode })
                    }

                    room.clients.forEach((clientId) => {
                        io.to(clientId).emit("room-expired", { room: roomCode })
                    })

                    delete rooms[roomCode]
                    console.log(`Room ${roomCode} deleted (inactive)`)
                }
            })
        },
        30 * 60 * 1000, // Check every 30 minutes
    )
}

module.exports = socketHandler
