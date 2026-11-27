const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'sql_bi_dsl',
      }
);

/**
 * Ejecuta una consulta SQL dentro de una transacción estrictamente READ ONLY
 * con límite de tiempo (statement_timeout) en PostgreSQL.
 * @param {string} sql
 * @param {number} [timeoutMs=5000]
 */
async function executeReadOnlyQuery(sql, timeoutMs = 5000) {
  const safeTimeout = Math.max(100, Math.trunc(Number(timeoutMs) || 5000));
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${safeTimeout}`);
    const result = await client.query(sql);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignorar error secundario en rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, executeReadOnlyQuery };
