const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');

const onlineUsers = new Map(); // userId -> { socketId, username, avatar }

module.exports = (io) => {
    // Authenticate socket connection
    io.use(async(socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication required'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user) return next(new Error('User not found'));

            socket.user = user;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async(socket) => {
        const user = socket.user;

        // Mark user online
        onlineUsers.set(user._id.toString(), {
            socketId: socket.id,
            username: user.username,
            avatar: user.avatar,
        });

        await User.findByIdAndUpdate(user._id, { isOnline: true });
        io.emit('user:online', { userId: user._id, username: user.username });

        // Join a room
        socket.on('room:join', async({ roomId }) => {
            try {
                const room = await Room.findById(roomId);
                if (!room) return socket.emit('error', { message: 'Room not found' });

                socket.join(roomId);

                // Notify others in room
                socket.to(roomId).emit('room:user_joined', {
                    userId: user._id,
                    username: user.username,
                    roomId,
                });

                // Send system message
                const systemMsg = new Message({
                    content: `${user.username} joined the room`,
                    sender: user._id,
                    room: roomId,
                    type: 'system',
                });
                await systemMsg.save();
                await systemMsg.populate('sender', 'username avatar');
                io.to(roomId).emit('message:new', systemMsg);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // Leave a room
        socket.on('room:leave', async({ roomId }) => {
            socket.leave(roomId);
            socket.to(roomId).emit('room:user_left', {
                userId: user._id,
                username: user.username,
                roomId,
            });

            const systemMsg = new Message({
                content: `${user.username} left the room`,
                sender: user._id,
                room: roomId,
                type: 'system',
            });
            await systemMsg.save();
            await systemMsg.populate('sender', 'username avatar');
            io.to(roomId).emit('message:new', systemMsg);
        });

        // Send message
        socket.on('message:send', async({ roomId, content }) => {
            try {
                if (!content ? .trim()) return;

                const message = new Message({ content: content.trim(), sender: user._id, room: roomId });
                await message.save();
                await message.populate('sender', 'username avatar');

                io.to(roomId).emit('message:new', message);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // Typing indicator
        socket.on('typing:start', ({ roomId }) => {
            socket.to(roomId).emit('typing:update', { userId: user._id, username: user.username, isTyping: true });
        });

        socket.on('typing:stop', ({ roomId }) => {
            socket.to(roomId).emit('typing:update', { userId: user._id, username: user.username, isTyping: false });
        });

        // Disconnect
        socket.on('disconnect', async() => {
            onlineUsers.delete(user._id.toString());
            await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen: new Date() });
            io.emit('user:offline', { userId: user._id, username: user.username });
        });
    });
};