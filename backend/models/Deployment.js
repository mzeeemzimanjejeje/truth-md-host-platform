const { pool } = require('../config/db');

function mapRow(row) {
    if (!row) return null;
    return {
        id:                row.id,
        _id:               row.id,
        user:              row.user_id,
        userId:            row.user_id,
        branchName:        row.branch_name,
        sessionId:         row.session_id,
        ownerNumber:       row.owner_number,
        prefix:            row.prefix,
        status:            row.status,
        repoUrl:           row.repo_url,
        detectedFramework: row.detected_framework,
        entryPoint:        row.entry_point,
        lastActive:        row.last_active,
        startedAt:         row.started_at,
        logs:              row.logs || [],
        createdAt:         row.created_at,
        // username populated via join
        username:          row.username || null
    };
}

const Deployment = {
    // ── Find ─────────────────────────────────────────────────────
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM deployments WHERE id=$1', [id]);
        return mapRow(rows[0]);
    },
    async findOne(filter) {
        const conditions = [];
        const values = [];
        let i = 1;
        const colMap = {
            _id: 'id', id: 'id',
            user: 'user_id', user_id: 'user_id',
            branchName: 'branch_name',
            status: 'status',
            repoUrl: 'repo_url'
        };
        for (const [k, v] of Object.entries(filter)) {
            const col = colMap[k] || k;
            if (v && typeof v === 'object' && v.$exists !== undefined) {
                conditions.push(v.$exists ? `${col} IS NOT NULL` : `${col} IS NULL`);
                if (v.$ne !== undefined) { /* handled below */ }
            } else if (v && typeof v === 'object' && v.$ne !== undefined) {
                conditions.push(`${col} != $${i++}`);
                values.push(v.$ne);
                if (v.$exists !== undefined) {
                    conditions.push(v.$exists ? `${col} IS NOT NULL` : `${col} IS NULL`);
                }
            } else {
                conditions.push(`${col}=$${i++}`);
                values.push(v);
            }
        }
        if (conditions.length === 0) return null;
        const { rows } = await pool.query(
            `SELECT * FROM deployments WHERE ${conditions.join(' AND ')} LIMIT 1`,
            values
        );
        return mapRow(rows[0]);
    },
    async find(filter = {}) {
        if (Object.keys(filter).length === 0) {
            // Admin: join with users for username
            const { rows } = await pool.query(
                `SELECT d.*, u.username FROM deployments d
                 JOIN users u ON u.id=d.user_id
                 ORDER BY d.created_at DESC`
            );
            return rows.map(mapRow);
        }
        const conditions = [];
        const values = [];
        let i = 1;
        if (filter.user) { conditions.push(`user_id=$${i++}`); values.push(filter.user); }
        if (filter.status) { conditions.push(`status=$${i++}`); values.push(filter.status); }
        if (filter.repoUrl?.$exists !== undefined && filter.repoUrl?.$ne !== undefined) {
            conditions.push(`repo_url IS NOT NULL AND repo_url != $${i++}`);
            values.push(filter.repoUrl.$ne);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pool.query(
            `SELECT * FROM deployments ${where} ORDER BY created_at DESC`,
            values
        );
        return rows.map(mapRow);
    },
    async countDocuments(filter = {}) {
        if (Object.keys(filter).length === 0) {
            const { rows } = await pool.query('SELECT COUNT(*) FROM deployments');
            return parseInt(rows[0].count);
        }
        const conditions = [];
        const values = [];
        let i = 1;
        if (filter.user) { conditions.push(`user_id=$${i++}`); values.push(filter.user); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pool.query(`SELECT COUNT(*) FROM deployments ${where}`, values);
        return parseInt(rows[0].count);
    },

    // ── Create ────────────────────────────────────────────────────
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO deployments
             (user_id, branch_name, session_id, owner_number, prefix,
              status, repo_url, detected_framework, entry_point, logs)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
            [
                data.user,
                data.branchName,
                data.sessionId,
                data.ownerNumber,
                data.prefix         || '.',
                data.status         || 'pending',
                data.repoUrl        || null,
                data.detectedFramework || 'Node.js Bot',
                data.entryPoint     || 'index.js',
                JSON.stringify(data.logs || [])
            ]
        );
        return mapRow(rows[0]);
    },

    // ── Save (full update) ────────────────────────────────────────
    async save(dep) {
        const { rows } = await pool.query(
            `UPDATE deployments SET
                status=$1, repo_url=$2, detected_framework=$3,
                entry_point=$4, last_active=$5, started_at=$6, logs=$7
             WHERE id=$8 RETURNING *`,
            [
                dep.status,
                dep.repoUrl           || null,
                dep.detectedFramework || 'Node.js Bot',
                dep.entryPoint        || 'index.js',
                dep.lastActive        || null,
                dep.startedAt         || null,
                JSON.stringify(dep.logs || []),
                dep.id
            ]
        );
        return mapRow(rows[0]);
    },

    // ── Update helpers ────────────────────────────────────────────
    async updateOne(filter, update) {
        const dep = await Deployment.findOne(filter) || await Deployment.findById(filter._id || filter.id);
        if (!dep) return;
        const set = update.$set || {};
        for (const [path, val] of Object.entries(set)) {
            const col = path.replace(/([A-Z])/g, '_$1').toLowerCase();
            await pool.query(`UPDATE deployments SET ${col}=$1 WHERE id=$2`, [val, dep.id]);
        }
    },
    async deleteOne(dep) {
        await pool.query('DELETE FROM deployments WHERE id=$1', [dep.id]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM deployments WHERE id=$1', [id]);
    },
    async deleteMany(filter) {
        if (filter.user) {
            await pool.query('DELETE FROM deployments WHERE user_id=$1', [filter.user]);
        }
    },

    // ── Log helpers ───────────────────────────────────────────────
    async pushLog(id, message, level = 'info') {
        const entry = { message, level, timestamp: new Date() };
        await pool.query(
            `UPDATE deployments
             SET logs = (to_jsonb($1::jsonb) || logs)[0:100]
             WHERE id=$2`,
            [JSON.stringify([entry]), id]
        );
        return entry;
    }
};

module.exports = Deployment;
