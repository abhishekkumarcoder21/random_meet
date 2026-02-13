const jwt = require('jsonwebtoken');

function setupSocketHandlers(io, prisma) {
    // Active room timers
    const roomTimers = new Map();

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.userId}`);

        // Join a room's socket channel
        socket.on('join-room', async ({ roomId }) => {
            try {
                const room = await prisma.room.findUnique({
                    where: { id: roomId },
                    include: {
                        participants: { select: { alias: true, userId: true } },
                        messages: {
                            orderBy: { createdAt: 'asc' },
                            take: 50,
                            include: { user: { select: { id: true } } }
                        }
                    }
                });

                if (!room) return;

                const participant = room.participants.find(p => p.userId === socket.userId);
                if (!participant) return;

                socket.join(roomId);
                socket.roomId = roomId;
                socket.alias = participant.alias;

                // Send room state to the joining user
                socket.emit('room-state', {
                    participants: room.participants.map(p => ({
                        alias: p.alias,
                        isMe: p.userId === socket.userId
                    })),
                    messages: room.messages.map(m => ({
                        id: m.id,
                        content: m.content,
                        alias: room.participants.find(p => p.userId === m.userId)?.alias || 'Unknown',
                        isMe: m.userId === socket.userId,
                        createdAt: m.createdAt
                    })),
                    status: room.status,
                    startedAt: room.startedAt,
                    durationMinutes: room.durationMinutes
                });

                // Notify others in room
                socket.to(roomId).emit('user-joined', {
                    alias: participant.alias,
                    participantCount: room.participants.length
                });

                // Start room timer if room is active and timer not running
                if (room.status === 'active' && !roomTimers.has(roomId)) {
                    startRoomTimer(roomId, room.durationMinutes, room.startedAt);
                }
            } catch (err) {
                console.error('Join room socket error:', err);
            }
        });

        // Send a message
        socket.on('send-message', async ({ roomId, content }) => {
            try {
                if (!content || content.trim().length === 0 || content.length > 500) return;

                const room = await prisma.room.findUnique({ where: { id: roomId } });
                if (!room || room.status === 'closed') return;

                // Rate limit: max 1 message per second per user (simple in-memory check)
                const now = Date.now();
                if (socket.lastMessageAt && now - socket.lastMessageAt < 1000) {
                    socket.emit('error-message', { error: 'Sending too fast. Please slow down.' });
                    return;
                }
                socket.lastMessageAt = now;

                // Anti-spam: check for duplicate messages
                if (socket.lastMessage === content.trim()) {
                    socket.emit('error-message', { error: 'Duplicate message detected.' });
                    return;
                }
                socket.lastMessage = content.trim();

                const message = await prisma.message.create({
                    data: {
                        content: content.trim(),
                        userId: socket.userId,
                        roomId
                    }
                });

                io.to(roomId).emit('new-message', {
                    id: message.id,
                    content: message.content,
                    alias: socket.alias,
                    isMe: false,
                    createdAt: message.createdAt
                });
            } catch (err) {
                console.error('Send message error:', err);
            }
        });

        // Send a reaction (emoji)
        socket.on('send-reaction', ({ roomId, emoji }) => {
            const allowedEmojis = ['❤️', '👏', '🤗', '💡', '😊', '🎯'];
            if (!allowedEmojis.includes(emoji)) return;

            socket.to(roomId).emit('reaction', {
                alias: socket.alias,
                emoji
            });
        });

        // Handle disconnect
        socket.on('disconnect', async () => {
            console.log(`🔌 User disconnected: ${socket.userId}`);
            if (socket.roomId) {
                socket.to(socket.roomId).emit('user-left', {
                    alias: socket.alias
                });
            }
        });
    });

    // Room timer management
    function startRoomTimer(roomId, durationMinutes, startedAt) {
        const startTime = new Date(startedAt).getTime();
        const endTime = startTime + durationMinutes * 60 * 1000;
        const warningTime = endTime - 30000; // 30 seconds before end

        // Warning at 30 seconds remaining
        const warningDelay = warningTime - Date.now();
        if (warningDelay > 0) {
            setTimeout(() => {
                io.to(roomId).emit('room-warning', {
                    message: '30 seconds remaining',
                    secondsLeft: 30
                });
            }, warningDelay);
        }

        // End room
        const endDelay = endTime - Date.now();
        if (endDelay > 0) {
            const timer = setTimeout(async () => {
                await closeRoom(roomId);
            }, endDelay);
            roomTimers.set(roomId, timer);
        } else {
            // Room already expired
            closeRoom(roomId);
        }
    }

    async function closeRoom(roomId) {
        try {
            await prisma.room.update({
                where: { id: roomId },
                data: { status: 'closed', closedAt: new Date() }
            });

            io.to(roomId).emit('room-ended', {
                message: 'This room has ended. Thank you for being here.',
                prompt: 'How did this experience make you feel?'
            });

            // Increase trust score for all participants who stayed
            const participants = await prisma.roomParticipant.findMany({
                where: { roomId }
            });
            for (const p of participants) {
                await prisma.user.update({
                    where: { id: p.userId },
                    data: { trustScore: { increment: 1 } }
                });
            }

            roomTimers.delete(roomId);

            // Clear the room from all sockets
            const sockets = await io.in(roomId).fetchSockets();
            for (const s of sockets) {
                s.leave(roomId);
            }
        } catch (err) {
            console.error('Close room error:', err);
        }
    }
}

module.exports = { setupSocketHandlers };
