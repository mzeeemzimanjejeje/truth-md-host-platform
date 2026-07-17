const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const { initiateSTKPush } = require('../services/mpesa');
const { sendPurchaseEmail } = require('../services/email');

function payflowHeaders() {
    return {
        'X-API-Key': process.env.PAYFLOW_API_KEY,
        'X-API-Secret': process.env.PAYFLOW_API_SECRET,
        'Content-Type': 'application/json'
    };
}

// @route   GET api/wallet
// @desc    Get user wallet info
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('wallet username referrals');
        const referralLink = `${req.protocol}://${req.get('host')}/signup.html?ref=${user.username}`;
        res.json({
            coins: user.wallet.coins,
            lastClaim: user.wallet.lastClaim,
            referralLink,
            referrals: user.referrals.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/wallet/claim
// @desc    Claim daily coins
router.post('/claim', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const now = new Date();
        if (user.wallet.lastClaim) {
            const hoursDiff = (now - new Date(user.wallet.lastClaim)) / (1000 * 60 * 60);
            if (hoursDiff < 24) {
                return res.status(400).json({
                    msg: `You can claim again in ${Math.ceil(24 - hoursDiff)} hours`
                });
            }
        }
        user.wallet.coins += 5;
        user.wallet.lastClaim = now;
        user.wallet.transactions.unshift({
            type: 'earned',
            amount: 5,
            description: 'Daily bonus claimed',
            category: 'daily'
        });
        if (user.wallet.transactions.length > 50) user.wallet.transactions.pop();
        await user.save();
        res.json({ coins: user.wallet.coins, lastClaim: user.wallet.lastClaim });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/wallet/stkpush
// @desc    Initiate M-Pesa STK push for coin purchase
router.post('/stkpush', auth, async (req, res) => {
    const { packageName, coins, price, phone } = req.body;

    if (!packageName || !coins || !price || !phone) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!process.env.PAYFLOW_API_KEY || !process.env.PAYFLOW_API_SECRET) {
        return res.status(503).json({ error: 'Payment gateway is not configured yet. Please contact the admin.' });
    }

    try {
        const callbackUrl = `${process.env.APP_URL}/api/wallet/mpesa-callback`;

        const stkResponse = await initiateSTKPush({
            phone,
            amount: price,
            accountRef: 'TRUTHCoins',
            description: `${coins} coins - ${packageName}`,
            callbackUrl
        });

        if (!stkResponse.success) {
            return res.status(400).json({ error: stkResponse.message || 'STK push failed' });
        }

        const purchase = new Purchase({
            user: req.user.id,
            packageName,
            coins: Number(coins),
            price: Number(price),
            phone,
            checkoutRequestId: stkResponse.checkout_request_id,
            merchantRequestId: stkResponse.merchant_request_id || '',
            status: 'pending'
        });

        await purchase.save();

        res.json({
            msg: 'STK push sent to your phone. Enter your M-Pesa PIN to complete payment.',
            checkoutRequestId: stkResponse.checkout_request_id
        });
    } catch (err) {
        console.error('STK push error:', err.response?.data || err.message);
        const errMsg = err.response?.data?.errorMessage || err.message || 'Failed to initiate payment';
        res.status(500).json({ error: errMsg });
    }
});

// @route   POST api/wallet/mpesa-callback
// @desc    Payflow payment callback
router.post('/mpesa-callback', async (req, res) => {
    try {
        console.log('Payflow callback received:', JSON.stringify(req.body));

        const body = req.body;

        // Payflow sends: { success, checkout_request_id, data: [{ status, transaction_code, ... }] }
        const checkoutRequestId = body.checkout_request_id;
        if (!checkoutRequestId) return res.json({ success: true });

        const purchase = await Purchase.findOne({ checkoutRequestId });
        if (!purchase) return res.json({ success: true });

        // Already processed — skip
        if (purchase.status !== 'pending') return res.json({ success: true });

        const txn = Array.isArray(body.data) ? body.data[0] : body.data || {};
        const txnStatus = (txn.status || '').toLowerCase();
        const receipt = txn.transaction_code || '';

        if (txnStatus === 'completed') {
            purchase.status = 'completed';
            purchase.mpesaReceiptNumber = receipt;
            purchase.completedAt = new Date();
            await purchase.save();

            // Credit user and deduct same amount from admin pool
            const admin = await User.findOne({ role: 'admin' }).select('_id');
            await Promise.all([
                User.findByIdAndUpdate(purchase.user, {
                    $inc: { 'wallet.coins': purchase.coins },
                    $push: {
                        'wallet.transactions': {
                            $each: [{
                                type: 'earned',
                                amount: purchase.coins,
                                description: `Bought ${purchase.coins} coins via M-Pesa (${receipt || purchase.packageName})`,
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
                                description: `Coins sold to user — M-Pesa ${receipt || purchase.packageName}`,
                                category: 'sale',
                                createdAt: new Date()
                            }],
                            $position: 0,
                            $slice: 50
                        }
                    }
                })
            ]);
            // Send receipt email to admin
            const buyer = await User.findById(purchase.user).select('username');
            const buyerName = buyer?.username || 'Unknown';
            sendPurchaseEmail(buyerName, purchase.coins, purchase.price, receipt, purchase.packageName)
                .catch(e => console.error('Purchase email error:', e.message));
            console.log(`Purchase ${checkoutRequestId} completed — ${purchase.coins} coins credited to user, deducted from admin. Receipt: ${receipt}`);
        } else {
            purchase.status = txnStatus === 'cancelled' ? 'cancelled' : 'failed';
            purchase.resultDesc = txnStatus;
            await purchase.save();
            console.log(`Purchase ${checkoutRequestId} ${purchase.status}`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Callback error:', err.message);
        res.json({ success: true });
    }
});

// @route   GET api/wallet/purchase-status/:checkoutId
// @desc    Poll for purchase status (checks DB first, then queries Payflow if still pending)
router.get('/purchase-status/:checkoutId', auth, async (req, res) => {
    try {
        const purchase = await Purchase.findOne({
            checkoutRequestId: req.params.checkoutId,
            user: req.user.id
        });

        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

        // If still pending, ask Payflow for live status
        if (purchase.status === 'pending') {
            try {
                const pfRes = await axios.get(
                    `https://payflow.top/api/v2/transactions.php?checkout_request_id=${encodeURIComponent(req.params.checkoutId)}`,
                    { headers: payflowHeaders(), timeout: 8000 }
                );

                if (pfRes.data?.success && Array.isArray(pfRes.data.data) && pfRes.data.data.length > 0) {
                    const txn = pfRes.data.data[0];
                    const txnStatus = (txn.status || '').toLowerCase();

                    if (txnStatus === 'completed') {
                        purchase.status = 'completed';
                        purchase.mpesaReceiptNumber = txn.transaction_code || '';
                        purchase.completedAt = new Date();
                        await purchase.save();

                        const admin = await User.findOne({ role: 'admin' }).select('_id');
                        await Promise.all([
                            User.findByIdAndUpdate(purchase.user, {
                                $inc: { 'wallet.coins': purchase.coins }
                            }),
                            admin && User.findByIdAndUpdate(admin._id, {
                                $inc: { 'wallet.coins': -purchase.coins }
                            })
                        ]);
                    } else if (txnStatus === 'failed' || txnStatus === 'cancelled') {
                        purchase.status = txnStatus;
                        await purchase.save();
                    }
                }
            } catch (pollErr) {
                console.warn('Payflow poll error:', pollErr.message);
            }
        }

        res.json({
            status: purchase.status,
            coins: purchase.coins,
            receipt: purchase.mpesaReceiptNumber,
            resultDesc: purchase.resultDesc
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/wallet/notifications
// @desc    Get coin transaction history as notifications
router.get('/notifications', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('wallet.transactions wallet.coins');
        const transactions = (user.wallet.transactions || []).slice(0, 20);

        // Also pull completed purchases not yet in transactions (legacy)
        const purchases = await Purchase.find({ user: req.user.id, status: 'completed' })
            .sort({ completedAt: -1 })
            .limit(10)
            .select('coins price packageName mpesaReceiptNumber completedAt');

        const notifications = [
            ...transactions.map(t => ({
                id: t._id,
                type: t.type,
                category: t.category,
                amount: t.amount,
                description: t.description,
                createdAt: t.createdAt
            })),
            ...purchases
                .filter(p => !transactions.some(t =>
                    t.category === 'purchase' && Math.abs(new Date(t.createdAt) - new Date(p.completedAt)) < 5000
                ))
                .map(p => ({
                    id: p._id,
                    type: 'earned',
                    category: 'purchase',
                    amount: p.coins,
                    description: `Bought ${p.coins} coins via M-Pesa${p.mpesaReceiptNumber ? ' (' + p.mpesaReceiptNumber + ')' : ''}`,
                    createdAt: p.completedAt
                }))
        ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);

        res.json({ notifications, coins: user.wallet.coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
