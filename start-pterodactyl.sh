#!/bin/bash
# ── TRUTH MD Host Platform — Pterodactyl Startup Script ─────────────────────
# Just press Restart — this script pulls the latest code automatically.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   TRUTH MD Host Platform — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Auto-pull latest code from GitHub ───────────────────────────────────────
# Uses GITHUB_TOKEN env var for private repo access (set in Pterodactyl variables)
if [ -n "$GITHUB_TOKEN" ]; then
    echo "[*] Updating from GitHub (authenticated)..."
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/mzeeemzimanjejeje/truth-md-host-platform.git"
    git fetch origin main 2>&1
    git reset --hard origin/main 2>&1 && echo "[✓] Code updated to latest" || echo "[!] Update failed — running existing code"
else
    echo "[!] GITHUB_TOKEN not set — skipping auto-update"
fi

# ── Install dependencies if node_modules is missing ──────────────────────────
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install --production
fi

# ── Start the server ─────────────────────────────────────────────────────────
echo "[*] Starting server on port ${PORT:-3000}..."
node index.js
