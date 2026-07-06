require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
// Allow one or more comma-separated origins (e.g. local dev + deployed frontend).
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

socketHandler(io);

// Connect to MongoDB. If MONGODB_URI is missing or still holds the Atlas
// password placeholder, fall back to an in-memory MongoDB so the app is
// fully usable for development. Swap in a real Atlas URI to persist data.
async function start() {
    let uri = process.env.MONGODB_URI;
    const needsFallback = !uri || uri.includes('<db_password>') || process.env.USE_MEMORY_DB === 'true';

    if (needsFallback) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mem = await MongoMemoryServer.create();
        uri = mem.getUri();
        console.warn(
            '⚠  No persistent MongoDB configured — using in-memory database.\n' +
            '   Data resets when the server restarts. Set MONGODB_URI in server/.env to persist.'
        );
    }

    try {
        await mongoose.connect(uri);
        console.log(`Connected to MongoDB${needsFallback ? ' (in-memory)' : ''}`);
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

start();