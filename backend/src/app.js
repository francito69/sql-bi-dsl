const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool, executeReadOnlyQuery } = require('./db');
const { validateReadOnlySQL, renderSqlTemplate } = require('./sqlValidator');
const { evaluateAlert, OPERATORS } = require('./alertEngine');

const app = express();
app.use(cors());
app.use(express.json());

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: '.SQL-BI', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message });
  }
});

// 1. Esquema desde information_schema para autocompletado en Monaco
app.get('/api/schema', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    const schema = {};
    for (const row of rows) {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push({ name: row.column_name, type: row.data_type });
    }
    res.json({ schema });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Validación de SQL en tiempo real
app.post('/api/query/validate', (req, res) => {
  const { sql, params } = req.body || {};
  const rendered = params ? renderSqlTemplate(sql || '', params) : sql;
  const result = validateReadOnlySQL(rendered);
  res.json(result);
});

// 3. Ejecución de consultas SQL (solo lectura)
app.post('/api/query/execute', async (req, res) => {
  const { sql, params } = req.body || {};
  const rendered = params ? renderSqlTemplate(sql || '', params) : sql;
  const validation = validateReadOnlySQL(rendered);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const start = Date.now();
  try {
    const result = await executeReadOnlyQuery(rendered);
    const executionTimeMs = Date.now() - start;
    const columns = result.fields.map((f) => f.name);
    res.json({
      columns,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTimeMs,
    });
  } catch (err) {
    res.status(400).json({ error: `Error al ejecutar SQL: ${err.message}` });
  }
});

// 4. Biblioteca de templates parametrizables
app.get('/api/templates', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sql_templates ORDER BY id ASC');
    res.json({ templates: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', async (req, res) => {
  const { nombre, descripcion, sql_template, parametros_json } = req.body || {};
  if (!nombre || !sql_template) {
    return res.status(400).json({ error: 'nombre y sql_template son obligatorios.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO sql_templates (nombre, descripcion, sql_template, parametros_json) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, descripcion || '', sql_template, JSON.stringify(parametros_json || [])]
    );
    res.status(201).json({ template: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Versionado de consultas (guardar revisión, listar, rollback)
app.get('/api/queries', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cg.*, cv.sql_texto
      FROM consultas_guardadas cg
      LEFT JOIN consulta_versiones cv
        ON cv.consulta_id = cg.id AND cv.version = cg.version_actual
      ORDER BY cg.id DESC;
    `);
    res.json({ queries: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queries', async (req, res) => {
  const { nombre, descripcion, sql_texto, comentario } = req.body || {};
  const validation = validateReadOnlySQL(sql_texto);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const cleanName = typeof nombre === 'string' ? nombre.trim() : '';
  if (!cleanName) {
    return res.status(400).json({ error: 'El nombre de la consulta es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM consultas_guardadas WHERE nombre = $1 FOR UPDATE', [cleanName]);
    if (existing.rows.length === 0) {
      const created = await client.query(
        'INSERT INTO consultas_guardadas (nombre, descripcion, version_actual) VALUES ($1, $2, 1) RETURNING *',
        [cleanName, descripcion || '']
      );
      const queryId = created.rows[0].id;
      await client.query(
        'INSERT INTO consulta_versiones (consulta_id, version, sql_texto, comentario) VALUES ($1, 1, $2, $3)',
        [queryId, sql_texto, comentario || 'Versión inicial']
      );
      await client.query('COMMIT');
      return res.status(201).json({ query: created.rows[0], version: 1 });
    }

    const queryRow = existing.rows[0];
    const maxRes = await client.query(
      'SELECT COALESCE(MAX(version), 0) AS max_version FROM consulta_versiones WHERE consulta_id = $1',
      [queryRow.id]
    );
    const nextVersion = Number(maxRes.rows[0].max_version) + 1;
    await client.query(
      'INSERT INTO consulta_versiones (consulta_id, version, sql_texto, comentario) VALUES ($1, $2, $3, $4)',
      [queryRow.id, nextVersion, sql_texto, comentario || `Revisión v${nextVersion}`]
    );
    const updated = await client.query(
      'UPDATE consultas_guardadas SET version_actual = $1 WHERE id = $2 RETURNING *',
      [nextVersion, queryRow.id]
    );
    await client.query('COMMIT');
    res.json({ query: updated.rows[0], version: nextVersion });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignorar error secundario en rollback
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/queries/:id/versions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM consulta_versiones WHERE consulta_id = $1 ORDER BY version DESC',
      [req.params.id]
    );
    res.json({ versions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queries/:id/rollback', async (req, res) => {
  const { version } = req.body || {};
  try {
    const target = await pool.query(
      'SELECT * FROM consulta_versiones WHERE consulta_id = $1 AND version = $2',
      [req.params.id, version]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Versión no encontrada.' });
    }
    const updated = await pool.query(
      'UPDATE consultas_guardadas SET version_actual = $1 WHERE id = $2 RETURNING *',
      [version, req.params.id]
    );
    res.json({ query: updated.rows[0], restoredSql: target.rows[0].sql_texto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Motor de Alertas SQL
app.get('/api/alerts', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alertas_sql ORDER BY id DESC');
    res.json({ alerts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts', async (req, res) => {
  const { nombre, sql_condicion, operador, umbral, intervalo_cron } = req.body || {};
  const cleanName = typeof nombre === 'string' ? nombre.trim() : '';
  if (!cleanName) {
    return res.status(400).json({ error: 'El nombre de la alerta es obligatorio.' });
  }
  const op = operador || '>';
  if (!Object.prototype.hasOwnProperty.call(OPERATORS, op)) {
    return res.status(400).json({ error: `Operador inválido: ${op}. Permitidos: ${Object.keys(OPERATORS).join(', ')}.` });
  }
  const numericThreshold = Number(umbral);
  if (umbral === undefined || umbral === null || umbral === '' || !Number.isFinite(numericThreshold)) {
    return res.status(400).json({ error: 'El umbral debe ser un número válido.' });
  }
  const validation = validateReadOnlySQL(sql_condicion);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO alertas_sql (nombre, sql_condicion, operador, umbral, intervalo_cron) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [cleanName, sql_condicion, op, numericThreshold, intervalo_cron || '*/5 * * * *']
    );
    res.status(201).json({ alert: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/alerts/:id/evaluate', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alertas_sql WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Alerta no encontrada.' });
    const result = await evaluateAlert(rows[0]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alerta_historial WHERE alerta_id = $1 ORDER BY ejecutado_en DESC LIMIT 20',
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app };
