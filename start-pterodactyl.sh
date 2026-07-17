#!/bin/bash
# ── TRUTH MD Host Platform — Pterodactyl Startup Script ─────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   TRUTH MD Host Platform — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Pull latest code from GitHub on every restart
echo "[*] Pulling latest code from GitHub..."
git pull origin main 2>&1 || echo "[!] git pull failed (offline or not a git repo) — continuing with existing files"

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install --production
fi

# Start the server
echo "[*] Starting server on port ${PORT:-3000}..."
node index.js
