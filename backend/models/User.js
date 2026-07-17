const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// ── Helpers ───────────────────────────────────────────────────────
function mapRow(row) {
    if (!row) return null;
    return {
        id:               row.id,
        _id:              row.id,         // compat alias
        username:         row.username,
        email:            row.email,
        isEmailVerified:  row.is_email_verified,
        emailOTP:         row.email_otp,
        emailOTPExpiry:   row.email_otp_expiry,
        password:         row.password,
        role:             row.role,
        wallet: {
            coins:        row.wallet_coins,
            lastClaim:    row.wallet_last_claim,
            transactions: row.wallet_transactions || []
        },
        referrals:  row.referrals  || [],
        referredBy: row.referred_by,
        createdAt:  row.created_at,
        save:       () => User.updateRaw(row.id, row)
    };
}

const User = {
    // ── Find ─────────────────────────────────────────────────────
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
        return mapRow(rows[0]);
    },
    async findOne(filter) {
        const keys = Object.keys(filter);
        if (keys.length === 0) return null;

        const colMap = { username: 'username', email: 'email', role: 'role' };
        const conditions = [];
        const values = [];
        let i = 1;
        for (const [k, v] of Object.entries(filter)) {
            const col = colMap[k];
            if (!col) continue;
            conditions.push(`${col}=$${i++}`);
            values.push(v);
        }
        if (conditions.length === 0) return null;
        const { rows } = await pool.query(
            `SELECT * FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`,
            values
        );
        return mapRow(rows[0]);
    },
    async find(filter = {}) {
        const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return rows.map(mapRow);
    },
    async countDocuments() {
        const { rows } = await pool.query('SELECT COUNT(*) FROM users');
        return parseInt(rows[0].count);
    },

    // ── Create ────────────────────────────────────────────────────
    async create(data) {
        const hash = await bcrypt.hash(data.password, 10);
        const { rows } = await pool.query(
            `INSERT INTO users
             (username, email, is_email_verified, email_otp, email_otp_expiry,
              password, role, wallet_coins, referred_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [
                data.username,
                data.email   || null,
                data.isEmailVerified || false,
                data.emailOTP        || null,
                data.emailOTPExpiry  || null,
                hash,
                data.role            || 'user',
                data.wallet?.coins !== undefined ? data.wallet.coins : 10,
                data.referredBy      || null
            ]
        );
        return mapRow(rows[0]);
    },

    // ── Update ────────────────────────────────────────────────────
    async updateOne(filter, update) {
        const user = await User.findOne(filter) || await User.findById(filter._id || filter.id);
        if (!user) return;
        await User._applyUpdate(user.id, update);
    },
    async findByIdAndUpdate(id, update, opts = {}) {
        await User._applyUpdate(id, update);
        if (opts.new) return User.findById(id);
    },
    async _applyUpdate(id, update) {
        const inc  = update.$inc  || {};
        const set  = update.$set  || {};
        const push = update.$push || {};

        if (Object.keys(inc).length) {
            for (const [path, val] of Object.entries(inc)) {
                const col = _fieldToCol(path);
                await pool.query(`UPDATE users SET ${col}=COALESCE(${col},0)+$1 WHERE id=$2`, [val, id]);
            }
        }
        if (Object.keys(set).length) {
            for (const [path, val] of Object.entries(set)) {
                const col = _fieldToCol(path);
                await pool.query(`UPDATE users SET ${col}=$1 WHERE id=$2`, [val, id]);
            }
        }
        if (Object.keys(push).length) {
            for (const [path, pushVal] of Object.entries(push)) {
                if (path === 'wallet.transactions') {
                    const items = pushVal.$each || [pushVal];
                    const slice = pushVal.$slice || 50;
                    for (const item of items) {
                        await pool.query(
                            `UPDATE users
                             SET wallet_transactions = (
                                 (to_jsonb($1::jsonb) || wallet_transactions)
                             )[0:${slice}]
                             WHERE id=$2`,
                            [JSON.stringify([item]), id]
                        );
                    }
                }
                if (path === 'referrals') {
                    const item = pushVal.$each ? pushVal.$each[0] : pushVal;
                    await pool.query(
                        `UPDATE users SET referrals = referrals || to_jsonb($1::text) WHERE id=$2`,
                        [item, id]
                    );
                }
            }
        }
    },

    // ── Save (called on a mapped row object) ─────────────────────
    async save(user) {
        await pool.query(
            `UPDATE users SET
                username=$1, email=$2, is_email_verified=$3,
                email_otp=$4, email_otp_expiry=$5, password=$6,
                role=$7, wallet_coins=$8, wallet_last_claim=$9,
                wallet_transactions=$10, referrals=$11, referred_by=$12
             WHERE id=$13`,
            [
                user.username,
                user.email          || null,
                user.isEmailVerified,
                user.emailOTP       || null,
                user.emailOTPExpiry || null,
                user.password,
                user.role,
                user.wallet.coins,
                user.wallet.lastClaim || null,
                JSON.stringify(user.wallet.transactions || []),
                JSON.stringify(user.referrals || []),
                user.referredBy     || null,
                user.id
            ]
        );
    },

    // ── Delete ────────────────────────────────────────────────────
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM users WHERE id=$1', [id]);
    },

    // ── Password compare ──────────────────────────────────────────
    async comparePassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    }
};

function _fieldToCol(path) {
    const map = {
        'wallet.coins':     'wallet_coins',
        'wallet.lastClaim': 'wallet_last_claim',
        'wallet.transactions': 'wallet_transactions',
        'is_email_verified':'is_email_verified',
        'role':             'role'
    };
    return map[path] || path.replace(/\./g, '_');
}

module.exports = User;
