require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const reportRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');
const { setupSocketHandlers } = require('./socket/roomHandler');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Parse allowed origins from FRONTEND_URL (supports comma-separated values)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(url => url.trim().replace(/\/+$/, '')); // strip trailing slashes

console.log('🌐 Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Make prisma available in routes
app.set('prisma', prisma);
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins
  });
});



// Socket.io handlers
setupSocketHandlers(io, prisma);

// Room auto-creation: ensure rooms are always available
async function ensureRoomsAvailable() {
  const roomTemplates = [
    { type: 'quick-chat', title: 'Quick Chat', maxParticipants: 2, durationMinutes: 5, isPremium: false, prompt: 'Have a genuine 5-minute conversation with a stranger. No pressure, just be yourself.' },
    { type: 'group-prompt', title: 'Group Prompt', maxParticipants: 5, durationMinutes: 10, isPremium: false, prompt: null },
    { type: 'confession', title: 'Confession Room', maxParticipants: 6, durationMinutes: 3, isPremium: false, prompt: 'Share something anonymously. No judgement here.' },
    { type: 'task-collab', title: 'Two Strangers, One Task', maxParticipants: 2, durationMinutes: 8, isPremium: false, prompt: null },
    { type: 'listening-circle', title: 'Listening Circle', maxParticipants: 4, durationMinutes: 7, isPremium: false, prompt: 'One person shares, others listen and support with reactions.' },
  ];

  const groupPrompts = [
    "What's something you believed as a kid that turned out to be hilariously wrong?",
    "If you could have dinner with any person (alive or dead), who would it be and why?",
    "What's the best piece of advice you've ever received?",
    "Describe your perfect day from morning to night.",
    "What's a skill you wish you had learned earlier in life?",
    "If you could live in any era, which would you choose?",
    "What's the most spontaneous thing you've ever done?",
    "What does 'home' mean to you?",
  ];

  const taskPrompts = [
    "Write a 4-line poem together — each person writes 2 lines alternately.",
    "Come up with a name and concept for a fictional café together.",
    "Create a short story where each person writes one sentence at a time.",
    "Design your dream treehouse together — describe what it would have.",
    "Plan a perfect road trip itinerary together in 8 minutes.",
  ];

  for (const template of roomTemplates) {
    const waitingCount = await prisma.room.count({
      where: { type: template.type, status: 'waiting' }
    });

    if (waitingCount < 2) {
      const roomsToCreate = 2 - waitingCount;
      for (let i = 0; i < roomsToCreate; i++) {
        let prompt = template.prompt;
        if (template.type === 'group-prompt') {
          prompt = groupPrompts[Math.floor(Math.random() * groupPrompts.length)];
        } else if (template.type === 'task-collab') {
          prompt = taskPrompts[Math.floor(Math.random() * taskPrompts.length)];
        }
        await prisma.room.create({
          data: { ...template, prompt, rules: 'Be respectful. No personal info sharing. Listen actively. Have fun!' }
        });
      }
    }
  }
}

// Run room availability check every 30 seconds
setInterval(ensureRoomsAvailable, 30000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`🚀 Random Meeting server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  await ensureRoomsAvailable();
  console.log('✅ Initial rooms created');
});
