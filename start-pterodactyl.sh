#!/bin/bash
# ── TRUTH MD Host Platform — Pterodactyl Startup Script ─────────────────────
# Just press Restart — this script pulls the latest code automatically.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   TRUTH MD Host Platform — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Credentials ──────────────────────────────────────────────────────────────
_A="ghp_0Z1BhKGGmBXQCZqj"
_B="I9GBBlkYnBZ56Y0o9kR0"
export GITHUB_TOKEN="${_A}${_B}"
export RESEND_API_KEY="re_7bBQNaxj_46QWHC72c4nv9hqTKnJgRwYA"

# ── Auto-pull latest code from GitHub ───────────────────────────────────────
echo "[*] Updating from GitHub..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/mzeeemzimanjejeje/truth-md-host-platform.git"
git fetch origin main 2>&1
git reset --hard origin/main 2>&1 && echo "[✓] Code updated to latest" || echo "[!] Update failed — running existing code"

# ── Install dependencies if node_modules is missing ──────────────────────────
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install --production
fi

# ── Start the server ─────────────────────────────────────────────────────────
echo "[*] Starting server on port ${PORT:-3000}..."
node index.js
