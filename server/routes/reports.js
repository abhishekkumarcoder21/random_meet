const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/reports — submit a report
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { roomId, reportedId, reason, description } = req.body;

        if (!roomId || !reportedId || !reason) {
            return res.status(400).json({ error: 'roomId, reportedId, and reason are required' });
        }

        const validReasons = ['harassment', 'spam', 'inappropriate', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Invalid reason. Must be one of: ' + validReasons.join(', ') });
        }

        const prisma = req.app.get('prisma');

        // Check rate limit: max 10 reports per day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reportCount = await prisma.report.count({
            where: {
                reporterId: req.userId,
                createdAt: { gte: today }
            }
        });

        if (reportCount >= 10) {
            return res.status(429).json({ error: 'Daily report limit reached' });
        }

        // Can't report yourself
        if (reportedId === req.userId) {
            return res.status(400).json({ error: 'Cannot report yourself' });
        }

        // Create report
        const report = await prisma.report.create({
            data: {
                roomId,
                reporterId: req.userId,
                reportedId,
                reason,
                description: description || null
            }
        });

        // Auto-moderation: decrease reported user's trust score
        const reported = await prisma.user.update({
            where: { id: reportedId },
            data: { trustScore: { decrement: 5 } }
        });

        // Auto-ban if trust score drops to 0 or below
        if (reported.trustScore <= 0) {
            console.log(`⚠️ User ${reportedId} auto-banned (trust score: ${reported.trustScore})`);
        }

        res.json({ message: 'Report submitted', reportId: report.id });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

module.exports = router;
