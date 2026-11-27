const { Parser } = require('node-sql-parser');

const parser = new Parser();

const FORBIDDEN_AST_TYPES = new Set([
  'drop',
  'delete',
  'update',
  'insert',
  'alter',
  'truncate',
  'create',
  'grant',
  'revoke',
  'execute',
  'replace',
  'call',
  'lock',
  'unlock',
  'rename',
  'set',
]);

/**
 * Recorre el AST buscando sentencias anidadas (p. ej. CTEs con DELETE/INSERT/UPDATE).
 * @param {any} node
 * @returns {string|null}
 */
function findForbiddenAstNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findForbiddenAstNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node.type === 'string' && FORBIDDEN_AST_TYPES.has(node.type.toLowerCase())) {
    return node.type.toLowerCase();
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') {
      const found = findForbiddenAstNode(val);
      if (found) return found;
    }
  }
  return null;
}

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
        error: `Operación bloqueada: solo se permiten consultas de lectura (SELECT). Sentencia "${stmt?.type || 'desconocida'}" no permitida.`,
      };
    }

    const forbiddenNested = findForbiddenAstNode(stmt.with);
    if (forbiddenNested) {
      return {
        valid: false,
        error: `Operación bloqueada: solo se permiten consultas de lectura (SELECT). Sentencia "${forbiddenNested}" no permitida en CTE.`,
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
 * Si un parámetro está sin comillas alrededor, solo admite números o identificadores simples.
 * @param {string} template
 * @param {Record<string, string|number>} params
 * @returns {string}
 */
function renderSqlTemplate(template, params = {}) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key, offset, fullStr) => {
    if (params[key] === undefined || params[key] === null) {
      return '';
    }
    const raw = String(params[key]);
    const before = fullStr.slice(0, offset);
    const quoteCount = (before.match(/'/g) || []).length;
    const insideSingleQuotes = quoteCount % 2 === 1;

    if (insideSingleQuotes) {
      return raw.replace(/'/g, "''");
    }
    // Fuera de comillas: restringir a número válido o identificador simple para evitar inyección
    if (/^-?\d+(\.\d+)?$/.test(raw.trim())) {
      return raw.trim();
    }
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw.trim())) {
      return raw.trim();
    }
    return `'${raw.replace(/'/g, "''")}'`;
  });
}

module.exports = {
  validateReadOnlySQL,
  renderSqlTemplate,
};
