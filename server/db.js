const mariadb = require('mariadb');
require('dotenv').config();

const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diabetes_tracking',
    connectionLimit: 10,
    charset: 'utf8mb4'
};
if (process.env.DB_SOCKET) {
    poolConfig.socketPath = process.env.DB_SOCKET;
}
const pool = mariadb.createPool(poolConfig);

async function query(sql, params) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(sql, params);
        return rows;
    } finally {
        if (conn) conn.release();
    }
}

async function testConnection() {
    try {
        const conn = await pool.getConnection();
        console.log('MariaDB connected successfully');
        conn.release();
        return true;
    } catch (err) {
        console.warn('MariaDB connection failed:', err.message);
        console.warn('App will run in demo mode (localStorage fallback)');
        return false;
    }
}

module.exports = { pool, query, testConnection };
