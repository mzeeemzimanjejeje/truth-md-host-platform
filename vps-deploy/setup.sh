#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# TRUTH MD Host Platform — VPS Setup Script
# Usage: bash vps-deploy/setup.sh YOUR_DOMAIN [APP_PORT]
# Example: bash vps-deploy/setup.sh mybot.example.com 5000
# ─────────────────────────────────────────────────────────────────

set -e

# ── Arguments ────────────────────────────────────────────────────
if [ -z "$1" ]; then
    echo ""
    echo "Usage: bash vps-deploy/setup.sh YOUR_DOMAIN [APP_PORT]"
    echo "Example: bash vps-deploy/setup.sh mybot.example.com 5000"
    echo ""
    echo "YOUR_DOMAIN  — the domain/subdomain pointing to this VPS"
    echo "APP_PORT     — port the Node.js app runs on (default: 5000)"
    exit 1
fi

DOMAIN="$1"
APP_PORT="${2:-5000}"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

echo "Domain:   $DOMAIN"
echo "App port: $APP_PORT"
echo ""

# ── Install Nginx + Certbot if missing ──────────────────────────
apt-get update -y
which nginx   || apt-get install -y nginx
which certbot || apt-get install -y certbot python3-certbot-nginx

# ── Write Nginx config ───────────────────────────────────────────
echo "Configuring Nginx for $DOMAIN → localhost:$APP_PORT..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sed -e "s/YOUR_DOMAIN/$DOMAIN/g" \
    -e "s/YOUR_APP_PORT/$APP_PORT/g" \
    "$SCRIPT_DIR/nginx.conf" > "$NGINX_CONF"

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "Nginx configured."

# ── SSL Certificate ─────────────────────────────────────────────
echo "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@$DOMAIN" || \
    echo ">>> SSL skipped — make sure your DNS A record points to this server IP, then run:"
    echo ">>> certbot --nginx -d $DOMAIN"

echo ""
echo "Done! Platform will be available at: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Edit /var/www/truth-host/.env and set APP_URL=https://$DOMAIN"
echo "  2. Run: cd /var/www/truth-host && pm2 start vps-deploy/ecosystem.config.js"
echo "  3. Run: pm2 save && pm2 startup"
