#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#   TRUTH MD Host Platform — Full VPS Installation Script
#   Run as root on a fresh Ubuntu 20.04+ server
#
#   Usage:
#     bash setup.sh
#   Or with arguments (skips prompts):
#     bash setup.sh <domain> <app_port> <mongodb_uri> <jwt_secret> \
#                   <admin_username> <admin_password> \
#                   <resend_api_key> <payflow_api_key> \
#                   <payflow_api_secret> <payflow_account_id> \
#                   <github_token>
# ═══════════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_URL="https://github.com/mzeeemzimanjejeje/truth-md-host-platform.git"
INSTALL_DIR="/var/www/truth-host"
NODE_VERSION="20"

log()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      TRUTH MD Host Platform — VPS Installer      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Root check ────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && fail "Please run as root (sudo bash setup.sh)"

# ── Collect config (args or interactive prompts) ──────────────────
if [ -n "$1" ]; then
    DOMAIN="$1"
    APP_PORT="${2:-5000}"
    MONGODB_URI="$3"
    JWT_SECRET="$4"
    ADMIN_USERNAME="$5"
    ADMIN_PASSWORD="$6"
    RESEND_API_KEY="$7"
    PAYFLOW_API_KEY="${8:-}"
    PAYFLOW_API_SECRET="${9:-}"
    PAYFLOW_ACCOUNT_ID="${10:-}"
    GITHUB_TOKEN="${11:-}"
else
    echo -e "${YELLOW}No arguments supplied — entering interactive setup.${NC}"
    echo ""

    read -rp "  Domain/subdomain (e.g. hosts.courtneytech.xyz): " DOMAIN
    read -rp "  App port (default 5000): " APP_PORT
    APP_PORT="${APP_PORT:-5000}"
    read -rp "  MongoDB URI: " MONGODB_URI
    read -rp "  JWT Secret (random string): " JWT_SECRET
    read -rp "  Admin username: " ADMIN_USERNAME
    read -rsp "  Admin password: " ADMIN_PASSWORD; echo ""
    read -rp "  Resend API key (re_...): " RESEND_API_KEY
    read -rp "  Payflow API key (optional, press Enter to skip): " PAYFLOW_API_KEY
    read -rp "  Payflow API secret (optional): " PAYFLOW_API_SECRET
    read -rp "  Payflow account ID (optional): " PAYFLOW_ACCOUNT_ID
    read -rp "  GitHub token (optional, for private bot repos): " GITHUB_TOKEN
fi

APP_URL="https://$DOMAIN"

echo ""
log "Domain:      $DOMAIN"
log "App port:    $APP_PORT"
log "Install dir: $INSTALL_DIR"
log "App URL:     $APP_URL"
echo ""

# ── System update ─────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -y && apt-get upgrade -y -qq
ok "System updated."

# ── Install Git ───────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    log "Installing git..."
    apt-get install -y git
fi
ok "Git: $(git --version)"

# ── Install Node.js via NodeSource ────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].replace("v",""))')" -lt "$NODE_VERSION" ]]; then
    log "Installing Node.js $NODE_VERSION..."
    apt-get install -y curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
ok "Node.js: $(node -v)  |  npm: $(npm -v)"

# ── Install PM2 ───────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    log "Installing PM2..."
    npm install -g pm2 --quiet
fi
ok "PM2: $(pm2 -v)"

# ── Install Nginx ─────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    log "Installing Nginx..."
    apt-get install -y nginx
fi
ok "Nginx: $(nginx -v 2>&1)"

# ── Install Certbot ───────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi
ok "Certbot installed."

# ── Clone / update repository ─────────────────────────────────────
log "Setting up application in $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/.git" ]; then
    log "Repository already exists — pulling latest changes..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    mkdir -p "$INSTALL_DIR"
    if [ -n "$GITHUB_TOKEN" ]; then
        CLONE_URL="https://${GITHUB_TOKEN}@github.com/mzeeemzimanjejeje/truth-md-host-platform.git"
    else
        CLONE_URL="$REPO_URL"
    fi
    git clone --depth 1 "$CLONE_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
