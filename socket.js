// Track rooms and connections
const rooms = {}

// Create separate namespaces for control and screen data
const socketHandler = (io) => {
    // Control namespace - optimized for low latency
    const controlNamespace = io.of("/control")

    // Screen namespace - optimized for bandwidth
    const screenNamespace = io.of("/screen")

    // Control socket handlers
    controlNamespace.on("connection", (socket) => {
        console.log("New control client connected:", socket.id)

        // Join Room by Code
        socket.on("join-room", (data) => {
            const { code, role } = data

            if (!code) {
                console.log("Error: Missing room code for join")
                return
            }

            // Leave previous rooms if any
            if (socket.currentRoom) {
                leaveRoom(socket, socket.currentRoom, controlNamespace, screenNamespace)
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
                }
            }

            // Determine if this is host or client based on role
            if (role === "host") {
                rooms[code].host = socket.id
                socket.isHost = true
                console.log(`${socket.id} joined room ${code} as host`)
                socket.emit("room-joined", { room: code, role: "host" })

                // Notify all clients in the room that a host has connected
                rooms[code].clients.forEach((clientId) => {
                    controlNamespace.to(clientId).emit("host-connected", {
                        room: code,
                        hostId: socket.id,
                    })
                })
            } else {
                // Client connection
                rooms[code].clients.push(socket.id)
                socket.isHost = false
                console.log(`${socket.id} joined room ${code} as client`)
                socket.emit("room-joined", { room: code, role: "client" })

                // Notify host that a client has connected
                if (rooms[code].host) {
                    controlNamespace.to(rooms[code].host).emit("client-connected", {
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

        // Mouse move event
        socket.on("mouse-move", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid mouse move data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host
            if (rooms[data.code] && rooms[data.code].host) {
                controlNamespace.to(rooms[data.code].host).emit("mouse-move", data)
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

            // Forward to the host
            if (rooms[data.code] && rooms[data.code].host) {
                controlNamespace.to(rooms[data.code].host).emit("mouse-click", data)
            }
        })

        // Key press event
        socket.on("key-press", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid key press data")
                return
            }

            // Update room activity timestamp
            if (rooms[data.code]) {
                rooms[data.code].lastActivity = Date.now()
            }

            // Forward to the host
            if (rooms[data.code] && rooms[data.code].host) {
                controlNamespace.to(rooms[data.code].host).emit("key-press", data)
            }
        })

        // Cursor position updates from host to client
        socket.on("cursor-position", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid cursor position data")
                return
            }

            // Forward to all clients in the room
            if (rooms[data.code]) {
                socket.to(data.code).emit("cursor-position", {
                    x: data.x,
                    y: data.y,
                })
            }
        })

        // Screen dimensions from host to client
        socket.on("screen-dimensions", (data) => {
            if (!data || !data.code) {
                console.log("Error: Invalid screen dimensions data")
                return
            }

            // Forward to all clients in the room
            if (rooms[data.code]) {
                socket.to(data.code).emit("screen-dimensions", {
                    width: data.width,
                    height: data.height,
                })
            }
        })

        // Screen data received acknowledgment
        socket.on("screen-data-received", (data) => {
            if (!data || !data.code || !data.frameId) {
                console.log("Error: Invalid screen data acknowledgment")
                return
            }

            // Forward acknowledgment to the host
            if (rooms[data.code] && rooms[data.code].host) {
                controlNamespace.to(rooms[data.code].host).emit("screen-data-received", data)
            }
        })

        // Disconnect Event
        socket.on("disconnect", () => {
            console.log("Control client disconnected:", socket.id)

            // Handle room cleanup if the socket was in a room
            if (socket.currentRoom) {
                leaveRoom(socket, socket.currentRoom, controlNamespace, screenNamespace)
            }
        })
    })

    // Screen socket handlers
    screenNamespace.on("connection", (socket) => {
        console.log("New screen client connected:", socket.id)

        // Join Room by Code
        socket.on("join-room", (data) => {
            const { code, role } = data

            if (!code) {
                console.log("Error: Missing room code for join")
                return
            }

            // Join the new room
            socket.join(code)
            socket.currentRoom = code
            socket.role = role

            console.log(`Screen socket ${socket.id} joined room ${code} as ${role}`)
        })

        // Screen Share Stream
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
            socket.to(data.code).emit("screen-data", data)
        })

        // Disconnect Event
        socket.on("disconnect", () => {
            console.log("Screen client disconnected:", socket.id)
            socket.currentRoom = null
        })
    })

    // Helper function to handle room leaving logic
    function leaveRoom(socket, roomCode, controlNs, screenNs) {
        const room = rooms[roomCode]
        if (!room) return

        if (socket.isHost && room.host === socket.id) {
            // If host is leaving
            room.host = null

            // Notify all clients in the room
            room.clients.forEach((clientId) => {
                controlNs.to(clientId).emit("host-disconnected", { room: roomCode })
            })

            console.log(`Host ${socket.id} left room ${roomCode}`)
        } else {
            // If client is leaving
            const clientIndex = room.clients.indexOf(socket.id)
            if (clientIndex !== -1) {
                room.clients.splice(clientIndex, 1)

                // Notify the host
                if (room.host) {
                    controlNs.to(room.host).emit("client-disconnected", {
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
                        controlNamespace.to(room.host).emit("room-expired", { room: roomCode })
                    }

                    room.clients.forEach((clientId) => {
                        controlNamespace.to(clientId).emit("room-expired", { room: roomCode })
                    })

                    delete rooms[roomCode]
                    console.log(`Room ${roomCode} deleted (inactive)`)
                }
            })
        },
        30 * 60 * 1000,
    ) // Check every 30 minutes
}

module.exports = socketHandler
