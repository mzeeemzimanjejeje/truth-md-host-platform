# TRUTH MD Host Platform — VPS Deployment Guide

## What you need before starting

| Requirement | Details |
|---|---|
| A VPS | Ubuntu 20.04+ recommended (1 GB RAM minimum, 2 GB+ for hosting bots) |
| A domain/subdomain | Must have an A record pointing to your VPS IP |
| MongoDB | Atlas free tier works, or a self-hosted instance |
| Node.js 18+ | Installed on the VPS |
| PM2 | `npm install -g pm2` |
| Git | `apt install git` |

---

## Step 1 — Upload the code

```bash
# On your VPS:
mkdir -p /var/www/truth-host
cd /var/www/truth-host

# Option A: Clone from GitHub
git clone https://github.com/YOUR_USER/YOUR_REPO .

# Option B: Upload the zip and extract
unzip truth-host.zip -d /var/www/truth-host
```

## Step 2 — Configure environment variables

```bash
cp .env.example .env
nano .env
```

Fill in **every value**:

| Variable | What it is |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string |
| `JWT_SECRET` | Any long random string (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` | Your admin login name |
| `ADMIN_PASSWORD` | Your admin login password |
| `PORT` | Port the Node.js app listens on (default `5000`) |
| `APP_URL` | **Your public domain** e.g. `https://mybot.example.com` — needed for M-Pesa callbacks |
| `GITHUB_TOKEN` | GitHub Personal Access Token — only needed to clone **private** bot repos |
| `EMAIL_USER` | Gmail address for purchase receipts (optional) |
| `EMAIL_PASSWORD` | Gmail App Password (not your real password — [generate here](https://myaccount.google.com/apppasswords)) |
| `PAYFLOW_API_KEY` | Payflow key for M-Pesa payments (optional) |
| `PAYFLOW_API_SECRET` | Payflow secret (optional) |
| `PAYFLOW_ACCOUNT_ID` | Payflow account ID (optional) |

## Step 3 — Install dependencies

```bash
cd /var/www/truth-host
npm install --production
```

## Step 4 — Set up Nginx + SSL

```bash
# Run the setup script — pass your domain and the app port
bash vps-deploy/setup.sh mybot.example.com 5000
```

This will:
- Install Nginx and Certbot if missing
- Configure Nginx to proxy your domain → Node.js app
- Obtain a free SSL certificate via Let's Encrypt

> **DNS must already point to your VPS IP** before running certbot.

## Step 5 — Start with PM2

```bash
cd /var/www/truth-host
pm2 start vps-deploy/ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

Check it's running:
```bash
pm2 status
pm2 logs truth-host-platform
```

## Step 6 — Verify

Open `https://your-domain.com` in a browser. You should see the login page.

Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set in `.env`.

---

## Bot hosting — what users need to provide

When deploying a bot from the dashboard, users need:

| Field | Description |
|---|---|
| **Service name** | A unique name for this bot instance |
| **Session ID** | The bot's `SESSION_ID` env var |
| **Owner number** | WhatsApp owner number (with country code, no `+`) |
| **GitHub repo URL** | Public (or private with `GITHUB_TOKEN`) repo containing the bot code |

The platform will clone the repo, install its npm dependencies, write a `.env`, and start it automatically.

### Supported bot frameworks
- Baileys (`@whiskeysockets/baileys`, `@adiwajshing/baileys`)
- WWebJS (`whatsapp-web.js`)
- Venom Bot (`venom-bot`)
- Open-WA (`@open-wa/wa-automate`)
- Any other Node.js bot (detected by `package.json` `main` or `scripts.start`)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| App won't start | Check `pm2 logs truth-host-platform` — usually a bad `.env` value |
| Can't connect to MongoDB | Verify `MONGODB_URI` and whitelist VPS IP in Atlas Network Access |
| M-Pesa callbacks not working | Make sure `APP_URL` in `.env` is your **public HTTPS** domain |
| Bot clone fails | Check `GITHUB_TOKEN` is set for private repos; ensure VPS has internet access |
| Bot exits immediately | Check bot logs in the dashboard — usually a missing env var in the bot itself |
| SSL cert fails | Ensure DNS A record is pointing to VPS IP, wait for propagation, then rerun `certbot` |
