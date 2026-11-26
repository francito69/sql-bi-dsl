const { Parser } = require('node-sql-parser');

const parser = new Parser();

const FORBIDDEN_KEYWORDS = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|COPY)\b/i;

/**
 * Valida una consulta SQL usando node-sql-parser (dialecto PostgreSQL)
 * y garantiza modo solo lectura obligatorio (solo sentencias SELECT).
 * @param {string} sql
 * @returns {{ valid: boolean, error?: string, ast?: any }}
 */
function validateReadOnlySQL(sql) {
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return { valid: false, error: 'La consulta SQL no puede estar vacía.' };
  }

  const trimmed = sql.trim();

  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    return {
      valid: false,
      error: 'Operación bloqueada: solo se permiten consultas de lectura (SELECT). Sentencias DROP/DELETE/UPDATE/INSERT están prohibidas.',
    };
  }

  try {
    const ast = parser.astify(trimmed, { database: 'PostgresQL' });
    const statements = Array.isArray(ast) ? ast : [ast];

    if (statements.length !== 1) {
      return {
        valid: false,
        error: 'Solo se permite ejecutar una sentencia SELECT a la vez.',
      };
    }

    const stmt = statements[0];
    if (!stmt || stmt.type !== 'select') {
      return {
        valid: false,
        error: `Sentencia "${stmt?.type || 'desconocida'}" no permitida. Modo solo lectura obligatorio.`,
      };
    }

    return { valid: true, ast: stmt };
  } catch (err) {
    return {
      valid: false,
      error: `Error de sintaxis SQL: ${err.message}`,
    };
  }
}

/**
 * Reemplaza variables tipo {{nombre_param}} en un template SQL
 * sanitizando comillas simples para evitar inyección.
 * @param {string} template
 * @param {Record<string, string|number>} params
 * @returns {string}
 */
function renderSqlTemplate(template, params = {}) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (params[key] === undefined || params[key] === null) {
      return '';
    }
    return String(params[key]).replace(/'/g, "''");
  });
}

module.exports = {
  validateReadOnlySQL,
  renderSqlTemplate,
};
