const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
    },
    isEmailVerified: { type: Boolean, default: false },
    emailOTP:        { type: String },
    emailOTPExpiry:  { type: Date },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    wallet: {
        coins: {
            type: Number,
            default: 10
        },
        lastClaim: Date,
        pendingPurchases: [{
            packageName: String,
            coins: Number,
            price: Number,
            mpesaCode: String,
            submittedAt: Date,
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected'],
                default: 'pending'
            }
        }],
        transactions: [{
            type: { type: String, enum: ['spent', 'earned'], required: true },
            amount: { type: Number, required: true },
            description: { type: String, required: true },
            category: { type: String, enum: ['deployment', 'purchase', 'daily', 'referral', 'other'], default: 'other' },
            createdAt: { type: Date, default: Date.now }
        }]
    },
    referrals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

module.exports = mongoose.model('User', UserSchema);
