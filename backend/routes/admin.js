const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
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
        const users = await User.find()
            .select('-password -emailOTP -emailOTPExpiry')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Deployment.deleteMany({ user: req.params.id });
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
        // Only deduct from admin pool when adding coins to a user (positive adjustment)
        const admin = await User.findOne({ role: 'admin' }).select('_id');
        const [user] = await Promise.all([
            User.findByIdAndUpdate(
                req.params.id,
                { $inc: { 'wallet.coins': coins } },
                { new: true }
            ).select('username wallet.coins'),
            admin && coins > 0 && User.findByIdAndUpdate(admin._id, {
                $inc: { 'wallet.coins': -coins }
            })
        ]);
        res.json({ msg: 'Coins updated', coins: user.wallet.coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/purchases
router.get('/purchases', auth, adminOnly, async (req, res) => {
    try {
        const purchases = await Purchase.find()
            .populate('user', 'username email')
            .sort({ createdAt: -1 })
            .limit(100);
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
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.status !== 'pending') return res.status(400).json({ error: 'Purchase already processed' });

        purchase.status = 'completed';
        purchase.completedAt = new Date();
        await purchase.save();

        const admin = await User.findOne({ role: 'admin' }).select('_id');
        await Promise.all([
            User.findByIdAndUpdate(purchase.user, {
                $inc: { 'wallet.coins': purchase.coins },
                $push: {
                    'wallet.transactions': {
                        $each: [{
                            type: 'earned',
                            amount: purchase.coins,
                            description: `Manually approved: ${purchase.coins} coins (${purchase.packageName})`,
                            category: 'purchase',
                            createdAt: new Date()
                        }],
                        $position: 0,
                        $slice: 50
                    }
                }
            }),
            admin && User.findByIdAndUpdate(admin._id, {
                $inc: { 'wallet.coins': -purchase.coins },
                $push: {
                    'wallet.transactions': {
                        $each: [{
                            type: 'spent',
                            amount: purchase.coins,
                            description: `Manually approved sale: ${purchase.coins} coins (${purchase.packageName})`,
                            category: 'sale',
                            createdAt: new Date()
                        }],
                        $position: 0,
                        $slice: 50
                    }
                }
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
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.status !== 'pending') return res.status(400).json({ error: 'Purchase already processed' });

        purchase.status = 'failed';
        await purchase.save();

        res.json({ msg: 'Purchase rejected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/deployments
router.get('/deployments', auth, adminOnly, async (req, res) => {
    try {
        const deployments = await Deployment.find()
            .populate('user', 'username')
            .sort({ createdAt: -1 });
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
