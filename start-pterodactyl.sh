#!/bin/bash
# ── TRUTH MD Host Platform — Pterodactyl Startup Script ─────────────────────
# 1. Copy .env.example to .env and fill in your values before first run.
# 2. Make sure MongoDB URI in .env points to your Atlas cluster or local Mongo.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   TRUTH MD Host Platform — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install --production
fi

# Start the server
echo "[*] Starting server on port ${PORT:-5000}..."
node index.js
