const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const { initiateSTKPush } = require('../services/mpesa');
const { sendPurchaseEmail, sendBuyerReceiptEmail } = require('../services/email');

function payflowHeaders() {
    return {
        'X-API-Key':    process.env.PAYFLOW_API_KEY,
        'X-API-Secret': process.env.PAYFLOW_API_SECRET,
        'Content-Type': 'application/json'
    };
}

// @route   GET /api/wallet
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const referralLink = `${req.protocol}://${req.get('host')}/signup.html?ref=${user.username}`;
        res.json({
            coins:        user.wallet.coins,
            lastClaim:    user.wallet.lastClaim,
            referralLink,
            referrals:    user.referrals.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/wallet/claim
router.post('/claim', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const now  = new Date();
        if (user.wallet.lastClaim) {
            const hoursDiff = (now - new Date(user.wallet.lastClaim)) / (1000 * 60 * 60);
            if (hoursDiff < 24)
                return res.status(400).json({ msg: `You can claim again in ${Math.ceil(24 - hoursDiff)} hours` });
        }

        user.wallet.coins += 5;
        user.wallet.lastClaim = now;
        user.wallet.transactions.unshift({
            type: 'earned', amount: 5,
            description: 'Daily bonus claimed', category: 'daily',
            createdAt: now
        });
        if (user.wallet.transactions.length > 50) user.wallet.transactions.pop();
        await User.save(user);

        res.json({ coins: user.wallet.coins, lastClaim: user.wallet.lastClaim });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/wallet/stkpush
router.post('/stkpush', auth, async (req, res) => {
    const { packageName, coins, price, phone } = req.body;
    if (!packageName || !coins || !price || !phone)
        return res.status(400).json({ error: 'All fields are required' });

    if (!process.env.PAYFLOW_API_KEY || !process.env.PAYFLOW_API_SECRET)
        return res.status(503).json({ error: 'Payment gateway is not configured yet. Please contact the admin.' });

    try {
        const callbackUrl = `${process.env.APP_URL}/api/wallet/mpesa-callback`;

        const stkResponse = await initiateSTKPush({
            phone, amount: price,
            accountRef: 'TRUTHCoins',
            description: `${coins} coins - ${packageName}`,
            callbackUrl
        });

        if (!stkResponse.success)
            return res.status(400).json({ error: stkResponse.message || 'STK push failed' });

        const purchase = await Purchase.create({
            user:               req.user.id,
            packageName,
            coins:              Number(coins),
            price:              Number(price),
            phone,
            checkoutRequestId:  stkResponse.checkout_request_id,
            merchantRequestId:  stkResponse.merchant_request_id || '',
            status:             'pending'
        });

        res.json({
            msg: 'STK push sent to your phone. Enter your M-Pesa PIN to complete payment.',
            checkoutRequestId: stkResponse.checkout_request_id
        });
    } catch (err) {
        console.error('STK push error:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.errorMessage || err.message || 'Failed to initiate payment' });
    }
});

// @route   POST /api/wallet/mpesa-callback
router.post('/mpesa-callback', async (req, res) => {
    try {
        const body = req.body;
        const checkoutRequestId = body.checkout_request_id;
        if (!checkoutRequestId) return res.json({ success: true });

        const purchase = await Purchase.findOne({ checkoutRequestId });
        if (!purchase || purchase.status !== 'pending') return res.json({ success: true });

        const txn       = Array.isArray(body.data) ? body.data[0] : body.data || {};
        const txnStatus = (txn.status || '').toLowerCase();
        const receipt   = txn.transaction_code || '';

        if (txnStatus === 'completed') {
            purchase.status             = 'completed';
            purchase.mpesaReceiptNumber = receipt;
            purchase.completedAt        = new Date();
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
                        `Bought ${purchase.coins} coins via M-Pesa (${receipt || purchase.packageName})`,
                        'purchase') }
                }),
                admin && User.findByIdAndUpdate(admin.id, {
                    $inc:  { 'wallet.coins': -purchase.coins },
                    $push: { 'wallet.transactions': txEntry('spent',
                        `Coins sold to user — M-Pesa ${receipt || purchase.packageName}`,
                        'sale') }
                })
            ]);

            const buyer = await User.findById(purchase.user);
            sendPurchaseEmail(buyer?.username, purchase.coins, purchase.price, receipt, purchase.packageName)
                .catch(e => console.error('Admin receipt email error:', e.message));
            if (buyer?.email) {
                sendBuyerReceiptEmail(buyer.email, buyer.username, purchase.coins, purchase.price, receipt, purchase.packageName)
                    .catch(e => console.error('Buyer receipt email error:', e.message));
            }
        } else {
            purchase.status     = txnStatus === 'cancelled' ? 'cancelled' : 'failed';
            purchase.resultDesc = txnStatus;
            await Purchase.save(purchase);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Callback error:', err.message);
        res.json({ success: true });
    }
});

