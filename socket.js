const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join Room by Code
        socket.on('join-room', (code) => {
            socket.join(code);
            console.log(`${socket.id} joined room: ${code}`);
        });

        // Screen Share Stream
        socket.on('screen-data', (data) => {
            socket.to(data.code).emit('screen-data', data);
        });

        // Mouse Move
        socket.on('mouse-move', (data) => {
            socket.to(data.code).emit('mouse-move', data);
        });

        // Mouse Click
        socket.on('mouse-click', (data) => {
            socket.to(data.code).emit('mouse-click', data);
        });

        // Key Press
        socket.on('key-press', (data) => {
            socket.to(data.code).emit('key-press', data);
        });

        // Clipboard Sharing
        socket.on('clipboard-copy', (data) => {
            socket.to(data.code).emit('clipboard-copy', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};

module.exports = socketHandler;
