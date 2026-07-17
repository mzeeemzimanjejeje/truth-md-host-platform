const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL client error:', err.message);
});

// ── Create tables if they don't exist ────────────────────────────
async function initSchema() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username            VARCHAR(64)   UNIQUE NOT NULL,
                email               VARCHAR(255)  UNIQUE,
                is_email_verified   BOOLEAN       DEFAULT false,
                email_otp           VARCHAR(10),
                email_otp_expiry    TIMESTAMPTZ,
                password            VARCHAR(255)  NOT NULL,
                role                VARCHAR(10)   DEFAULT 'user'
                                        CHECK (role IN ('user','admin')),
                wallet_coins        INTEGER       DEFAULT 10,
                wallet_last_claim   TIMESTAMPTZ,
                wallet_transactions JSONB         DEFAULT '[]',
                referrals           JSONB         DEFAULT '[]',
                referred_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
                created_at          TIMESTAMPTZ   DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS deployments (
                id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                branch_name        VARCHAR(128) UNIQUE NOT NULL,
                session_id         VARCHAR(255) NOT NULL,
                owner_number       VARCHAR(64)  NOT NULL,
                prefix             VARCHAR(10)  DEFAULT '.',
                status             VARCHAR(16)  DEFAULT 'pending'
                                        CHECK (status IN ('active','inactive','pending')),
                repo_url           TEXT,
                detected_framework VARCHAR(64)  DEFAULT 'Node.js Bot',
                entry_point        VARCHAR(128) DEFAULT 'index.js',
                last_active        TIMESTAMPTZ,
                logs               JSONB        DEFAULT '[]',
                created_at         TIMESTAMPTZ  DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS purchases (
                id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id              UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                package_name         VARCHAR(128)  NOT NULL,
                coins                INTEGER       NOT NULL,
                price                NUMERIC(10,2) NOT NULL,
                phone                VARCHAR(32)   NOT NULL,
                checkout_request_id  VARCHAR(255),
                merchant_request_id  VARCHAR(255),
                mpesa_receipt_number VARCHAR(64),
                status               VARCHAR(16)   DEFAULT 'pending'
                                        CHECK (status IN ('pending','completed','failed','cancelled')),
                result_desc          TEXT,
                created_at           TIMESTAMPTZ   DEFAULT NOW(),
                completed_at         TIMESTAMPTZ
            );
        `);
        console.log('Neon database schema ready.');
    } finally {
        client.release();
    }
}

module.exports = { pool, initSchema };
