/**
 * Neon PostgreSQL client — uses Neon's native HTTP API (/sql/v1)
 * via Node.js 18+ built-in fetch. No npm driver needed.
 */

// Parse postgres://user:pass@host/dbname
function parseUrl(url) {
    const u = new URL(url);
    return {
        host:     u.hostname,
        user:     decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, '')
    };
}

function buildPool(connectionString) {
    const { host, password } = parseUrl(connectionString);
    const endpoint = `https://${host}/sql/v1`;

    async function query(sql, params = []) {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type':          'application/json',
                'Authorization':         `Bearer ${password}`,
                'Neon-Connection-String': connectionString
            },
            body: JSON.stringify({ query: sql, params })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Neon query error (${res.status}): ${text}`);
        }

        const data = await res.json();

        // Neon returns { rows, rowCount, fields, command }
        // Rows from HTTP API come as arrays — convert to objects using fields
        let rows = data.rows || [];
        if (Array.isArray(data.fields) && rows.length && Array.isArray(rows[0])) {
            const names = data.fields.map(f => f.name);
            rows = rows.map(row =>
                Object.fromEntries(names.map((name, i) => [name, row[i]]))
            );
        }

        return { rows, rowCount: data.rowCount ?? rows.length };
    }

    return { query };
}

const pool = buildPool(process.env.DATABASE_URL);

// ── Create tables if they don't exist ────────────────────────────
async function initSchema() {
    const queries = [
        `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

        `CREATE TABLE IF NOT EXISTS users (
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
        )`,

        `CREATE TABLE IF NOT EXISTS deployments (
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
        )`,

        `CREATE TABLE IF NOT EXISTS purchases (
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
        )`
    ];

    for (const sql of queries) {
        await pool.query(sql);
    }
    console.log('Neon database schema ready.');
}

module.exports = { pool, initSchema };