ok "Code ready."

# ── Create required directories ───────────────────────────────────
mkdir -p "$INSTALL_DIR/bots"
ok "Bots directory ready."

# ── Write .env ────────────────────────────────────────────────────
log "Writing .env..."
cat > "$INSTALL_DIR/.env" <<EOF
# TRUTH MD Host Platform — generated by setup.sh

# ── Database ──────────────────────────────────────────────────────
MONGODB_URI=${MONGODB_URI}

# ── Auth ──────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Admin account ─────────────────────────────────────────────────
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ── Server ────────────────────────────────────────────────────────
PORT=${APP_PORT}
NODE_ENV=production

# ── Public URL (used for M-Pesa callbacks) ────────────────────────
APP_URL=${APP_URL}

# ── Email — Resend ────────────────────────────────────────────────
RESEND_API_KEY=${RESEND_API_KEY}

# ── GitHub (for cloning private bot repos) ────────────────────────
GITHUB_TOKEN=${GITHUB_TOKEN}

# ── Payflow / M-Pesa ─────────────────────────────────────────────
PAYFLOW_API_KEY=${PAYFLOW_API_KEY}
PAYFLOW_API_SECRET=${PAYFLOW_API_SECRET}
PAYFLOW_ACCOUNT_ID=${PAYFLOW_ACCOUNT_ID}
EOF
ok ".env written."

# ── Install npm dependencies ──────────────────────────────────────
log "Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --production --silent
ok "Dependencies installed."

# ── Write Nginx config ────────────────────────────────────────────
log "Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Increase upload size for bot file deployments
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
EOF

# Remove default site if enabled
rm -f /etc/nginx/sites-enabled/default

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
ok "Nginx configured for $DOMAIN."

# ── SSL Certificate ───────────────────────────────────────────────
log "Requesting SSL certificate for $DOMAIN..."
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@courtneytech.xyz" --redirect; then
    ok "SSL certificate installed. Site is HTTPS."
else
    warn "SSL skipped — your DNS A record may not be pointing to this server yet."
    warn "Once DNS is set, run:  certbot --nginx -d $DOMAIN"
fi

# ── Write PM2 ecosystem file ──────────────────────────────────────
log "Writing PM2 ecosystem config..."
cat > "$INSTALL_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'truth-host-platform',
      script: 'index.js',
      cwd: '${INSTALL_DIR}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '${INSTALL_DIR}/.env',
      env: {
        NODE_ENV: 'production',
        PORT: ${APP_PORT}
      }
    }
  ]
};
EOF
ok "PM2 ecosystem config written."

# ── Start / restart with PM2 ──────────────────────────────────────
log "Starting application with PM2..."
cd "$INSTALL_DIR"

# Stop existing instance if running
pm2 delete truth-host-platform 2>/dev/null || true

pm2 start ecosystem.config.js
pm2 save

# Enable PM2 startup on reboot
log "Enabling PM2 startup on reboot..."
PM2_STARTUP=$(pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo" | tail -1)
if [ -n "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP" || true
fi
pm2 save
ok "PM2 startup enabled."

# ── Auto-renew SSL via cron ───────────────────────────────────────
log "Setting up SSL auto-renewal..."
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
ok "SSL auto-renewal scheduled (daily at 3am)."

# ── Final status ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Platform URL: ${CYAN}${APP_URL}${NC}"
echo -e "  Admin login:  ${CYAN}${ADMIN_USERNAME}${NC}"
echo -e "  Install dir:  ${CYAN}${INSTALL_DIR}${NC}"
echo ""
echo -e "  Useful commands:"
echo -e "  ${YELLOW}pm2 status${NC}                    — check app status"
echo -e "  ${YELLOW}pm2 logs truth-host-platform${NC}  — view live logs"
echo -e "  ${YELLOW}pm2 restart truth-host-platform${NC}— restart app"
echo ""
echo -e "  To update to latest code:"
echo -e "  ${YELLOW}cd ${INSTALL_DIR} && git pull && npm install --production && pm2 restart truth-host-platform${NC}"
echo ""
pm2 status
