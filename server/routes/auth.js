const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Generate a 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }

        const prisma = req.app.get('prisma');

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email } });
        }

        // Check if user is banned (trust score <= 0)
        if (user.trustScore <= 0) {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }

        // Invalidate old OTPs
        await prisma.oTP.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true }
        });

        // Create new OTP
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.oTP.create({
            data: { code, expiresAt, userId: user.id }
        });

        // In production, send email via nodemailer/SendGrid
        // For dev, log to console
        console.log(`📧 OTP for ${email}: ${code}`);

        res.json({ message: 'OTP sent', email });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }

        const prisma = req.app.get('prisma');

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find valid OTP
        const otp = await prisma.oTP.findFirst({
            where: {
                userId: user.id,
                code,
                used: false,
                expiresAt: { gt: new Date() }
            }
        });

        if (!otp) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Mark OTP as used
        await prisma.oTP.update({
            where: { id: otp.id },
            data: { used: true }
        });

        // Reset daily room count if it's a new day
        const now = new Date();
        const lastReset = new Date(user.lastRoomReset);
        if (now.toDateString() !== lastReset.toDateString()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { roomsUsedToday: 0, lastRoomReset: now }
            });
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
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Failed to verify OTP' });
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
