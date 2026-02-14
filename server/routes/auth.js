const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
            return res.status(400).json({ error: 'Nickname must be 2-20 characters' });
        }

        const prisma = req.app.get('prisma');

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Sanitize nickname
        const cleanName = nickname.trim().replace(/[^\w\s]/g, '').substring(0, 20);
        if (cleanName.length < 2) {
            return res.status(400).json({ error: 'Nickname must contain at least 2 valid characters' });
        }

        // Create user
        const user = await prisma.user.create({
            data: { email, passwordHash, displayName: cleanName }
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                isPremium: user.isPremium,
                roomsUsedToday: user.roomsUsedToday,
                trustScore: user.trustScore
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const prisma = req.app.get('prisma');

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user is banned
        if (user.trustScore <= 0) {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Reset daily room count if new day
        const now = new Date();
        const lastReset = new Date(user.lastRoomReset);
        if (now.toDateString() !== lastReset.toDateString()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { roomsUsedToday: 0, lastRoomReset: now }
            });
            user.roomsUsedToday = 0;
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                isPremium: user.isPremium,
                roomsUsedToday: user.roomsUsedToday,
                trustScore: user.trustScore
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Failed to log in' });
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const prisma = req.app.get('prisma');

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { subscription: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Reset daily room count if new day
        const now = new Date();
        const lastReset = new Date(user.lastRoomReset);
        if (now.toDateString() !== lastReset.toDateString()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { roomsUsedToday: 0, lastRoomReset: now }
            });
            user.roomsUsedToday = 0;
        }

        res.json({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isPremium: user.isPremium,
            roomsUsedToday: user.roomsUsedToday,
            trustScore: user.trustScore,
            subscription: user.subscription
        });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// POST /api/auth/set-nickname
router.post('/set-nickname', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const prisma = req.app.get('prisma');

        const { nickname } = req.body;
        if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
            return res.status(400).json({ error: 'Nickname must be 2-20 characters' });
        }

        // Sanitize: allow letters, numbers, spaces, underscores
        const clean = nickname.trim().replace(/[^\w\s]/g, '').substring(0, 20);
        if (clean.length < 2) {
            return res.status(400).json({ error: 'Nickname must contain at least 2 valid characters' });
        }

        const user = await prisma.user.update({
            where: { id: decoded.userId },
            data: { displayName: clean }
        });

        res.json({
            message: 'Nickname set',
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                isPremium: user.isPremium
            }
        });
    } catch (err) {
        console.error('Set nickname error:', err);
        res.status(500).json({ error: 'Failed to set nickname' });
    }
});

module.exports = router;
