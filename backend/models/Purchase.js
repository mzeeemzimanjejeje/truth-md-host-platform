const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    packageName: { type: String, required: true },
    coins: { type: Number, required: true },
    price: { type: Number, required: true },
    phone: { type: String, required: true },
    checkoutRequestId: { type: String },
    merchantRequestId: { type: String },
    mpesaReceiptNumber: { type: String },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    resultDesc: { type: String },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