// @route   GET /api/wallet/purchase-status/:checkoutId
router.get('/purchase-status/:checkoutId', auth, async (req, res) => {
    try {
        const purchase = await Purchase.findOne({
            checkoutRequestId: req.params.checkoutId,
            user: req.user.id
        });
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

        if (purchase.status === 'pending') {
            try {
                const pfRes = await axios.get(
                    `https://payflow.top/api/v2/transactions.php?checkout_request_id=${encodeURIComponent(req.params.checkoutId)}`,
                    { headers: payflowHeaders(), timeout: 8000 }
                );

                if (pfRes.data?.success && Array.isArray(pfRes.data.data) && pfRes.data.data.length > 0) {
                    const txn       = pfRes.data.data[0];
                    const txnStatus = (txn.status || '').toLowerCase();

                    if (txnStatus === 'completed') {
                        purchase.status             = 'completed';
                        purchase.mpesaReceiptNumber = txn.transaction_code || '';
                        purchase.completedAt        = new Date();
                        await Purchase.save(purchase);

                        const admin      = await User.findOne({ role: 'admin' });
                        const pollBuyer  = await User.findById(purchase.user);
                        await Promise.all([
                            User.findByIdAndUpdate(purchase.user, { $inc: { 'wallet.coins': purchase.coins } }),
                            admin && User.findByIdAndUpdate(admin.id, { $inc: { 'wallet.coins': -purchase.coins } })
                        ]);
                        if (pollBuyer?.email) {
                            sendBuyerReceiptEmail(pollBuyer.email, pollBuyer.username, purchase.coins, purchase.price, purchase.mpesaReceiptNumber, purchase.packageName)
                                .catch(e => console.error('Buyer receipt email error (poll):', e.message));
                        }
                    } else if (txnStatus === 'failed' || txnStatus === 'cancelled') {
                        purchase.status = txnStatus;
                        await Purchase.save(purchase);
                    }
                }
            } catch (pollErr) {
                console.warn('Payflow poll error:', pollErr.message);
            }
        }

        res.json({
            status:     purchase.status,
            coins:      purchase.coins,
            receipt:    purchase.mpesaReceiptNumber,
            resultDesc: purchase.resultDesc
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/wallet/notifications
router.get('/notifications', auth, async (req, res) => {
    try {
        const user      = await User.findById(req.user.id);
        const purchases = await Purchase.find({ user: req.user.id, status: 'completed' });
        const txns      = (user.wallet.transactions || []).slice(0, 20);

        const notifications = [
            ...txns.map(t => ({
                id: t._id || t.createdAt, type: t.type, category: t.category,
                amount: t.amount, description: t.description, createdAt: t.createdAt
            })),
            ...purchases
                .filter(p => !txns.some(t =>
                    t.category === 'purchase' && Math.abs(new Date(t.createdAt) - new Date(p.completedAt)) < 5000
                ))
                .map(p => ({
                    id: p.id, type: 'earned', category: 'purchase', amount: p.coins,
                    description: `Bought ${p.coins} coins via M-Pesa${p.mpesaReceiptNumber ? ' (' + p.mpesaReceiptNumber + ')' : ''}`,
                    createdAt: p.completedAt
                }))
        ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);

        res.json({ notifications, coins: user.wallet.coins });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
