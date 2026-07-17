require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { pool, initSchema } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

// ── Boot sequence ─────────────────────────────────────────────────
async function boot() {
    // 1. Create tables if they don't exist
    await initSchema();

    // 2. Seed admin account
    const User = require('./models/User');
    const existing = await User.findOne({ username: process.env.ADMIN_USERNAME });
    if (!existing) {
        await User.create({
            username:        process.env.ADMIN_USERNAME,
            email:           'admin@truthhost.local',
            password:        process.env.ADMIN_PASSWORD,
            role:            'admin',
            isEmailVerified: true,
            wallet:          { coins: 6000000 }
        });
        console.log('Admin account created with 6,000,000 coins');
    } else if (existing.wallet.coins === 0) {
        existing.wallet.coins = 6000000;
        await User.save(existing);
        console.log('Admin wallet initialised to 6,000,000 coins');
    }

    // 3. Auto-restart bots that were active before last shutdown
    const Deployment = require('./models/Deployment');
    const botManager = require('./services/botManager');
    const fs         = require('fs');

    const activeBots = await Deployment.find({
        status:  'active',
        repoUrl: { $exists: true, $ne: null }
    });

    if (activeBots.length > 0) {
        console.log(`Auto-restarting ${activeBots.length} bot(s)...`);
        for (const deployment of activeBots) {
            const id  = deployment.id;
            const dir = botManager.botDir(id);

            if (!fs.existsSync(dir)) {
                console.warn(`  [SKIP] ${deployment.branchName} — bot files missing, marking inactive`);
                deployment.status = 'inactive';
                await Deployment.save(deployment);
                continue;
            }
            try {
                await botManager.startBot(deployment, (msg, level) => botManager.pushLog(id, msg, level));
                console.log(`  [OK] ${deployment.branchName} restarted`);
            } catch (err) {
                console.error(`  [FAIL] ${deployment.branchName}: ${err.message}`);
                deployment.status = 'inactive';
                await Deployment.save(deployment);
            }
        }
        console.log('Auto-restart complete.');
    }
}

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/deployments', require('./routes/deployments'));
app.use('/api/wallet',      require('./routes/wallet'));
app.use('/api/admin',       require('./routes/admin'));

// ── Frontend ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    try {
        await boot();
    } catch (err) {
        console.error('Boot error:', err.message);
    }
});

// ── Graceful shutdown ─────────────────────────────────────────────
function gracefulShutdown(signal) {
    console.log(`\n${signal} received — shutting down...`);
    server.close(async () => {
        try {
            const botManager = require('./services/botManager');
            const Deployment = require('./models/Deployment');
            const bots = await Deployment.find({ status: 'active' });
            bots.forEach(d => { try { botManager.stopBot(d.id); } catch (_) {} });
            console.log(`Stopped ${bots.length} bot(s). Exiting.`);
        } catch (_) {}
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
