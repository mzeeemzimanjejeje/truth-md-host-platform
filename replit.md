# TRUTH MD Host Platform

WhatsApp Bot Hosting Platform — lets users deploy, manage, and monitor WhatsApp bots via a web dashboard. Built with Node.js/Express, MongoDB, and a static HTML/CSS/JS frontend.

## Stack

- **Backend**: Node.js + Express (`backend/server.js`, entry via `index.js`)
- **Database**: MongoDB via Mongoose (`backend/config/db.js`)
- **Frontend**: Static HTML/CSS/JS in `frontend/public/`
- **Bot management**: Custom process manager using `child_process.spawn` (`backend/services/botManager.js`)
- **Payments**: Payflow M-Pesa integration (`backend/services/mpesa.js`, `backend/routes/wallet.js`)
- **Email**: Nodemailer for purchase receipts (`backend/services/email.js`)

## Project structure

```
index.js                  # Entry point — requires backend/server.js
backend/
  server.js               # Express app, MongoDB connect, graceful shutdown
  routes/                 # auth, deployments, wallet, admin
  models/                 # User, Deployment, Purchase
  services/               # botManager, mpesa, email
  middleware/             # JWT auth
frontend/public/          # index.html, dashboard.html, login.html, signup.html + CSS/JS
bots/                     # Bot files cloned from GitHub are stored here (auto-created)
vps-deploy/               # Nginx config, PM2 ecosystem, setup script for VPS
DEPLOY.md                 # Full VPS deployment guide
.env.example              # Template for all required env vars
```

## Running locally on Replit

1. Configure the workflow to run `node index.js` on port 5000
2. The `.env` file is already present with a MongoDB Atlas URI
3. All frontend calls use relative URLs — no hardcoding needed

## VPS deployment

See `DEPLOY.md` for the complete step-by-step guide.

Quick summary:
```bash
# 1. Upload code to /var/www/truth-host
# 2. Copy and fill in environment variables
cp .env.example .env && nano .env

# 3. Install dependencies
npm install --production

# 4. Set up Nginx + SSL (pass your domain and app port)
bash vps-deploy/setup.sh your-domain.com 5000

# 5. Start with PM2
pm2 start vps-deploy/ecosystem.config.js
pm2 save && pm2 startup
```

## Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | Database connection |
| `JWT_SECRET` | ✅ | Token signing |
| `ADMIN_USERNAME` | ✅ | Admin login |
| `ADMIN_PASSWORD` | ✅ | Admin login |
| `PORT` | ✅ | Server port (default 5000) |
| `APP_URL` | ✅ | Public HTTPS URL — used for M-Pesa callbacks |
| `GITHUB_TOKEN` | optional | Clone private bot repos |
| `RESEND_API_KEY` | optional | Resend API key for OTP and purchase receipt emails |
| `PAYFLOW_API_KEY` | optional | M-Pesa coin purchases |
| `PAYFLOW_API_SECRET` | optional | M-Pesa coin purchases |
| `PAYFLOW_ACCOUNT_ID` | optional | M-Pesa coin purchases |

## User preferences

- Keep existing project structure and stack — no migrations or restructuring
