const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const apiRoutes = require('./routes/api');
const { seedInitialData } = require('./seedData');

const app = express();
const PORT = process.env.PORT || 5000;

// High-performance Middleware
app.use(compression()); // Gzip compression reduces network payload by 75%
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Strict limit prevents memory bloat
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint for Render.com Keep-Alive / UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString(), memoryUsage: process.memoryUsage().rss });
});

// Mount API Routes
app.use('/api', apiRoutes);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '../public')));

// Fallback routing for SPA / Multi-page navigation
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize database and start server
async function startServer() {
  await seedInitialData();
  app.listen(PORT, () => {
    console.log(`
============================================================
🚀 AFFILIATE EMPIRE BHARAT PLATFORM LIVE!
🌐 Server URL: http://localhost:${PORT}
📱 Mobile-Friendly User Dashboard: http://localhost:${PORT}/dashboard
👑 Master Admin Control Center: http://localhost:${PORT}/admin
⚡ Instant 60% Commission & UPI QR Payment Engine Active
============================================================
    `);
  });
}

startServer();
