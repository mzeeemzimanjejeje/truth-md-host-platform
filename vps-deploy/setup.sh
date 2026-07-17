#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# TRUTH MD Host Platform — VPS Domain Setup
# Domain: truthxplatfom.courtneytech.xyz
# Run this ON YOUR VPS (not inside Pterodactyl)
# ─────────────────────────────────────────────────────────────────

set -e

DOMAIN="truthxplatfom.courtneytech.xyz"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

# ── Get Pterodactyl port ─────────────────────────────────────────
if [ -z "$1" ]; then
    echo ""
    echo "Usage: bash setup.sh YOUR_PTERODACTYL_PORT"
    echo "Example: bash setup.sh 4057"
    echo ""
    echo "Find your port in the Pterodactyl panel under:"
    echo "  Server → Address (the number after the colon)"
    exit 1
fi

PORT=$1
echo "Using Pterodactyl port: $PORT"

# ── Install Nginx + Certbot if missing ──────────────────────────
which nginx   || apt install -y nginx
which certbot || apt install -y certbot python3-certbot-nginx

# ── Write Nginx config with correct port ────────────────────────
echo "Configuring Nginx for $DOMAIN → port $PORT..."
sed "s/YOUR_PTERODACTYL_PORT/$PORT/g" vps-deploy/nginx.conf > $NGINX_CONF
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "Nginx configured."

# ── SSL Certificate ─────────────────────────────────────────────
echo "Getting SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@courtneytech.xyz || \
  echo ">>> Point your DNS A record to this server IP first, then rerun certbot."

echo ""
echo "Done! Platform available at: https://$DOMAIN"
