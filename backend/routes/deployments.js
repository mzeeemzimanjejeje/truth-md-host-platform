const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Deployment = require('../models/Deployment');
const User       = require('../models/User');
const botManager = require('../services/botManager');

// Helper: save a log entry to DB
async function dbLog(deployment, message, level = 'info') {
    deployment.logs.unshift({ message, level, timestamp: new Date() });
    if (deployment.logs.length > 100) deployment.logs = deployment.logs.slice(0, 100);
    await deployment.save();
}

// @route   POST api/deployments
router.post('/', [auth, [
    check('branchName', 'Service name is required').not().isEmpty(),
    check('sessionId',   'SESSION_ID is required').not().isEmpty(),
    check('ownerNumber', 'OWNER_NUMBER is required').not().isEmpty()
]], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { branchName, sessionId, ownerNumber, prefix, repoUrl } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (user.wallet.coins < 10)
            return res.status(400).json({ msg: 'Not enough coins. Each deployment costs 10 coins.' });

        const exists = await Deployment.findOne({ branchName });
        if (exists) return res.status(400).json({ msg: 'Service name already in use' });

        // Create deployment record first to get an ID
        const deployment = new Deployment({
            user:   req.user.id,
            branchName,
            sessionId,
            ownerNumber,
            prefix: prefix || '.',
            repoUrl: repoUrl || null,
            status:  'pending',
            logs: [{ message: `Deployment "${branchName}" created.`, level: 'info' }]
        });

        // Deduct coins
        user.wallet.coins -= 10;
        user.wallet.transactions.unshift({
            type: 'spent', amount: 10,
            description: `Bot deployed: ${branchName}`, category: 'deployment'
        });
        if (user.wallet.transactions.length > 50) user.wallet.transactions.pop();
        await user.save();
        await deployment.save();

        // Clone + detect + install + start (async — don't block response)
        const id = deployment._id.toString();
        (async () => {
            const log = (msg, level = 'info') => {
                botManager.pushLog(id, msg, level);
                dbLog(deployment, msg, level).catch(() => {});
            };

            try {
                if (repoUrl) {
                    const { framework, entryPoint } = await botManager.cloneRepo(repoUrl, id, log);
                    deployment.detectedFramework = framework;
                    deployment.entryPoint        = entryPoint;
                    await deployment.save();

                    // Write env vars to .env
                    botManager.writeEnv(id, { SESSION_ID: sessionId, OWNER_NUMBER: ownerNumber, PREFIX: prefix || '.' });

                    await botManager.installDeps(id, log);

                    const pid = await botManager.startBot(deployment, log);
                    deployment.status     = 'active';
                    deployment.lastActive = new Date();
                    await deployment.save();
                } else {
                    deployment.status = 'active';
                    await dbLog(deployment, 'No GitHub repo provided — bot marked active without process.', 'warn');
                    await deployment.save();
                }
            } catch (err) {
                deployment.status = 'inactive';
                await dbLog(deployment, `Startup error: ${err.message}`, 'error');
                await deployment.save();
            }
        })();

        res.json(deployment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/deployments
router.get('/', auth, async (req, res) => {
    try {
        const deployments = await Deployment.find({ user: req.user.id })
            .select('-logs')
            .sort({ createdAt: -1 });

        // Merge real running status + startedAt from botManager
        const enriched = deployments.map(d => {
            const obj = d.toObject();
            if (d.repoUrl) {
                const running    = botManager.isRunning(d._id);
                obj.status       = running ? 'active' : 'inactive';
                obj.startedAt    = running ? botManager.getStartedAt(d._id) : null;
            } else {
                obj.startedAt    = d.status === 'active' ? (d.lastActive || d.createdAt) : null;
            }
            return obj;
        });

        res.json(enriched);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/deployments/count
router.get('/count', auth, async (req, res) => {
    try {
        const user        = await User.findById(req.user.id);
        const deployments = await Deployment.find({ user: req.user.id });

        let active = 0, inactive = 0;
        deployments.forEach(d => {
            const running = d.repoUrl ? botManager.isRunning(d._id) : d.status === 'active';
            running ? active++ : inactive++;
        });

        res.json({ active, inactive, coins: user.wallet.coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/deployments/:id/start
router.put('/:id/start', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id });
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        const log = (msg, level = 'info') => {
            botManager.pushLog(req.params.id, msg, level);
            dbLog(deployment, msg, level).catch(() => {});
        };

        if (deployment.repoUrl) {
            await botManager.startBot(deployment, log);
            deployment.status     = 'active';
            deployment.lastActive = new Date();
            await deployment.save();
        } else {
            deployment.status = 'active';
            await dbLog(deployment, 'Bot started.', 'info');
            await deployment.save();
        }

        res.json({ status: 'active', msg: 'Bot started successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: err.message || 'Server error' });
    }
});

// @route   PUT api/deployments/:id/stop
router.put('/:id/stop', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id });
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        botManager.stopBot(req.params.id);
        deployment.status = 'inactive';
        await dbLog(deployment, 'Bot stopped.', 'warn');
        await deployment.save();

        res.json({ status: 'inactive', msg: 'Bot stopped' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/deployments/:id/restart
router.put('/:id/restart', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id });
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        const log = (msg, level = 'info') => {
            botManager.pushLog(req.params.id, msg, level);
            dbLog(deployment, msg, level).catch(() => {});
        };

        if (deployment.repoUrl) {
            await botManager.restartBot(deployment, log);
            deployment.status     = 'active';
            deployment.lastActive = new Date();
        } else {
            deployment.status = 'active';
            await log('Bot restarted.', 'info');
        }
        await deployment.save();

        res.json({ status: 'active', msg: 'Bot restarted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: err.message || 'Server error' });
    }
});

// @route   GET api/deployments/:id/logs
router.get('/:id/logs', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id })
            .select('logs branchName repoUrl');
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        // Merge in-memory logs (real-time stdout) with DB logs
        const memLogs = botManager.getLogs(req.params.id);
        const dbLogs  = deployment.logs || [];

        // Combine and deduplicate by timestamp + message
        const allLogs = [...memLogs, ...dbLogs].reduce((acc, l) => {
            const key = `${l.message}|${new Date(l.timestamp).getTime()}`;
            if (!acc.seen.has(key)) { acc.seen.add(key); acc.list.push(l); }
            return acc;
        }, { seen: new Set(), list: [] }).list;

        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ logs: allLogs.slice(0, 150), branchName: deployment.branchName });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/deployments/:id/status
router.get('/:id/status', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id })
            .select('status repoUrl');
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        const running    = deployment.repoUrl
            ? botManager.isRunning(req.params.id)
            : deployment.status === 'active';
        const startedAt  = running
            ? (deployment.repoUrl ? botManager.getStartedAt(req.params.id) : (deployment.lastActive || null))
            : null;

        res.json({ status: running ? 'active' : 'inactive', startedAt });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/deployments/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({ _id: req.params.id, user: req.user.id });
        if (!deployment) return res.status(404).json({ msg: 'Deployment not found' });

        botManager.stopBot(req.params.id);

        // Remove bot files
        const { botDir } = botManager;
        const dir = botDir(req.params.id);
        const fs  = require('fs');
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

        await deployment.deleteOne();
        res.json({ msg: 'Deployment deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
