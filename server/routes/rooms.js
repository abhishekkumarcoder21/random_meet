const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const FREE_ROOM_LIMIT = 3;
const PREMIUM_ROOM_LIMIT = 15;

const ALIASES = [
    'Wanderer', 'Dreamer', 'Explorer', 'Stargazer', 'Firefly',
    'Moonbeam', 'Drifter', 'Echo', 'Spark', 'Breeze',
    'Ripple', 'Ember', 'Fern', 'Pebble', 'Cloud',
    'Horizon', 'Meadow', 'Lantern', 'River', 'Harbor'
];

function getRandomAlias() {
    return ALIASES[Math.floor(Math.random() * ALIASES.length)];
}

// GET /api/rooms — list available rooms
router.get('/', authMiddleware, async (req, res) => {
    try {
        const prisma = req.app.get('prisma');
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        // Debug: count all rooms
        const totalRooms = await prisma.room.count();
        const waitingRooms = await prisma.room.count({ where: { status: 'waiting' } });
        const activeRooms = await prisma.room.count({ where: { status: 'active' } });
        console.log(`📊 Rooms in DB: total=${totalRooms}, waiting=${waitingRooms}, active=${activeRooms}`);

        const rooms = await prisma.room.findMany({
            where: { status: { in: ['waiting', 'active'] } },
            include: {
                participants: { select: { alias: true } },
                _count: { select: { participants: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`📋 Rooms returned: ${rooms.length}`);

        const roomLimit = user.isPremium ? PREMIUM_ROOM_LIMIT : FREE_ROOM_LIMIT;
        const roomsRemaining = Math.max(0, roomLimit - user.roomsUsedToday);

        res.json({
            rooms: rooms.map(r => ({
                id: r.id,
                type: r.type,
                title: r.title,
                prompt: r.prompt,
                rules: r.rules,
                maxParticipants: r.maxParticipants,
                currentParticipants: r._count.participants,
                durationMinutes: r.durationMinutes,
                status: r.status,
                isPremium: r.isPremium,
                participants: r.participants.map(p => p.alias)
            })),
            user: {
                roomsUsedToday: user.roomsUsedToday,
                roomLimit,
                roomsRemaining,
                isPremium: user.isPremium,
                displayName: user.displayName
            }
        });
    } catch (err) {
        console.error('List rooms error:', err);
        res.status(500).json({ error: 'Failed to list rooms' });
    }
});

// POST /api/rooms/join/:id — join a room
router.post('/join/:id', authMiddleware, async (req, res) => {
    try {
        const prisma = req.app.get('prisma');
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        // Check daily limit
        const roomLimit = user.isPremium ? PREMIUM_ROOM_LIMIT : FREE_ROOM_LIMIT;

        // Reset daily count if new day
        const now = new Date();
        const lastReset = new Date(user.lastRoomReset);
        if (now.toDateString() !== lastReset.toDateString()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { roomsUsedToday: 0, lastRoomReset: now }
            });
            user.roomsUsedToday = 0;
        }

        if (user.roomsUsedToday >= roomLimit) {
            return res.status(429).json({
                error: 'Daily room limit reached',
                upgrade: !user.isPremium
            });
        }

        // Check room exists and is joinable
        const room = await prisma.room.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { participants: true } } }
        });

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.status === 'closed' || room.status === 'ending') {
            return res.status(400).json({ error: 'Room is no longer available' });
        }

        // Check premium access
        if (room.isPremium && !user.isPremium) {
            return res.status(403).json({
                error: 'Premium room — upgrade to access',
                upgrade: true
            });
        }

        // Check capacity
        if (room._count.participants >= room.maxParticipants) {
            return res.status(400).json({ error: 'Room is full' });
        }

        // Check if already in room
        const existing = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId: user.id, roomId: room.id } }
        });

        if (existing) {
            return res.json({ message: 'Already in room', alias: existing.alias, roomId: room.id });
        }

        // Create participant — use user's nickname or fallback to random alias
        const alias = user.displayName || getRandomAlias();
        await prisma.roomParticipant.create({
            data: { userId: user.id, roomId: room.id, alias }
        });

        // Increment daily usage
        await prisma.user.update({
            where: { id: user.id },
            data: { roomsUsedToday: { increment: 1 } }
        });

        // Check if room should start
        const updatedCount = room._count.participants + 1;
        if (updatedCount >= 2 && room.status === 'waiting') {
            await prisma.room.update({
                where: { id: room.id },
                data: { status: 'active', startedAt: new Date() }
            });
        }

        res.json({
            message: 'Joined room',
            alias,
            roomId: room.id,
            roomType: room.type,
            prompt: room.prompt,
            rules: room.rules,
            durationMinutes: room.durationMinutes
        });
    } catch (err) {
        console.error('Join room error:', err);
        res.status(500).json({ error: 'Failed to join room' });
    }
});

// GET /api/rooms/:id — get room details
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const prisma = req.app.get('prisma');
        const room = await prisma.room.findUnique({
            where: { id: req.params.id },
            include: {
                participants: { select: { alias: true, userId: true } },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 100,
                    include: {
                        user: { select: { id: true } }
                    }
                }
            }
        });

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Find current user's alias
        const myParticipant = room.participants.find(p => p.userId === req.userId);

        res.json({
            id: room.id,
            type: room.type,
            title: room.title,
            prompt: room.prompt,
            rules: room.rules,
            maxParticipants: room.maxParticipants,
            durationMinutes: room.durationMinutes,
            status: room.status,
            startedAt: room.startedAt,
            participants: room.participants.map(p => ({
                alias: p.alias,
                isMe: p.userId === req.userId
            })),
            messages: room.messages.map(m => ({
                id: m.id,
                content: m.content,
                alias: room.participants.find(p => p.userId === m.userId)?.alias || 'Unknown',
                isMe: m.userId === req.userId,
                createdAt: m.createdAt
            })),
            myAlias: myParticipant?.alias
        });
    } catch (err) {
        console.error('Get room error:', err);
        res.status(500).json({ error: 'Failed to get room' });
    }
});

module.exports = router;
