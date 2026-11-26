const cron = require('node-cron');
const { pool } = require('./db');
const { validateReadOnlySQL } = require('./sqlValidator');

const OPERATORS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '=': (a, b) => a === b,
};

/**
 * Evalúa una condición de alerta SQL contra la base de datos y registra el resultado.
 * @param {object} alert
 * @returns {Promise<{ disparada: boolean, valorObtenido: number, mensaje: string }>}
 */
async function evaluateAlert(alert) {
  const validation = validateReadOnlySQL(alert.sql_condicion);
  if (!validation.valid) {
    const mensaje = `SQL inválido en alerta: ${validation.error}`;
    await pool.query(
      'INSERT INTO alerta_historial (alerta_id, valor_obtenido, disparada, mensaje) VALUES ($1, NULL, FALSE, $2)',
      [alert.id, mensaje]
    );
    return { disparada: false, valorObtenido: null, mensaje };
  }

  const result = await pool.query(alert.sql_condicion);
  const firstRow = result.rows[0] || {};
  const firstKey = Object.keys(firstRow)[0];
  const valorObtenido = Number(firstRow[firstKey] ?? 0);
  const umbral = Number(alert.umbral);
  const comparator = OPERATORS[alert.operador] || OPERATORS['>'];
  const disparada = comparator(valorObtenido, umbral);

  const mensaje = disparada
    ? `ALERTA DISPARADA: valor=${valorObtenido} ${alert.operador} umbral=${umbral}`
    : `Normal: valor=${valorObtenido} (umbral ${alert.operador} ${umbral})`;

  await pool.query(
    'UPDATE alertas_sql SET ultimo_valor = $1, ultimo_disparo = CASE WHEN $2 THEN NOW() ELSE ultimo_disparo END WHERE id = $3',
    [valorObtenido, disparada, alert.id]
  );

  await pool.query(
    'INSERT INTO alerta_historial (alerta_id, valor_obtenido, disparada, mensaje) VALUES ($1, $2, $3, $4)',
    [alert.id, valorObtenido, disparada, mensaje]
  );

  return { disparada, valorObtenido, mensaje };
}

/**
 * Ejecuta todas las alertas activas.
 */
async function runActiveAlerts() {
  const { rows: alerts } = await pool.query('SELECT * FROM alertas_sql WHERE activa = TRUE');
  const results = [];
  for (const alert of alerts) {
    try {
      const res = await evaluateAlert(alert);
      results.push({ id: alert.id, nombre: alert.nombre, ...res });
    } catch (err) {
      results.push({ id: alert.id, nombre: alert.nombre, error: err.message });
    }
  }
  return results;
}

function startAlertScheduler() {
  return cron.schedule('*/5 * * * *', async () => {
    try {
      await runActiveAlerts();
    } catch (err) {
      console.error('Error en scheduler de alertas:', err.message);
    }
  });
}

module.exports = {
  evaluateAlert,
  runActiveAlerts,
  startAlertScheduler,
  OPERATORS,
};
