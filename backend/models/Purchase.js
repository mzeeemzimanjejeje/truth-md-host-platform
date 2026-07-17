const { pool } = require('../config/db');

function mapRow(row) {
    if (!row) return null;
    return {
        id:                  row.id,
        _id:                 row.id,
        user:                row.user_id,
        packageName:         row.package_name,
        coins:               row.coins,
        price:               parseFloat(row.price),
        phone:               row.phone,
        checkoutRequestId:   row.checkout_request_id,
        merchantRequestId:   row.merchant_request_id,
        mpesaReceiptNumber:  row.mpesa_receipt_number,
        status:              row.status,
        resultDesc:          row.result_desc,
        createdAt:           row.created_at,
        completedAt:         row.completed_at,
        // populated via join
        username:            row.username || null,
        email:               row.email    || null
    };
}

const Purchase = {
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM purchases WHERE id=$1', [id]);
        return mapRow(rows[0]);
    },
    async findOne(filter) {
        const conditions = [];
        const values = [];
        let i = 1;
        const colMap = {
            checkoutRequestId: 'checkout_request_id',
            user: 'user_id',
            status: 'status',
            _id: 'id', id: 'id'
        };
        for (const [k, v] of Object.entries(filter)) {
            const col = colMap[k] || k;
            conditions.push(`${col}=$${i++}`);
            values.push(v);
        }
        const { rows } = await pool.query(
            `SELECT * FROM purchases WHERE ${conditions.join(' AND ')} LIMIT 1`,
            values
        );
        return mapRow(rows[0]);
    },
    async find(filter = {}) {
        if (Object.keys(filter).length === 0) {
            // Admin: join with users
            const { rows } = await pool.query(
                `SELECT p.*, u.username, u.email FROM purchases p
                 JOIN users u ON u.id=p.user_id
                 ORDER BY p.created_at DESC LIMIT 100`
            );
            return rows.map(mapRow);
        }
        const conditions = [];
        const values = [];
        let i = 1;
        if (filter.user)   { conditions.push(`user_id=$${i++}`); values.push(filter.user); }
        if (filter.status) { conditions.push(`status=$${i++}`);  values.push(filter.status); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pool.query(
            `SELECT * FROM purchases ${where} ORDER BY created_at DESC`,
            values
        );
        return rows.map(mapRow);
    },
    async countDocuments(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;
        if (filter.status) { conditions.push(`status=$${i++}`); values.push(filter.status); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pool.query(`SELECT COUNT(*) FROM purchases ${where}`, values);
        return parseInt(rows[0].count);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO purchases
             (user_id, package_name, coins, price, phone,
              checkout_request_id, merchant_request_id, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
                data.user,
                data.packageName,
                data.coins,
                data.price,
                data.phone,
                data.checkoutRequestId  || null,
                data.merchantRequestId  || null,
                data.status             || 'pending'
            ]
        );
        return mapRow(rows[0]);
    },
    async save(p) {
        const { rows } = await pool.query(
            `UPDATE purchases SET
                status=$1, mpesa_receipt_number=$2,
                completed_at=$3, result_desc=$4
             WHERE id=$5 RETURNING *`,
            [p.status, p.mpesaReceiptNumber || null, p.completedAt || null, p.resultDesc || null, p.id]
        );
        return mapRow(rows[0]);
    }
};

module.exports = Purchase;
