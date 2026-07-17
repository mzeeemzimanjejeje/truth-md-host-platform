const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const User       = require('../models/User');
const Purchase   = require('../models/Purchase');
const Deployment = require('../models/Deployment');

// @route   GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const [totalUsers, totalDeployments, pendingPurchases, completedPurchases] = await Promise.all([
            User.countDocuments(),
            Deployment.countDocuments(),
            Purchase.countDocuments({ status: 'pending' }),
            Purchase.countDocuments({ status: 'completed' })
        ]);
        res.json({ totalUsers, totalDeployments, pendingPurchases, completedPurchases });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/users
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find();
        res.json(users.map(({ password, emailOTP, emailOTPExpiry, ...u }) => u));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        await Deployment.deleteMany({ user: req.params.id });
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PATCH /api/admin/users/:id/coins
router.patch('/users/:id/coins', auth, adminOnly, async (req, res) => {
    try {
        const { coins } = req.body;
        const admin = await User.findOne({ role: 'admin' });

        await User.findByIdAndUpdate(req.params.id, { $inc: { 'wallet.coins': coins } });
        if (admin && coins > 0) {
            await User.findByIdAndUpdate(admin.id, { $inc: { 'wallet.coins': -coins } });
        }

        const updated = await User.findById(req.params.id);
        res.json({ msg: 'Coins updated', coins: updated.wallet.coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/purchases
router.get('/purchases', auth, adminOnly, async (req, res) => {
    try {
        const purchases = await Purchase.find();
        res.json(purchases);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PATCH /api/admin/purchases/:id/approve
router.patch('/purchases/:id/approve', auth, adminOnly, async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (!purchase)                    return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.status !== 'pending') return res.status(400).json({ error: 'Purchase already processed' });

        purchase.status      = 'completed';
        purchase.completedAt = new Date();
        await Purchase.save(purchase);

        const admin = await User.findOne({ role: 'admin' });
        const txEntry = (type, desc, cat) => ({
            type, amount: purchase.coins, description: desc,
            category: cat, createdAt: new Date()
        });

        await Promise.all([
            User.findByIdAndUpdate(purchase.user, {
                $inc:  { 'wallet.coins': purchase.coins },
                $push: { 'wallet.transactions': txEntry('earned',
                    `Manually approved: ${purchase.coins} coins (${purchase.packageName})`,
                    'purchase') }
            }),
            admin && User.findByIdAndUpdate(admin.id, {
                $inc:  { 'wallet.coins': -purchase.coins },
                $push: { 'wallet.transactions': txEntry('spent',
                    `Manually approved sale: ${purchase.coins} coins (${purchase.packageName})`,
                    'sale') }
            })
        ]);

        res.json({ msg: 'Purchase approved and coins credited' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PATCH /api/admin/purchases/:id/reject
router.patch('/purchases/:id/reject', auth, adminOnly, async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (!purchase)                    return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.status !== 'pending') return res.status(400).json({ error: 'Purchase already processed' });

        purchase.status = 'failed';
        await Purchase.save(purchase);
        res.json({ msg: 'Purchase rejected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/deployments
router.get('/deployments', auth, adminOnly, async (req, res) => {
    try {
        const deployments = await Deployment.find();
        res.json(deployments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/admin/deployments/:id
router.delete('/deployments/:id', auth, adminOnly, async (req, res) => {
    try {
        await Deployment.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Deployment deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
