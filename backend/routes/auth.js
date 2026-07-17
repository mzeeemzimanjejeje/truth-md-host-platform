const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../services/email');

function signToken(payload) {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) reject(err); else resolve(token);
        });
    });
}

// @route   POST /api/auth/register
router.post('/register', [
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Valid email is required').isEmail(),
    check('password', 'Password must be 6+ characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password, referralCode } = req.body;

    try {
        const existingUsername = await User.findOne({ username });
        if (existingUsername) return res.status(400).json({ error: 'Username already taken' });

        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

        const otp = generateOTP();
        const isAdmin = username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;

        // Find referrer
        let referrerId = null;
        if (referralCode && !isAdmin) {
            const referrer = await User.findOne({ username: referralCode });
            if (referrer) referrerId = referrer.id;
        }

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password,
            emailOTP:       isAdmin ? null : otp,
            emailOTPExpiry: isAdmin ? null : new Date(Date.now() + 10 * 60 * 1000),
            isEmailVerified: isAdmin,
            role:           isAdmin ? 'admin' : 'user',
            wallet:         { coins: isAdmin ? 6000000 : 10 },
            referredBy:     referrerId
        });

        // Credit referrer
        if (referrerId) {
            await User.findByIdAndUpdate(referrerId, {
                $inc: { 'wallet.coins': 5 },
                $push: { referrals: user.id }
            });
        }

        if (isAdmin) {
            const token = await signToken({ user: { id: user.id, role: user.role } });
            return res.json({ token });
        }

        sendOTPEmail(user.email, username, otp)
            .catch(e => console.error('OTP email error:', e.message));

        res.json({ msg: 'Account created. A 6-digit code has been sent to your email.', userId: user.id });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/login
router.post('/login', [
    check('username', 'Username is required').not().isEmpty(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = await signToken({ user: { id: user.id, role: user.role } });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    const { userId, otp } = req.body;
    if (!userId || !otp) return res.status(400).json({ error: 'userId and otp are required' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.emailOTP || user.emailOTP !== otp.trim())
            return res.status(400).json({ error: 'Invalid verification code' });

        if (new Date() > new Date(user.emailOTPExpiry))
            return res.status(400).json({ error: 'Code has expired. Please request a new one.' });

        user.isEmailVerified = true;
        user.emailOTP        = null;
        user.emailOTPExpiry  = null;
        await User.save(user);

        sendWelcomeEmail(user.email, user.username)
            .catch(e => console.error('Welcome email error:', e.message));

        const token = await signToken({ user: { id: user.id, role: user.role } });
        res.json({ token });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.email) return res.status(400).json({ error: 'No email on file' });

        const otp = generateOTP();
        user.emailOTP        = otp;
        user.emailOTPExpiry  = new Date(Date.now() + 10 * 60 * 1000);
        await User.save(user);

        await sendOTPEmail(user.email, user.username, otp);
        res.json({ msg: 'A new code has been sent to your email.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/auth/user
router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { password, emailOTP, emailOTPExpiry, ...safe } = user;
        res.json(safe);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
