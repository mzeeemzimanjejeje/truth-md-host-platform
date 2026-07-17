// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Initialize Express
const app = express();

// Basic Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: 'admin',
  serverSelectionTimeoutMS: 10000,
})
.then(async () => {
  console.log('MongoDB Connected');

  // ── Seed admin account ───────────────────────────────────────────────────
  const User = require('./models/User');
  const existing = await User.findOne({ username: process.env.ADMIN_USERNAME });
  if (!existing) {
    await User.create({
      username: process.env.ADMIN_USERNAME,
      email: 'admin@truthhost.local',
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      isEmailVerified: true,
      wallet: { coins: 6000000 }
    });
    console.log('Admin account created with 6,000,000 coins');
  } else if (existing.wallet.coins === 0) {
    await User.updateOne({ _id: existing._id }, { $set: { 'wallet.coins': 6000000 } });
    console.log('Admin wallet initialised to 6,000,000 coins');
  }

  // ── Auto-restart bots that were active before last shutdown ─────────────
  const Deployment  = require('./models/Deployment');
  const botManager  = require('./services/botManager');
  const fs          = require('fs');

  const activeBots = await Deployment.find({ status: 'active', repoUrl: { $exists: true, $ne: null } });

  if (activeBots.length > 0) {
    console.log(`Auto-restarting ${activeBots.length} bot(s)...`);
    for (const deployment of activeBots) {
      const id  = deployment._id.toString();
      const dir = botManager.botDir(id);

      if (!fs.existsSync(dir)) {
        console.warn(`  [SKIP] ${deployment.branchName} — bot files missing, marking inactive`);
        await Deployment.updateOne({ _id: deployment._id }, { $set: { status: 'inactive' } });
        continue;
      }

      try {
        await botManager.startBot(deployment, (msg, level) => {
          botManager.pushLog(id, msg, level);
        });
        console.log(`  [OK] ${deployment.branchName} restarted`);
      } catch (err) {
        console.error(`  [FAIL] ${deployment.branchName}: ${err.message}`);
        await Deployment.updateOne({ _id: deployment._id }, { $set: { status: 'inactive' } });
      }
    }
    console.log('Auto-restart complete.');
  }
})
.catch(err => console.error('MongoDB Connection Error:', err.message));

// Route Imports (must be after middleware but before error handling)
const authRouter = require('./routes/auth');
const deploymentsRouter = require('./routes/deployments');
const walletRouter = require('./routes/wallet');
const adminRouter = require('./routes/admin');

// Route Middleware
app.use('/api/auth', authRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/admin', adminRouter);

// Serve Frontend (must be after API routes)
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Error Handling (must be last middleware)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin access: ${process.env.ADMIN_USERNAME}`);
});
