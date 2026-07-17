const mongoose = require('mongoose');

const DeploymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    branchName: {
        type: String,
        required: true,
        unique: true
    },
    sessionId: {
        type: String,
        required: true
    },
    ownerNumber: {
        type: String,
        required: true
    },
    prefix: {
        type: String,
        default: '.'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    repoUrl:           { type: String },
    detectedFramework: { type: String, default: 'Node.js Bot' },
    entryPoint:        { type: String, default: 'index.js' },
    lastActive: Date,
    logs: [{
        message: String,
        level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Deployment', DeploymentSchema);
