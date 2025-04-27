// const socketHandler = (io) => {
//     io.on('connection', (socket) => {
//         console.log('New client connected:', socket.id);

//         // Join Room by Code
//         socket.on('join-room', (code) => {
//             socket.join(code);
//             console.log(`${socket.id} joined room: ${code}`);
//         });

//         // Screen Share Stream
//         socket.on('screen-data', (data) => {
//             socket.to(data.code).emit('screen-data', data);
//         });

//         // Mouse Move
//         socket.on('mouse-move', (data) => {
//             socket.to(data.code).emit('mouse-move', data);
//         });

//         // Mouse Click
//         socket.on('mouse-click', (data) => {
//             socket.to(data.code).emit('mouse-click', data);
//         });

//         // Key Press
//         socket.on('key-press', (data) => {
//             socket.to(data.code).emit('key-press', data);
//         });

//         // Clipboard Sharing
//         socket.on('clipboard-copy', (data) => {
//             socket.to(data.code).emit('clipboard-copy', data);
//         });

//         socket.on('disconnect', () => {
//             console.log('Client disconnected:', socket.id);
//         });
//     });
// };

// module.exports = socketHandler;


const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join Room by Code
        socket.on('join-room', (code) => {
            if (!code) {
                console.log('Error: Missing room code for join');
                return;
            }
            socket.join(code);
            console.log(`${socket.id} joined room: ${code}`);
        });

        // Screen Share Stream
        socket.on('screen-data', (data) => {
            if (!data || !data.code || !data.image) {
                console.log('Error: Invalid screen data received', data);
                return;
            }

            console.log(`Received screen data for room: ${JSON.stringify(data)}`);
            socket.to(data.code).emit('screen-data', data);
        });

        // Mouse Move
        socket.on('mouse-move', (data) => {
            if (!data || !data.code || typeof data.x !== 'number' || typeof data.y !== 'number') {
                console.log('Error: Invalid mouse move data received', data);
                return;
            }

            console.log(`Mouse move event received for room: ${data.code}`);
            socket.to(data.code).emit('mouse-move', data);
        });

        // Mouse Click
        socket.on('mouse-click', (data) => {
            if (!data || !data.code || typeof data.x !== 'number' || typeof data.y !== 'number') {
                console.log('Error: Invalid mouse click data received', data);
                return;
            }

            console.log(`Mouse click event received for room: ${data.code}`);
            socket.to(data.code).emit('mouse-click', data);
        });

        // Key Press
        socket.on('key-press', (data) => {
            if (!data || !data.code || !data.key) {
                console.log('Error: Invalid key press data received', data);
                return;
            }

            console.log(`Key press event received for room: ${data.code}`);
            socket.to(data.code).emit('key-press', data);
        });

        // Clipboard Sharing
        socket.on('clipboard-copy', (data) => {
            if (!data || !data.code || !data.text) {
                console.log('Error: Invalid clipboard data received', data);
                return;
            }

            console.log(`Clipboard copy event received for room: ${data.code}`);
            socket.to(data.code).emit('clipboard-copy', data);
        });

        // Disconnect Event
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};

module.exports = socketHandler;
